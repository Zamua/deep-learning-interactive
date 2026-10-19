import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, clamp01 } from '../../lecture/scene';
import { G, type RGB } from './data';

export type K = Color | `--${string}`;

export const FEATS = ['bright', 'blue', 'green', 'warm', 'texture'];

/** Text shrunk (never grown) until it fits `maxW` px. */
export function fit(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  const size = o.size ?? 5;
  const w = s.measure(str, o);
  s.text(str, x, y, { ...o, size: w > maxW ? (size * maxW) / w : size });
}

/** Text in a rounded, tinted pill. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; on?: number; font?: 'mono' | 'serif' | 'ui' } = {}): number {
  const size = o.size ?? 3.6;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { size, font });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  const on = o.on ?? 0;
  s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.c('--card') });
  s.rrect(x0, y - ph / 2, pw, ph, ph / s.u / 2, { fill: s.tint(k, 0.1 + 0.2 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.2 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { size, font, color: s.c(k), weight: font === 'mono' ? 600 : 500 });
  return pw;
}

/** White mono text on a dark translucent pill, legible over any image. */
export function tag(s: Scene, text: string, x: number, y: number, size = 2.8): void {
  const tw = s.measure(text, { size, font: 'mono', weight: 600 });
  const ph = s.u * size * 1.6;
  s.rrect(x - tw / 2 - s.u * size * 0.4, y - ph / 2, tw + s.u * size * 0.8, ph, ph / s.u / 2, { fill: 'rgba(0,0,0,0.62)' });
  s.text(text, x, y + s.u * 0.15, { size, font: 'mono', weight: 600, color: '#ffffff' });
}

/** A labeled rounded box, the lecture's way of drawing a network part. */
export function block(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; sub?: string } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 + 0.2 * on });
  const size = o.size ?? 3.6;
  const ty = o.sub ? y + h * 0.4 : y + h / 2;
  fit(s, label, x + w / 2, ty, w - s.u * 2, { size, font: 'ui', weight: 600, color: s.c(k) });
  if (o.sub) fit(s, o.sub, x + w / 2, y + h * 0.7, w - s.u * 2, { size: size * 0.8, font: 'mono', color: s.c('--ink-2') });
}

const canvases = new Map<string, HTMLCanvasElement>();
const fresh = new WeakMap<HTMLCanvasElement, RGB>();

/** An interleaved RGB array as a small canvas; cached by key, repainted when the array changes. */
function rgbCanvas(key: string, rgb: RGB, w: number, h: number): HTMLCanvasElement {
  let c = canvases.get(key);
  if (!c) {
    c = document.createElement('canvas');
    canvases.set(key, c);
  }
  if (fresh.get(c) === rgb && c.width === w) return c;
  c.width = w;
  c.height = h;
  const id = new ImageData(w, h);
  for (let p = 0; p < w * h; p++) {
    id.data[p * 4] = rgb[p * 3]!;
    id.data[p * 4 + 1] = rgb[p * 3 + 1]!;
    id.data[p * 4 + 2] = rgb[p * 3 + 2]!;
    id.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(id, 0, 0);
  fresh.set(c, rgb);
  return c;
}

/** Draws an RGB image crisply into a square at (x, y), with a hairline frame. `src` crops [sx, sy, sw, sh] in pixels. */
export function picture(s: Scene, key: string, rgb: RGB, x: number, y: number, S: number, o: { n?: number; src?: [number, number, number, number]; frame?: boolean } = {}): void {
  const n = o.n ?? 32;
  const c = rgbCanvas(key, rgb, n, n);
  const ctx = s.ctx;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (o.src) ctx.drawImage(c, o.src[0], o.src[1], o.src[2], o.src[3], x, y, S, S);
  else ctx.drawImage(c, x, y, S, S);
  ctx.restore();
  if (o.frame !== false) s.rrect(x, y, S, S, 0.3, { stroke: s.c('--rule'), lw: 0.25 });
}

/** A gray stand-in while CIFAR-10 loads. */
export function loading(s: Scene, x: number, y: number, S: number): void {
  s.rrect(x, y, S, S, 1, { fill: s.tint('slate', 0.12), stroke: s.tint('slate', 0.4) });
  s.text('loading CIFAR-10', x + S / 2, y + S / 2, { size: 3, color: s.c('--ink-3') });
}

/** The 8 x 8 cell lines over a square image. */
export function gridLines(s: Scene, x: number, y: number, S: number, a = 1, n = G): void {
  s.alpha(a, () => {
    const c = s.ctx;
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = Math.max(0.6, s.u * 0.18);
    c.beginPath();
    for (let k = 1; k < n; k++) {
      c.moveTo(x + (k * S) / n, y);
      c.lineTo(x + (k * S) / n, y + S);
      c.moveTo(x, y + (k * S) / n);
      c.lineTo(x + S, y + (k * S) / n);
    }
    c.stroke();
  });
}

/** Rectangle of cell i on an n x n grid over the square (x, y, S). */
export function cellRect(i: number, x: number, y: number, S: number, n = G): [number, number, number] {
  const cs = S / n;
  return [x + (i % n) * cs, y + Math.floor(i / n) * cs, cs];
}

/** Dims cells by attention: bright where alpha is high. */
export function attnMask(s: Scene, alpha: number[], x: number, y: number, S: number, a = 1, depth = 0.82): void {
  const amax = Math.max(...alpha);
  s.alpha(a, () => {
    alpha.forEach((al, i) => {
      const [cx, cy, cs] = cellRect(i, x, y, S);
      s.ctx.fillStyle = `rgba(0,0,0,${depth * (1 - Math.sqrt(al / amax))})`;
      s.ctx.fillRect(cx, cy, cs + 0.5, cs + 0.5);
    });
  });
}

/** Paints scores: purple where high, dark where low. */
export function scoreMask(s: Scene, scores: number[], x: number, y: number, S: number, a = 1, show = (_i: number) => 1): void {
  const smax = Math.max(...scores.map(Math.abs));
  s.alpha(a, () => {
    scores.forEach((v0, i) => {
      const sh = show(i);
      if (sh <= 0) return;
      const v = v0 / smax;
      const [cx, cy, cs] = cellRect(i, x, y, S);
      s.ctx.fillStyle = v >= 0 ? s.tint('purple', 0.68 * v * sh) : `rgba(0,0,0,${-0.5 * v * sh})`;
      s.ctx.fillRect(cx, cy, cs + 0.5, cs + 0.5);
    });
  });
}

/** Numbers in the cells, when the cells are big enough to hold them. */
export function cellLabels(s: Scene, vals: number[], x: number, y: number, S: number, fmt: (v: number, i: number) => string, a = 1): void {
  const cs = S / G;
  if (cs < s.u * 6.4) return;
  const c = s.ctx;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.9)';
  c.shadowBlur = s.u * 0.6;
  s.alpha(a, () =>
    vals.forEach((v, i) => {
      const t = fmt(v, i);
      if (!t) return;
      const [cx, cy] = cellRect(i, x, y, S);
      s.text(t, cx + cs / 2, cy + cs / 2 + s.u * 0.1, { font: 'mono', size: Math.min(2.5, (cs / s.u) * 0.3), weight: 600, color: '#ffffff' });
    }),
  );
  c.restore();
}

/** A highlighted cell outline. */
export function cellBox(s: Scene, i: number, x: number, y: number, S: number, k: K, a = 1, lw = 0.6): void {
  const [cx, cy, cs] = cellRect(i, x, y, S);
  s.alpha(a, () => s.rrect(cx, cy, cs, cs, 0.5, { stroke: s.c(k), lw }));
}

/**
 * Five feature rows as diverging bars: `filled` as solid bars, `outline` as the dashed query,
 * values clipped at +-2. Returns the bar zero line x.
 */
export function featBars(
  s: Scene,
  x: number,
  y: number,
  w: number,
  rowH: number,
  o: { filled?: number[] | null; outline?: number[] | null; fillK?: K; marks?: number[] | null; markK?: K; labelW?: number; size?: number; fillA?: number },
): number {
  const lab = o.labelW ?? s.u * 13;
  const mid = x + lab + (w - lab) / 2;
  const half = (w - lab) / 2 - s.u;
  const sc = (v: number) => Math.max(-1, Math.min(1, v / 2)) * half;
  s.line(mid, y - s.u, mid, y + rowH * 5 + s.u * 0.5, s.tint('--ink-3', 0.6), 0.25);
  FEATS.forEach((nm, d) => {
    const yy = y + d * rowH;
    s.text(nm, x + lab - s.u * 1.5, yy + rowH / 2, { size: o.size ?? 3.1, color: s.c('--ink-2'), align: 'right' });
    if (o.filled) {
      const v = sc(o.filled[d]!);
      s.rrect(Math.min(mid, mid + v), yy + rowH * 0.2, Math.max(1.5, Math.abs(v)), rowH * 0.6, 0.6, { fill: s.tint(o.fillK ?? 'orange', o.fillA ?? 0.75) });
    }
    if (o.outline) {
      const v = sc(o.outline[d]!);
      const c = s.ctx;
      c.save();
      c.setLineDash([s.u * 0.8, s.u * 0.6]);
      s.rrect(Math.min(mid, mid + v), yy + rowH * 0.1, Math.max(1.5, Math.abs(v)), rowH * 0.8, 0.4, { stroke: s.c('slate'), lw: 0.35 });
      c.restore();
    }
    if (o.marks) {
      const xx = mid + sc(o.marks[d]!);
      s.line(xx, yy + rowH * 0.05, xx, yy + rowH * 0.95, s.c(o.markK ?? 'teal'), 0.7);
    }
  });
  return mid;
}

/** The three steps of soft attention as numbered pills; `on` lights one (0, 1, 2), earlier ones stay half lit. */
export function steps(s: Scene, cx: number, y: number, on: number, a = 1): void {
  const names = ['score', 'softmax', 'average'];
  const ks: K[] = ['purple', 'teal', 'gold'];
  const size = 3.1;
  const ws = names.map((n) => s.measure(`${0} ${n}`, { size, font: 'ui' }) + s.u * size * 1.4);
  const gap = s.u * 2;
  const tot = ws.reduce((p, q) => p + q, 0) + gap * 2;
  let x = cx - tot / 2;
  s.alpha(a, () =>
    names.forEach((n, i) => {
      const lit = clamp01(1 - Math.abs(on - i));
      s.alpha(0.45 + 0.55 * Math.max(lit, on > i ? 0.6 : 0), () => pill(s, `${i + 1} ${n}`, x, y, ks[i]!, { size, align: 'left', on: lit, font: 'ui' }));
      x += ws[i]! + gap;
    }),
  );
}

/** A curved arrow from (x0, y0) to (x1, y1) bending by `bend` px to its left. */
export function curve(s: Scene, x0: number, y0: number, x1: number, y1: number, bend: number, col: string, lw = 0.5, head = true): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cx = mx + (-(y1 - y0) / len) * bend;
  const cy = my + ((x1 - x0) / len) * bend;
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.strokeStyle = col;
  c.lineWidth = lw * s.u;
  c.lineCap = 'round';
  c.stroke();
  if (head) {
    const tx = x1 - cx;
    const ty = y1 - cy;
    const tl = Math.hypot(tx, ty) || 1;
    s.arrow(x1 - (tx / tl) * s.u * 2, y1 - (ty / tl) * s.u * 2, x1, y1, col, lw, 2.4);
  }
}

/** A small vector drawn as a column of cells. */
export function vec(s: Scene, x: number, y: number, cw: number, ch: number, n: number, k: K, on = 0, vals?: number[]): void {
  for (let i = 0; i < n; i++) {
    const v = vals ? Math.min(1, Math.abs(vals[i]!) / 1.5) : 0.5;
    s.rrect(x, y + i * ch, cw, ch - s.u * 0.3, 0.4, { fill: s.tint(k, 0.12 + 0.5 * v * (0.5 + on)), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.22 });
  }
}
