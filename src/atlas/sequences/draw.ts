// Drawing helpers for the sequence-model explainers: tokens, step boxes and chains of them.
import type { Scene } from '../../lecture/scene';
import type { Ink } from '../../lecture/scene';

/** A token in a small rounded chip, centered on (x, y). */
export function chip(s: Scene, x: number, y: number, label: string, k: Ink, o: { w?: number; h?: number; on?: number; size?: number } = {}): void {
  const w = (o.w ?? 9) * s.u;
  const h = (o.h ?? 7) * s.u;
  s.cell(x - w / 2, y - h / 2, w, h, label, k, { on: o.on ?? 0, size: o.size ?? 3.4 });
}

/** A step of a recurrent network: a box centered on (x, y), `w` by `h` stage units. */
export function box(s: Scene, x: number, y: number, label: string, k: Ink, o: { w?: number; h?: number; on?: number; size?: number } = {}): void {
  const w = (o.w ?? 12) * s.u;
  const h = (o.h ?? 9) * s.u;
  const on = o.on ?? 0;
  s.rrect(x - w / 2, y - h / 2, w, h, 1.6, { fill: s.tint(k, 0.12 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 + 0.2 * on });
  if (label) s.text(label, x, y + 0.2 * s.u, { size: o.size ?? 3.4, font: 'mono', weight: 600, color: s.c(k) });
}

/** A vertical stack of number cells centered on x, one per label, `gap` stage units apart. */
export function stack(s: Scene, x: number, y: number, labels: string[], k: Ink, o: { w?: number; h?: number; gap?: number; on?: number[]; size?: number } = {}): number[] {
  const gap = (o.gap ?? 8) * s.u;
  const ys = labels.map((_, i) => y + (i - (labels.length - 1) / 2) * gap);
  const w = (o.w ?? 11) * s.u;
  const h = (o.h ?? 7) * s.u;
  ys.forEach((yy, i) => s.cell(x - w / 2, yy - h / 2, w, h, labels[i]!, k, { on: o.on?.[i] ?? 0, size: o.size ?? 3.2 }));
  return ys;
}

/** Right arrows between consecutive x positions, leaving `pad` stage units at each end. */
export function links(s: Scene, xs: number[], y: number, pad: number, k: Ink = '--ink-3', a: (i: number) => number = () => 1): void {
  for (let i = 0; i + 1 < xs.length; i++) s.alpha(a(i), () => s.arrow(xs[i]! + pad * s.u, y, xs[i + 1]! - pad * s.u, y, s.c(k), 0.35, 2));
}

/** A number with a sign the way the stage prints it: `−0.5`. */
export const fmt = (v: number, places?: number): string => (places === undefined ? String(v) : v.toFixed(places)).replace('-', '−');
