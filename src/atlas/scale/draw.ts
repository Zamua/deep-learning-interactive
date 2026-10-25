// Drawing helpers for the scale explainers: labelled boxes, stacked byte bars and GPU cards.
import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';

export type Ink = Color | `--${string}`;

/** A filled, outlined box centered on (x, y), `w` by `h` stage units, with an optional label inside. */
export function box(s: Scene, x: number, y: number, w: number, h: number, k: Ink, o: { label?: string; size?: number; on?: number; ink?: Ink; font?: 'mono' | 'ui' | 'serif' } = {}): void {
  const W = w * s.u;
  const H = h * s.u;
  const on = o.on ?? 0;
  s.rrect(x - W / 2, y - H / 2, W, H, 1.2, { fill: s.tint(k, 0.16 + 0.22 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.2 * on });
  if (o.label) s.text(o.label, x, y + 0.2 * s.u, { size: o.size ?? 3.2, font: o.font ?? 'mono', weight: 600, color: s.c(o.ink ?? '--ink') });
}

/**
 * Parts laid end to end from `x`, `unit` stage units per count, as one bar `h` units tall
 * centered on `y`. `grow` in [0, 1] reveals the parts left to right; returns each part's center x.
 */
export function stack(s: Scene, x: number, y: number, unit: number, h: number, parts: { n: number; k: Ink; label?: string; a?: number }[], o: { grow?: number; size?: number } = {}): number[] {
  const total = parts.reduce((a, p) => a + p.n, 0);
  const shown = (o.grow ?? 1) * total;
  let at = 0;
  const mids: number[] = [];
  for (const p of parts) {
    const w = Math.max(0, Math.min(p.n, shown - at));
    const x0 = x + at * unit * s.u;
    mids.push(x0 + (p.n * unit * s.u) / 2);
    if (w > 0) {
      s.alpha(p.a ?? 1, () => {
        s.rrect(x0 + 0.15 * s.u, y - (h / 2) * s.u, w * unit * s.u - 0.3 * s.u, h * s.u, 0.8, { fill: s.tint(p.k, 0.32), stroke: s.tint(p.k, 0.9), lw: 0.3 });
        if (p.label && w >= p.n - 1e-6) s.text(p.label, x0 + (p.n * unit * s.u) / 2, y + 0.2 * s.u, { size: o.size ?? 3, font: 'mono', weight: 650, color: s.c(p.k) });
      });
    }
    at += p.n;
  }
  return mids;
}

/** A GPU as a card: an outlined panel with its name along the top edge. */
export function gpu(s: Scene, x: number, y: number, w: number, h: number, name: string, o: { k?: Ink; on?: number; size?: number } = {}): void {
  const k = o.k ?? 'slate';
  const W = w * s.u;
  const H = h * s.u;
  const on = o.on ?? 0;
  s.rrect(x - W / 2, y - H / 2, W, H, 1.6, { fill: s.tint(k, 0.06 + 0.1 * on), stroke: s.tint(k, 0.5 + 0.4 * on), lw: 0.35 });
  s.text(name, x, y - H / 2 + 3 * s.u, { size: o.size ?? 2.9, font: 'mono', weight: 650, color: s.c('--ink-2') });
}

/** Mono text, the explainers' usual label. */
export function mono(s: Scene, text: string, x: number, y: number, o: { size?: number; k?: Ink; align?: CanvasTextAlign; weight?: number; halo?: boolean } = {}): void {
  s.text(text, x, y, { size: o.size ?? 3.4, font: 'mono', weight: o.weight ?? 550, align: o.align ?? 'center', color: s.c(o.k ?? '--ink'), halo: o.halo });
}
