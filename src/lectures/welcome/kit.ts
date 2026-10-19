import { type CifarSet, cifarImage, loadCifar } from '../../core/data';
import type { Plot } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { type Scene, type TextOpts, clamp01 } from '../../lecture/scene';

export type K = Color | `--${string}`;

// ---------------------------------------------------------------- CIFAR photos

let train: CifarSet | null = null;
let waiting: Plot | null = null;
const canvases = new Map<number, HTMLCanvasElement>();

loadCifar()
  .then((c) => {
    train = c.train;
    waiting?.redraw();
  })
  .catch(() => {});

/** Training-set indices of one clear photo per class, in CIFAR class order. */
export const PICK = [22, 149, 31, 104, 49, 15, 25, 13, 68, 33];
export const CLASSES = ['plane', 'car', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck'];

function photoCanvas(i: number): HTMLCanvasElement | null {
  if (!train) return null;
  let c = canvases.get(i);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 32;
    c.getContext('2d')!.putImageData(cifarImage(train, i), 0, 0);
    canvases.set(i, c);
  }
  return c;
}

/** Draws training photo i crisp at (x, y), or a placeholder while the sample loads. */
export function photo(s: Scene, i: number, x: number, y: number, size: number, frame: string | null = s.c('--rule'), lw = 0.25): void {
  const c = photoCanvas(i);
  if (c) {
    s.ctx.save();
    s.ctx.imageSmoothingEnabled = false;
    s.ctx.drawImage(c, x, y, size, size);
    s.ctx.restore();
  } else {
    waiting = s.p;
    s.ctx.fillStyle = s.c('--paper-2');
    s.ctx.fillRect(x, y, size, size);
  }
  if (frame) {
    s.ctx.strokeStyle = frame;
    s.ctx.lineWidth = Math.max(1, s.u * lw);
    s.ctx.strokeRect(x, y, size, size);
  }
}

// ---------------------------------------------------------------- text

/** A run of differently colored pieces on one baseline; returns its width. */
export function spans(s: Scene, parts: [string, K?, number?][], x: number, y: number, o: TextOpts & { align?: 'left' | 'center' | 'right' } = {}): number {
  const widths = parts.map(([t, , wt]) => s.measure(t, { ...o, weight: wt ?? o.weight }));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  parts.forEach(([t, k, wt], i) => {
    s.text(t, cx, y, { ...o, align: 'left', weight: wt ?? o.weight, color: k ? s.c(k) : (o.color ?? s.c('--ink')) });
    cx += widths[i]!;
  });
  return total;
}

/** A rounded tag of text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number; font?: TextOpts['font']; opaque?: boolean } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.font ?? 'mono';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 1.1;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  if (o.opaque) s.rrect(x0, y - ph / 2, pw, ph, size * 0.875, { fill: s.c('--card') });
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.875, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.7), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

// ---------------------------------------------------------------- marks and icons

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** A mouse pointer with its tip at (x, y), `size` in stage units. */
export function pointer(s: Scene, x: number, y: number, size = 6, press = 0): void {
  const c = s.ctx;
  const k = (size * s.u) / 10;
  if (press > 0) s.circle(x, y, s.u * (1.5 + 3.5 * press), { stroke: s.tint('--ink', 0.5 * (1 - press)), lw: 0.4 });
  c.beginPath();
  const pts: [number, number][] = [[0, 0], [0, 10], [2.6, 7.6], [4.5, 11.6], [6.1, 10.8], [4.3, 7], [7.6, 7]];
  pts.forEach(([px, py], i) => (i ? c.lineTo(x + px * k, y + py * k) : c.moveTo(x + px * k, y + py * k)));
  c.closePath();
  c.fillStyle = s.c('--ink');
  c.fill();
  c.strokeStyle = s.c('--card');
  c.lineWidth = Math.max(1, k * 0.7);
  c.lineJoin = 'round';
  c.stroke();
}

/** An eye, `r` px wide from center to corner, with the iris looking along `look` (-1..1). */
export function eye(s: Scene, cx: number, cy: number, r: number, k: K, look = 0, open = 1): void {
  const c = s.ctx;
  const hgt = r * 0.62 * open;
  c.beginPath();
  c.moveTo(cx - r, cy);
  c.quadraticCurveTo(cx, cy - hgt * 1.6, cx + r, cy);
  c.quadraticCurveTo(cx, cy + hgt * 1.6, cx - r, cy);
  c.closePath();
  c.fillStyle = s.tint(k, 0.08);
  c.fill();
  c.save();
  c.clip();
  s.circle(cx + look * r * 0.3, cy, r * 0.42, { fill: s.tint(k, 0.55) });
  s.circle(cx + look * r * 0.3, cy, r * 0.19, { fill: s.c('--ink') });
  s.circle(cx + look * r * 0.3 - r * 0.12, cy - r * 0.12, r * 0.07, { fill: '#fff' });
  c.restore();
  c.beginPath();
  c.moveTo(cx - r, cy);
  c.quadraticCurveTo(cx, cy - hgt * 1.6, cx + r, cy);
  c.quadraticCurveTo(cx, cy + hgt * 1.6, cx - r, cy);
  c.strokeStyle = s.c(k);
  c.lineWidth = s.u * 0.5;
  c.stroke();
}

/** A receptive field with a bar of light at `angle`; `fire` 0..1 adds spikes to the right. */
export function cell(s: Scene, cx: number, cy: number, r: number, angle: number, k: K, fire: number, t: number): void {
  s.circle(cx, cy, r, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.7), lw: 0.35 });
  const dx = Math.cos(angle) * r * 0.75;
  const dy = Math.sin(angle) * r * 0.75;
  s.line(cx - dx, cy - dy, cx + dx, cy + dy, s.c('gold'), Math.max(0.8, r / s.u / 4));
  if (fire <= 0) return;
  const x0 = cx + r * 1.35;
  const x1 = x0 + r * 1.9;
  s.alpha(fire, () => {
    s.line(x0, cy, x1, cy, s.tint('--ink', 0.35), 0.25);
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.6 + i / 6) % 1;
      const x = x0 + ph * (x1 - x0);
      s.line(x, cy - r * 0.4, x, cy + r * 0.05, s.c(k), 0.35);
    }
  });
}

/** Hand-designed features: a little grid of oriented gradient strokes. */
export function features(s: Scene, x: number, y: number, size: number, k: K, t: number): void {
  const n = 4;
  const cs = size / n;
  s.rrect(x, y, size, size, 0.8, { fill: s.tint(k, 0.05), stroke: s.tint(k, 0.45), lw: 0.25 });
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = Math.sin(i * 1.7 + j * 2.3) * 1.4 + Math.sin(t * 0.6 + i + j) * 0.12;
      const cx = x + (j + 0.5) * cs;
      const cy = y + (i + 0.5) * cs;
      const l = cs * (0.25 + 0.15 * Math.abs(Math.cos(i * 3.1 + j)));
      s.line(cx - Math.cos(a) * l, cy - Math.sin(a) * l, cx + Math.cos(a) * l, cy + Math.sin(a) * l, s.c(k), 0.4);
    }
}

/** A play button in a disc. */
export function playIcon(s: Scene, cx: number, cy: number, r: number, k: K): void {
  s.circle(cx, cy, r, { fill: s.tint(k, 0.14), stroke: s.c(k), lw: 0.45 });
  const c = s.ctx;
  c.beginPath();
  c.moveTo(cx - r * 0.3, cy - r * 0.42);
  c.lineTo(cx + r * 0.46, cy);
  c.lineTo(cx - r * 0.3, cy + r * 0.42);
  c.closePath();
  c.fillStyle = s.c(k);
  c.fill();
}

/** A slider track with its knob at `v` (0..1). */
export function sliderIcon(s: Scene, x: number, y: number, w: number, v: number, k: K): void {
  s.line(x, y, x + w, y, s.tint('--ink', 0.2), 0.8);
  s.line(x, y, x + w * clamp01(v), y, s.c(k), 0.8);
  s.circle(x + w * clamp01(v), y, s.u * 1.7, { fill: s.c('--card'), stroke: s.c(k), lw: 0.5 });
}
