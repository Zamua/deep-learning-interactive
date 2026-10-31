// What the page sends the reminder Worker, and what a push carries to the page's service worker (src/offline/sw.js).

/** `test` answers the page's "send a test"; `daily` is the reminder itself. */
export type PushKind = 'daily' | 'test';

/** A push's whole payload: the words come from what the page saved, so no progress leaves the device. */
export interface PushPayload {
  kind: PushKind;
}

/** PUT /subscription. */
export interface SubscriptionBody {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  /** Local time of day, "HH:MM". */
  time: string;
  /** IANA time zone. */
  tz: string;
  /** Epoch ms of the latest practice. */
  lastActive: number;
}

/** DELETE /subscription and POST /test. */
export interface EndpointBody {
  endpoint: string;
}
