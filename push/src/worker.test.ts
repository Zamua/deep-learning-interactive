import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { b64u } from './webpush';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));
const { Reminders } = await import('./worker');

/** Durable Object storage in memory, keys listed in order as the real one does. */
class FakeStorage {
  m = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(k: string) {
    return structuredClone(this.m.get(k)) as T | undefined;
  }
  async put(k: string, v: unknown) {
    this.m.set(k, structuredClone(v));
  }
  async delete(k: string) {
    return this.m.delete(k);
  }
  async list<T>(o: { prefix: string; limit?: number }) {
    const keys = [...this.m.keys()].filter((k) => k.startsWith(o.prefix)).sort().slice(0, o.limit);
    return new Map(keys.map((k) => [k, structuredClone(this.m.get(k)) as T]));
  }
  async setAlarm(t: number) {
    this.alarm = t;
  }
  async deleteAlarm() {
    this.alarm = null;
  }
}

const NOW = Date.UTC(2026, 10, 1, 19, 0);

async function vapidEnv() {
  const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = b64u.encode(new Uint8Array((await crypto.subtle.exportKey('raw', k.publicKey)) as ArrayBuffer));
  return { VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey)), VAPID_PUBLIC_KEY: pub, VAPID_SUBJECT: 'mailto:test@example.com', ALLOWED_ORIGINS: '' };
}

/** A browser's subscription keys, as real as a push service would hand out. */
async function browserKeys() {
  const k = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  return { p256dh: b64u.encode(new Uint8Array((await crypto.subtle.exportKey('raw', k.publicKey)) as ArrayBuffer)), auth: b64u.encode(crypto.getRandomValues(new Uint8Array(16))) };
}

const sub = (n: number, keys: { p256dh: string; auth: string }) => ({ endpoint: `https://web.push.apple.com/${n}`, ...keys, time: '19:00', tz: 'UTC', lastActive: 0 });

let sent: string[];
let gate: Promise<void> | null;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sent = [];
  gate = null;
  vi.stubGlobal('fetch', async (url: string) => {
    sent.push(url);
    if (gate) await gate;
    return new Response(null, { status: 201 });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function reminders() {
  const storage = new FakeStorage();
  const r = new Reminders({ storage } as never, (await vapidEnv()) as never);
  return { r, storage };
}

/** Puts entries straight into storage, due now, as an older build or a bad client may have left them. */
async function seed(storage: FakeStorage, r: InstanceType<typeof Reminders>, subs: ReturnType<typeof sub>[]) {
  for (const s of subs) await r.upsert(s);
  for (const [k, e] of storage.m) storage.m.set(k, { ...(e as object), next: NOW - 1000 });
}

describe('the reminder alarm', () => {
  it('sends every due reminder and stays armed when one subscription cannot be sent to', async () => {
    const { r, storage } = await reminders();
    const good = await browserKeys();
    await seed(storage, r, [sub(1, { p256dh: 'bm90LWEta2V5', auth: 'eA' }), sub(2, good), sub(3, good)]);
    await r.alarm();
    expect(sent.sort()).toEqual(['https://web.push.apple.com/1', 'https://web.push.apple.com/2', 'https://web.push.apple.com/3'].filter((u) => !u.endsWith('/1')));
    expect(storage.alarm).toBeGreaterThan(NOW);
    for (const e of storage.m.values()) expect((e as { next: number }).next).toBeGreaterThan(NOW);
  });

  it('does not bring back a subscription removed while its reminder was sending', async () => {
    const { r, storage } = await reminders();
    const s = sub(1, await browserKeys());
    await seed(storage, r, [s]);
    let open!: () => void;
    gate = new Promise((res) => (open = res));
    const running = r.alarm();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await r.remove(s.endpoint);
    open();
    await running;
    expect(storage.m.size).toBe(0);
  });
});

describe('a test push', () => {
  it('keeps a reminder time changed while the test was sending', async () => {
    const { r, storage } = await reminders();
    const s = sub(1, await browserKeys());
    await r.upsert(s);
    let open!: () => void;
    gate = new Promise((res) => (open = res));
    const testing = r.test(s.endpoint);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await r.upsert({ ...s, time: '07:30' });
    open();
    await testing;
    expect([...storage.m.values()].map((e) => (e as { time: string }).time)).toEqual(['07:30']);
  });
});
