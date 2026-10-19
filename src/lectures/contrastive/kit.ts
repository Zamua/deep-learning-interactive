import { type CifarSet, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, clamp01, lerp } from '../../lecture/scene';
import { type Img, colorJitter, drawImg, fromCifar, hflip, randomResizedCrop } from '../../lib/contrastive-aug';
import { type ShapeImage, render } from '../../lib/contrastive-clip';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
export const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** The latest beat of `ids` (script order) that has started, or null. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** The drawing area inside the margins, below the scene chip. */
export function area(s: Scene, top = 0.12, pad = 0.045): Rect {
  const m = Math.max(s.u * 4, s.w * pad);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
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

/** A labelled box, for networks (f, g, encoders). */
export function box(s: Scene, cx: number, cy: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; sub?: string; italic?: boolean } = {}): void {
  const on = o.on ?? 0.5;
  s.rrect(cx - w / 2, cy - h / 2, w, h, 2, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.35 + 0.25 * on });
  const size = o.size ?? Math.min(5, (h / s.u) * 0.42);
  s.text(label, cx, cy - (o.sub ? size * s.u * 0.32 : 0), { size, font: o.italic ? 'serif' : 'ui', italic: o.italic, weight: 650, color: s.c(k) });
  if (o.sub) s.text(o.sub, cx, cy + size * s.u * 0.62, { size: size * 0.62, font: 'ui', color: s.c('--ink-2') });
}

/** A heatmap of an n x m matrix whose entries are 0..1 (after `norm`), the diagonal outlined in gold. */
export function heat(
  s: Scene,
  x: number,
  y: number,
  cell: number,
  vals: ArrayLike<number>,
  n: number,
  m: number,
  o: { k?: K; norm?: (v: number) => number; label?: (v: number, i: number, j: number) => string; diag?: number; hiRow?: number; size?: number; a?: (i: number, j: number) => number } = {},
): void {
  const k = o.k ?? 'teal';
  const norm = o.norm ?? ((v: number) => v);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a = o.a ? o.a(i, j) : 1;
      if (a <= 0.003) continue;
      const v = vals[i * m + j]!;
      const q = clamp01(norm(v));
      const dim = o.hiRow !== undefined && o.hiRow >= 0 && i !== o.hiRow ? 0.45 : 1;
      s.alpha(a, () => {
        s.ctx.fillStyle = s.tint(k, (0.07 + 0.85 * q) * dim);
        s.ctx.fillRect(x + j * cell + 1, y + i * cell + 1, cell - 2, cell - 2);
        if (o.label) {
          const t = o.label(v, i, j);
          if (t) s.text(t, x + j * cell + cell / 2, y + i * cell + cell / 2 + s.u * 0.2, { font: 'mono', size: o.size ?? Math.min(3.4, (cell / s.u) * 0.34), color: q > 0.55 ? s.c('--card') : s.c(dim < 1 ? '--ink-3' : '--ink-2') });
        }
      });
    }
  const d = o.diag ?? 1;
  if (d > 0.003)
    s.alpha(d, () => {
      for (let i = 0; i < Math.min(n, m); i++) s.rrect(x + i * cell + 1.5, y + i * cell + 1.5, cell - 3, cell - 3, 0.6, { stroke: s.c('gold'), lw: 0.45 });
    });
  if (o.hiRow !== undefined && o.hiRow >= 0) s.rrect(x, y + o.hiRow * cell, m * cell, cell, 0.6, { stroke: s.c('--ink'), lw: 0.35 });
}

/** A unit circle with faint axes. */
export function unitCircle(s: Scene, cx: number, cy: number, R: number): void {
  s.line(cx - R * 1.12, cy, cx + R * 1.12, cy, s.c('--grid'), 0.25);
  s.line(cx, cy - R * 1.12, cx, cy + R * 1.12, s.c('--grid'), 0.25);
  s.circle(cx, cy, R, { stroke: s.c('--axis'), lw: 0.35 });
}

/** A point on the circle at angle `a` (radians, y up): filled for view 1, a ring for view 2. */
export function onCircle(s: Scene, cx: number, cy: number, R: number, a: number, k: K, o: { ring?: boolean; r?: number } = {}): [number, number] {
  const x = cx + R * Math.cos(a);
  const y = cy - R * Math.sin(a);
  const r = o.r ?? s.u * 1.4;
  if (o.ring) s.circle(x, y, r, { fill: s.c('--card'), stroke: s.c(k), lw: 0.5 });
  else s.circle(x, y, r, { fill: s.c(k) });
  return [x, y];
}

/** Interpolates angles along the shorter arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** A simple padlock, for a frozen network. */
export function lock(s: Scene, cx: number, cy: number, size: number, k: K): void {
  const w = size;
  const h = size * 0.78;
  s.rrect(cx - w / 2, cy - h * 0.2, w, h, 0.6, { fill: s.c(k) });
  const c = s.ctx;
  c.beginPath();
  c.arc(cx, cy - h * 0.2, w * 0.3, Math.PI, 0);
  c.strokeStyle = s.c(k);
  c.lineWidth = Math.max(1.5, w * 0.14);
  c.stroke();
}

export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const q = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * q, cy, cx - s.u * 0.2 * q, cy + s.u * 0.7 * q, '#fff', 0.45 * q);
  s.line(cx - s.u * 0.2 * q, cy + s.u * 0.7 * q, cx + s.u * 1 * q, cy - s.u * 0.7 * q, '#fff', 0.45 * q);
}

export function cross(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('red') });
  const d = r * 0.42;
  const lw = 0.45 * (r / s.u / 1.9);
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', lw);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', lw);
}

// ---------------------------------------------------------------- CIFAR

let set: CifarSet | null = null;
let waiting: Plot | null = null;
loadCifar()
  .then((c) => {
    set = c.train;
    waiting?.redraw();
  })
  .catch(() => {});

/** The CIFAR training sample, or null while it loads (the stage redraws once it lands). */
export function cifar(s: Scene): CifarSet | null {
  if (!set) waiting = s.p;
  return set;
}

const imgCache = new Map<string, Img>();

function nthOfClass(cs: CifarSet, c: number, n: number): number {
  let k = 0;
  for (let i = 0; i < cs.n; i++) if (cs.labels[i] === c && k++ === n) return i;
  return 0;
}

/** Image `n` of CIFAR class `c` (0 plane, 1 car, 2 bird, 3 cat, 5 dog, 7 horse, 8 ship), as floats. */
export function photo(cs: CifarSet, c: number, n = 0): Img {
  const key = `${c}:${n}`;
  let im = imgCache.get(key);
  if (!im) imgCache.set(key, (im = fromCifar(cs, nthOfClass(cs, c, n))));
  return im;
}

/** A photo with a thin frame. */
export function drawPhoto(s: Scene, img: Img, x: number, y: number, size: number, k: K = '--rule', lw = 0.3): void {
  drawImg(s.ctx, img, x, y, size);
  s.rrect(x, y, size, size, 0.4, { stroke: s.c(k), lw });
}

export interface Views {
  crop: [number, number, number, number][];
  plain: Img[];
  colored: Img[];
}
const viewCache = new Map<string, Views>();

/** Two fixed augmented views of a photo: cropped (and maybe flipped), then color-jittered. */
export function views(img: Img, key: string, seed: number): Views {
  let v = viewCache.get(key);
  if (v) return v;
  const r = new Rng(seed);
  const crop: Views['crop'] = [];
  const plain: Img[] = [];
  const colored: Img[] = [];
  for (let q = 0; q < 2; q++) {
    const c = randomResizedCrop(img, r, 0.3, 0.7);
    const flipped = q === 1 ? hflip(c.img) : c.img;
    crop.push(c.box);
    plain.push(flipped);
    colored.push(colorJitter(flipped, r, 0.5, 0.5, 0.5, 0.12));
  }
  v = { crop, plain, colored };
  viewCache.set(key, v);
  return v;
}

// ---------------------------------------------------------------- toy CLIP images

let shapes: ShapeImage[] | null = null;

/** The six image-caption pairs of the chapter's toy CLIP figure. */
export function clipPairs(): ShapeImage[] {
  if (!shapes) {
    const r = new Rng(31);
    shapes = ([[0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 2, 0], [1, 2, 0], [2, 3, 0]] as const).map(([sh, c, z]) => render(sh, c, z, r));
  }
  return shapes;
}

export const SHORT: Record<string, string> = { small: 'sml', yellow: 'yel', green: 'grn', circle: 'circ', square: 'sq', triangle: 'tri' };
