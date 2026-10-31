// Drawing shared by the partials and gradient explainers: the bowl's contour plot and the term table.
import type { Ink, Scene } from '../../../lecture/scene';
import { Frame, type Rect } from '../draw';

/** The contour plot, and where its legend goes: below it on a phone, beside it on a desktop. */
export function bowlLayout(s: Scene) {
  const plot: Rect = s.tall ? [s.w * 0.05, s.h * 0.03, s.w * 0.9, s.h * 0.5] : [s.w * 0.04, s.h * 0.06, s.w * 0.58, s.h * 0.88];
  const F = new Frame(s, plot, [-2.3, 2.3, -1.6, 2.3], true);
  const legend = s.tall ? { x: s.w / 2 - 22 * s.u, y: s.h * 0.75, dy: 7.2 * s.u } : { x: s.w * 0.65, y: s.h * 0.34, dy: 8 * s.u };
  // The formula sits above the legend, with room for the per-term braces under it.
  const fy = s.tall ? s.h * 0.6 : legend.y - 1.9 * legend.dy;
  return { F, legend, fy };
}

/** The ring where u² + 2v² = c: an ellipse with semi-axes sqrt(c) in u and sqrt(c / 2) in v. */
export function ring(s: Scene, F: Frame, c: number, stroke: string, lw: number) {
  const ctx = s.ctx;
  F.clip(() => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      const x = F.X(Math.sqrt(c) * Math.cos(t));
      const y = F.Y(Math.sqrt(c / 2) * Math.sin(t));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw * s.u;
    ctx.stroke();
  });
}

const LEVELS = [0.5, 1.5, 3, 4.5, 6, 8];

/** Every ring, the one at height `hi` lit by `hiA`, with the u and v axes. */
export function rings(s: Scene, F: Frame, hi = -1, hiA = 0) {
  F.axes(0.8);
  for (const c of LEVELS) ring(s, F, c, s.tint('purple', c === hi ? 0.35 + 0.65 * hiA : 0.35), c === hi ? 0.3 + 0.35 * hiA : 0.3);
  const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('u', F.X(2.15), F.Y(0) + 3 * s.u, o);
  s.text('v', F.X(0) - 3 * s.u, F.Y(2.15), o);
}

export function legendLine(s: Scene, L: { x: number; y: number; dy: number }, row: number, text: string, k: Ink, a: number) {
  s.alpha(a, () => s.text(text, L.x, L.y + row * L.dy, { size: 3.9, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
}

/** Term-table sizes in stage units: cell, gap (holding a plus sign), label column. */
const TW = 14;
const TH = 7.5;
const TGAP = 4.6;
const TLW = 13;
export const ROW = [0.25, 0.37, 0.49];
const RES = [0.65, 0.75, 0.85];

/** Where cell i of an n-term table starts, the table centered on the stage. */
export const cellX = (s: Scene, n: number, i: number) => s.w / 2 + (-(TLW + 2 + n * TW + (n - 1) * TGAP) / 2 + TLW + 2 + i * (TW + TGAP)) * s.u;
/** Just right of an n-term table, for a note beside a row. */
export const besideX = (s: Scene, n: number) => cellX(s, n, n) - TGAP * s.u + 2 * s.u;

/**
 * One row of a term table: a label, then what each term of f becomes, joined by plus signs.
 * `next` crossfades the row into another label and cells as `next.t` goes 0 -> 1.
 */
export function termRow(s: Scene, n: number, row: number, k: Ink, a: number, label: string, cells: string[], on: number[] = [], next?: { label: string; cells: string[]; t: number; k: Ink }) {
  const y = s.h * ROW[row]!;
  const t = next?.t ?? 0;
  s.alpha(a, () => {
    const x0 = cellX(s, n, 0);
    for (let i = 0; i < n; i++) {
      const x = cellX(s, n, i);
      if (i) s.text('+', x - (TGAP / 2) * s.u, y, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.alpha(1 - t, () => s.cell(x, y - (TH / 2) * s.u, TW * s.u, TH * s.u, '', k, { on: on[i] ?? 0 }));
      if (next) s.alpha(t, () => s.cell(x, y - (TH / 2) * s.u, TW * s.u, TH * s.u, '', next.k, { on: on[i] ?? 0 }));
    }
    const words = (lab: string, cs: string[], kk: Ink, w: number) =>
      s.alpha(w, () => {
        s.text(lab, x0 - 2 * s.u, y, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(kk) });
        cs.forEach((c, i) => s.text(c, cellX(s, n, i) + (TW / 2) * s.u, y + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 600 }));
      });
    words(label, cells, k, 1 - t);
    if (next) words(next.label, next.cells, next.k, t);
  });
}

/** A result line under the table. */
export const result = (s: Scene, t: string, row: number, k: Ink, a: number) =>
  s.alpha(a, () => s.text(t, s.w / 2, s.h * RES[row]!, { size: 3.8, font: 'mono', weight: 600, color: s.c(k), halo: true }));

/** `v` once `a` is past halfway: a cell filled in as the voice reaches it. */
export const fill = (a: number, v: string) => (a > 0.5 ? v : '');
