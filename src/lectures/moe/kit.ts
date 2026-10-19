import { CLASS_COLORS, rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';
import { TOY_DOMAIN, type ToySnap, recordSessions, snapRoute, toyData } from '../../lib/moe-toy';

export type K = Color | `--${string}`;

/** Expert e's palette key: the chapter's class order, so expert 0 is blue everywhere. */
export const ekey = (e: number): Color => CLASS_COLORS[e % CLASS_COLORS.length]!;

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** A rounded tag of mono text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: number } = {}): number {
  const size = o.size ?? 3.6;
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.75;
  let x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  x0 = Math.max(2 * s.u, Math.min(s.w - 2 * s.u - pw, x0));
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.8, { fill: s.tint(k, o.fill ?? 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** A labeled box: an expert, the router, attention. `on` lights it (0..1). */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; sub?: string; font?: 'mono' | 'ui' } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.08 + 0.42 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.3 * on });
  if (!label) return;
  const size = o.size ?? Math.min(4, (h / s.u) * 0.42);
  const cy = o.sub ? y + h * 0.4 : y + h / 2;
  s.text(label, x + w / 2, cy + s.u * 0.2, { font: o.font ?? 'mono', size, weight: 650, color: on > 0.5 ? s.c('--ink') : s.c(k) });
  if (o.sub) s.text(o.sub, x + w / 2, y + h * 0.74, { font: 'ui', size: size * 0.72, color: s.c('--ink-2') });
}

/** Big centered title with an italic subtitle. */
export function title(s: Scene, t: string, sub: string, a: number, y = 0.42): void {
  s.alpha(a, () => {
    s.text(t, s.w / 2, s.h * y, { size: Math.min(9.5, (s.w / s.u) * 0.085), font: 'display', weight: 600 });
    if (sub) s.text(sub, s.w / 2, s.h * y + s.u * 10, { size: Math.min(4.6, (s.w / s.u) * 0.04), italic: true, color: s.c('--ink-2') });
  });
}

/** A short caption line under a picture, sized to fit the stage width. */
export function note(s: Scene, t: string, y: number, a = 1, k: K = '--ink-2', size = 3.8): void {
  const max = s.w - 8 * s.u;
  let sz = size;
  while (sz > 3.1 && s.measure(t, { size: sz, italic: true }) > max) sz -= 0.1;
  s.alpha(a, () => s.text(t, s.w / 2, y, { size: sz, italic: true, color: s.c(k) }));
}

/** An arrow head line with a small dot at the start, in stage px. */
export function link(s: Scene, x0: number, y0: number, x1: number, y1: number, k: K, a = 1, w = 0.45): void {
  s.alpha(a, () => s.arrow(x0, y0, x1, y1, s.c(k), w, 2));
}

/* ------------------------------------------------------------------ */
/* the toy router, recorded once                                        */
/* ------------------------------------------------------------------ */

export const TOY = toyData();
export const TOY_E = 4;

interface Runs {
  none: ToySnap[];
  aux: ToySnap[];
  bias: ToySnap[];
}
let RUNS: Runs | null = null;

/** The chapter trainer's default runs: no balancing, then aux loss or bias terms from the collapsed weights. */
export function runs(): Runs {
  if (!RUNS) {
    const [none, aux] = recordSessions([{ mode: 'none', steps: 2000 }, { mode: 'aux', steps: 800 }], 10);
    const [, bias] = recordSessions([{ mode: 'none', steps: 2000 }, { mode: 'bias', steps: 800 }], 10);
    RUNS = { none: none!, aux: aux!, bias: bias! };
  }
  return RUNS;
}

/** The snapshot at fraction `t` (0..1) of the first `upto` steps of a run. */
export function snapAt(run: ToySnap[], t: number, upto: number): ToySnap {
  const last = Math.min(run.length - 1, Math.round(upto / 10));
  return run[Math.round(clamp01(t) * last)]!;
}

const fieldCache = new WeakMap<ToySnap, { key: string; cv: HTMLCanvasElement }>();
const CELLS = 60;

function fieldCanvas(s: Scene, sn: ToySnap, useBias: boolean): HTMLCanvasElement {
  const cols = Array.from({ length: TOY_E }, (_, e) => s.c(ekey(e)));
  const key = `${useBias}|${cols.join()}`;
  const hit = fieldCache.get(sn);
  if (hit && hit.key === key) return hit.cv;
  const cv = document.createElement('canvas');
  cv.width = cv.height = CELLS;
  const img = new ImageData(CELLS, CELLS);
  const rgb = cols.map((c) => rgbOf(c));
  const [x0, x1, y0, y1] = TOY_DOMAIN;
  for (let j = 0; j < CELLS; j++)
    for (let i = 0; i < CELLS; i++) {
      const x = x0 + ((i + 0.5) / CELLS) * (x1 - x0);
      const y = y1 - ((j + 0.5) / CELLS) * (y1 - y0);
      const [r, g, b] = rgb[snapRoute(TOY_E, sn, x, y, useBias)]!;
      const o = (j * CELLS + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  cv.getContext('2d')!.putImageData(img, 0, 0);
  fieldCache.set(sn, { key, cv });
  return cv;
}

/** The toy panel: router regions, the funnel's creases, and every token colored by its expert. */
export function toyPanel(s: Scene, x: number, y: number, size: number, sn: ToySnap, o: { useBias?: boolean; field?: number; creases?: number } = {}): void {
  const [x0, x1, y0, y1] = TOY_DOMAIN;
  const px = (v: number) => x + ((v - x0) / (x1 - x0)) * size;
  const py = (v: number) => y + ((y1 - v) / (y1 - y0)) * size;
  s.rrect(x, y, size, size, 1.5, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.roundRect(x, y, size, size, 1.5 * s.u);
  c.clip();
  const fa = o.field ?? 1;
  if (fa > 0) {
    c.save();
    c.globalAlpha *= 0.2 * fa;
    c.imageSmoothingEnabled = false;
    c.drawImage(fieldCanvas(s, sn, !!o.useBias), x, y, size, size);
    c.restore();
  }
  const ca = o.creases ?? 0;
  if (ca > 0)
    s.alpha(ca, () => {
      s.line(px(0.5), y, px(0.5), y + size, s.tint('--ink-3', 0.7), 0.3, [1.2, 1]);
      s.line(x, py(0.25), x + size, py(0.25), s.tint('--ink-3', 0.7), 0.3, [1.2, 1]);
    });
  const r = Math.max(1.6, size / 110);
  for (let n = 0; n < TOY.n; n++) s.circle(px(TOY.X[2 * n]!), py(TOY.X[2 * n + 1]!), r, { fill: s.c(ekey(sn.assign[n]!)), stroke: s.tint('--paper', 0.8), lw: 0.15 });
  c.restore();
}

/** Tokens per expert as vertical bars, with the even share dashed. */
export function loadBars(s: Scene, x: number, y: number, w: number, h: number, load: number[], o: { a?: number; cap?: number; size?: number } = {}): void {
  const E = load.length;
  const n = load.reduce((a, b) => a + b, 0) || 1;
  const cw = w / E;
  const size = o.size ?? 3.4;
  const base = y + h - s.u * size * 1.6;
  const bh = base - y;
  s.alpha(o.a ?? 1, () => {
    for (let e = 0; e < E; e++) {
      const v = load[e]!;
      const hh = (v / n) * bh;
      s.rrect(x + e * cw + cw * 0.18, base - hh, cw * 0.64, Math.max(hh, 0.5), 0.8, { fill: s.tint(ekey(e), 0.75) });
      s.text(String(v), x + e * cw + cw / 2, base + s.u * size * 0.9, { font: 'mono', size, weight: 600, color: s.c(ekey(e)) });
    }
    s.line(x, base, x + w, base, s.c('--axis'), 0.25);
    const ey = base - bh / E;
    s.line(x, ey, x + w, ey, s.tint('--ink-2', 0.8), 0.25, [1, 0.8]);
    if (o.cap) {
      const cy = base - (o.cap / n) * bh;
      s.line(x, cy, x + w, cy, s.c('red'), 0.3, [0.6, 0.8]);
    }
  });
}

/** A loss curve on log axes, drawn up to fraction `t` of its points. */
export function logCurve(s: Scene, x: number, y: number, w: number, h: number, vals: number[], t: number, k: K = 'red', lo = 1e-3, hi = 1): void {
  const L = Math.log10;
  const sy = (v: number) => y + h - ((L(Math.max(v, lo)) - L(lo)) / (L(hi) - L(lo))) * h;
  for (const v of [1, 0.1, 0.01, 0.001]) {
    if (v < lo || v > hi) continue;
    s.line(x, sy(v), x + w, sy(v), s.c('--grid'), 0.2);
    s.text(String(v), x + w, sy(v) - s.u * 1.6, { font: 'mono', size: 2.9, align: 'right', color: s.c('--ink-3'), halo: true });
  }
  const n = Math.max(2, Math.round(clamp01(t) * (vals.length - 1)) + 1);
  const c = s.ctx;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const X = x + (i / (vals.length - 1)) * w;
    const Y = sy(vals[i]!);
    if (i) c.lineTo(X, Y);
    else c.moveTo(X, Y);
  }
  c.strokeStyle = s.c(k);
  c.lineWidth = 0.55 * s.u;
  c.stroke();
}
