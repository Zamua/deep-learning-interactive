// The reminder sender for Atlas. The site is static and has no accounts: a browser's push
// subscription is its identity. The Worker keeps, per subscription, only the push address and
// keys, a reminder time and time zone, and when the learner last practiced; one Durable Object
// holds them all and wakes on an alarm at the next reminder due.
import { DurableObject } from 'cloudflare:workers';
import { endpointFrom, subscriptionFrom } from './api';
import { nextFire, type Reminder } from './schedule';
import { encrypt, newSender, vapidAuth } from './webpush';

export interface Env {
  REMINDERS: DurableObjectNamespace<Reminders>;
  /** Secret: the VAPID private key as a JWK. */
  VAPID_PRIVATE_JWK: string;
  /** The VAPID public key, base64url, as the page subscribes with. */
  VAPID_PUBLIC_KEY: string;
  /** A contact for push services: an https URL or a mailto. */
  VAPID_SUBJECT: string;
  /** Comma-separated origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
}

interface Entry extends Reminder {
  endpoint: string;
  p256dh: string;
  auth: string;
  next: number;
  /** When the latest test push went out, to rate-limit them. */
  lastTest: number;
}

const MAX_ENTRIES = 2000;
const MAX_BODY = 4096;
/** Reminders this close to due are sent in the same wake-up. */
const SLACK = 60_000;

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export class Reminders extends DurableObject<Env> {
  private async key(endpoint: string) {
    return `e:${await sha256(endpoint)}`;
  }

  /** Adds or updates a subscription; returns when its next reminder is due. */
  async upsert(e: Omit<Entry, 'next' | 'lastSent' | 'lastTest'>): Promise<{ next: number } | { error: string }> {
    const key = await this.key(e.endpoint);
    const old = await this.ctx.storage.get<Entry>(key);
    if (!old && (await this.ctx.storage.list({ prefix: 'e:', limit: MAX_ENTRIES })).size >= MAX_ENTRIES) return { error: 'full' };
    const entry: Entry = { ...e, lastSent: old?.lastSent ?? 0, lastTest: old?.lastTest ?? 0, next: 0 };
    entry.next = nextFire(entry, Date.now());
    await this.ctx.storage.put(key, entry);
    await this.schedule();
    return { next: entry.next };
  }

  async remove(endpoint: string): Promise<void> {
    await this.ctx.storage.delete(await this.key(endpoint));
    await this.schedule();
  }

  /** Sends one push now, at most once a minute per subscription. */
  async test(endpoint: string): Promise<{ status: number } | { error: string }> {
    const key = await this.key(endpoint);
    const e = await this.ctx.storage.get<Entry>(key);
    if (!e) return { error: 'unknown' };
    if (Date.now() - e.lastTest < 60_000) return { error: 'too soon' };
    e.lastTest = Date.now();
    const status = await this.send(e, 'test');
    if (status === 404 || status === 410) await this.ctx.storage.delete(key);
    else await this.ctx.storage.put(key, e);
    return { status };
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const all = await this.ctx.storage.list<Entry>({ prefix: 'e:' });
    for (const [key, e] of all) {
      if (e.next > now + SLACK) continue;
      // Re-checked here: the learner may have practiced since this reminder was scheduled.
      const due = nextFire({ ...e, lastSent: 0 }, now - SLACK) <= now + SLACK;
      if (due) {
        const status = await this.send(e, 'daily');
        if (status === 404 || status === 410) {
          await this.ctx.storage.delete(key);
          continue;
        }
        e.lastSent = now;
      }
      e.next = nextFire(e, now);
      await this.ctx.storage.put(key, e);
    }
    await this.schedule();
  }

  private async schedule(): Promise<void> {
    let soonest = Infinity;
    for (const e of (await this.ctx.storage.list<Entry>({ prefix: 'e:' })).values()) soonest = Math.min(soonest, e.next);
    if (Number.isFinite(soonest)) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, soonest));
    else await this.ctx.storage.deleteAlarm();
  }

  private async send(e: Entry, kind: 'daily' | 'test'): Promise<number> {
    const body = await encrypt(new TextEncoder().encode(JSON.stringify({ kind })), e.p256dh, e.auth, await newSender());
    const res = await fetch(e.endpoint, {
      method: 'POST',
      headers: {
        TTL: '43200',
        Urgency: 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: await vapidAuth(e.endpoint, JSON.parse(this.env.VAPID_PRIVATE_JWK) as JsonWebKey, this.env.VAPID_PUBLIC_KEY, this.env.VAPID_SUBJECT),
      },
      body,
    });
    // The push host and status only: the endpoint itself identifies the browser.
    if (!res.ok) console.log('push refused', kind, new URL(e.endpoint).host, res.status, (await res.text()).slice(0, 200));
    return res.status;
  }
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const ok = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'PUT, DELETE, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const h = cors(req, env);
    if (url.pathname === '/healthz') return new Response('ok', { headers: h });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (!h['Access-Control-Allow-Origin']) return json({ error: 'origin not allowed' }, 403, h);
    const stub = env.REMINDERS.get(env.REMINDERS.idFromName('all'));
    const body = req.method === 'GET' ? {} : await readBody(req);
    if (!body) return json({ error: 'bad body' }, 400, h);
    const endpoint = endpointFrom(body);
    if (!endpoint) return json({ error: 'not a push endpoint' }, 400, h);

    if (url.pathname === '/subscription' && req.method === 'PUT') {
      const sub = subscriptionFrom(body);
      if (!sub) return json({ error: 'bad subscription' }, 400, h);
      const r = await stub.upsert(sub);
      return json(r, 'error' in r ? 503 : 200, h);
    }
    if (url.pathname === '/subscription' && req.method === 'DELETE') {
      await stub.remove(endpoint);
      return json({ ok: true }, 200, h);
    }
    if (url.pathname === '/test' && req.method === 'POST') {
      const r = await stub.test(endpoint);
      if ('error' in r) {
        return r.error === 'unknown'
          ? json({ error: 'The reminder service has no subscription for this browser. Turn reminders off and on again.' }, 404, h)
          : json({ error: 'One test a minute. Try again shortly.' }, 429, h);
      }
      if (r.status < 200 || r.status >= 300) return json({ error: `The push service refused the test (${r.status}).` }, 502, h);
      return json(r, 200, h);
    }
    return json({ error: 'not found' }, 404, h);
  },
} satisfies ExportedHandler<Env>;
