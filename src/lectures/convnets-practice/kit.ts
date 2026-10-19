import { type CifarSet, cifarImage, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, lerp } from '../../lecture/scene';
import { eig3 } from '../../lib/convnets-practice-math';

export type K = Color | `--${string}`;

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** The latest beat of `ids` (script order) that has started, or null. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** A rounded tag of text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: 'mono' | 'ui' } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 1.1;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, o.fill ?? 0.13), stroke: s.tint(k, 0.7), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** A soft rounded panel. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: K, on = 0): void {
  s.rrect(x, y, w, h, 2.2, { fill: s.tint(k, 0.05 + 0.08 * on), stroke: s.tint(k, 0.35 + 0.5 * on), lw: 0.3 + 0.25 * on });
}

export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

export function cross(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('red') });
  const d = r * 0.42;
  const lw = 0.45 * (r / s.u / 1.9);
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', lw);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', lw);
}

/** A dashed rectangle outline. */
export function dashed(s: Scene, x: number, y: number, w: number, h: number, col: string, lw = 0.45): void {
  const c = s.ctx;
  c.save();
  c.setLineDash([s.u * 1.1, s.u * 0.8]);
  c.strokeStyle = col;
  c.lineWidth = lw * s.u;
  c.strokeRect(x, y, w, h);
  c.restore();
}

// ---------------------------------------------------------------- CIFAR

export interface Cifar {
  cat: HTMLCanvasElement;
  /** Assorted training images, for "a dataset". */
  thumbs: HTMLCanvasElement[];
  dogs: HTMLCanvasElement[];
  /** The cat at contrast 0.6 and 1.4. */
  contrast: [HTMLCanvasElement, HTMLCanvasElement];
  /** The cat with four exaggerated PCA color shifts, and each shift in 0..1 units. */
  pca: HTMLCanvasElement[];
  shifts: number[][];
  evals: number[];
  /** Eigenvectors as columns, largest eigenvalue first. */
  evecs: number[][];
  mean: number[];
  /** Sampled training pixels, RGB in 0..1. */
  cloud: [number, number, number][];
}

let cifarData: Cifar | null = null;
let waiting: Plot | null = null;

function canvasOf(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

function mapPixels(set: CifarSet, i: number, f: (rgb: number[]) => number[]): HTMLCanvasElement {
  const img = new ImageData(32, 32);
  const o = i * 3072;
  for (let p = 0; p < 1024; p++) {
    const v = f([set.pixels[o + p]! / 255, set.pixels[o + 1024 + p]! / 255, set.pixels[o + 2048 + p]! / 255]);
    for (let k = 0; k < 3; k++) img.data[p * 4 + k] = Math.round(Math.max(0, Math.min(1, v[k]!)) * 255);
    img.data[p * 4 + 3] = 255;
  }
  return canvasOf(img);
}

function build(train: CifarSet): Cifar {
  const of = (cls: number, skip = 0): number => {
    let seen = 0;
    for (let i = 0; i < train.n; i++) if (train.labels[i] === cls && seen++ === skip) return i;
    return 0;
  };
  const catI = of(3, CAT_PICK);
  let m = 0;
  for (let p = 0; p < 3072; p++) m += train.pixels[catI * 3072 + p]! / 255;
  m /= 3072;
  const contrast = [0.6, 1.4].map((c) => mapPixels(train, catI, (v) => v.map((x) => (x - m) * c + m))) as [HTMLCanvasElement, HTMLCanvasElement];
  // RGB covariance over every training pixel
  const mean = [0, 0, 0];
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const n = train.n * 1024;
  for (let i = 0; i < train.n; i++) for (let p = 0; p < 1024; p++) for (let k = 0; k < 3; k++) mean[k]! += train.pixels[i * 3072 + k * 1024 + p]! / 255 / n;
  for (let i = 0; i < train.n; i++)
    for (let p = 0; p < 1024; p++) {
      const v = [0, 1, 2].map((k) => train.pixels[i * 3072 + k * 1024 + p]! / 255 - mean[k]!);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a]![b]! += (v[a]! * v[b]!) / (n - 1);
    }
  const { vals, vecs } = eig3(S);
  const r = new Rng(31);
  const cloud: [number, number, number][] = [];
  for (let q = 0; q < 900; q++) {
    const i = r.int(train.n);
    const p = r.int(1024);
    cloud.push([0, 1, 2].map((k) => train.pixels[i * 3072 + k * 1024 + p]! / 255) as [number, number, number]);
  }
  const alphas = [
    [1.6, 0.4, -0.2],
    [-1.5, 0.6, 0.5],
    [0.3, 1.8, -0.6],
    [-0.4, -1.7, 1.2],
  ];
  // evecs . (alpha * evals), exaggerated for display: one unit of alpha_1 moves 0.12.
  const F = 0.12 / Math.max(1e-6, vals[0]!);
  const shifts = alphas.map((al) => [0, 1, 2].map((k) => [0, 1, 2].reduce((acc, i) => acc + vecs[k]![i]! * al[i]! * vals[i]! * F, 0)));
  const pca = shifts.map((sh) => mapPixels(train, catI, (v) => v.map((x, k) => x + sh[k]!)));
  const thumbs = [7, 8, 1, 2, 4, 9, 0, 6, 5, 3, 1, 8, 0, 2, 7, 4, 9, 6].map((c, k) => canvasOf(cifarImage(train, of(c, 1 + (k >> 3)))));
  const dogs = [0, 1, 2].map((k) => canvasOf(cifarImage(train, of(5, k + 1))));
  return { cat: canvasOf(cifarImage(train, catI)), thumbs, dogs, contrast, pca, shifts, evals: vals, evecs: vecs, mean, cloud };
}

/** Which training cat (0 = the first) stars in the lecture. */
const CAT_PICK = 8;

loadCifar()
  .then(({ train }) => {
    cifarData = build(train);
    waiting?.redraw();
  })
  .catch(() => {});

/** The CIFAR pictures, or null while they load (the stage redraws when they land). */
export function cifar(s: Scene): Cifar | null {
  if (!cifarData) waiting = s.p;
  return cifarData;
}

/**
 * Draws a 32 x 32 canvas into a `size` square at (x, y), crisp, optionally mirrored
 * (`flip` runs 1 -> -1 through an edge-on squeeze), rotated (radians) or sheared.
 * `src` picks a sub-rectangle [sx, sy, sw, sh] of the source.
 */
export function pic(
  s: Scene,
  cv: HTMLCanvasElement | null | undefined,
  x: number,
  y: number,
  size: number,
  o: { flip?: number; vflip?: boolean; rot?: number; shear?: number; stretch?: number; src?: [number, number, number, number]; frame?: K } = {},
): void {
  const c = s.ctx;
  if (!cv) {
    s.rrect(x, y, size, size, 0.8, { fill: s.tint('--ink', 0.06), stroke: s.c('--rule'), lw: 0.3 });
    return;
  }
  c.save();
  c.beginPath();
  c.rect(x, y, size, size);
  c.clip();
  c.fillStyle = '#000';
  c.fillRect(x, y, size, size);
  c.translate(x + size / 2, y + size / 2);
  if (o.rot) c.rotate(o.rot);
  if (o.shear) c.transform(1, 0, o.shear, 1, 0, 0);
  c.scale((o.flip ?? 1) * (o.stretch ?? 1), o.vflip ? -1 : 1);
  c.imageSmoothingEnabled = false;
  const [sx, sy, sw, sh] = o.src ?? [0, 0, cv.width, cv.height];
  c.drawImage(cv, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  c.restore();
  s.rrect(x, y, size, size, 0.4, { stroke: o.frame ? s.c(o.frame) : s.tint('--ink', 0.25), lw: o.frame ? 0.5 : 0.25 });
}

// ---------------------------------------------------------------- the AlexNet strip

export const LAYERS = ['conv1', 'conv2', 'conv3', 'conv4', 'conv5', 'fc6', 'fc7', 'fc8'];
/** plain: as trained; frozen: lr 0; ft: fine-tuned; new: fresh head; cut: removed. */
export type St = 'plain' | 'frozen' | 'ft' | 'new' | 'cut';

const ST: Record<St, K> = { plain: 'slate', frozen: 'slate', ft: 'teal', new: 'orange', cut: '--ink-3' };

/** Eight layer blocks across [x, x + w]; returns each block's center x. */
export function strip(
  s: Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  st: St[],
  o: { names?: string[]; a?: (i: number) => number; lift?: (i: number) => number; size?: number } = {},
): number[] {
  const { u } = s;
  const gap = u * 1.4;
  const bw = (w - gap * 7) / 8;
  const xs: number[] = [];
  st.forEach((k, i) => {
    const bx = x + i * (bw + gap);
    xs.push(bx + bw / 2);
    const a = o.a ? o.a(i) : 1;
    if (a <= 0.003) return;
    const fc = i >= 5;
    const bh = fc ? h * 0.72 : h * (1 - i * 0.05);
    const by = y + (h - bh) / 2 - (o.lift ? o.lift(i) : 0);
    s.alpha(a, () => {
      if (k === 'cut') dashed(s, bx, by, bw, bh, s.tint('--ink-3', 0.7), 0.35);
      else s.rrect(bx, by, bw, bh, 1.2, { fill: s.tint(ST[k], k === 'plain' || k === 'frozen' ? 0.14 : 0.26), stroke: s.tint(ST[k], k === 'plain' ? 0.55 : 0.9), lw: k === 'plain' || k === 'frozen' ? 0.3 : 0.55 });
      const name = o.names?.[i] ?? LAYERS[i]!;
      s.text(name, bx + bw / 2, by + bh / 2, { font: 'mono', size: o.size ?? Math.min(3, (bw / u) * 0.27), weight: 600, color: k === 'cut' ? s.c('--ink-3') : s.c('--ink') });
    });
  });
  return xs;
}

/** A small padlock, for frozen layers. */
export function lock(s: Scene, cx: number, cy: number, r: number, col: string): void {
  const c = s.ctx;
  s.rrect(cx - r, cy - r * 0.2, r * 2, r * 1.5, 0.4, { fill: col });
  c.beginPath();
  c.arc(cx, cy - r * 0.2, r * 0.65, Math.PI, 0);
  c.strokeStyle = col;
  c.lineWidth = r * 0.35;
  c.stroke();
}
