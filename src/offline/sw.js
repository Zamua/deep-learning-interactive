// Atlas's service worker: offline use and reminders. The build prepends `self.__ATLAS_OFFLINE`, the list of files
// to keep ({ files, audio }), null in dev, where every request goes to the network; and `self.__ATLAS_WIRE`,
// src/offline/wire.json, the names the page and this worker share.
//
// A new worker installs only once it holds every file of its build, and takes over then. Until that moment the build
// before it keeps answering, whole, so Atlas never opens on a build it cannot finish drawing with no connection. An
// install that is cut short (iOS allows an installed app only short sessions) keeps what arrived and resumes at the
// next launch. Once a build is in charge its pages come from the cache, never the network: the next build arrives
// through the next worker. Narration is cached the first time it plays, since all of it is far larger than the app,
// and the page names the explainers that come next so that theirs is saved ahead, up to AHEAD_CAP. A learner can also
// save a whole course's narration from the settings menu: those courses are kept, and each new build's narration for
// them is fetched as it arrives (names are content hashed, so only what changed).
// This file touches Cache Storage only: progress lives in localStorage and is never its concern.
const OFFLINE = self.__ATLAS_OFFLINE;
const WIRE = self.__ATLAS_WIRE;
const APP = 'atlas-app';
const AUDIO = 'atlas-audio';
/** Narration saved before it was played: what the page said comes next. A track moves to AUDIO once it plays. */
const AHEAD = 'atlas-audio-ahead';
/** The most narration held ahead, in bytes: about twenty explainers. */
const AHEAD_CAP = 40 * 1024 * 1024;
/** Which courses' narration the learner saved, as a list of course ids; in its own cache, so it outlives a build. */
const KEEP = 'atlas-keep';
/** Parallel downloads while caching the app. */
const POOL = 4;

const url = (file) => new URL(file, self.registration.scope).href;
const appFiles = new Set(OFFLINE ? OFFLINE.files.map(url) : []);
const audioFiles = new Set(OFFLINE ? OFFLINE.audio.map(url) : []);
const SHELL = url('index.html');
const KEPT = url('kept-courses.json');
/** Each narration track's size in bytes. */
const sizes = new Map(OFFLINE ? Object.entries(OFFLINE.sizes || {}).map(([f, n]) => [url(f), n]) : []);

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

/** The files of this build that the cache does not hold. */
async function missing() {
  const held = new Set((await (await caches.open(APP)).keys()).map((r) => r.url));
  return [...appFiles].filter((u) => !held.has(u));
}

/**
 * Saves all of this build beside the one before it: what is not held yet, the unhashed files again (their names do not
 * change with their contents), and the shell last, so the cached shell never names a file that is not there.
 */
async function saveBuild() {
  const cache = await caches.open(APP);
  const res = await get(SHELL);
  if (!(await res.clone().text()).includes(ENTRY)) throw new Error('the site serves another build');
  const unhashed = [...appFiles].filter((u) => u !== SHELL && !u.startsWith(HASHED));
  const hashed = (await missing()).filter((u) => u.startsWith(HASHED));
  await inPool([...hashed, ...unhashed], async (u) => cache.put(u, await get(u)));
  // The worker before this one may have tidied the cache meanwhile.
  await inPool((await missing()).filter((u) => u !== SHELL), async (u) => cache.put(u, await get(u)));
  await cache.put(SHELL, res);
}

/** Fetches again what the browser evicted or an older worker removed; once all of it is here, drops the previous build. */
async function saveRest() {
  const cache = await caches.open(APP);
  let incomplete = false;
  await inPool(await missing(), async (u) => {
    try {
      await cache.put(u, await get(u));
    } catch {
      incomplete = true;
    }
  });
  // A newer worker on its way in is filling the same cache.
  if (!incomplete && !self.registration.installing && !self.registration.waiting) await prune();
}

/** Drops what the current build no longer names, and caches of other names. */
async function prune() {
  for (const name of await caches.keys()) if (![APP, AUDIO, AHEAD, KEEP].includes(name)) await caches.delete(name);
  for (const [name, keep] of [[APP, appFiles], [AUDIO, audioFiles], [AHEAD, audioFiles]]) {
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

self.addEventListener('install', (e) => {
  if (!OFFLINE) return void self.skipWaiting();
  e.waitUntil(saveBuild().then(() => self.skipWaiting()));
});

// The previous build's files stay until a page loads under this worker: a page opened on that build still needs them.
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

/** The saved app, which is whole; the network only if the browser has evicted the shell. */
async function page(req) {
  return (await (await caches.open(APP)).match(SHELL)) ?? fetch(req);
}

/** A file of the previous build, for a page that was opened on it. */
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

/** A saved track, played or held ahead; one held ahead joins the played ones, which are never dropped to make room. */
async function heldAudio(key) {
  const played = await caches.open(AUDIO);
  const hit = await played.match(key);
  if (hit) return hit;
  const ahead = await caches.open(AHEAD);
  const early = await ahead.match(key);
  if (!early) return undefined;
  await played.put(key, early.clone());
  await ahead.delete(key);
  return early;
}

/**
 * Holds the narration of `want` (addresses, soonest first) and lets go of what was held ahead and is no longer wanted.
 * Only once the app itself is whole; stops quietly at the cap, or when the connection does.
 */
async function saveAhead(want) {
  if ((await missing()).length) return;
  const played = await caches.open(AUDIO);
  const ahead = await caches.open(AHEAD);
  const wanted = [...new Set(want)].filter((u) => audioFiles.has(u));
  for (const req of await ahead.keys()) if (!wanted.includes(req.url)) await ahead.delete(req);
  let total = 0;
  let full = false;
  for (const u of wanted) {
    if (await played.match(u)) continue;
    const held = await ahead.match(u);
    if (full) {
      if (held) await ahead.delete(u);
      continue;
    }
    let body;
    if (held) body = await held.blob();
    else {
      const res = await fetch(u);
      if (res.status !== 200) return;
      body = await res.blob();
    }
    full = total + body.size > AHEAD_CAP;
    if (full && held) await ahead.delete(u);
    if (full) continue;
    total += body.size;
    if (!held) await ahead.put(u, new Response(body, { headers: { 'Content-Type': body.type || 'audio/mp4' } }));
  }
}

let aheadWant = null;
let aheadSaving = null;

/** One run of `saveAhead` at a time, then once more with the latest list if another came meanwhile. */
function keepAhead(want) {
  aheadWant = want;
  aheadSaving ??= (async () => {
    while (aheadWant) {
      const next = aheadWant;
      aheadWant = null;
      await saveAhead(next).catch(() => {});
    }
  })().finally(() => (aheadSaving = null));
  return aheadSaving;
}

/** Each course's narration, as the page last named it: only the page knows which track belongs to which course. */
let catalog = {};
/** Why saving courses last stopped short: '', 'full' (no room left) or 'offline'. */
let problem = '';

async function kept() {
  const res = await (await caches.open(KEEP)).match(KEPT);
  return res ? res.json() : [];
}

async function setKept(ids) {
  await (await caches.open(KEEP)).put(KEPT, new Response(JSON.stringify([...new Set(ids)]), { headers: { 'Content-Type': 'application/json' } }));
}

const tracksOf = (id) => (Array.isArray(catalog[id]) ? catalog[id] : []).filter((u) => audioFiles.has(u));

/** Tells every open page that what is saved changed. */
async function tell() {
  for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: WIRE.progress });
}

/**
 * Saves the narration of every kept course that is not held yet, two tracks at a time, with the played ones (never
 * dropped to make room). Once the app itself is whole; stops when storage is full or the connection goes, and skips
 * the rest of a course the learner stops saving.
 */
async function saveCourses() {
  if ((await missing()).length) return;
  problem = '';
  const played = await caches.open(AUDIO);
  const todo = [];
  for (const id of await kept()) for (const u of tracksOf(id)) if (!(await played.match(u))) todo.push({ id, u });
  let next = 0;
  const one = async () => {
    while (next < todo.length && !problem) {
      const { id, u } = todo[next++];
      if (!(await kept()).includes(id)) continue;
      if (!(await heldAudio(u))) {
        const res = await fetch(u).catch(() => null);
        if (!res || res.status !== 200) return void (problem = 'offline');
        try {
          await played.put(u, res);
        } catch {
          return void (problem = 'full');
        }
        if (!(await kept()).includes(id)) await played.delete(u);
      }
      await tell();
    }
  };
  await Promise.all([one(), one()]);
}

let coursesSaving = null;
let coursesAgain = false;

/** One run of `saveCourses` at a time, then once more if asked again meanwhile. */
function keepCourses() {
  coursesAgain = true;
  coursesSaving ??= (async () => {
    while (coursesAgain) {
      coursesAgain = false;
      await saveCourses().catch(() => {});
    }
  })().finally(() => {
    coursesSaving = null;
    void tell();
  });
  return coursesSaving;
}

/** Lets a course go: it is no longer kept, and its narration, played or saved, is deleted. */
async function drop(id) {
  await setKept((await kept()).filter((k) => k !== id));
  const played = await caches.open(AUDIO);
  const ahead = await caches.open(AHEAD);
  for (const u of tracksOf(id)) {
    await played.delete(u);
    await ahead.delete(u);
  }
  await tell();
}

/** What is saved of each course the page named. */
async function coursesHeld(sound) {
  const ids = await kept();
  const out = {};
  for (const id of Object.keys(catalog)) {
    const tracks = tracksOf(id);
    const held = tracks.filter((u) => sound.has(u));
    const bytes = (list) => list.reduce((n, u) => n + (sizes.get(u) || 0), 0);
    out[id] = { tracks: tracks.length, held: held.length, bytes: bytes(tracks), heldBytes: bytes(held), kept: ids.includes(id) };
  }
  return out;
}

function audio(e, key) {
  const hit = heldAudio(key);
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

const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/**
 * Takes the page's list of narration to hold ahead (and goes on saving kept courses, which may have been cut short),
 * the courses to save, stop saving or let go, and answers the settings menu: what is saved.
 */
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d) return;
  if (OFFLINE && d.courses && typeof d.courses === 'object') catalog = d.courses;
  if (OFFLINE && d.type === WIRE.ahead && Array.isArray(d.urls)) return e.waitUntil(Promise.all([keepAhead(d.urls), keepCourses()]));
  if (OFFLINE && d.type === WIRE.save) return e.waitUntil((async () => {
    await setKept([...(await kept()), ...ids(d.ids)]);
    await keepCourses();
  })());
  if (OFFLINE && d.type === WIRE.stop) return e.waitUntil((async () => {
    await setKept((await kept()).filter((k) => !ids(d.ids).includes(k)));
    await tell();
  })());
  if (OFFLINE && d.type === WIRE.drop) return e.waitUntil(Promise.all(ids(d.ids).map(drop)));
  if (d.type !== WIRE.status || !e.ports[0]) return;
  e.waitUntil((async () => {
    if (!OFFLINE) return e.ports[0].postMessage({ version: '', ready: false, files: 0, filesTotal: 0, audio: 0, total: 0, upcoming: 0, courses: {}, saving: false, problem: '' });
    const app = await caches.open(APP);
    const held = new Set((await app.keys()).map((r) => r.url));
    const files = [...appFiles].filter((u) => held.has(u)).length;
    const sound = new Set([...(await (await caches.open(AUDIO)).keys()), ...(await (await caches.open(AHEAD)).keys())].map((r) => r.url));
    const upcoming = ids(d.upcoming).filter((u) => sound.has(u)).length;
    e.ports[0].postMessage({
      version: OFFLINE.version, ready: files === appFiles.size, files, filesTotal: appFiles.size, audio: sound.size, total: audioFiles.size, upcoming,
      courses: await coursesHeld(sound), saving: coursesSaving !== null, problem,
    });
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
