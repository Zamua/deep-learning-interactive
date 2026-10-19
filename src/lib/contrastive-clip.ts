import { Rng } from '../core/rand';
import { Net, normalizeBack, normalizeRows, rowSoftmax, simMatrix } from './contrastive-net';

/** A toy CLIP: 16 x 16 pictures of colored shapes, captions like "a big red circle". */
export const SHAPES = ['circle', 'square', 'triangle'] as const;
export const COLORS = ['red', 'green', 'blue', 'yellow'] as const;
export const SIZES = ['small', 'big'] as const;
export const IMG = 16;
const DIN = IMG * IMG * 3;
const RGB: Record<(typeof COLORS)[number], [number, number, number]> = {
  red: [0.88, 0.22, 0.2],
  green: [0.2, 0.68, 0.3],
  blue: [0.22, 0.4, 0.92],
  yellow: [0.95, 0.8, 0.15],
};

export const VOCAB = ['a', ...SIZES, ...COLORS, ...SHAPES];


export interface ShapeImage {
  shape: number;
  color: number;
  size: number;
  /** Pixels, row-major, RGB interleaved, 0..1. */
  px: Float32Array;
  caption: string;
  /** Index of the (shape, color, size) combination, 0..23. */
  combo: number;
}

export function combo(shape: number, color: number, size: number): number {
  return (shape * COLORS.length + color) * SIZES.length + size;
}

export function render(shape: number, color: number, size: number, r: Rng): ShapeImage {
  const px = new Float32Array(DIN);
  const cx = 8 + r.uniform(-1, 1);
  const cy = 8 + r.uniform(-1, 1);
  const R = (size ? 5.6 : 3.4) * r.uniform(0.92, 1.08);
  const base = RGB[COLORS[color]!];
  const col = base.map((v) => Math.min(1, Math.max(0, v + r.uniform(-0.07, 0.07))));
  const bg = 0.9 + r.uniform(-0.05, 0.05);
  for (let i = 0; i < IMG; i++)
    for (let j = 0; j < IMG; j++) {
      const x = j + 0.5 - cx;
      const y = i + 0.5 - cy;
      let inside: boolean;
      if (shape === 0) inside = x * x + y * y <= R * R;
      else if (shape === 1) inside = Math.abs(x) <= R * 0.9 && Math.abs(y) <= R * 0.9;
      else {
        // Upward triangle: apex at top, base at the bottom.
        const top = -R, bot = R * 0.75;
        inside = y >= top && y <= bot && Math.abs(x) <= ((y - top) / (bot - top)) * R * 1.05;
      }
      for (let ch = 0; ch < 3; ch++) {
        const v = (inside ? col[ch]! : bg) + 0.03 * r.randn();
        px[(i * IMG + j) * 3 + ch] = Math.min(1, Math.max(0, v));
      }
    }
  const caption = `a ${SIZES[size]} ${COLORS[color]} ${SHAPES[shape]}`;
  return { shape, color, size, px, caption, combo: combo(shape, color, size) };
}

/** Every combination `per` times, with fresh jitter. */
export function makeSet(per: number, seed: number): ShapeImage[] {
  const r = new Rng(seed);
  const out: ShapeImage[] = [];
  for (let k = 0; k < per; k++)
    for (let s = 0; s < SHAPES.length; s++)
      for (let c = 0; c < COLORS.length; c++) {
        for (let z = 0; z < SIZES.length; z++) out.push(render(s, c, z, r));
      }
  return out;
}

export interface Encoded {
  t: Float64Array;
  known: string[];
  unknown: string[];
}

/**
 * Image encoder: one linear layer on the pixels. Text encoder: the mean of word vectors.
 * Both outputs are normalized and compared by dot product times a learned scale (1 / tau).
 */
export class ToyClip {
  readonly d: number;
  readonly f: Net;
  E: Float64Array;
  logScale: number;
  step = 0;
  lastLoss = NaN;
  private r: Rng;
  private st = new Map<Float64Array | 'ls', { m: Float64Array; v: Float64Array }>();

  constructor(d = 12, seed = 5, hidden = 48) {
    this.d = d;
    this.f = new Net(DIN, hidden, d, seed);
    this.E = new Float64Array(VOCAB.length * d);
    this.logScale = Math.log(1 / 0.07);
    this.r = new Rng(seed);
    this.reset(seed);
  }

  reset(seed: number): void {
    const r = new Rng(seed);
    this.f.reset(seed);
    for (let i = 0; i < this.E.length; i++) this.E[i] = r.randn();
    this.logScale = Math.log(1 / 0.07);
    this.st.clear();
    this.r = new Rng(seed + 7);
    this.step = 0;
    this.lastLoss = NaN;
  }

  get tau(): number {
    return 1 / Math.exp(this.logScale);
  }

  private pixels(imgs: ShapeImage[]): Float64Array {
    const X = new Float64Array(imgs.length * DIN);
    imgs.forEach((im, n) => {
      for (let i = 0; i < DIN; i++) X[n * DIN + i] = im.px[i]! - 0.5;
    });
    return X;
  }

  encodeImages(imgs: ShapeImage[]): Float64Array {
    return normalizeRows(this.f.forward(this.pixels(imgs), imgs.length).out, imgs.length, this.d).z;
  }

  private words(text: string): { ids: number[]; known: string[]; unknown: string[] } {
    const ids: number[] = [];
    const known: string[] = [];
    const unknown: string[] = [];
    for (const w of text.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
      const id = VOCAB.indexOf(w);
      if (id >= 0) {
        ids.push(id);
        known.push(w);
      } else unknown.push(w);
    }
    return { ids, known, unknown };
  }

  private txtRaw(texts: string[]): { Y: Float64Array; ids: number[][] } {
    const { d } = this;
    const Y = new Float64Array(texts.length * d);
    const ids = texts.map((t) => this.words(t).ids);
    ids.forEach((ws, n) => {
      for (const w of ws) for (let k = 0; k < d; k++) Y[n * d + k]! += this.E[w * d + k]! / ws.length;
    });
    return { Y, ids };
  }

  encodeText(text: string): Encoded {
    const { known, unknown } = this.words(text);
    const { Y } = this.txtRaw([text]);
    const t = known.length ? normalizeRows(Y, 1, this.d).z : new Float64Array(this.d);
    return { t, known, unknown };
  }

  encodeTexts(texts: string[]): Float64Array {
    return normalizeRows(this.txtRaw(texts).Y, texts.length, this.d).z;
  }

  /** A fresh batch of B images, one per (shape, color, size), so no caption repeats. */
  sample(B = 16): ShapeImage[] {
    const all: [number, number, number][] = [];
    for (let sh = 0; sh < SHAPES.length; sh++)
      for (let c = 0; c < COLORS.length; c++) for (let z = 0; z < SIZES.length; z++) all.push([sh, c, z]);
    return this.r.shuffle(all).slice(0, B).map(([sh, c, z]) => render(sh, c, z, this.r));
  }

  /** One step of the symmetric loss on a batch with no repeated caption. */
  train(imgs: ShapeImage[], lr = 0.01): number {
    const n = imgs.length;
    const { d } = this;
    const X = this.pixels(imgs);
    const fi = this.f.forward(X, n);
    const ni = normalizeRows(fi.out, n, d);
    const tr = this.txtRaw(imgs.map((im) => im.caption));
    const nt = normalizeRows(tr.Y, n, d);
    const scale = Math.exp(this.logScale);
    const S = simMatrix(ni.z, n, nt.z, n, d, scale);
    const P = rowSoftmax(S, n, n);
    const ST = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ST[j * n + i] = S[i * n + j]!;
    const PT = rowSoftmax(ST, n, n);
    let loss = 0;
    for (let i = 0; i < n; i++) loss -= (Math.log(P[i * n + i]!) + Math.log(PT[i * n + i]!)) / (2 * n);
    const dS = new Float64Array(n * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) dS[i * n + j] = (P[i * n + j]! + PT[j * n + i]! - (i === j ? 2 : 0)) / (2 * n);
    let dLog = 0;
    const dzi = new Float64Array(n * d);
    const dzt = new Float64Array(n * d);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const g = dS[i * n + j]!;
        dLog += g * S[i * n + j]!;
        for (let k = 0; k < d; k++) {
          dzi[i * d + k]! += g * scale * nt.z[j * d + k]!;
          dzt[j * d + k]! += g * scale * ni.z[i * d + k]!;
        }
      }
    const dYi = normalizeBack(ni.z, ni.len, dzi, n, d);
    const dYt = normalizeBack(nt.z, nt.len, dzt, n, d);
    this.f.zeroGrad();
    this.f.backward(X, n, fi.hid, dYi);
    const gE = new Float64Array(this.E.length);
    tr.ids.forEach((ws, q) => {
      for (const w of ws) for (let k = 0; k < d; k++) gE[w * d + k]! += dYt[q * d + k]! / ws.length;
    });
    this.step++;
    this.f.adam(lr);
    this.adam(this.E, gE, lr);
    const ls = new Float64Array([this.logScale]);
    this.adam(ls, new Float64Array([dLog]), lr);
    // CLIP clips the scale at 100 (tau at least 0.01).
    this.logScale = Math.min(Math.log(100), ls[0]!);
    this.lastLoss = loss;
    return loss;
  }

  private adam(p: Float64Array, g: Float64Array, lr: number): void {
    const key = p.length === 1 ? 'ls' : p;
    let s = this.st.get(key);
    if (!s) this.st.set(key, (s = { m: new Float64Array(p.length), v: new Float64Array(p.length) }));
    const c1 = 1 - 0.9 ** this.step;
    const c2 = 1 - 0.999 ** this.step;
    for (let i = 0; i < p.length; i++) {
      s.m[i] = 0.9 * s.m[i]! + 0.1 * g[i]!;
      s.v[i] = 0.999 * s.v[i]! + 0.001 * g[i]! ** 2;
      p[i]! -= (lr * (s.m[i]! / c1)) / (Math.sqrt(s.v[i]! / c2) + 1e-8);
    }
  }

  /** Zero-shot: for each image, the prompt with the highest cosine. */
  classify(imgs: ShapeImage[], prompts: string[]): { pred: number[]; S: Float64Array } {
    const z = this.encodeImages(imgs);
    const T = new Float64Array(prompts.length * this.d);
    prompts.forEach((p, c) => T.set(this.encodeText(p).t, c * this.d));
    const S = simMatrix(z, imgs.length, T, prompts.length, this.d);
    const pred = imgs.map((_, n) => {
      let best = 0;
      for (let c = 1; c < prompts.length; c++) if (S[n * prompts.length + c]! > S[n * prompts.length + best]!) best = c;
      return best;
    });
    return { pred, S };
  }
}

const shapeCanvases = new WeakMap<ShapeImage, HTMLCanvasElement>();

/** Draws a shape image at (x, y), `size` CSS px square, with crisp pixels. */
export function drawShape(c: CanvasRenderingContext2D, im: ShapeImage, x: number, y: number, size: number): void {
  let cv = shapeCanvases.get(im);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = IMG;
    const d = new ImageData(IMG, IMG);
    for (let p = 0; p < IMG * IMG; p++) {
      for (let k = 0; k < 3; k++) d.data[p * 4 + k] = Math.round(im.px[p * 3 + k]! * 255);
      d.data[p * 4 + 3] = 255;
    }
    cv.getContext('2d')!.putImageData(d, 0, 0);
    shapeCanvases.set(im, cv);
  }
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, x, y, size, size);
  c.restore();
}
