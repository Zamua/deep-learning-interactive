// Drawing helpers for the inference explainers: token chips, model passes, and tallies.
import type { Ink, Scene } from '../../lecture/scene';

/** A chip just wide enough for its label, centered on (x, y). */
export function word(s: Scene, x: number, y: number, t: string, k: Ink, o: { on?: number; size?: number; h?: number } = {}): void {
  const size = o.size ?? 3;
  const w = Math.max(8, 3 + (s.measure(t, { size, font: 'mono' }) / s.u) * 1.05);
  const h = (o.h ?? 6.5) * s.u;
  s.cell(x - (w * s.u) / 2, y - h / 2, w * s.u, h, '', k, { on: o.on ?? 0 });
  s.text(t, x, y + 0.2 * s.u, { size, font: 'mono', weight: 600, color: s.c(k) });
}

/** One pass of a model: a box of `n` stacked layers centered on (x, y), `w` by `h` stage units. */
export function pass(s: Scene, x: number, y: number, k: Ink, o: { w?: number; h?: number; n?: number; on?: number; label?: string } = {}): void {
  const w = (o.w ?? 14) * s.u;
  const h = (o.h ?? 18) * s.u;
  const n = o.n ?? 4;
  const on = o.on ?? 0;
  s.rrect(x - w / 2, y - h / 2, w, h, 1.6, { fill: s.tint(k, 0.08 + 0.12 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 });
  const pad = 1.6 * s.u;
  const lh = (h - 2 * pad) / n;
  for (let i = 0; i < n; i++) s.rrect(x - w / 2 + pad, y - h / 2 + pad + i * lh + 0.4 * s.u, w - 2 * pad, lh - 0.8 * s.u, 0.8, { fill: s.tint(k, 0.22 + 0.2 * on) });
  if (o.label) s.text(o.label, x, y, { size: 2.8, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** A check or a cross on its own, centered on (x, y). */
export function mark(s: Scene, ok: boolean, x: number, y: number, size = 3.6): void {
  s.text(ok ? '✓' : '✗', x, y, { size, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
}

/** A horizontal bar from x0, `len` px long, with a label past its end. */
export function hbar(s: Scene, x0: number, y: number, len: number, k: Ink, label: string, o: { h?: number; size?: number } = {}): void {
  const h = (o.h ?? 4.4) * s.u;
  s.rrect(x0, y - h / 2, Math.max(len, 0.8 * s.u), h, 1, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.3 });
  s.text(label, x0 + Math.max(len, 0.8 * s.u) + 2 * s.u, y, { size: o.size ?? 3.2, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
}
