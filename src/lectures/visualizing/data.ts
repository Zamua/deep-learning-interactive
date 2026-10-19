/**
 * The chapter's trained network, its images and precomputed analysis, plus the slow experiments
 * the scenes replay (occlusion, gradient ascent, inversion, ...). Those run in a worker, the ones
 * the visible scene asks for first, and arrive as snapshots that a scene picks by time, so drawing
 * stays a pure function of time once an experiment has finished.
 */
import { type CifarSet, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Scene } from '../../lecture/scene';
import { type ConvNet, type Stage, type Trace, argmax, loadNet, softmax } from '../../lib/visualizing-net';
import { CLASS_VIZ, FRAME, INVERT, type In, type Init, type Out } from './protocol';
import { inferno, viridis } from '../../lib/visualizing-ui';

export interface Analysis {
  tsne: { codes: [number, number][]; pixels: [number, number][] };
  nn: { codes: number[][]; pixels: number[][] };
  units: Record<string, [number, number, number, number][][]>;
  labels: number[];
  stats: Record<string, { zeros: number; everOn: number[] }>;
  gallery: number[];
  occGallery: number[];
}

export interface Assets {
  net: ConvNet;
  train: CifarSet;
  test: CifarSet;
  an: Analysis;
  /** Test-set indices: one image per class in class order, then another row of the same. */
  gallery: number[];
  occGallery: number[];
}

// ---------------------------------------------------------------- canvases

export type Cmap = (t: number) => [number, number, number];

export function toCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** A network input (3 x 32 x 32, mean subtracted) as a picture. */
export function inputCanvas(x: Float32Array, mean: number[]): HTMLCanvasElement {
  const img = new ImageData(32, 32);
  for (let q = 0; q < 1024; q++) {
    for (let c = 0; c < 3; c++) img.data[q * 4 + c] = Math.max(0, Math.min(255, (x[c * 1024 + q]! + mean[c]!) * 255));
    img.data[q * 4 + 3] = 255;
  }
  return toCanvas(img);
}

/** One n x n map starting at `off`, through a colormap scaled to [0, hi]. */
export function mapCanvas(F: ArrayLike<number>, off: number, n: number, hi: number, cmap: Cmap = inferno): HTMLCanvasElement {
  const img = new ImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const [r, g, b] = cmap(F[off + i]! / (hi || 1));
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  return toCanvas(img);
}

/** A 3 x n x n block stretched so its own min is black and max white (how filters are drawn). */
export function filterCanvas(W: ArrayLike<number>, off: number, n: number): HTMLCanvasElement {
  let mn = Infinity;
  let mx = -Infinity;
  const N = n * n;
  for (let i = 0; i < 3 * N; i++) {
    mn = Math.min(mn, W[off + i]!);
    mx = Math.max(mx, W[off + i]!);
  }
  const img = new ImageData(n, n);
  const k = 255 / (mx - mn || 1);
  for (let q = 0; q < N; q++) {
    for (let c = 0; c < 3; c++) img.data[q * 4 + c] = (W[off + c * N + q]! - mn) * k;
    img.data[q * 4 + 3] = 255;
  }
  return toCanvas(img);
}

function cifarCanvas(set: CifarSet, i: number): HTMLCanvasElement {
  const img = new ImageData(32, 32);
  const o = i * 3072;
  for (let q = 0; q < 1024; q++) {
    img.data[q * 4] = set.pixels[o + q]!;
    img.data[q * 4 + 1] = set.pixels[o + 1024 + q]!;
    img.data[q * 4 + 2] = set.pixels[o + 2048 + q]!;
    img.data[q * 4 + 3] = 255;
  }
  return toCanvas(img);
}

const memo = new Map<string, unknown>();
export function once<T>(key: string, f: () => T): T {
  if (!memo.has(key)) memo.set(key, f());
  return memo.get(key) as T;
}

export const testImg = (a: Assets, i: number): HTMLCanvasElement => once(`test-${i}`, () => cifarCanvas(a.test, i));
/** Image i of the chapter's 1,200-image sample: 0-999 from the train file, 1000-1199 from the test file. */
export const sampleImg = (a: Assets, i: number): HTMLCanvasElement => once(`sample-${i}`, () => (i < 1000 ? cifarCanvas(a.train, i) : cifarCanvas(a.test, i - 1000)));

// ---------------------------------------------------------------- loading

let A: Assets | null = null;
let failed = '';
let plot: Plot | null = null;
let lastAssets = 0;

const fetchOk = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url.split('/').pop()}: ${r.status}`);
    return r;
  });

Promise.all([
  loadNet(),
  loadCifar(),
  fetchOk('./data/visualizing-analysis.json').then((r) => r.json() as Promise<Analysis>),
  fetchOk('./data/visualizing-net.json').then((r) => r.json() as Promise<Init['manifest']>),
  fetchOk('./data/visualizing-net.bin').then((r) => r.arrayBuffer()),
])
  .then(([net, c, an, manifest, buf]) => {
    const rows = (g: number[]) => [...g.filter((_, i) => i % 2 === 0), ...g.filter((_, i) => i % 2 === 1)];
    A = { net, train: c.train, test: c.test, an, gallery: rows(an.gallery), occGallery: rows(an.occGallery) };
    start(A, manifest, buf);
    plot?.redraw();
  })
  .catch((e: Error) => {
    failed = e.message;
    plot?.redraw();
  });

/** The network and data, or null while they load (the stage redraws once they land). */
export function assets(s: Scene): Assets | null {
  plot = s.p;
  lastAssets = performance.now();
  if (paused && worker && plot.canvas.isConnected) {
    paused = false;
    worker.postMessage({ type: 'resume' } satisfies In);
  }
  return A;
}

export const loadError = (): string => failed;

// ---------------------------------------------------------------- the experiments, run by the worker

export { CLASS_VIZ, INVERT };

export interface Occlusion {
  img: number;
  y: number;
  base: number;
  /** Probability of the true class with the patch at each of the 256 spots, filled as they arrive. */
  heat: Float32Array;
  pos: number;
  x0: Float32Array;
}

export interface Saliency {
  img: number;
  probs: Float32Array;
  pred: number;
  other: number;
  /** `${rule}-${class}` -> saliency (inferno) and the image masked by it. */
  maps: Map<string, { sal: HTMLCanvasElement; masked: HTMLCanvasElement }>;
}

/** Snapshots every `every` steps, with one number per snapshot (a probability or a loss). */
export interface Run {
  frames: HTMLCanvasElement[];
  vals: number[];
  /** The step of the latest snapshot. */
  step: number;
  total: number;
  every: number;
}

export interface Texture extends Run {
  grams: HTMLCanvasElement[];
  src: HTMLCanvasElement | null;
}

export interface Fooling {
  img: number;
  target: number;
  frames: HTMLCanvasElement[];
  diffs: HTMLCanvasElement[];
  probs: Float32Array[];
  linf: number[];
  /** Magnification of each difference image. */
  mag: number[];
  finished: boolean;
}

export interface Fgsm {
  eps: number[];
  preds: number[];
  conf: number[];
}

function gramCanvas(G: Float32Array, C: number, hi: number): HTMLCanvasElement {
  const img = new ImageData(C, C);
  for (let i = 0; i < C * C; i++) {
    const [r, g, b] = inferno(Math.sqrt(Math.max(0, G[i]!) / hi));
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  return toCanvas(img);
}

let worker: Worker | null = null;
let paused = false;
const states = new Map<string, unknown>();
const done = new Set<string>();
const asked = new Map<string, number>();
let sentWanted = '';
let wantQueued = false;
let lastRedraw = 0;
let redrawQueued = false;

function start(a: Assets, manifest: Init['manifest'], buf: ArrayBuffer): void {
  const net = a.net;
  const mean = net.mean;
  const input = (i: number) => net.input(a.test.pixels, i);
  const run = (total: number, every: number): Run => ({ frames: [], vals: [], step: 0, total, every });

  const occImg = a.occGallery[2]!;
  const occ: Occlusion = { img: occImg, y: a.test.labels[occImg]!, base: 0, heat: new Float32Array(256).fill(NaN), pos: 0, x0: input(occImg) };
  occ.base = softmax(net.forward(occ.x0).scores)[occ.y]!;
  states.set('occlusion', occ);

  const salImg = a.gallery[5]!;
  const probs = softmax(net.forward(input(salImg)).scores);
  const pred = argmax(probs);
  const sal: Saliency = { img: salImg, probs, pred, other: pred === 3 ? 5 : 3, maps: new Map() };
  states.set('saliency', sal);
  const salPx = testImg(a, salImg).getContext('2d')!.getImageData(0, 0, 32, 32);

  for (const c of CLASS_VIZ) states.set(`class-${c}`, run(300, FRAME));
  for (const l of INVERT) states.set(`invert-${l}`, run(200, FRAME));
  states.set('dream', { ...run(60, 1), frames: [inputCanvas(input(a.gallery[16]!), mean)], vals: [0] });
  const tex: Texture = { ...run(300, FRAME), grams: [], src: null };
  states.set('texture', tex);
  let texHi = 1;

  const foolImg = a.gallery[14]!;
  const foolX0 = input(foolImg);
  const fool: Fooling = { img: foolImg, target: 0, frames: [], diffs: [], probs: [], linf: [], mag: [], finished: false };
  states.set('fool', fool);
  const fg: Fgsm = { eps: [], preds: [], conf: [] };
  states.set('fgsm', fg);

  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<Out>) => {
    const m = e.data;
    switch (m.kind) {
      case 'occ':
        occ.heat[m.pos] = m.p;
        occ.pos = m.pos + 1;
        break;
      case 'sal': {
        const hi = Float32Array.from(m.sal).sort()[Math.floor(1023 * 0.99)]! || 1;
        const img = new ImageData(32, 32);
        for (let i = 0; i < 1024; i++) {
          const k = Math.min(1, m.sal[i]! / hi);
          for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = 16 * (1 - k) + salPx.data[i * 4 + ch]! * k;
          img.data[i * 4 + 3] = 255;
        }
        sal.maps.set(`${m.rule}-${m.c}`, { sal: mapCanvas(m.sal, 0, 32, hi), masked: toCanvas(img) });
        break;
      }
      case 'gram-src':
        texHi = m.g.reduce((p, q) => Math.max(p, q), 0) || 1;
        tex.src = gramCanvas(m.g, 16, texHi);
        break;
      case 'frame': {
        const r = states.get(m.key) as Run;
        r.frames.push(inputCanvas(m.x, mean));
        r.vals.push(m.v);
        r.step = m.step;
        if (m.g) tex.grams.push(gramCanvas(m.g, 16, texHi));
        break;
      }
      case 'fool': {
        let mx = 0;
        for (let i = 0; i < 3072; i++) mx = Math.max(mx, Math.abs(m.x[i]! - foolX0[i]!));
        const mag = mx > 0 ? 0.5 / mx : 1;
        const dm = new ImageData(32, 32);
        for (let q = 0; q < 1024; q++) {
          for (let c = 0; c < 3; c++) dm.data[q * 4 + c] = 128 + 255 * mag * (m.x[c * 1024 + q]! - foolX0[c * 1024 + q]!);
          dm.data[q * 4 + 3] = 255;
        }
        fool.frames.push(inputCanvas(m.x, mean));
        fool.diffs.push(toCanvas(dm));
        fool.probs.push(m.probs);
        fool.linf.push(mx * 255);
        fool.mag.push(mag);
        break;
      }
      case 'fgsm':
        fg.eps.push(m.eps);
        fg.preds.push(m.pred);
        fg.conf.push(m.conf);
        break;
      case 'done':
        done.add(m.key);
        if (m.key === 'fool') fool.finished = true;
        break;
    }
    // The lecture was closed: let the worker rest until a scene asks again.
    if (!plot || !plot.canvas.isConnected) {
      if (!paused) {
        paused = true;
        worker!.postMessage({ type: 'pause' } satisfies In);
      }
      return;
    }
    if (wantedKeys().includes(m.key)) redrawSoon();
  };
  const init: Init = {
    type: 'init',
    manifest,
    buf,
    occ: { x: occ.x0, y: occ.y },
    sal: { x: input(salImg), classes: [sal.pred, sal.other] },
    frog: input(a.gallery[6]!),
    dream: input(a.gallery[16]!),
    fool: { x: foolX0, y: a.test.labels[foolImg]!, target: fool.target },
  };
  worker.postMessage(init, [buf]);
  sendWanted();
}

/** Keys asked for by the latest draw. */
function wantedKeys(): string[] {
  return [...asked].filter(([, t]) => t >= lastAssets - 60).map(([k]) => k);
}

function sendWanted(): void {
  wantQueued = false;
  if (!worker) return;
  const keys = wantedKeys().filter((k) => !done.has(k));
  const j = keys.join(',');
  if (j === sentWanted) return;
  sentWanted = j;
  worker.postMessage({ type: 'want', keys } satisfies In);
}

/** Redraws the stage for new results, at most ten times a second (the player redraws anyway while playing). */
function redrawSoon(): void {
  if (redrawQueued) return;
  const wait = Math.max(0, lastRedraw + 100 - performance.now());
  redrawQueued = true;
  setTimeout(() => {
    redrawQueued = false;
    lastRedraw = performance.now();
    if (plot?.canvas.isConnected) plot.redraw();
  }, wait);
}

/** A job's state, marking it as wanted by the scene on screen. */
function use<T>(key: string): T | null {
  const st = states.get(key);
  if (st === undefined) return null;
  asked.set(key, performance.now());
  if (!wantQueued) {
    wantQueued = true;
    queueMicrotask(sendWanted);
  }
  return st as T;
}

export const occlusion = (s: Scene): Occlusion | null => (assets(s) ? use<Occlusion>('occlusion') : null);
export const saliency = (s: Scene): Saliency | null => (assets(s) ? use<Saliency>('saliency') : null);
export const classViz = (s: Scene, c: number): Run | null => (assets(s) ? use<Run>(`class-${c}`) : null);
export const inversion = (s: Scene, l: Stage): Run | null => (assets(s) ? use<Run>(`invert-${l}`) : null);
export const dream = (s: Scene): Run | null => (assets(s) ? use<Run>('dream') : null);
export const texture = (s: Scene): Texture | null => (assets(s) ? use<Texture>('texture') : null);
export const fooling = (s: Scene): Fooling | null => (assets(s) ? use<Fooling>('fool') : null);
export const fgsm = (s: Scene): Fgsm | null => (assets(s) ? use<Fgsm>('fgsm') : null);

/** The snapshot of a run nearest to `step` that has been computed so far. */
export function frameAt(r: Run, step: number): { k: number; c: HTMLCanvasElement; v: number; step: number } {
  const k = Math.max(0, Math.min(r.frames.length - 1, Math.floor(step / r.every)));
  return { k, c: r.frames[k]!, v: r.vals[k]!, step: k * r.every };
}

// ---------------------------------------------------------------- quick, memoized results

/** Forward pass of a test image, kept. */
export const traceOf = (a: Assets, img: number): Trace => once(`trace-${img}`, () => a.net.forward(a.net.input(a.test.pixels, img)));

/** |d score / d pixel|, max over colors, as an inferno canvas: what the backward pass returns. */
export function gradCanvas(a: Assets, img: number): HTMLCanvasElement {
  return once(`grad-${img}`, () => {
    const x = a.net.input(a.test.pixels, img);
    const c = argmax(traceOf(a, img).scores);
    const { dx } = a.net.scoreGrad(x, c);
    const sal = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) sal[i] = Math.max(Math.abs(dx[i]!), Math.abs(dx[1024 + i]!), Math.abs(dx[2048 + i]!));
    const hi = Float32Array.from(sal).sort()[Math.floor(1023 * 0.99)]! || 1;
    return mapCanvas(sal, 0, 32, hi);
  });
}

/** Every map of one stage for a test image, on one shared brightness scale. */
export function stageMaps(a: Assets, img: number, st: Stage): HTMLCanvasElement[] {
  return once(`maps-${img}-${st}`, () => {
    const F = a.net.stage(traceOf(a, img), st);
    const [C, H] = a.net.shape(st);
    let hi = 0;
    for (let i = 0; i < F.length; i++) hi = Math.max(hi, F[i]!);
    return Array.from({ length: C }, (_, k) => mapCanvas(F, k * H * H, H, hi));
  });
}

/** Channels of a stage that are zero everywhere for this image. */
export function silent(a: Assets, img: number, st: Stage): boolean[] {
  return once(`silent-${img}-${st}`, () => {
    const F = a.net.stage(traceOf(a, img), st);
    const [C, H] = a.net.shape(st);
    return Array.from({ length: C }, (_, k) => {
      for (let i = k * H * H; i < (k + 1) * H * H; i++) if (F[i]! > 0) return false;
      return true;
    });
  });
}

/** The heat map of the occlusion run so far, viridis stretched over the values found. */
export function heatCanvas(o: Occlusion, upto: number): { c: HTMLCanvasElement; lo: number; hi: number } {
  const n = Math.min(upto, o.pos);
  return once(`heat-${n}`, () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < n; k++) {
      lo = Math.min(lo, o.heat[k]!);
      hi = Math.max(hi, o.heat[k]!);
    }
    if (!(hi - lo > 1e-3)) lo = hi - 1e-3;
    const img = new ImageData(16, 16);
    for (let k = 0; k < 256; k++) {
      const [r, g, b] = k < n ? viridis((o.heat[k]! - lo) / (hi - lo)) : [0, 0, 0];
      img.data[k * 4] = r;
      img.data[k * 4 + 1] = g;
      img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = k < n ? 255 : 0;
    }
    return { c: toCanvas(img), lo, hi };
  });
}

/** The chapter's occlusion step, as an input with the patch at position k. */
export function occludedCanvas(a: Assets, o: Occlusion, k: number): HTMLCanvasElement {
  return once(`occ-img-${k}`, () => {
    const xi = Float32Array.from(o.x0);
    const r = Math.floor(k / 16);
    const c = k % 16;
    const t0 = 2 * r + 1 - 4;
    const l0 = 2 * c + 1 - 4;
    for (let ch = 0; ch < 3; ch++)
      for (let yy = Math.max(0, t0); yy < Math.min(32, t0 + 8); yy++)
        for (let q = Math.max(0, l0); q < Math.min(32, l0 + 8); q++) xi[ch * 1024 + yy * 32 + q] = 0;
    return inputCanvas(xi, a.net.mean);
  });
}

/**
 * The chapter's linear-explanation experiment: n random weights and inputs, every input nudged by
 * eps = 2/255 toward its weight's sign. The score W.x, its mean and typical spread over random
 * inputs, and the shift the nudge causes.
 */
export function linearStats(n: number): { s0: number; mu: number; sd: number; shift: number } {
  const L = once('linear', () => {
    const N = 150528;
    const rng = new Rng(17);
    const W = Float32Array.from({ length: N }, () => 0.1 * rng.randn());
    const X = Float32Array.from({ length: N }, () => rng.next());
    X[0] = 0.5;
    return { W, X };
  });
  return once(`linear-${n}`, () => {
    let s0 = 0;
    let s = 0;
    let q = 0;
    let mu = 0;
    for (let i = 0; i < n; i++) {
      const wi = L.W[i]!;
      s0 += wi * L.X[i]!;
      s += Math.abs(wi);
      q += wi * wi;
      mu += 0.5 * wi;
    }
    return { s0, mu, sd: Math.sqrt(q / 12), shift: (2 / 255) * s };
  });
}

/** The true class's probability with the patch at position k (from the run if it got there). */
export function occludedProb(a: Assets, o: Occlusion, k: number): number {
  if (k < o.pos) return o.heat[k]!;
  return once(`occ-p-${k}`, () => {
    const xi = Float32Array.from(o.x0);
    const r = Math.floor(k / 16);
    const c = k % 16;
    const t0 = 2 * r + 1 - 4;
    const l0 = 2 * c + 1 - 4;
    for (let ch = 0; ch < 3; ch++)
      for (let yy = Math.max(0, t0); yy < Math.min(32, t0 + 8); yy++)
        for (let q = Math.max(0, l0); q < Math.min(32, l0 + 8); q++) xi[ch * 1024 + yy * 32 + q] = 0;
    return softmax(a.net.forward(xi).scores)[o.y]!;
  });
}

/** A grid of small images as one canvas, `cols` wide, drawn once. */
export function atlas(key: string, n: number, cols: number, img: (i: number) => HTMLCanvasElement): HTMLCanvasElement {
  return once(`atlas-${key}`, () => {
    const c = document.createElement('canvas');
    c.width = cols * 32;
    c.height = Math.ceil(n / cols) * 32;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < n; i++) ctx.drawImage(img(i), (i % cols) * 32, Math.floor(i / cols) * 32);
    return c;
  });
}

/** Unit-length pool3 code of a sample image (the t-SNE input). */
export function codeOf(a: Assets, i: number): Float32Array {
  return once(`code-${i}`, () => {
    const x = i < 1000 ? a.net.input(a.train.pixels, i) : a.net.input(a.test.pixels, i - 1000);
    const f = Float32Array.from(a.net.stage(a.net.forward(x), 'pool3'));
    let n = 0;
    for (const v of f) n += v * v;
    n = Math.sqrt(n) || 1;
    for (let k = 0; k < f.length; k++) f[k]! /= n;
    return f;
  });
}
