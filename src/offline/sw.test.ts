import { beforeEach, describe, expect, it } from 'vitest';
import { offlineLists } from '../../tools/service-worker.mjs';
import type { PushPayload } from '../../push/src/wire';
import SOURCE from './sw.js?raw';
import WIRE from './wire.json';

const SCOPE = 'https://atlas.test/';

interface Stored {
  buf: ArrayBuffer;
  status: number;
  headers: [string, string][];
}
const keyOf = (r: string | { url: string }) => (typeof r === 'string' ? r : r.url);

class FakeCache {
  m = new Map<string, Stored>();
  async match(r: string | { url: string }) {
    const v = this.m.get(keyOf(r));
    return v && new Response(v.buf.slice(0), { status: v.status, headers: v.headers });
  }
  async put(r: string | { url: string }, res: Response) {
    this.m.set(keyOf(r), { buf: await res.arrayBuffer(), status: res.status, headers: [...res.headers] });
  }
  async keys() {
    return [...this.m.keys()].map((url) => ({ url }));
  }
  async delete(r: string | { url: string }) {
    return this.m.delete(keyOf(r));
  }
}

class FakeCaches {
  m = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.m.has(name)) this.m.set(name, new FakeCache());
    return this.m.get(name)!;
  }
  async keys() {
    return [...this.m.keys()];
  }
  async delete(name: string) {
    return this.m.delete(name);
  }
}

type Handler = (e: unknown) => void;

/** IndexedDB as far as sw.js uses it: one object store per database, read by key. */
function fakeIndexedDB(data: Map<string, Map<string, Map<string, unknown>>>) {
  const later = (fn: () => void) => void Promise.resolve().then(fn);
  const db = (name: string) => ({
    createObjectStore: (store: string) => data.get(name)!.set(store, new Map()),
    transaction: (store: string) => ({
      objectStore: () => ({
        get(key: string) {
          const req: { result?: unknown; onsuccess?: () => void } = {};
          later(() => {
            req.result = data.get(name)?.get(store)?.get(key);
            req.onsuccess?.();
          });
          return req;
        },
      }),
    }),
  });
  return {
    open(name: string) {
      const req: { result?: ReturnType<typeof db>; onupgradeneeded?: () => void; onsuccess?: () => void } = {};
      later(() => {
        req.result = db(name);
        if (!data.has(name)) {
          data.set(name, new Map());
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
  };
}

/** A service worker global with an in-memory network and cache, running sw.js. */
function boot(offline: { version: string; files: string[]; audio: string[]; sizes?: Record<string, number> } | null) {
  const handlers = new Map<string, Handler>();
  const net = new Map<string, { body: string; type: string }>();
  const fetches: { url: string; range: string | null; cache?: string }[] = [];
  const env = { online: true };
  const fetch = async (input: string | FakeRequest, init?: { cache?: string }) => {
    const url = keyOf(input);
    const range = typeof input === 'string' ? null : input.headers.get('Range');
    fetches.push({ url, range, cache: init?.cache });
    if (!env.online) throw new TypeError('Failed to fetch');
    const hit = net.get(url);
    if (!hit) return new Response('missing', { status: 404 });
    const m = range && /^bytes=(\d+)-(\d*)$/.exec(range);
    if (m) {
      const end = m[2] ? Number(m[2]) : hit.body.length - 1;
      return new Response(hit.body.slice(Number(m[1]), end + 1), { status: 206, headers: { 'Content-Type': hit.type, 'Content-Range': `bytes ${m[1]}-${end}/${hit.body.length}` } });
    }
    return new Response(hit.body, { status: 200, headers: { 'Content-Type': hit.type } });
  };
  const caches = new FakeCaches();
  const idb = new Map<string, Map<string, Map<string, unknown>>>();
  const shown: { title: string; body: string }[] = [];
  const registration: { scope: string; installing?: object; waiting?: object; showNotification: (title: string, o: { body: string }) => Promise<void> } = {
    scope: SCOPE,
    showNotification: async (title, o) => void shown.push({ title, body: o.body }),
  };
  /** What the cache held each time the worker asked to take over. */
  const tookOver: string[][] = [];
  const self = {
    __ATLAS_OFFLINE: offline,
    __ATLAS_WIRE: WIRE,
    registration,
    location: { origin: new URL(SCOPE).origin },
    clients: { claim: async () => {}, matchAll: async () => [] },
    skipWaiting: () => void tookOver.push([...(caches.m.get('atlas-app')?.m.keys() ?? [])]),
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
  };
  new Function('self', 'caches', 'fetch', 'indexedDB', SOURCE)(self, caches, fetch, fakeIndexedDB(idb));

  /** Dispatches an extendable event and waits for everything it extended. */
  async function extend(type: string, extra: object = {}) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const e = { ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => (response = p) };
    handlers.get(type)!(e);
    const res = response && (await response);
    await Promise.all(waits);
    return res;
  }
  const request = (path: string, init: { mode?: string; method?: string; range?: string } = {}) =>
    new FakeRequest(new URL(path, SCOPE).href, init.method ?? 'GET', init.mode ?? 'cors', init.range);
  const get = (path: string, init?: { mode?: string; method?: string; range?: string }) => extend('fetch', { request: request(path, init) });
  return { net, fetches, env, caches, idb, shown, registration, tookOver, extend, get };
}

class FakeRequest {
  headers: Headers;
  constructor(readonly url: string, readonly method: string, readonly mode: string, range?: string) {
    this.headers = new Headers(range ? { Range: range } : {});
  }
}

const OFFLINE = { version: 'v1', files: ['index.html', 'assets/index-a1.js', 'assets/ui-b2.css', 'assets/concept-d4.js', 'icon-192.png'], audio: ['assets/narration-c3.m4a', 'assets/narration-g7.m4a', 'assets/narration-h8.m4a'], sizes: { 'assets/narration-c3.m4a': 10, 'assets/narration-g7.m4a': 5, 'assets/narration-h8.m4a': 5 } };
const url = (f: string) => new URL(f, SCOPE).href;
const SHELL = '<script src="./assets/index-a1.js"></script><link href="./assets/ui-b2.css">';

describe('offline service worker', () => {
  let w: ReturnType<typeof boot>;
  /** Installs and activates, then loads a page, as a launch does. */
  const installed = async () => {
    await w.extend('install');
    await w.extend('activate');
    await w.get('./', { mode: 'navigate' });
  };
  const app = () => w.caches.open('atlas-app');
  const shellText = async () => (await (await app()).match(url('index.html')))!.text();
  beforeEach(() => {
    w = boot(OFFLINE);
    w.net.set(url('index.html'), { body: SHELL, type: 'text/html' });
    w.net.set(url('assets/index-a1.js'), { body: 'js', type: 'text/javascript' });
    w.net.set(url('assets/ui-b2.css'), { body: 'css', type: 'text/css' });
    w.net.set(url('assets/concept-d4.js'), { body: 'concept', type: 'text/javascript' });
    w.net.set(url('icon-192.png'), { body: 'png', type: 'image/png' });
    w.net.set(url('assets/narration-c3.m4a'), { body: '0123456789', type: 'audio/mp4' });
    w.net.set(url('assets/narration-g7.m4a'), { body: 'ggggg', type: 'audio/mp4' });
    w.net.set(url('assets/narration-h8.m4a'), { body: 'hhhhh', type: 'audio/mp4' });
  });

  it('takes over only once every file of the build is saved, and leaves the narration for when it plays', async () => {
    await w.extend('install');
    expect(w.tookOver).toEqual([expect.arrayContaining(OFFLINE.files.map(url))]);
    expect([...(await app()).m.keys()].sort()).toEqual(OFFLINE.files.map(url).sort());
    expect(w.fetches.filter((f) => f.cache).every((f) => f.cache === 'reload')).toBe(true);
    expect(w.caches.m.get('atlas-audio')?.m.size ?? 0).toBe(0);
  });

  it('downloads again at install only files whose names are not content hashed', async () => {
    await installed();
    w.fetches.length = 0;
    await w.extend('install');
    expect(w.fetches.map((f) => f.url).sort()).toEqual([url('icon-192.png'), url('index.html')]);
  });

  it('fetches nothing on later launches', async () => {
    await installed();
    w.fetches.length = 0;
    await w.get('./', { mode: 'navigate' });
    expect(w.fetches).toEqual([]);
  });

  it('fails the install when a file cannot be fetched, keeping the old shell', async () => {
    await installed();
    await (await app()).delete(url('assets/ui-b2.css'));
    w.net.delete(url('assets/ui-b2.css'));
    w.net.set(url('index.html'), { body: `${SHELL}<!-- new -->`, type: 'text/html' });
    await expect(w.extend('install')).rejects.toThrow(/404/);
    expect(await shellText()).toBe(SHELL);
  });

  it('leaves the shell alone when the site already serves another build', async () => {
    await installed();
    w.net.set(url('index.html'), { body: '<script src="./assets/index-z9.js"></script>', type: 'text/html' });
    await expect(w.extend('install')).rejects.toThrow(/another build/);
    expect(await shellText()).toBe(SHELL);
  });

  it('leaves the build before it whole when its own cannot finish, and resumes where it stopped', async () => {
    await (await app()).put(url('index.html'), new Response('OLD'));
    await (await app()).put(url('assets/index-old.js'), new Response('old'));
    w.net.delete(url('assets/concept-d4.js'));
    await expect(w.extend('install')).rejects.toThrow(/404/);
    expect(w.tookOver).toEqual([]);
    expect(await shellText()).toBe('OLD');
    expect(await (await app()).match(url('assets/index-old.js'))).toBeDefined();
    expect(await (await app()).match(url('assets/ui-b2.css'))).toBeDefined();
    w.net.set(url('assets/concept-d4.js'), { body: 'concept', type: 'text/javascript' });
    w.fetches.length = 0;
    await w.extend('install');
    expect(w.fetches.map((f) => f.url).sort()).toEqual([url('assets/concept-d4.js'), url('icon-192.png'), url('index.html')]);
    expect(await shellText()).toBe(SHELL);
    expect(w.tookOver).toHaveLength(1);
  });

  it('saves again a file that went missing while it installed', async () => {
    const cache = await app();
    const put = cache.put.bind(cache);
    let dropped = false;
    cache.put = async (r, res) => {
      await put(r, res);
      if (!dropped && keyOf(r) === url('icon-192.png')) {
        dropped = true;
        await cache.delete(url('assets/index-a1.js'));
      }
    };
    await w.extend('install');
    expect([...cache.m.keys()].sort()).toEqual(OFFLINE.files.map(url).sort());
  });

  it('fetches again on the next launch what the browser evicted', async () => {
    await installed();
    await (await app()).delete(url('assets/concept-d4.js'));
    await w.get('./', { mode: 'navigate' });
    expect(await (await app()).match(url('assets/concept-d4.js'))).toBeDefined();
  });

  it('opens the cached app with no connection', async () => {
    await installed();
    w.env.online = false;
    const page = await w.get('./', { mode: 'navigate' });
    expect(await page!.text()).toBe(SHELL);
    expect(await (await w.get('assets/index-a1.js'))!.text()).toBe('js');
  });

  it('opens pages from the saved build even when the site has a newer one', async () => {
    await installed();
    w.net.set(url('index.html'), { body: '<p>new</p>', type: 'text/html' });
    const page = await w.get('index.html', { mode: 'navigate' });
    expect(await page!.text()).toBe(SHELL);
  });

  it('serves app files from the cache without the network', async () => {
    await installed();
    w.fetches.length = 0;
    expect(await (await w.get('assets/ui-b2.css'))!.text()).toBe('css');
    expect(w.fetches).toEqual([]);
  });

  it('still serves the previous build to a page that was opened on it', async () => {
    await (await app()).put(url('assets/old-e5.js'), new Response('old chunk'));
    await w.extend('install');
    await w.extend('activate');
    w.env.online = false;
    expect(await (await w.get('assets/old-e5.js'))!.text()).toBe('old chunk');
  });

  it('keeps the previous build while a newer worker is arriving', async () => {
    await (await app()).put(url('assets/next-f6.js'), new Response('next build'));
    w.registration.installing = {};
    await installed();
    expect(await (await app()).match(url('assets/next-f6.js'))).toBeDefined();
  });

  it('streams narration from the network the first time and keeps the whole track', async () => {
    const res = await w.get('assets/narration-c3.m4a', { range: 'bytes=0-1' });
    expect(res!.status).toBe(206);
    expect(await res!.text()).toBe('01');
    const audio = await w.caches.open('atlas-audio');
    expect(await (await audio.match(url('assets/narration-c3.m4a')))!.text()).toBe('0123456789');
  });

  it('downloads a track once however many ranges play at the same time', async () => {
    await Promise.all([w.get('assets/narration-c3.m4a', { range: 'bytes=0-1' }), w.get('assets/narration-c3.m4a', { range: 'bytes=2-' })]);
    expect(w.fetches.filter((f) => f.range === null)).toHaveLength(1);
  });

  it('answers ranges of saved narration offline as partial responses', async () => {
    await w.get('assets/narration-c3.m4a', { range: 'bytes=0-1' });
    w.env.online = false;
    const part = async (range: string) => {
      const r = (await w.get('assets/narration-c3.m4a', { range }))!;
      return [r.status, r.headers.get('Content-Range'), r.status === 206 ? await r.text() : ''];
    };
    expect(await part('bytes=2-5')).toEqual([206, 'bytes 2-5/10', '2345']);
    expect(await part('bytes=7-')).toEqual([206, 'bytes 7-9/10', '789']);
    expect(await part('bytes=-3')).toEqual([206, 'bytes 7-9/10', '789']);
    expect(await part('bytes=8-99')).toEqual([206, 'bytes 8-9/10', '89']);
    expect(await part('bytes=10-')).toEqual([416, 'bytes */10', '']);
    const whole = (await w.get('assets/narration-c3.m4a'))!;
    expect([whole.status, await whole.text()]).toEqual([200, '0123456789']);
  });

  it('drops files the current build no longer names once a page loads on it', async () => {
    const audio = await w.caches.open('atlas-audio');
    await audio.put(url('assets/narration-old.m4a'), new Response('old'));
    await audio.put(url('assets/narration-c3.m4a'), new Response('0123456789'));
    await (await app()).put(url('assets/index-old.js'), new Response('old'));
    await w.caches.open('elsewhere');
    await installed();
    expect([...(await app()).m.keys()].sort()).toEqual(OFFLINE.files.map(url).sort());
    expect([...audio.m.keys()]).toEqual([url('assets/narration-c3.m4a')]);
    expect((await w.caches.keys()).sort()).toEqual(['atlas-app', 'atlas-audio', 'atlas-audio-ahead']);
  });

  describe('narration saved ahead', () => {
    const G = url('assets/narration-g7.m4a');
    const H = url('assets/narration-h8.m4a');
    const C = url('assets/narration-c3.m4a');
    const ahead = () => w.caches.open('atlas-audio-ahead');
    const want = (urls: string[]) => w.extend('message', { data: { type: WIRE.ahead, urls }, ports: [] });
    const upcoming = async (urls: string[]) => {
      const ch = new MessageChannel();
      const got = new Promise<{ upcoming: number }>((resolve) => (ch.port1.onmessage = (m) => resolve(m.data)));
      await w.extend('message', { data: { type: WIRE.status, upcoming: urls }, ports: [ch.port2] });
      const v = await got;
      ch.port1.close();
      return v.upcoming;
    };

    it('holds the narration the page names, and plays it with no connection', async () => {
      await installed();
      await want([G, H]);
      expect([...(await ahead()).m.keys()]).toEqual([G, H]);
      expect(await upcoming([G, H, C])).toBe(2);
      w.env.online = false;
      const part = (await w.get('assets/narration-g7.m4a', { range: 'bytes=0-1' }))!;
      expect([part.status, await part.text()]).toEqual([206, 'gg']);
    });

    it('waits until the app itself is saved', async () => {
      await want([G]);
      expect((await ahead()).m.size).toBe(0);
    });

    it('keeps a track that has played, whatever comes next', async () => {
      await installed();
      await want([G, H]);
      await w.get('assets/narration-g7.m4a', { range: 'bytes=0-1' });
      await want([H]);
      await want([]);
      expect([...(await w.caches.open('atlas-audio')).m.keys()]).toEqual([G]);
      expect((await ahead()).m.size).toBe(0);
    });

    it('lets go of what is no longer coming, and fetches nothing it already holds', async () => {
      await installed();
      await want([G]);
      w.fetches.length = 0;
      await want([H, G]);
      expect(w.fetches.map((f) => f.url)).toEqual([H]);
      await want([H]);
      expect([...(await ahead()).m.keys()]).toEqual([H]);
    });

    it('stops at the cap, keeping what comes soonest', async () => {
      await installed();
      w.net.set(G, { body: 'g'.repeat(30 * 1024 * 1024), type: 'audio/mp4' });
      w.net.set(H, { body: 'h'.repeat(20 * 1024 * 1024), type: 'audio/mp4' });
      await want([H, C]);
      await want([G, H, C]);
      expect([...(await ahead()).m.keys()]).toEqual([G]);
    });

    it('stays quiet with no connection, and ignores addresses that are not narration', async () => {
      await installed();
      w.env.online = false;
      await want([G]);
      w.env.online = true;
      await want([url('assets/index-a1.js'), 'https://elsewhere.test/x.m4a']);
      expect((await ahead()).m.size).toBe(0);
    });

    it('survives tidying after an update', async () => {
      await installed();
      await want([G]);
      await w.get('./', { mode: 'navigate' });
      expect((await w.caches.keys()).sort()).toEqual(['atlas-app', 'atlas-audio', 'atlas-audio-ahead', 'atlas-keep']);
      expect([...(await ahead()).m.keys()]).toEqual([G]);
    });
  });

  describe('courses saved whole', () => {
    const G = url('assets/narration-g7.m4a');
    const H = url('assets/narration-h8.m4a');
    const C = url('assets/narration-c3.m4a');
    const COURSES = { one: [G, H], two: [C] };
    const played = () => w.caches.open('atlas-audio');
    const send = (type: string, extra: object = {}) => w.extend('message', { data: { type, courses: COURSES, ...extra }, ports: [] });
    const status = async () => {
      const ch = new MessageChannel();
      const got = new Promise<{ courses: Record<string, { tracks: number; held: number; bytes: number; heldBytes: number; kept: boolean }>; problem: string }>((resolve) => (ch.port1.onmessage = (m) => resolve(m.data)));
      await w.extend('message', { data: { type: WIRE.status, courses: COURSES }, ports: [ch.port2] });
      const v = await got;
      ch.port1.close();
      return v;
    };

    it('saves every track of a course, and plays it with no connection', async () => {
      await installed();
      await send(WIRE.save, { ids: ['one'] });
      expect([...(await played()).m.keys()].sort()).toEqual([G, H]);
      expect((await status()).courses).toEqual({
        one: { tracks: 2, held: 2, bytes: 10, heldBytes: 10, kept: true },
        two: { tracks: 1, held: 0, bytes: 10, heldBytes: 0, kept: false },
      });
      w.env.online = false;
      const part = (await w.get('assets/narration-h8.m4a', { range: 'bytes=0-1' }))!;
      expect([part.status, await part.text()]).toEqual([206, 'hh']);
    });

    it('waits until the app itself is saved', async () => {
      await send(WIRE.save, { ids: ['one'] });
      expect((await played()).m.size).toBe(0);
      expect((await status()).courses.one!.kept).toBe(true);
    });

    it('goes on where it stopped once the connection returns, fetching only what is missing', async () => {
      await installed();
      await (await played()).put(G, new Response('ggggg'));
      w.env.online = false;
      await send(WIRE.save, { ids: ['one', 'two'] });
      expect((await status()).problem).toBe('offline');
      w.env.online = true;
      w.fetches.length = 0;
      await send(WIRE.ahead, { urls: [] });
      expect(w.fetches.map((f) => f.url).sort()).toEqual([C, H].sort());
      expect((await status()).problem).toBe('');
    });

    it('uses what was saved ahead instead of fetching it again', async () => {
      await installed();
      await send(WIRE.ahead, { urls: [G] });
      w.fetches.length = 0;
      await send(WIRE.save, { ids: ['one'] });
      expect(w.fetches.map((f) => f.url)).toEqual([H]);
      expect((await (await w.caches.open('atlas-audio-ahead')).keys()).length).toBe(0);
    });

    it('stops when storage is full, and says so', async () => {
      await installed();
      const cache = await played();
      cache.put = async () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
      await send(WIRE.save, { ids: ['one'] });
      const st = await status();
      expect([st.problem, st.courses.one!.held]).toEqual(['full', 0]);
    });

    it('saves no more of a course once told to stop, and keeps what it has', async () => {
      await installed();
      await send(WIRE.save, { ids: ['two'] });
      await send(WIRE.stop, { ids: ['two'] });
      w.fetches.length = 0;
      await send(WIRE.ahead, { urls: [] });
      expect(w.fetches).toEqual([]);
      expect((await status()).courses.two).toMatchObject({ held: 1, kept: false });
    });

    it('removes a course: its tracks, played or saved, and the wish to keep it', async () => {
      await installed();
      await send(WIRE.save, { ids: ['one', 'two'] });
      await send(WIRE.drop, { ids: ['one'] });
      expect([...(await played()).m.keys()]).toEqual([C]);
      expect((await status()).courses.one).toMatchObject({ held: 0, kept: false });
    });

    it('keeps the list of saved courses through tidying after an update, and drops tracks the build no longer has', async () => {
      await installed();
      await send(WIRE.save, { ids: ['two'] });
      await (await played()).put(url('assets/narration-old.m4a'), new Response('old'));
      await w.get('./', { mode: 'navigate' });
      expect([...(await played()).m.keys()]).toEqual([C]);
      expect((await status()).courses.two!.kept).toBe(true);
    });
  });

  it('leaves other requests to the browser', async () => {
    expect(await w.get('https://elsewhere.test/api')).toBeUndefined();
    expect(await w.get('assets/index-a1.js', { method: 'POST' })).toBeUndefined();
    expect(await w.get('api/rooms')).toBeUndefined();
  });

  it('reports whether the app is cached and how many tracks are', async () => {
    const ask = async () => {
      const ch = new MessageChannel();
      const got = new Promise((resolve) => (ch.port1.onmessage = (m) => resolve(m.data)));
      await w.extend('message', { data: { type: WIRE.status }, ports: [ch.port2] });
      const v = await got;
      ch.port1.close();
      return v;
    };
    expect(await ask()).toEqual({ version: 'v1', ready: false, files: 0, filesTotal: 5, audio: 0, total: 3, upcoming: 0, courses: {}, saving: false, problem: '' });
    await installed();
    await w.get('assets/narration-c3.m4a', { range: 'bytes=0-1' });
    expect(await ask()).toEqual({ version: 'v1', ready: true, files: 5, filesTotal: 5, audio: 1, total: 3, upcoming: 0, courses: {}, saving: false, problem: '' });
  });
});

describe('reminders', () => {
  const push = (w: ReturnType<typeof boot>, payload: PushPayload) => w.extend('push', { data: { json: () => payload } });

  it('words a reminder from the summary the page saved', async () => {
    const w = boot(null);
    const { db, store, key } = WIRE.summary;
    w.idb.set(db, new Map([[store, new Map([[key, { title: 'Softmax', body: '2 of 3 right in a row so far.' }]])]]));
    await push(w, { kind: 'daily' });
    await push(w, { kind: 'test' });
    expect(w.shown).toEqual([
      { title: 'Softmax', body: '2 of 3 right in a row so far.' },
      { title: 'Reminders are on', body: 'Atlas will remind you once a day. 2 of 3 right in a row so far.' },
    ]);
  });

  it('still reminds when the page has saved nothing', async () => {
    const w = boot(null);
    await push(w, { kind: 'daily' });
    expect(w.shown).toEqual([{ title: 'Atlas', body: 'A few minutes of practice keeps it fresh.' }]);
  });
});

describe('offline service worker in dev', () => {
  it('caches nothing and answers nothing', async () => {
    const w = boot(null);
    await w.extend('install');
    expect(w.fetches).toEqual([]);
    expect(await w.get('./', { mode: 'navigate' })).toBeUndefined();
  });
});

describe('offlineLists', () => {
  it('keeps the app and lists narration apart, leaving out maps, legacy fonts and dotfiles', () => {
    const lists = offlineLists(['index.html', 'sw.js', '.hostthis-keep', 'assets/a.js', 'assets/a.js.map', 'assets/f.woff2', 'assets/f.woff', 'assets/f.ttf', 'assets/narration-x.m4a', 'icon.svg']);
    expect(lists).toEqual({ files: ['assets/a.js', 'assets/f.woff2', 'icon.svg', 'index.html'], audio: ['assets/narration-x.m4a'] });
  });
});
