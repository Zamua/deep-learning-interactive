// Atlas's service worker: offline use and reminders. The build prepends `self.__ATLAS_OFFLINE`, the list of files
// to keep ({ files, audio }), null in dev, where every request goes to the network; and `self.__ATLAS_WIRE`,
// src/offline/wire.json, the names the page and this worker share.
//
// A new worker needs only the shell and the files it names, so it can install and take over during the short sessions
// iOS allows an installed app, and on a connection too slow to beat PAGE_WAIT. The rest of the app (styles, fonts, every
// concept) is saved in the background, picking up on the next launch where it stopped. Once saved, Atlas opens and
// practices with no connection. Narration is cached the first time it plays, since all of it is far larger than the
// app. This file touches Cache Storage only: progress lives in localStorage and is never its concern.
const OFFLINE = self.__ATLAS_OFFLINE;
const WIRE = self.__ATLAS_WIRE;
const APP = 'atlas-app';
const AUDIO = 'atlas-audio';
/** Its one entry says this install's older pages have been moved onto a build that keeps itself current. */
const MOVED = 'atlas-moved';
/** A page load waits this long for the network before falling back to the cached app. */
const PAGE_WAIT = 4000;
/** Parallel downloads while caching the app. */
const POOL = 4;

const url = (file) => new URL(file, self.registration.scope).href;
const appFiles = new Set(OFFLINE ? OFFLINE.files.map(url) : []);
const audioFiles = new Set(OFFLINE ? OFFLINE.audio.map(url) : []);
const SHELL = url('index.html');

const HASHED = url('assets/');
/** This build's entry script, which only this build's shell names. */
const ENTRY = OFFLINE ? OFFLINE.files.find((f) => /^assets\/index-[\w-]+\.js$/.test(f)) : undefined;

async function get(u) {
  const res = await fetch(u, { cache: 'reload' });
  if (!res.ok) throw new Error(`${u} answered ${res.status}`);
  return res;
}

/** Runs `job` on each item, a few at a time. */
async function inPool(items, job) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await job(items[next++]);
  };
  await Promise.all(Array.from({ length: POOL }, worker));
}

/** Saves this build's shell, its unhashed files and what the shell names, the shell last so that it never names a missing file. */
async function saveShell() {
  const cache = await caches.open(APP);
  const res = await get(SHELL);
  const html = await res.clone().text();
  if (!html.includes(ENTRY)) throw new Error('the site serves another build');
  const named = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"]+)"/g)].map((m) => url(m[1])).filter((u) => appFiles.has(u));
  const unhashed = [...appFiles].filter((u) => u !== SHELL && !u.startsWith(HASHED));
  const held = await Promise.all(named.map((u) => cache.match(u)));
  await inPool([...unhashed, ...named.filter((_, i) => !held[i])], async (u) => cache.put(u, await get(u)));
  await cache.put(SHELL, res);
}

/** Saves what is still missing of this build; once all of it is here, drops the previous build. */
async function saveRest() {
  const cache = await caches.open(APP);
  const missing = [];
  for (const u of appFiles) if (!(await cache.match(u))) missing.push(u);
  let incomplete = false;
  await inPool(missing, async (u) => {
    try {
      await cache.put(u, await get(u));
    } catch {
      incomplete = true;
    }
  });
  if (!incomplete) await prune();
}

/** Drops what the current build no longer names, and caches of other names. */
async function prune() {
  for (const name of await caches.keys()) if (name !== APP && name !== AUDIO && name !== MOVED) await caches.delete(name);
  for (const [name, keep] of [[APP, appFiles], [AUDIO, audioFiles]]) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  }
}

let appSaving = null;

/** One run of `saveRest` at a time; a failure is retried on the next launch. */
function keepApp() {
  appSaving ??= saveRest()
    .catch(() => {})
    .finally(() => (appSaving = null));
  return appSaving;
}

/**
 * A page from before this worker cannot reload itself, and on a slow connection its launch was answered from the cache.
 * The first worker of this kind moves such pages to the build it just saved, once; later builds' pages move themselves.
 */
async function moveOlderPages() {
  const moved = await caches.open(MOVED);
  if (await moved.match(url(MOVED))) return;
  await moved.put(url(MOVED), new Response(''));
  const held = await (await caches.open(APP)).keys();
  if (!held.some((r) => r.url.startsWith(HASHED) && !appFiles.has(r.url))) return;
  for (const c of await self.clients.matchAll({ type: 'window' })) await c.navigate(c.url).catch(() => {});
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  if (OFFLINE) e.waitUntil(saveShell());
});

// Neither job below is part of activation: requests wait for activation to end, and a navigation is itself a request.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.clients.claim().then(() => {
      if (!OFFLINE) return;
      void moveOlderPages();
      void keepApp();
    }),
  );
});

/** The network's page when it answers in time, else the cached app. */
async function page(req) {
  const net = fetch(req);
  net.catch(() => {});
  const late = new Promise((resolve) => setTimeout(resolve, PAGE_WAIT));
  try {
    const res = await Promise.race([net, late]);
    if (res) return res;
  } catch {
    /* offline */
  }
  const cached = await (await caches.open(APP)).match(SHELL);
  return cached ?? net;
}

/** A file of the previous build, for its shell while this build is still being saved. */
async function heldFile(req, key) {
  return (await (await caches.open(APP)).match(key)) ?? fetch(req);
}

async function appFile(req, key) {
  const cache = await caches.open(APP);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(key, res.clone());
  return res;
}

/** Answers a media element's `Range` request from a whole cached file, as Safari plays only partial responses. */
async function ranged(whole, range) {
  if (!range) return whole;
  const body = await whole.blob();
  const size = body.size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = m && m[1] !== '' ? Number(m[1]) : NaN;
  let end = m && m[2] !== '' ? Number(m[2]) : size - 1;
  if (m && m[1] === '' && m[2] !== '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  if (!(start >= 0 && start <= end)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': whole.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Narration downloads in flight, so a track's many range requests fetch it whole only once. */
const saving = new Map();

function saveAudio(key) {
  if (!saving.has(key)) {
    const job = (async () => {
      const res = await fetch(key);
      if (res.status === 200) await (await caches.open(AUDIO)).put(key, res);
    })()
      .catch(() => {})
      .finally(() => saving.delete(key));
    saving.set(key, job);
  }
  return saving.get(key);
}

function audio(e, key) {
  const hit = caches.open(AUDIO).then((c) => c.match(key));
  e.respondWith(hit.then((r) => (r ? ranged(r, e.request.headers.get('Range')) : fetch(e.request))));
  e.waitUntil(hit.then((r) => r || saveAudio(key)));
}

self.addEventListener('fetch', (e) => {
  if (!OFFLINE || e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(page(e.request));
    e.waitUntil(keepApp());
    return;
  }
  const key = u.origin + u.pathname;
  if (appFiles.has(key)) return e.respondWith(appFile(e.request, key));
  if (audioFiles.has(key)) return audio(e, key);
  if (key.startsWith(HASHED)) e.respondWith(heldFile(e.request, key));
});

/** Answers the settings menu: whether the app is cached, and how many narrations are. */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== WIRE.status || !e.ports[0]) return;
  e.waitUntil((async () => {
    if (!OFFLINE) return e.ports[0].postMessage({ ready: false, files: 0, filesTotal: 0, audio: 0, total: 0 });
    const app = await caches.open(APP);
    const held = new Set((await app.keys()).map((r) => r.url));
    const files = [...appFiles].filter((u) => held.has(u)).length;
    const saved = (await (await caches.open(AUDIO)).keys()).length;
    e.ports[0].postMessage({ ready: files === appFiles.size, files, filesTotal: appFiles.size, audio: saved, total: audioFiles.size });
  })());
});

// Reminders. A push carries only its kind; the words come from what the page last saved, so no progress ever
// leaves the device.
function readSummary() {
  const { db, store, key } = WIRE.summary;
  return new Promise((resolve) => {
    const open = indexedDB.open(db, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(store);
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const get = open.result.transaction(store, 'readonly').objectStore(store).get(key);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => resolve(undefined);
    };
  });
}

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let kind = 'daily';
    try {
      kind = e.data ? e.data.json().kind : 'daily';
    } catch {
      /* an unreadable payload is still a reminder */
    }
    const s = (await readSummary()) || { title: 'Atlas', body: 'A few minutes of practice keeps it fresh.' };
    const title = kind === 'test' ? 'Reminders are on' : s.title;
    const body = kind === 'test' ? `Atlas will remind you once a day. ${s.body}` : s.body;
    await self.registration.showNotification(title, { body, icon: 'icon-192.png', tag: 'atlas', data: { url: './#/atlas' } });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#/atlas', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
