// Drawing helpers for the transformer explainers: subscripted names, short vectors as cell rows,
// small matrices, attention grids and blocks that stand for whole matrices.
import type { Ink, Scene, TextOpts } from '../../lecture/scene';

/** `base` with a smaller, lowered `sub`, as one label: W with a Q under it. Returns its width. */
export function sub(s: Scene, base: string, subscript: string, x: number, y: number, o: TextOpts & { k?: Ink } = {}): number {
  const size = o.size ?? 3.8;
  const font = o.font ?? 'mono';
  const weight = o.weight ?? 650;
  const bo: TextOpts = { size, font, weight };
  const so: TextOpts = { size: size * 0.66, font, weight };
  const wb = s.measure(base, bo);
  const ws = s.measure(subscript, so);
  const total = wb + ws + 0.2 * s.u;
  const left = o.align === 'right' ? x - total : o.align === 'left' ? x : x - total / 2;
  const col = s.c(o.k ?? '--ink');
  s.text(base, left, y, { ...bo, align: 'left', color: col, halo: o.halo });
  s.text(subscript, left + wb + 0.2 * s.u, y + size * 0.32 * s.u, { ...so, align: 'left', color: col, halo: o.halo });
  return total;
}

/** A short vector as a row of small cells centered on x, `pitch` stage units apart. */
export function vrow(s: Scene, x: number, y: number, labels: string[], k: Ink, o: { w?: number; h?: number; pitch?: number; on?: number[]; size?: number } = {}): number[] {
  const pitch = (o.pitch ?? 9) * s.u;
  const w = (o.w ?? 8) * s.u;
  const h = (o.h ?? 7) * s.u;
  const xs = labels.map((_, i) => x + (i - (labels.length - 1) / 2) * pitch);
  xs.forEach((cx, i) => s.cell(cx - w / 2, y - h / 2, w, h, labels[i]!, k, { on: o.on?.[i] ?? 0, size: o.size ?? 3.2 }));
  return xs;
}

/** A small matrix of cells centered on (x, y), `pitch` by `vpitch` stage units apart. */
export function mini(s: Scene, x: number, y: number, rows: (string | number)[][], k: Ink, o: { w?: number; h?: number; pitch?: number; vpitch?: number; size?: number; on?: (i: number, j: number) => number } = {}): { l: number; r: number; t: number; b: number } {
  const pitch = (o.pitch ?? 9) * s.u;
  const vp = (o.vpitch ?? 7.5) * s.u;
  const w = (o.w ?? 8) * s.u;
  const h = (o.h ?? 6.5) * s.u;
  const m = rows.length;
  const n = rows[0]!.length;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const cx = x + (j - (n - 1) / 2) * pitch;
      const cy = y + (i - (m - 1) / 2) * vp;
      s.cell(cx - w / 2, cy - h / 2, w, h, String(rows[i]![j]!), k, { on: o.on?.(i, j) ?? 0, size: o.size ?? 3 });
    }
  }
  return { l: x - ((n - 1) / 2) * pitch - w / 2, r: x + ((n - 1) / 2) * pitch + w / 2, t: y - ((m - 1) / 2) * vp - h / 2, b: y + ((m - 1) / 2) * vp + h / 2 };
}

/**
 * A T by T attention grid with its top-left cell centered on (x, y): rows are tokens asking,
 * columns tokens asked. `val(i, j)` in [0, 1] shades a cell; null leaves it blank (masked).
 */
export function heat(s: Scene, x: number, y: number, n: number, cell: number, val: (i: number, j: number) => number | null, k: Ink, o: { text?: (i: number, j: number) => string; size?: number; alpha?: (i: number, j: number) => number } = {}): void {
  const c = cell * s.u;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = o.alpha?.(i, j) ?? 1;
      if (a <= 0.003) continue;
      s.alpha(a, () => {
        const v = val(i, j);
        const cx = x + j * c;
        const cy = y + i * c;
        if (v === null) {
          s.rrect(cx - c / 2 + 0.4 * s.u, cy - c / 2 + 0.4 * s.u, c - 0.8 * s.u, c - 0.8 * s.u, 0.8, { stroke: s.tint('--ink-3', 0.35), lw: 0.25 });
          return;
        }
        s.rrect(cx - c / 2 + 0.4 * s.u, cy - c / 2 + 0.4 * s.u, c - 0.8 * s.u, c - 0.8 * s.u, 0.8, { fill: s.tint(k, 0.08 + 0.5 * v), stroke: s.tint(k, 0.5), lw: 0.25 });
        const t = o.text?.(i, j);
        if (t) s.text(t, cx, cy + 0.2 * s.u, { size: o.size ?? 2.8, font: 'mono', weight: 600, color: s.c('--ink') });
      });
    }
  }
}

/** A rectangle standing for a whole matrix, its name inside and its sizes along two sides. */
export function slab(s: Scene, x: number, y: number, w: number, h: number, k: Ink, name: string, rows?: string, cols?: string, o: { size?: number; on?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.2, { fill: s.tint(k, 0.14 + 0.16 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  s.text(name, x + w / 2, y + h / 2, { size: o.size ?? 3.8, font: 'mono', weight: 650, color: s.c(k), halo: true });
  const lo: TextOpts = { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true };
  if (rows) s.text(rows, x - 1.6 * s.u, y + h / 2, { ...lo, align: 'right' });
  if (cols) s.text(cols, x + w / 2, y - 2.8 * s.u, lo);
}

/** A labelled box for one step of a block, centered on (x, y). */
export function stage(s: Scene, x: number, y: number, w: number, h: number, label: string, k: Ink, o: { on?: number; size?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x - (w * s.u) / 2, y - (h * s.u) / 2, w * s.u, h * s.u, 1.6, { fill: s.tint(k, 0.1 + 0.22 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 + 0.2 * on });
  s.text(label, x, y + 0.2 * s.u, { size: o.size ?? 3.2, font: 'mono', weight: 600, color: s.c(on > 0.5 ? k : '--ink') });
}

/** A number the way the stage prints it, with a true minus sign: `−0.5`. */
export const fmt = (v: number, places?: number): string => (places === undefined ? String(v) : v.toFixed(places)).replace('-', '−');

/** `[1, −2]` for the stage. */
export const vtext = (xs: readonly number[], places?: number): string => `[${xs.map((x) => fmt(x, places)).join(', ')}]`;
