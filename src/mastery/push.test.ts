import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Learner } from './learner';

const settle = () => new Promise((r) => setTimeout(r, 30));
const learner = { today: () => ({ kind: 'done', due: 0, t: 0 }), trackTargets: [], records: {} } as unknown as Learner;

/** A browser with push: one subscription, a reminder service whose answers can be held back, and localStorage. */
function browser() {
  const store = new Map<string, string>();
  let sub: object | null = {
    endpoint: 'https://web.push.apple.com/x',
    toJSON: () => ({ endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: async () => ((sub = null), true),
  };
  const calls: string[] = [];
  let hold: Promise<void> | null = null;
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
  vi.stubGlobal('Notification', { requestPermission: async () => 'granted' });
  const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub } };
  vi.stubGlobal('navigator', { userAgent: '', serviceWorker: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg) } });
  vi.stubGlobal('indexedDB', { open: () => { const r: { onerror?: () => void } = {}; queueMicrotask(() => r.onerror?.()); return r; } });
  /** The reminder time the service holds, as of the latest PUT it processed. */
  const server = { time: '' };
  vi.stubGlobal('fetch', async (_url: string, init: { method: string; body: string }) => {
    calls.push(init.method);
    if (init.method === 'PUT' && hold) {
      const h = hold;
      hold = null;
      await h;
    }
    if (init.method === 'PUT') server.time = (JSON.parse(init.body) as { time: string }).time;
    return new Response(JSON.stringify(init.method === 'PUT' ? { next: 1 } : { ok: true }), { status: 200 });
  });
  /** Holds back the next PUT until released, as a slow network might. */
  const holdNextPut = () => {
    let open!: () => void;
    hold = new Promise((r) => (open = r));
    return open;
  };
  return { store, calls, server, holdNextPut };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_PUSH_URL', 'https://push.test');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AAAA');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('reminders', () => {
  it('stay off when turned off while a sync is out', async () => {
    const b = browser();
    const push = await import('./push');
    b.store.set('atlas.reminders', JSON.stringify({ on: true, time: '19:00', synced: 1 }));
    const release = b.holdNextPut();
    const syncing = push.syncReminders(learner);
    await vi.waitFor(() => expect(b.calls).toEqual(['PUT']));
    const off = push.disableReminders();
    // Lets the second operation run as far as it can before the held sync finishes.
    await settle();
    release();
    await Promise.all([syncing, off]);
    expect(push.loadPrefs().on).toBe(false);
  });

  it('keep the time chosen while a sync with the old one is out, here and at the service', async () => {
    const b = browser();
    const push = await import('./push');
    b.store.set('atlas.reminders', JSON.stringify({ on: true, time: '19:00', synced: 1 }));
    const release = b.holdNextPut();
    const syncing = push.syncReminders(learner);
    await vi.waitFor(() => expect(b.calls).toEqual(['PUT']));
    const enabling = push.enableReminders(learner, '07:30');
    await settle();
    release();
    await Promise.all([syncing, enabling]);
    expect(push.loadPrefs()).toMatchObject({ on: true, time: '07:30' });
    expect(b.server.time).toBe('07:30');
  });
});
