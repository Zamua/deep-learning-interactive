// Atlas's service worker: offline use and reminders. The build prepends `self.__ATLAS_OFFLINE`, the list of files
// to keep ({ files, audio }); in dev it is null and every request goes to the network.
//
// The app (code, styles, fonts, every concept) is cached at install, so Atlas opens and practices with no
// connection. Narration is cached the first time it plays, since all of it is far larger than the app.
const OFFLINE = self.__ATLAS_OFFLINE;
const APP = 'atlas-app';
const AUDIO = 'atlas-audio';
/** A page load waits this long for the network before falling back to the cached app. */
const PAGE_WAIT = 4000;
/** Parallel downloads while caching the app. */
const POOL = 8;

const url = (file) => new URL(file, self.registration.scope).href;
const appFiles = new Set(OFFLINE ? OFFLINE.files.map(url) : []);
const audioFiles = new Set(OFFLINE ? OFFLINE.audio.map(url) : []);
const SHELL = url('index.html');

const HASHED = url('assets/');

async function get(u) {
  const res = await fetch(u, { cache: 'reload' });
  if (!res.ok) throw new Error(`${u} answered ${res.status}`);
  return res;
}

async function cacheApp() {
  const cache = await caches.open(APP);
  // Files under assets/ have content-hashed names, so a cached one is current; the rest are fetched again.
  const missing = [];
  for (const u of appFiles) if (u !== SHELL && (!u.startsWith(HASHED) || !(await cache.match(u)))) missing.push(u);
  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const u = missing[next++];
      await cache.put(u, await get(u));
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));
  // The shell goes in last: until the whole build is cached, the old shell keeps naming files that are.
  await cache.put(SHELL, await get(SHELL));
}

/** Drops what the current build no longer names, and caches of other names. */
async function prune() {
  for (const name of await caches.keys()) if (name !== APP && name !== AUDIO) await caches.delete(name);
  for (const [name, keep] of [[APP, appFiles], [AUDIO, audioFiles]]) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  if (OFFLINE) e.waitUntil(cacheApp());
});

self.addEventListener('activate', (e) => e.waitUntil(Promise.all([self.clients.claim(), OFFLINE ? prune() : null])));

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
  if (e.request.mode === 'navigate') return e.respondWith(page(e.request));
  const key = u.origin + u.pathname;
  if (appFiles.has(key)) return e.respondWith(appFile(e.request, key));
  if (audioFiles.has(key)) return audio(e, key);
});

/** Answers the settings menu: whether the app is cached, and how many narrations are. */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'offline-status' || !e.ports[0]) return;
  e.waitUntil((async () => {
    if (!OFFLINE) return e.ports[0].postMessage({ ready: false, audio: 0, total: 0 });
    const app = await caches.open(APP);
    const held = new Set((await app.keys()).map((r) => r.url));
    const ready = [...appFiles].every((u) => held.has(u));
    const saved = (await (await caches.open(AUDIO)).keys()).length;
    e.ports[0].postMessage({ ready, audio: saved, total: audioFiles.size });
  })());
});

// Reminders. A push carries only its kind; the words come from what the page last saved, so no progress ever
// leaves the device.
const DB = 'atlas';
const STORE = 'kv';

function read(key) {
  return new Promise((resolve) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const get = open.result.transaction(STORE, 'readonly').objectStore(STORE).get(key);
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
    const s = (await read('summary')) || { title: 'Atlas', body: 'A few minutes of practice keeps it fresh.' };
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
