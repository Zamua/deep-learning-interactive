import { rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { type Scene, clamp01, lerp, smooth } from '../../lecture/scene';
import { spokenText } from '../../lecture/types';
import { type Box, CLASS_COLOR, SCENE_H, SCENE_W, sceneBitmap } from '../../lib/detection-scene';
import { script } from './script';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

export const ASPECT = SCENE_W / SCENE_H;
export const clsK = (cls: number): Color => CLASS_COLOR[cls]!;

// ---------------------------------------------------------------- timing

const SPOKEN = new Map<string, string>();
for (const sc of script.scenes) for (const b of sc.beats) SPOKEN.set(`${sc.id}/${b.id}`, spokenText(b.say));

/** Seconds into the scene at which `word` (its `nth` occurrence) is spoken in a beat, by text position. */
export function cue(s: Scene, scene: string, beat: string, word: string, nth = 0): number {
  const text = SPOKEN.get(`${scene}/${beat}`) ?? '';
  let i = -1;
  for (let k = 0; k <= nth; k++) i = text.indexOf(word, i + 1);
  return lerp(s.at(beat), s.end(beat), Math.max(0, i) / Math.max(1, text.length));
}

/** Eased 0 -> 1 over `dur` seconds from scene time `t0`. */
export const after = (s: Scene, t0: number, dur = 0.5): number => smooth((s.t - t0) / dur);

/** Index of the last beat in `ids` that has started, or -1. */
export function stage(s: Scene, ids: string[]): number {
  let k = -1;
  ids.forEach((id, i) => {
    if (s.since(id) >= 0) k = i;
  });
  return k;
}

// ---------------------------------------------------------------- layout

/** The largest rect of the given aspect inside (x, y, w, h), centered. */
export function fit(x: number, y: number, w: number, h: number, aspect = ASPECT): Rect {
  const ww = Math.min(w, h * aspect);
  const hh = ww / aspect;
  return [x + (w - ww) / 2, y + (h - hh) / 2, ww, hh];
}

/** The stage inside a margin of `m` units, below a top band of `top` (fraction of height). */
export function area(s: Scene, top = 0.1, m = 4): Rect {
  const y = Math.max(s.h * top, s.u * m);
  return [s.u * m, y, s.w - 2 * s.u * m, s.h - y - s.u * m];
}

// ---------------------------------------------------------------- the street scene

const BMP_SCALE = 3;

/** A window onto the street scene (left, top, width in scene px), placed on the stage. */
export class View {
  readonly k: number;
  readonly h: number;
  constructor(
    readonly s: Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly win: [number, number, number] = [0, 0, SCENE_W],
  ) {
    this.k = w / win[2];
    this.h = ((win[2] * SCENE_H) / SCENE_W) * this.k;
  }
  /** A full-scene view filling `r` (a 3:2 rect from `fit`). */
  static in(s: Scene, r: Rect, win?: [number, number, number]): View {
    return new View(s, r[0], r[1], r[2], win);
  }
  X(sx: number): number {
    return this.x + (sx - this.win[0]) * this.k;
  }
  Y(sy: number): number {
    return this.y + (sy - this.win[1]) * this.k;
  }
  rect(b: Box): Rect {
    return [this.X(b[0]), this.Y(b[1]), (b[2] - b[0]) * this.k, (b[3] - b[1]) * this.k];
  }
  paint(a = 1, dim = 0): void {
    const s = this.s;
    const c = s.ctx;
    const [wx, wy, ww] = this.win;
    s.alpha(a, () => {
      c.save();
      c.beginPath();
      c.roundRect(this.x, this.y, this.w, this.h, s.u * 1.2);
      c.clip();
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(sceneBitmap(SCENE_W * BMP_SCALE), wx * BMP_SCALE, wy * BMP_SCALE, ww * BMP_SCALE, ((ww * SCENE_H) / SCENE_W) * BMP_SCALE, this.x, this.y, this.w, this.h);
      if (dim > 0) {
        c.fillStyle = s.tint('--card', dim);
        c.fillRect(this.x, this.y, this.w, this.h);
      }
      c.restore();
      s.rrect(this.x, this.y, this.w, this.h, 1.2, { stroke: s.c('--rule'), lw: 0.3 });
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(this.x, this.y, this.w, this.h);
    c.clip();
    fn();
    c.restore();
  }
  box(b: Box, col: string, lw = 0.5, dash?: number[]): void {
    const c = this.s.ctx;
    const [x, y, w, h] = this.rect(b);
    c.save();
    c.strokeStyle = col;
    c.lineWidth = lw * this.s.u;
    c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
    c.strokeRect(x, y, w, h);
    c.restore();
  }
  fill(b: Box, col: string): void {
    const [x, y, w, h] = this.rect(b);
    this.s.ctx.fillStyle = col;
    this.s.ctx.fillRect(x, y, w, h);
  }
  /** Paints a label image (one texel per `down` scene px) over the view. */
  overlay(img: HTMLCanvasElement, a: number, smoothing = false): void {
    const s = this.s;
    const f = img.width / SCENE_W;
    const [wx, wy, ww] = this.win;
    s.alpha(a, () =>
      this.clip(() => {
        const c = s.ctx;
        c.imageSmoothingEnabled = smoothing;
        c.drawImage(img, wx * f, wy * f, ww * f, ((ww * SCENE_H) / SCENE_W) * f, this.x, this.y, this.w, this.h);
        c.imageSmoothingEnabled = true;
      }),
    );
  }
  /** Draws a crop of the scene (box `b`) stretched into a stage rect: R-CNN's warp. */
  crop(b: Box, r: Rect): void {
    const c = this.s.ctx;
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(sceneBitmap(SCENE_W * BMP_SCALE), b[0] * BMP_SCALE, b[1] * BMP_SCALE, (b[2] - b[0]) * BMP_SCALE, (b[3] - b[1]) * BMP_SCALE, r[0], r[1], r[2], r[3]);
    c.restore();
  }
}

/** A crop of the scene drawn into a stage rect without a View. */
export function sceneCrop(s: Scene, b: Box, r: Rect): void {
  new View(s, 0, 0, 1).crop(b, r);
}

const labelCache = new Map<string, HTMLCanvasElement>();

/** A label map as an image: palette[label] is a hex color, or null for clear. Cached by `key` and palette. */
export function labelImage(key: string, labels: Uint8Array, w: number, h: number, palette: (string | null)[]): HTMLCanvasElement {
  const k = `${key}|${w}x${h}|${palette.join(',')}`;
  const hit = labelCache.get(k);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const img = new ImageData(w, h);
  const rgb = palette.map((p) => (p ? rgbOf(p) : null));
  for (let i = 0; i < w * h; i++) {
    const col = rgb[labels[i]!];
    if (!col) continue;
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = 255;
  }
  cv.getContext('2d')!.putImageData(img, 0, 0);
  if (labelCache.size > 24) labelCache.clear();
  labelCache.set(k, cv);
  return cv;
}

// ---------------------------------------------------------------- labels and marks

/** A filled label chip with white text; (x, y) is its top-left (or top-center). Kept on the stage. */
export function chip(s: Scene, text: string, x: number, y: number, bg: string, o: { size?: number; fg?: string; align?: 'left' | 'center' } = {}): Rect {
  const size = o.size ?? 3;
  const tw = s.measure(text, { font: 'ui', size, weight: 650 });
  const pw = tw + s.u * size * 0.75;
  const ph = s.u * size * 1.5;
  let x0 = o.align === 'center' ? x - pw / 2 : x;
  x0 = Math.max(s.u * 1.5, Math.min(s.w - pw - s.u * 1.5, x0));
  s.rrect(x0, y, pw, ph, size * 0.3, { fill: bg });
  s.text(text, x0 + pw / 2, y + ph / 2 + s.u * 0.1, { font: 'ui', size, weight: 650, color: o.fg ?? '#fff' });
  return [x0, y, pw, ph];
}

export function chipSize(s: Scene, text: string, size = 3): [number, number] {
  return [s.measure(text, { font: 'ui', size, weight: 650 }) + s.u * size * 0.75, s.u * size * 1.5];
}

const hits = (a: Rect, b: Rect): boolean => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

/**
 * A chip on a box: above its top edge, else inside it, else under it; the first spot inside the
 * view and clear of the chips already in `placed`.
 */
export function boxChip(v: View, b: Box, text: string, bg: string, placed: Rect[], size = 2.8): void {
  const s = v.s;
  const [pw, ph] = chipSize(s, text, size);
  const [bx, by, bw, bh] = v.rect(b);
  const x = Math.max(v.x + s.u * 0.5, Math.min(v.x + v.w - pw - s.u * 0.5, bx));
  const xs = [x, Math.max(v.x + s.u * 0.5, Math.min(v.x + v.w - pw - s.u * 0.5, bx + bw - pw))];
  const ys = [by - ph - s.u * 0.3, by + s.u * 0.3, by + bh + s.u * 0.3, by + bh - ph - s.u * 0.3];
  let spot: Rect | null = null;
  for (const yy of ys) {
    for (const xx of xs) {
      const r: Rect = [xx, yy, pw, ph];
      if (yy < v.y + s.u * 0.3 || yy + ph > v.y + v.h - s.u * 0.3) continue;
      if (placed.some((p) => hits(p, r))) continue;
      spot = r;
      break;
    }
    if (spot) break;
  }
  spot ??= [x, Math.max(v.y + s.u * 0.3, ys[0]!), pw, ph];
  placed.push(spot);
  chip(s, text, spot[0], spot[1], bg, { size });
}

/** A rounded tag of mono text, e.g. a shape like 7 x 7 x 30. Returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number } = {}): number {
  const size = o.size ?? 3.4;
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** A row of number cells starting at (x, y); `on` lights cells. */
export function cells(s: Scene, x: number, y: number, cw: number, ch: number, vals: string[], k: K | ((i: number) => K), o: { on?: (i: number) => number; a?: (i: number) => number; size?: number; gap?: number } = {}): void {
  const gap = o.gap ?? 0;
  vals.forEach((v, i) => {
    const a = o.a ? o.a(i) : 1;
    if (a <= 0.003) return;
    const kk = typeof k === 'function' ? k(i) : k;
    s.alpha(a, () => s.cell(x + i * (cw + gap), y, cw, ch, v, kk, { on: o.on ? o.on(i) : 0, size: o.size }));
  });
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

/** A rounded block with a centered label, for network diagrams. */
export function block(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { size?: number; on?: number; sub?: string } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.1 + 0.14 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 + 0.2 * on });
  const size = o.size ?? 3.2;
  if (o.sub) {
    s.text(label, x + w / 2, y + h / 2 - size * s.u * 0.45, { size, weight: 600, font: 'ui', color: s.c(k) });
    s.text(o.sub, x + w / 2, y + h / 2 + size * s.u * 0.6, { size: size * 0.8, font: 'mono', color: s.c('--ink-3') });
  } else s.text(label, x + w / 2, y + h / 2 + s.u * 0.1, { size, weight: 600, font: 'ui', color: s.c(k) });
}

/** A trapezoid that narrows left to right: a stack of conv layers. */
export function trapezoid(s: Scene, x: number, y: number, w: number, h: number, k: K, shrink = 0.45, label = '', size = 3): void {
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y + (h * shrink) / 2);
  c.lineTo(x + w, y + h - (h * shrink) / 2);
  c.lineTo(x, y + h);
  c.closePath();
  c.fillStyle = s.tint(k, 0.14);
  c.fill();
  c.strokeStyle = s.tint(k, 0.8);
  c.lineWidth = 0.35 * s.u;
  c.stroke();
  if (label) s.text(label, x + w * 0.45, y + h / 2, { size, font: 'ui', weight: 600, color: s.c(k) });
}

/** A short-lived accent glow behind a rect, peaking mid-way through p in [0, 1]. */
export function flash(s: Scene, r: Rect, p: number, k: K = '--accent'): void {
  const a = Math.sin(clamp01(p) * Math.PI);
  if (a > 0.01) s.rrect(r[0] - s.u, r[1] - s.u, r[2] + 2 * s.u, r[3] + 2 * s.u, 2, { fill: s.tint(k, 0.25 * a) });
}

/** Box helpers in corner form. */
export const lerpBox = (a: Box, b: Box, t: number): Box => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
export const cxcywh = (b: Box): [number, number, number, number] => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1]];
export const corners = (cx: number, cy: number, w: number, h: number): Box => [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];

/** Side panels only on a genuinely wide stage; anything squarer stacks the panel under the picture. */
export const stacked = (s: Scene): boolean => s.w < s.h * 1.45;
