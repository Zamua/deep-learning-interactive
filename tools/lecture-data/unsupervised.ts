// Replays the unsupervised chapter's toy AE/VAE/GAN runs and writes the lecture's snapshots,
// src/lectures/unsupervised/data.ts. Usage: node tools/lecture-data/unsupervised.ts
import { writeFileSync } from 'node:fs';
import { TinyNet } from '../../src/lib/unsupervised-net.ts';
import { Rng } from '../../src/core/rand.ts';

const OUT = new URL('../../src/lectures/unsupervised/data.ts', import.meta.url);
const num = (v: number, d: number) => {
  let s = v.toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  s = s.replace(/^(-?)0\./, '$1.');
  return s === '-0' || s === '' ? '0' : s;
};
const arr = (a: ArrayLike<number>, d: number) => `[${Array.from(a, (v) => num(v, d)).join(',')}]`;
const flat = (n: TinyNet) => { const o: number[] = []; n.W.forEach((W, l) => { o.push(...W, ...n.b[l]!); }); return o; };
const sigm = (v: number) => 1 / (1 + Math.exp(-v));

// ---------- autoencoder (chapter figure: arc, 150 points, seed 3; init Rng(7); adam 0.01)
function toyArc(n: number, seed: number) {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = (0.35 + 1.3 * r.next()) * Math.PI;
    X[2 * i] = 1.1 * Math.cos(t) + 0.05 * r.randn();
    X[2 * i + 1] = 0.95 * Math.sin(t) + 0.05 * r.randn();
  }
  return X;
}
const AE_STEPS = [0, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1000, 1300, 1600, 2000];
function ae(linear: boolean) {
  const N = 150;
  const X = toyArc(N, 3);
  const r = new Rng(7);
  const rn = () => r.randn();
  const enc = linear ? new TinyNet([2, 1], ['linear'], rn) : new TinyNet([2, 16, 1], ['tanh', 'linear'], rn);
  const dec = linear ? new TinyNet([1, 2], ['linear'], rn) : new TinyNet([1, 16, 2], ['tanh', 'linear'], rn);
  const lossNow = () => { const xh = dec.run(enc.run(X, N), N); let l = 0; for (let i = 0; i < 2 * N; i++) l += (xh[i]! - X[i]!) ** 2; return l / N; };
  const w: string[] = [], loss: number[] = [];
  for (let step = 0; step <= 2000; step++) {
    if (AE_STEPS.includes(step)) { w.push(arr([...flat(enc), ...flat(dec)], 4)); loss.push(lossNow()); }
    if (step === 2000) break;
    const z = enc.forward(X, N);
    const xh = dec.forward(z, N);
    const d = new Float64Array(N * 2);
    for (let i = 0; i < N * 2; i++) d[i] = (2 * (xh[i]! - X[i]!)) / N;
    enc.backward(dec.backward(d));
    enc.adam(0.01);
    dec.adam(0.01);
  }
  return { w, loss };
}
const aeLin = ae(true), aeMlp = ae(false);
console.log('AE loss lin', aeLin.loss.map((v) => v.toFixed(4)).join(' '));
console.log('AE loss mlp', aeMlp.loss.map((v) => v.toFixed(4)).join(' '));

// ---------- VAE (chapter figure: 300 points, Rng(21); build(3); adam 3e-3; 3000 steps)
const VAE_STEPS = [0, 40, 80, 120, 160, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500, 1800, 2100, 2500, 3000];
const VAE_ZS = 81;
function vae() {
  const N = 300;
  const r0 = new Rng(21);
  const X = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) {
    const t = (0.35 + 1.3 * r0.next()) * Math.PI;
    X[2 * i] = Math.cos(t) + 0.04 * r0.randn();
    X[2 * i + 1] = 0.8 * Math.sin(t) + 0.04 * r0.randn();
  }
  const r = new Rng(3);
  const rn = () => r.randn();
  const enc = new TinyNet([2, 32, 2], ['tanh', 'linear'], rn);
  const dec = new TinyNet([1, 32, 32, 2], ['tanh', 'tanh', 'linear'], rn);
  const rng = new Rng(4);
  const gr = new Rng(77);
  const gen = new Float64Array(200).map(() => gr.randn());
  const zs = new Float64Array(VAE_ZS).map((_, i) => -2.6 + (5.2 * i) / (VAE_ZS - 1));
  let ema = { rec: NaN, kl: NaN };
  const curves: string[] = [], rec: number[] = [], kl: number[] = [];
  const B = 64;
  for (let step = 0; step <= 3000; step++) {
    if (VAE_STEPS.includes(step)) { curves.push(arr(dec.run(zs, VAE_ZS), 3)); rec.push(ema.rec); kl.push(ema.kl); }
    if (step === 3000) break;
    const xb = new Float64Array(B * 2);
    for (let i = 0; i < B; i++) { const k = rng.int(N); xb[2 * i] = X[2 * k]!; xb[2 * i + 1] = X[2 * k + 1]!; }
    const h = enc.forward(xb, B);
    const eps = new Float64Array(B).map(() => rng.randn());
    const z = new Float64Array(B);
    for (let i = 0; i < B; i++) z[i] = h[2 * i]! + Math.exp(0.5 * h[2 * i + 1]!) * eps[i]!;
    const xh = dec.forward(z, B);
    let rc = 0, k = 0;
    const dxh = new Float64Array(B * 2);
    for (let i = 0; i < B * 2; i++) { const d = xh[i]! - xb[i]!; rc += 50 * d * d; dxh[i] = (100 * d) / B; }
    const dz = dec.backward(dxh);
    const dh = new Float64Array(B * 2);
    for (let i = 0; i < B; i++) {
      const m = h[2 * i]!, lv = h[2 * i + 1]!;
      k += 0.5 * (m * m + Math.exp(lv) - 1 - lv);
      dh[2 * i] = dz[i]! + m / B;
      dh[2 * i + 1] = dz[i]! * 0.5 * Math.exp(0.5 * lv) * eps[i]! + (0.5 * (Math.exp(lv) - 1)) / B;
    }
    enc.backward(dh);
    enc.adam(3e-3);
    dec.adam(3e-3);
    const res = { rec: rc / B, kl: k / B };
    ema = step === 0 ? res : { rec: 0.95 * ema.rec + 0.05 * res.rec, kl: 0.95 * ema.kl + 0.05 * res.kl };
  }
  // the encoder's mean and spread for 24 data points, for the "codes fill the prior" picture
  const pick = new Float64Array(48);
  for (let i = 0; i < 24; i++) { pick[2 * i] = X[2 * i * 12]!; pick[2 * i + 1] = X[2 * i * 12 + 1]!; }
  const hh = enc.run(pick, 24);
  return { curves, rec, kl, gen: arr(dec.run(gen, 200), 3), mu: arr(Array.from({ length: 24 }, (_, i) => hh[2 * i]!), 3), sig: arr(Array.from({ length: 24 }, (_, i) => Math.exp(0.5 * hh[2 * i + 1]!)), 3) };
}
const V = vae();
console.log('VAE rec', V.rec.map((v) => v.toFixed(3)).join(' '));
console.log('VAE kl', V.kl.map((v) => v.toFixed(3)).join(' '));
console.log('VAE mu', V.mu, 'sig', V.sig);

// ---------- GAN (chapter figure: two bumps, k = 1, adam 2e-3 beta1 0.5)
const NB = 48, LO = -4, HI = 4, DX = 61, GZ = 31;
function gan(seed: number, every: number, until: number) {
  const B = 64;
  const r = new Rng(seed);
  const rn = () => r.randn();
  const G = new TinyNet([1, 16, 16, 1], ['leaky', 'leaky', 'linear'], rn);
  const D = new TinyNet([1, 24, 24, 1], ['leaky', 'leaky', 'linear'], rn);
  const rng = new Rng(seed + 100);
  const real = () => (rng.next() < 0.5 ? -1.6 : 1.6) + 0.35 * rng.randn();
  const zr = new Rng(9);
  const zTest = new Float64Array(3000).map(() => zr.randn());
  const xs = new Float64Array(DX).map((_, i) => LO + ((HI - LO) * i) / (DX - 1));
  const gz = new Float64Array(GZ).map((_, i) => -3 + (6 * i) / (GZ - 1));
  let ld = NaN, lg = NaN;
  const hist: string[] = [], dcur: string[] = [], gmap: string[] = [], lds: number[] = [], lgs: number[] = [];
  for (let step = 0; step <= until; step++) {
    if (step % every === 0) {
      const g = G.run(zTest, 3000);
      const counts = new Array(NB).fill(0);
      for (const v of g) { const b = Math.floor(((v - LO) / (HI - LO)) * NB); if (b >= 0 && b < NB) counts[b]++; }
      hist.push(arr(counts, 0));
      dcur.push(arr(Array.from(D.run(xs, DX), sigm), 2));
      gmap.push(arr(G.run(gz, GZ), 2));
      lds.push(ld); lgs.push(lg);
    }
    if (step === until) break;
    const xr = new Float64Array(B).map(real);
    const xf = G.run(new Float64Array(B).map(() => rng.randn()), B);
    const or = D.forward(xr, B);
    let l = 0;
    D.backward(or.map((v) => { l -= Math.log(Math.max(1e-9, sigm(v))); return (sigm(v) - 1) / B; }));
    const of = D.forward(xf, B);
    D.backward(of.map((v) => { l -= Math.log(Math.max(1e-9, 1 - sigm(v))); return sigm(v) / B; }));
    D.adam(2e-3, 0.5);
    const xg = G.forward(new Float64Array(B).map(() => rng.randn()), B);
    const og = D.forward(xg, B);
    let l2 = 0;
    const dx = D.backward(og.map((v) => { l2 -= Math.log(Math.max(1e-9, sigm(v))); return (sigm(v) - 1) / B; }));
    D.zeroGrad();
    G.backward(dx);
    G.adam(2e-3, 0.5);
    ld = Number.isNaN(ld) ? l / B : 0.95 * ld + 0.05 * (l / B);
    lg = Number.isNaN(lg) ? l2 / B : 0.95 * lg + 0.05 * (l2 / B);
  }
  return { hist, dcur, gmap, lds, lgs };
}
const g2 = gan(2, 100, 4000);
const g42 = gan(42, 100, 2000);
console.log('GAN2 ld', g2.lds.map((v) => v.toFixed(2)).join(' '));
console.log('GAN2 lg', g2.lgs.map((v) => v.toFixed(2)).join(' '));

const lines = (a: string[]) => `[\n    ${a.join(',\n    ')},\n  ]`;
const src = `// Generated offline by replaying the chapter's own toy trainings (TinyNet, same data, sizes,
// seeds and learning rates): the VAE and GAN runs take seconds, too long for page load.

/** Training steps at which the autoencoder snapshots were taken. */
export const AE_STEPS = ${arr(AE_STEPS, 0)};

/**
 * Autoencoder on the arc. \`w[k]\` is the encoder then the decoder, each layer's W (out x in,
 * row-major) then b; \`loss[k]\` is the mean squared reconstruction distance at that step.
 */
export const AE_LIN = {
  loss: ${arr(aeLin.loss, 4)},
  w: ${lines(aeLin.w)},
};
export const AE_MLP = {
  loss: ${arr(aeMlp.loss, 4)},
  w: ${lines(aeMlp.w)},
};

export const VAE_STEPS = ${arr(VAE_STEPS, 0)};
/** Decoder output (x, y pairs) at ${VAE_ZS} codes evenly spaced from -2.6 to 2.6, per snapshot. */
export const VAE_CURVES: number[][] = ${lines(V.curves)};
/** Smoothed reconstruction and KL terms at each snapshot (NaN before the first step). */
export const VAE_REC = ${arr(V.rec, 3).replace(/NaN/g, 'NaN')};
export const VAE_KL = ${arr(V.kl, 3)};
/** The trained decoder applied to 200 codes drawn from N(0, 1) (Rng 77). */
export const VAE_GEN = ${V.gen};
/** The trained encoder's mean and spread for 24 of the training points. */
export const VAE_MU = ${V.mu};
export const VAE_SIG = ${V.sig};

/** A GAN run, snapshotted every \`every\` steps. */
export interface GanRun {
  every: number;
  /** Histogram of 3,000 samples of G(z): ${NB} bins over [${LO}, ${HI}]. */
  hist: number[][];
  /** D(x) at ${DX} points evenly spaced over [${LO}, ${HI}]. */
  d: number[][];
  /** G(z) at ${GZ} codes evenly spaced over [-3, 3]. */
  g: number[][];
  /** Smoothed loss_D and loss_G. */
  ld: number[];
  lg: number[];
}

/** The chapter's default run (seed 2): converges onto both bumps. */
export const GAN_OK: GanRun = {
  every: 100,
  hist: ${lines(g2.hist)},
  d: ${lines(g2.dcur)},
  g: ${lines(g2.gmap)},
  ld: ${arr(g2.lds, 3)},
  lg: ${arr(g2.lgs, 3)},
};

/** Seed 42: collapses onto the left bump for about 800 steps, then recovers. */
export const GAN_COLLAPSE: GanRun = {
  every: 100,
  hist: ${lines(g42.hist)},
  d: ${lines(g42.dcur)},
  g: ${lines(g42.gmap)},
  ld: ${arr(g42.lds, 3)},
  lg: ${arr(g42.lgs, 3)},
};
`;
writeFileSync(OUT, src);
console.log('wrote', OUT, src.length, 'bytes');
