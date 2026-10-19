import { type Scene, type TextOpts, clamp01 } from '../../lecture/scene';
import { type K, Plane, type Rect, margin, top } from './draw';

/** A number with a fixed count of decimals and a typographic minus. */
export function num(v: number, d = 2): string {
  const t = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return t.toFixed(d).replace('-', '−');
}

/** Text shrunk (never grown) so it fits within `maxW` pixels. */
export function fit(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts = {}): void {
  const size = o.size ?? 5;
  const wd = s.measure(str, o);
  s.text(str, x, y, { ...o, size: wd > maxW ? (size * maxW) / wd : size });
}

/** A plane on the left and a panel on the right that shares its height. */
export function plotSide(s: Scene, frac: number): { pl: Plane; side: Rect } {
  const m = margin(s);
  const avail = s.h - top(s) - m;
  const size = Math.min(avail, s.w * frac);
  const py = top(s) + (avail - size) / 2;
  const pl = new Plane(s, m, py, size);
  const sx = m + size + m * 1.3;
  return { pl, side: [sx, py, s.w - sx - m, size] };
}

/** Two planes side by side under a header line each. */
export function twoPlots(s: Scene, head = 8): [Plane, Plane] {
  const m = margin(s);
  const hd = s.u * head;
  const size = Math.min((s.w - 3 * m) / 2, s.h - top(s) - m - hd);
  const y = top(s) + hd + (s.h - top(s) - m - hd - size) / 2;
  const x0 = (s.w - 2 * size - m) / 2;
  return [new Plane(s, x0, y, size), new Plane(s, x0 + size + m, y, size)];
}

/** Crossfades between a sequence of values keyed by beats, for a label that changes in place. */
export function swap(s: Scene, ids: string[], dur = 0.45): { i: number; a: number; prev: number } {
  let i = -1;
  for (let k = 0; k < ids.length; k++) if (s.since(ids[k]!) >= 0) i = k;
  if (i < 0) return { i: 0, a: 1, prev: 0 };
  const a = clamp01(s.since(ids[i]!) / dur);
  return { i, a, prev: Math.max(0, i - 1) };
}

/** Draws `fn(k)` for the current and (fading) previous entries of a `swap`. */
export function crossfade(s: Scene, sw: { i: number; a: number; prev: number }, fn: (k: number) => void): void {
  if (sw.a < 1 && sw.prev !== sw.i) s.alpha(1 - sw.a, () => fn(sw.prev));
  s.alpha(sw.a, () => fn(sw.i));
}

/** A small value grid cell with text, filled by `fill` (0..1) as a probability bar. */
export function barCell(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; fill?: number; size?: number; gold?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.1, { fill: s.tint(k, 0.07 + 0.12 * on), stroke: s.tint(k, 0.4 + 0.4 * on), lw: 0.28 });
  if (o.fill !== undefined && o.fill > 0) s.rrect(x + s.u * 0.5, y + h - s.u * 1.4, Math.max(0, (w - s.u) * clamp01(o.fill)), s.u * 0.9, 0.4, { fill: s.tint(k, 0.75) });
  if ((o.gold ?? 0) > 0) s.alpha(o.gold!, () => s.rrect(x - s.u * 0.3, y - s.u * 0.3, w + s.u * 0.6, h + s.u * 0.6, 1.3, { stroke: s.c('gold'), lw: 0.55 }));
  s.text(label, x + w / 2, y + h / 2 - (o.fill !== undefined ? s.u * 0.5 : 0), { size: o.size ?? 3.2, font: 'mono', weight: 550 });
}
