// Web Push with nothing but WebCrypto: the VAPID token that identifies the sender (RFC 8292),
// and the aes128gcm payload encryption the browser's keys require (RFC 8291).

export const b64u = {
  encode(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(t, (c) => c.charCodeAt(0));
  },
};

const text = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** The P-256 public key of a key pair, uncompressed: 0x04 || x || y. */
export async function rawPublic(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer);
}

export interface Sender {
  /** An ECDH P-256 key pair, fresh for every message. */
  keys: CryptoKeyPair;
  /** 16 random bytes, fresh for every message. */
  salt: Uint8Array;
}

export async function newSender(): Promise<Sender> {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  return { keys, salt: crypto.getRandomValues(new Uint8Array(16)) };
}

/**
 * Encrypts `plaintext` for one subscription as a single aes128gcm record. `p256dh` and `auth`
 * are the subscription's keys, base64url as the browser gives them.
 */
export async function encrypt(plaintext: Uint8Array, p256dh: string, auth: string, sender: Sender): Promise<Uint8Array> {
  const uaPublic = b64u.decode(p256dh);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  // The standard member is `public`; the Workers type definitions spell it `$public`.
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, sender.keys.privateKey, 256));
  const asPublic = await rawPublic(sender.keys.publicKey);
  const ikm = await hkdf(b64u.decode(auth), ecdh, concat(text('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic), 32);
  const cek = await hkdf(sender.salt, ikm, concat(text('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(sender.salt, ikm, concat(text('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record, so the plaintext ends with the last-record delimiter and no padding.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(sender.salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, sealed);
}

/** The VAPID `Authorization` header for a push service: a short-lived ES256 token plus the public key. */
export async function vapidAuth(endpoint: string, privateJwk: JsonWebKey, publicKey: string, subject: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o: object) => b64u.encode(text(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(unsigned)));
  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${publicKey}`;
}

/** Push services browsers use; the Worker only ever sends to these hosts. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[\w-]+\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}
