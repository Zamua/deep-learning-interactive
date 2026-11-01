// The Worker's request bodies, read at the boundary: anything that is not the expected shape is null, never a throw.
import { validTime, validZone } from './schedule';
import { b64u, isPushEndpoint } from './webpush';

/** A PUT /subscription: the browser's push subscription, its reminder time and zone, and its latest practice. */
export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  time: string;
  tz: string;
  lastActive: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The push endpoint a body names, as `subscription.endpoint` or a bare `endpoint`. */
export function endpointFrom(body: Record<string, unknown>): string | null {
  const sub = isObj(body.subscription) ? body.subscription : {};
  const endpoint = String(sub.endpoint ?? body.endpoint ?? '');
  return isPushEndpoint(endpoint) ? endpoint : null;
}

const bytes = (s: string): number => {
  try {
    return /^[\w-]+$/.test(s) ? b64u.decode(s).length : -1;
  } catch {
    return -1;
  }
};

/** Keys a push can be encrypted to: an uncompressed P-256 point (65 bytes) and a 16-byte secret. */
const validKeys = (p256dh: string, auth: string): boolean => bytes(p256dh) === 65 && b64u.decode(p256dh)[0] === 4 && bytes(auth) === 16;

export function subscriptionFrom(body: Record<string, unknown>): Subscription | null {
  const endpoint = endpointFrom(body);
  const sub = isObj(body.subscription) ? body.subscription : {};
  const keys = isObj(sub.keys) ? sub.keys : {};
  const time = String(body.time ?? '');
  const tz = String(body.tz ?? '');
  const lastActive = Number(body.lastActive ?? 0);
  if (!endpoint || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || !validKeys(keys.p256dh, keys.auth)) return null;
  if (!validTime(time) || !validZone(tz) || !Number.isFinite(lastActive)) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth, time, tz, lastActive };
}
