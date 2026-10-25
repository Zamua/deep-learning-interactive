import { describe, expect, it } from 'vitest';
import { b64u, encrypt, isPushEndpoint, vapidAuth } from './webpush';

// RFC 8291 section 5: the message, keys and resulting body.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

/** A P-256 key pair from a raw private scalar and its uncompressed public point. */
async function keyPair(d: string, pub: string, usage: 'ECDH' | 'ECDSA'): Promise<CryptoKeyPair> {
  const p = b64u.decode(pub);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.encode(p.slice(1, 33)), y: b64u.encode(p.slice(33)), d };
  const alg = { name: usage, namedCurve: 'P-256' };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, alg, true, usage === 'ECDH' ? ['deriveBits'] : ['sign']);
  const publicKey = await crypto.subtle.importKey('jwk', { ...jwk, d: undefined }, alg, true, usage === 'ECDH' ? [] : ['verify']);
  return { privateKey, publicKey };
}

describe('encrypt', () => {
  it('reproduces the RFC 8291 example byte for byte', async () => {
    const keys = await keyPair(RFC.asPrivate, RFC.asPublic, 'ECDH');
    const salt = b64u.decode(RFC.body).slice(0, 16);
    const body = await encrypt(new TextEncoder().encode(RFC.plaintext), RFC.uaPublic, RFC.auth, { keys, salt });
    expect(b64u.encode(body)).toBe(RFC.body);
  });
});

describe('vapidAuth', () => {
  it('signs a token for the push service origin that verifies with the public key', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
    const pub = b64u.encode(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer));
    const header = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', jwk, pub, 'https://example.com', 1_000_000_000_000);
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(pub);
    const [h, c, sig] = token!.split('.');
    expect(JSON.parse(new TextDecoder().decode(b64u.decode(c!)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_000_000_000 + 43_200, sub: 'https://example.com' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, b64u.decode(sig!), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});

describe('isPushEndpoint', () => {
  it('accepts browser push services only', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('not a url')).toBe(false);
  });
});
