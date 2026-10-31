import { describe, expect, it } from 'vitest';
import { endpointFrom, subscriptionFrom } from './api';

const endpoint = 'https://web.push.apple.com/QGx';
const full = { subscription: { endpoint, keys: { p256dh: 'pk', auth: 'au' } }, time: '19:00', tz: 'America/New_York', lastActive: 5 };

describe('endpointFrom', () => {
  it('reads the subscription endpoint or a bare one, and only push services', () => {
    expect(endpointFrom(full)).toBe(endpoint);
    expect(endpointFrom({ endpoint })).toBe(endpoint);
    expect(endpointFrom({ endpoint: 'https://example.com/x' })).toBeNull();
    expect(endpointFrom({ subscription: null, endpoint })).toBe(endpoint);
  });
});

describe('subscriptionFrom', () => {
  it('reads a whole subscription', () => {
    expect(subscriptionFrom(full)).toEqual({ endpoint, p256dh: 'pk', auth: 'au', time: '19:00', tz: 'America/New_York', lastActive: 5 });
  });

  it('is null, not a throw, for any partial or malformed body', () => {
    for (const body of [
      { endpoint, time: '19:00', tz: 'UTC' },
      { ...full, subscription: null },
      { ...full, subscription: 'x' },
      { ...full, subscription: { endpoint } },
      { ...full, subscription: { endpoint, keys: null } },
      { ...full, subscription: { endpoint, keys: { p256dh: 1, auth: 'au' } } },
      { ...full, time: '25:00' },
      { ...full, tz: 'Nowhere/Else' },
      { ...full, lastActive: 'soon' },
    ]) {
      expect(subscriptionFrom(body as Record<string, unknown>)).toBeNull();
    }
  });
});
