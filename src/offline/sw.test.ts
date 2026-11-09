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

/** Lets the work a handler started without waiting for it finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

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
function boot(offline: { files: string[]; audio: string[] } | null) {
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
  const pages: { url: string; navigate: (to: string) => Promise<void> }[] = [];
  const self = {
    __ATLAS_OFFLINE: offline,
    __ATLAS_WIRE: WIRE,
    registration: { scope: SCOPE, showNotification: async (title: string, o: { body: string }) => void shown.push({ title, body: o.body }) },
    location: { origin: new URL(SCOPE).origin },
    clients: { claim: async () => {}, matchAll: async () => pages },
    skipWaiting: () => {},
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
  return { net, fetches, env, caches, idb, shown, pages, extend, get };
}

class FakeRequest {
  headers: Headers;
  constructor(readonly url: string, readonly method: string, readonly mode: string, range?: string) {
    this.headers = new Headers(range ? { Range: range } : {});
  }
}

const OFFLINE = { files: ['index.html', 'assets/index-a1.js', 'assets/ui-b2.css', 'assets/concept-d4.js', 'icon-192.png'], audio: ['assets/narration-c3.m4a'] };
const url = (f: string) => new URL(f, SCOPE).href;
const SHELL = '<script src="./assets/index-a1.js"></script><link href="./assets/ui-b2.css">';

describe('offline service worker', () => {
  let w: ReturnType<typeof boot>;
  /** Installs and activates, then waits for the background save, as a launch does. */
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
  });

  it('installs on the shell, its unhashed files and what it names, not the whole app', async () => {
    await w.extend('install');
    expect([...(await app()).m.keys()].sort()).toEqual(['index.html', 'assets/index-a1.js', 'assets/ui-b2.css', 'icon-192.png'].map(url).sort());
  });

  it('saves the rest after taking over, but not the narration', async () => {
    await installed();
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

  it('fetches nothing more on later launches once the app is saved', async () => {
    await installed();
    w.fetches.length = 0;
    await w.get('./', { mode: 'navigate' });
    expect(w.fetches.map((f) => f.url)).toEqual([url('./')]);
  });

  it('fails the install when a file the shell names cannot be fetched, keeping the old shell', async () => {
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

  it('keeps what arrived and the previous build when a file is missing, and finishes on the next launch', async () => {
    await (await app()).put(url('assets/index-old.js'), new Response('old'));
    w.net.delete(url('assets/concept-d4.js'));
    await installed();
    expect(await (await app()).match(url('assets/index-old.js'))).toBeDefined();
    expect(await (await app()).match(url('assets/concept-d4.js'))).toBeUndefined();
    expect(await shellText()).toBe(SHELL);
    w.net.set(url('assets/concept-d4.js'), { body: 'concept', type: 'text/javascript' });
    await w.get('./', { mode: 'navigate' });
    expect(await (await app()).match(url('assets/concept-d4.js'))).toBeDefined();
    expect(await (await app()).match(url('assets/index-old.js'))).toBeUndefined();
  });

  it('opens the cached app with no connection', async () => {
    await installed();
    w.env.online = false;
    const page = await w.get('./', { mode: 'navigate' });
    expect(await page!.text()).toBe(SHELL);
    expect(await (await w.get('assets/index-a1.js'))!.text()).toBe('js');
  });

  it('prefers the network for pages when it answers', async () => {
    await installed();
    w.net.set(url('index.html'), { body: '<p>new</p>', type: 'text/html' });
    const page = await w.get('index.html', { mode: 'navigate' });
    expect(await page!.text()).toBe('<p>new</p>');
  });

  it('serves app files from the cache without the network', async () => {
    await installed();
    w.fetches.length = 0;
    expect(await (await w.get('assets/ui-b2.css'))!.text()).toBe('css');
    expect(w.fetches).toEqual([]);
  });

  it('still serves the previous build to a page that was opened on it', async () => {
    await (await app()).put(url('assets/old-e5.js'), new Response('old chunk'));
    w.net.delete(url('assets/concept-d4.js'));
    await installed();
    w.env.online = false;
    expect(await (await w.get('assets/old-e5.js'))!.text()).toBe('old chunk');
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

  it('drops files the current build no longer names once all of it is saved', async () => {
    const audio = await w.caches.open('atlas-audio');
    await audio.put(url('assets/narration-old.m4a'), new Response('old'));
    await audio.put(url('assets/narration-c3.m4a'), new Response('0123456789'));
    await (await app()).put(url('assets/index-old.js'), new Response('old'));
    await w.caches.open('elsewhere');
    await installed();
    expect([...(await app()).m.keys()].sort()).toEqual(OFFLINE.files.map(url).sort());
    expect([...audio.m.keys()]).toEqual([url('assets/narration-c3.m4a')]);
    expect((await w.caches.keys()).sort()).toEqual(['atlas-app', 'atlas-audio', 'atlas-moved']);
  });

  it('moves a page from before this worker onto the new build, once', async () => {
    const went: string[] = [];
    w.pages.push({ url: url('#/atlas'), navigate: async (to) => void went.push(to) });
    await (await app()).put(url('assets/index-old.js'), new Response('old'));
    await w.extend('install');
    await w.extend('activate');
    await settle();
    expect(went).toEqual([url('#/atlas')]);
    await w.extend('activate');
    await settle();
    expect(went).toHaveLength(1);
  });

  it('leaves the page alone on a first install, where it is already this build', async () => {
    const went: string[] = [];
    w.pages.push({ url: url('#/'), navigate: async (to) => void went.push(to) });
    await w.extend('install');
    await w.extend('activate');
    await settle();
    expect(went).toEqual([]);
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
    expect(await ask()).toEqual({ ready: false, files: 0, filesTotal: 5, audio: 0, total: 1 });
    await installed();
    await w.get('assets/narration-c3.m4a', { range: 'bytes=0-1' });
    expect(await ask()).toEqual({ ready: true, files: 5, filesTotal: 5, audio: 1, total: 1 });
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
