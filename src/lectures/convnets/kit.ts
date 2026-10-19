import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;

/** Screen offset of `d` px of depth in the oblique view: up and to the right. */
export function depthVec(d: number): [number, number] {
  return [d * 0.6, -d * 0.46];
}

function poly(s: Scene, pts: [number, number][], fill?: string, stroke?: string, lw = 0.3): void {
  const c = s.ctx;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw * s.u;
    c.lineJoin = 'round';
    c.stroke();
  }
}

/** A solid block in oblique view: front face at (x, y, w, h), depth d px. */
export function box(s: Scene, x: number, y: number, w: number, h: number, d: number, k: K, o: { fill?: number; lw?: number; front?: boolean } = {}): void {
  const [dx, dy] = depthVec(d);
  const f = o.fill ?? 0.14;
  const st = s.tint(k, 0.85);
  const lw = o.lw ?? 0.3;
  poly(s, [[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]], s.tint(k, f * 1.5), st, lw);
  poly(s, [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], s.tint(k, f * 2.1), st, lw);
  if (o.front !== false) poly(s, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], s.tint(k, f), st, lw);
}

/** A wireframe block, for a filter or window drawn inside a volume. */
export function wire(s: Scene, x: number, y: number, w: number, h: number, d: number, k: K, lw = 0.45, fill = 0.22): void {
  const [dx, dy] = depthVec(d);
  const col = s.c(k);
  poly(s, [[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]], s.tint(k, fill * 0.8), col, lw);
  poly(s, [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], s.tint(k, fill), col, lw);
  poly(s, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], s.tint(k, fill * 0.6), col, lw);
}

/** A stack of n slices from back to front; `draw` paints slice i with its top-left at (sx, sy). */
export function slices(s: Scene, x: number, y: number, w: number, h: number, n: number, d: number, draw: (i: number, sx: number, sy: number) => void): void {
  const [dx, dy] = depthVec(d);
  for (let i = n - 1; i >= 0; i--) {
    const t = n > 1 ? i / (n - 1) : 0;
    draw(i, x + dx * t, y + dy * t);
  }
}

/** Draws a canvas crisply (no smoothing) at (x, y, w, h). */
export function pic(s: Scene, cv: CanvasImageSource, x: number, y: number, w: number, h: number, smooth = false): void {
  const c = s.ctx;
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = smooth;
  c.drawImage(cv, x, y, w, h);
  c.imageSmoothingEnabled = prev;
}

/** A rounded tag of mono text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number } = {}): number {
  const size = o.size ?? 3.6;
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** A labelled layer chip, e.g. CONV; returns its width. */
export function chip(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; on?: number; h?: number } = {}): number {
  const size = o.size ?? 3.4;
  const tw = s.measure(text, { font: 'mono', size, weight: 650 });
  const w = tw + s.u * size * 1.3;
  const h = o.h ?? s.u * size * 2;
  const on = o.on ?? 1;
  s.rrect(x, y - h / 2, w, h, 1.4, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.4 + 0.5 * on), lw: 0.35 });
  s.text(text, x + w / 2, y + s.u * 0.15, { font: 'mono', size, weight: 650, color: s.c(k) });
  return w;
}

export function chipWidth(s: Scene, text: string, size = 3.4): number {
  return s.measure(text, { font: 'mono', size, weight: 650 }) + s.u * size * 1.3;
}

/** A thick outline around a block of cells. */
export function frame(s: Scene, x: number, y: number, w: number, h: number, k: K, lw = 0.7, pad = 0.4): void {
  s.rrect(x - s.u * pad, y - s.u * pad, w + 2 * s.u * pad, h + 2 * s.u * pad, 1.2, { stroke: s.c(k), lw });
}

/** A dashed rectangle, for zero padding or a placeholder. */
export function dashed(s: Scene, x: number, y: number, w: number, h: number, col: string, lw = 0.3, dash = [1, 0.8]): void {
  const c = s.ctx;
  c.save();
  c.setLineDash(dash.map((d) => d * s.u));
  c.strokeStyle = col;
  c.lineWidth = lw * s.u;
  c.strokeRect(x, y, w, h);
  c.restore();
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** A red cross in a disc. */
export function cross(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('red') });
  const d = r * 0.42;
  const w = 0.45 * (r / s.u / 1.9);
  s.line(cx - d, cy - d, cx + d, cy + d, '#fff', w);
  s.line(cx - d, cy + d, cx + d, cy - d, '#fff', w);
}

/** A soft accent glow behind a box whose value just changed; p runs 0 -> 1. */
export function flash(s: Scene, x: number, y: number, w: number, h: number, p: number, k: K = '--accent'): void {
  const a = Math.sin(clamp01(p) * Math.PI);
  if (a > 0.01) s.rrect(x - s.u, y - s.u, w + 2 * s.u, h + 2 * s.u, 2, { fill: s.tint(k, 0.28 * a) });
}

/** A quadratic arc from (x0, y0) to (x1, y1) bulging by `bend` px, with an arrow head. */
export function arc(s: Scene, x0: number, y0: number, x1: number, y1: number, bend: number, col: string, width = 0.45, head = true): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.lineCap = 'round';
  c.stroke();
  if (head) {
    const tx = x1 - cx;
    const ty = y1 - cy;
    const tl = Math.hypot(tx, ty) || 1;
    s.arrow(x1 - (tx / tl) * s.u * 0.8, y1 - (ty / tl) * s.u * 0.8, x1, y1, col, width, 2.2);
  }
}

/** Number with thousands separators. */
export const commas = (v: number): string => Math.round(v).toLocaleString('en-US');

/** Shared stage geometry: width and height in stage units, and the content's horizontal center. */
export function geo(s: Scene): { W: number; H: number; cx: number } {
  return { W: s.w / s.u, H: s.h / s.u, cx: s.w / 2 };
}
