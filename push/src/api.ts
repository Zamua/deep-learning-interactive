// The Worker's request bodies, read at the boundary: anything that is not the expected shape is null, never a throw.
import { validTime, validZone } from './schedule';
import { isPushEndpoint } from './webpush';

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

export function subscriptionFrom(body: Record<string, unknown>): Subscription | null {
  const endpoint = endpointFrom(body);
  const sub = isObj(body.subscription) ? body.subscription : {};
  const keys = isObj(sub.keys) ? sub.keys : {};
  const time = String(body.time ?? '');
  const tz = String(body.tz ?? '');
  const lastActive = Number(body.lastActive ?? 0);
  if (!endpoint || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || !validTime(time) || !validZone(tz) || !Number.isFinite(lastActive)) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth, time, tz, lastActive };
}
