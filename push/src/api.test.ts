import { describe, expect, it } from 'vitest';
import { endpointFrom, subscriptionFrom } from './api';
import { b64u } from './webpush';
import type { EndpointBody, SubscriptionBody } from './wire';

const endpoint = 'https://web.push.apple.com/QGx';
/** A browser's keys as the push service hands them out: a 65-byte P-256 point and a 16-byte secret. */
const p256dh = b64u.encode(new Uint8Array([4, ...new Array(64).fill(7)]));
const auth = b64u.encode(new Uint8Array(16).fill(3));
const full = { subscription: { endpoint, keys: { p256dh, auth } }, time: '19:00', tz: 'America/New_York', lastActive: 5 } satisfies SubscriptionBody;

describe('endpointFrom', () => {
  it('reads the subscription endpoint or a bare one, and only push services', () => {
    expect(endpointFrom(full)).toBe(endpoint);
    expect(endpointFrom({ endpoint } satisfies EndpointBody)).toBe(endpoint);
    expect(endpointFrom({ endpoint: 'https://example.com/x' })).toBeNull();
    expect(endpointFrom({ subscription: null, endpoint })).toBe(endpoint);
  });
});

describe('subscriptionFrom', () => {
  it('reads a whole subscription', () => {
    expect(subscriptionFrom(full)).toEqual({ endpoint, p256dh, auth, time: '19:00', tz: 'America/New_York', lastActive: 5 });
  });

  it('is null, not a throw, for any partial or malformed body', () => {
    for (const body of [
      { endpoint, time: '19:00', tz: 'UTC' },
      { ...full, subscription: null },
      { ...full, subscription: 'x' },
      { ...full, subscription: { endpoint } },
      { ...full, subscription: { endpoint, keys: null } },
      { ...full, subscription: { endpoint, keys: { p256dh: 1, auth } } },
      { ...full, subscription: { endpoint, keys: { p256dh: 'bm90LWEta2V5', auth } } },
      { ...full, subscription: { endpoint, keys: { p256dh, auth: b64u.encode(new Uint8Array(8)) } } },
      { ...full, subscription: { endpoint, keys: { p256dh: 'not base64!', auth } } },
      { ...full, time: '25:00' },
      { ...full, tz: 'Nowhere/Else' },
      { ...full, lastActive: 'soon' },
    ]) {
      expect(subscriptionFrom(body as Record<string, unknown>)).toBeNull();
    }
  });
});
