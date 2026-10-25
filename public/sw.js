// Atlas reminders. A push carries only its kind; the words come from what the page last saved,
// so no progress ever leaves the device. There is no fetch handler: pages load as usual.
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
    await self.registration.showNotification(title, { body, icon: 'icon-192.png', tag: 'atlas', data: { url: './#/atlas/learn' } });
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
