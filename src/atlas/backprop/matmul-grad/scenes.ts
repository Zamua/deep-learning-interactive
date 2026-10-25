import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, type Ink, mono } from '../draw';

const W = [
  [1, 2, 0],
  [-1, 1, 3],
];
const X = [3, 0, 2];
const Z = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const DZ = [1, -2];
const DW = DZ.map((g) => X.map((x) => g * x));
const DX = X.map((_, j) => W.reduce((a, r, i) => a + r[j]! * DZ[i]!, 0));
const fmt = (v: number) => (v < 0 ? `−${-v}` : String(v));

const CW = 9;
const CH = 7.6;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Center of column j and of row i. */
  cx: (j: number) => number;
  cy: (i: number) => number;
}

/** A rows by cols grid of cells centered on (cx, cy); `on(i, j)` lights a cell. */
function grid(s: Scene, cx: number, cy: number, rows: number, cols: number, labels: (i: number, j: number) => string, k: Ink, on: (i: number, j: number) => number = () => 0, scale = 1): Box {
  const cw = CW * scale * s.u;
  const ch = CH * scale * s.u;
  const x0 = cx - (cols * cw) / 2;
  const y0 = cy - (rows * ch) / 2;
  const pad = 0.5 * s.u;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s.cell(x0 + j * cw + pad, y0 + i * ch + pad, cw - 2 * pad, ch - 2 * pad, labels(i, j), k, { on: on(i, j), size: 3.6 * scale });
  return { x0, y0, x1: x0 + cols * cw, y1: y0 + rows * ch, cx: (j) => x0 + (j + 0.5) * cw, cy: (i) => y0 + (i + 0.5) * ch };
}

const blank = () => '';
const label = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.8) => s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k) });
const shapeNote = (s: Scene, t: string, b: Box) => mono(s, t, (b.x0 + b.x1) / 2, b.y1 + 3.6 * s.u, '--ink-3', 3.2, 'center', 500);

const shapes: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const y1 = s.h * 0.27;
    const fa = s.ease('fwd', 0.6);
    s.alpha(fa, () => {
      const bW = grid(s, cx - 20 * s.u, y1, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue');
      const bx = grid(s, cx + 3.5 * s.u, y1, 3, 1, (i) => fmt(X[i]!), 'orange');
      label(s, '=', cx + 12.5 * s.u, y1, '--ink-2');
      const bz = grid(s, cx + 21.5 * s.u, y1, 2, 1, (i) => fmt(Z[i]!), 'purple');
      label(s, 'W', (bW.x0 + bW.x1) / 2, bW.y0 - 3.4 * s.u, 'blue');
      label(s, 'x', bx.cx(0), bx.y0 - 3.4 * s.u, 'orange');
      label(s, 'z', bz.cx(0), bz.y0 - 3.4 * s.u, 'purple');
      s.alpha(after(s, 'fwd', 0.4), () => shapeNote(s, '(2, 3)', bW));
      s.alpha(after(s, 'fwd', 0.6), () => shapeNote(s, '(3,)', bx));
      s.alpha(after(s, 'fwd', 0.8), () => shapeNote(s, '(2,)', bz));
    });
    s.alpha(after(s, 'dz', 0.3), () => {
      const b = grid(s, cx + 35.5 * s.u, y1, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.6);
      label(s, 'dz', b.cx(0), b.y0 - 3.4 * s.u, 'red');
      shapeNote(s, '(2,)', b);
    });
    // Below: the two gradients, each built to its variable's shape.
    const y2 = s.h * 0.71;
    s.alpha(after(s, 'dwshape', 0.2), () => {
      const g = grid(s, cx - 25 * s.u, y2, 2, 3, blank, 'red', () => after(s, 'outer', 0.75) * 0.7);
      shapeNote(s, '(2, 3), like W', g);
      s.alpha(after(s, 'outer', 0.2), () => {
        const c = grid(s, g.x0 - 6.5 * s.u, y2, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.6);
        const r = grid(s, (g.x0 + g.x1) / 2, g.y0 - 4.8 * s.u, 1, 3, (_, j) => fmt(X[j]!), 'orange');
        label(s, 'dz', c.cx(0), c.y0 - 3.2 * s.u, 'red', 'center', 3.2);
        label(s, 'xᵀ', r.x1 + 1.6 * s.u, r.cy(0), 'orange', 'left', 3.4);
        label(s, 'dW = dz xᵀ', (g.x0 + g.x1) / 2, r.y0 - 3.6 * s.u, 'red', 'center', 3.4);
      });
    });
    s.alpha(after(s, 'dxshape', 0.35), () => {
      const wt = grid(s, cx + 7 * s.u, y2, 3, 2, blank, 'blue');
      const d = grid(s, cx + 23 * s.u, y2, 2, 1, blank, 'red', () => 0.6);
      label(s, '=', cx + 31.5 * s.u, y2, '--ink-2');
      const dx = grid(s, cx + 40 * s.u, y2, 3, 1, blank, 'red', () => after(s, 'dxshape', 0.85) * 0.7);
      shapeNote(s, '(3, 2)', wt);
      shapeNote(s, '(2,)', d);
      shapeNote(s, '(3,)', dx);
      label(s, 'Wᵀ', (wt.x0 + wt.x1) / 2, wt.y0 - 3.4 * s.u, 'blue', 'center', 3.4);
      label(s, 'dx', dx.cx(0), dx.y0 - 3.4 * s.u, 'red', 'center', 3.4);
    });
  },
};

/** Scene two's grids are larger: it has fewer of them. */
const K = 1.15;

const entries: SceneDef = {
  marks: {
    zi: { tex: String.raw`z_i = \textstyle\sum_j \symW_{ij}\,\symx_j`, x: 0.5, y: 0.09, size: 5 },
    ij: { tex: String.raw`\frac{\partial \symL}{\partial \symW_{ij}} = \frac{\partial \symL}{\partial z_i}\,\symx_j`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    s.show('zi', s.ease('zi', 0.6) * (1 - s.ease('ij', 0.4)));
    s.show('ij', s.ease('ij', 0.5, 0.3) * (1 - s.ease('dx', 0.4)));
    const ax = s.w / 2 + 4 * s.u;
    const ay = s.h * 0.4;
    // Which dW cells are showing: (1, 2) first, then row 0, then row 1.
    const shown = (i: number, j: number) => {
      if (i === 1 && j === 2) return after(s, 'ij', 0.72);
      return i === 0 ? after(s, 'grid', 0.25 + 0.08 * j) : after(s, 'grid', 0.7 + 0.08 * j);
    };
    const hi = (i: number, j: number) => (i === 1 && j === 2 ? s.win('ij', 'grid') : 0);
    const g = grid(s, ax, ay, 2, 3, (i, j) => (shown(i, j) > 0.5 ? fmt(DW[i]![j]!) : ''), 'red', (i, j) => Math.max(hi(i, j), shown(i, j) * 0.4), K);
    const col = grid(s, g.x0 - 7 * s.u, ay, 2, 1, (i) => fmt(DZ[i]!), 'red', (i) => (i === 1 ? s.win('ij', 'grid') : 0) + 0.3, K);
    const row = grid(s, (g.x0 + g.x1) / 2, g.y0 - 5.4 * s.u, 1, 3, (_, j) => fmt(X[j]!), 'orange', (_, j) => (j === 2 ? s.win('ij', 'grid') : 0), K);
    label(s, 'dz', col.x0 - 1.6 * s.u, col.cy(0), 'red', 'right', 3.4);
    label(s, 'xᵀ', row.x1 + 1.6 * s.u, row.cy(0), 'orange', 'left', 3.4);
    label(s, 'dW', g.x1 + 1.6 * s.u, g.cy(1), 'red', 'left', 3.4);
    // dx: column j of W, weighted by dz, summed into dx_j.
    const bx = s.w / 2 + 4 * s.u;
    const by = s.h * 0.72;
    s.alpha(s.ease('dx', 0.6), () => {
      const hot = (j: number) => (j === 0 ? after(s, 'dx', 0.55) : 0);
      const w = grid(s, bx, by, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', (_, j) => hot(j) * 0.8, K);
      const c = grid(s, w.x0 - 7 * s.u, by, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3, K);
      label(s, 'dz', c.x0 - 1.6 * s.u, c.cy(0), 'red', 'right', 3.4);
      label(s, 'W', w.x1 + 1.6 * s.u, w.cy(0), 'blue', 'left', 3.4);
      const dy = w.y1 + 7.5 * s.u;
      for (let j = 0; j < 3; j++) {
        const a = j === 0 ? after(s, 'dx', 0.7) : after(s, 'dx', 0.85 + 0.05 * j);
        s.alpha(a, () => {
          s.arrow(w.cx(j), w.y1 + 0.4 * s.u, w.cx(j), dy - 4.6 * s.u, s.c('--ink-3'), 0.3, 1.6);
          s.cell(w.cx(j) - ((CW * K) / 2 - 0.5) * s.u, dy - ((CH * K) / 2 - 0.5) * s.u, (CW * K - 1) * s.u, (CH * K - 1) * s.u, fmt(DX[j]!), 'red', { on: j === 0 ? 0.8 : 0.4, size: 3.6 * K });
        });
      }
      s.alpha(after(s, 'dx', 0.7), () => label(s, 'dx', w.x1 + 1.6 * s.u, dy, 'red', 'left', 3.4));
    });
  },
};

export const scenes: Record<string, SceneDef> = { shapes, entries };
