import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cells, cite } from '../../draw';
import { caption } from '../../networks/draw';
import { fmt, rich } from '../draw';

/** The block diagram: x, the box F, the sum and y on one row, with the shortcut arching above. */
function diagram(s: Scene, yD: number, o: { relu?: number } = {}): void {
  const xN = s.w * 0.1;
  const b0 = s.w * 0.24;
  const b1 = s.w * 0.54;
  const pN = s.w * 0.66;
  const yN = s.w * 0.9;
  const r = 4 * s.u;
  const top = yD - 15 * s.u;
  const ink = s.c('--ink-3');
  s.circle(xN, yD, r, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.4 });
  s.text('x', xN, yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('orange') });
  s.arrow(xN + r, yD, b0 - 0.6 * s.u, yD, ink, 0.35, 2);
  s.rrect(b0, yD - 7 * s.u, b1 - b0, 14 * s.u, 1.6, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
  s.text('F(x)', (b0 + b1) / 2, yD - 1.8 * s.u, { size: 4.2, font: 'mono', weight: 650, color: s.c('blue') });
  s.text('conv, ReLU, conv', (b0 + b1) / 2, yD + 3.6 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-2') });
  s.arrow(b1, yD, pN - r, yD, ink, 0.35, 2);
  s.line(xN, yD - r, xN, top, s.c('orange'), 0.4);
  s.line(xN, top, pN, top, s.c('orange'), 0.4);
  s.arrow(pN, top, pN, yD - r, s.c('orange'), 0.4, 2);
  s.text('shortcut', (xN + pN) / 2, top - 3 * s.u, { size: 3, font: 'mono', color: s.c('orange') });
  s.circle(pN, yD, r, { fill: s.tint('--ink', 0.06), stroke: s.c('--ink-2'), lw: 0.4 });
  s.text('+', pN, yD, { size: 5, font: 'mono', weight: 650, color: s.c('--ink') });
  s.arrow(pN + r, yD, yN - r, yD, ink, 0.35, 2);
  s.alpha(o.relu ?? 0, () => s.text('ReLU', (pN + yN) / 2, yD - 3 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
  s.circle(yN, yD, r, { fill: s.tint('green', 0.2), stroke: s.c('green'), lw: 0.4 });
  s.text('y', yN, yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') });
}

const X = [2, -1, 3];
const FX = [0.5, 0.5, -1];
const SUM = X.map((v, i) => v + FX[i]!);
const Y = SUM.map((v) => Math.max(0, v));

/** A labelled column of three cells; `on(i)` lights cell i. */
function column(s: Scene, x: number, y: number, label: string, vals: string[], k: Ink, on: (i: number) => number = () => 0) {
  s.text(label, x, y - 12 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
  [0, 1, 2].forEach((i) => cells(s, [x], y - 6.8 * s.u + i * 6.8 * s.u, [vals[i]!], k, { w: 11, h: 6, size: 3.2, on: [on(i)] }));
}

const block: SceneDef = {
  draw(s) {
    const yD = s.h * 0.3;
    const relu = s.ease('relu', 0.6);
    diagram(s, yD, { relu });
    s.alpha(s.win('recap', 'entries'), () =>
      rich(s, [['y', 'green'], [' = ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['F(x)', 'blue']], s.w / 2, s.h * 0.62, { size: 5, weight: 650 }),
    );
    s.alpha(s.win('recap', 'conv'), () => caption(s, 'F learns only the change: the residual', s.h * 0.74, 'blue', 3.4));
    s.alpha(s.win('conv', 'entries'), () => {
      caption(s, 'x: a stack of channels', s.h * 0.74, 'orange', 3.4);
      caption(s, 'F: the layers, not a filter size', s.h * 0.8, 'blue', 3.4);
    });
    // The sum entry by entry, then the ReLU after it.
    const ex = s.ease('entries', 0.6);
    s.alpha(ex, () => {
      const y = s.h * 0.72;
      const [c1, c2, c3, c4] = [0.13, 0.37, 0.62, 0.87].map((f) => s.w * f) as [number, number, number, number];
      const first = s.win('entries', 'relu');
      column(s, c1, y, 'x', X.map(fmt), 'orange', (i) => (i === 0 ? first : 0));
      s.text('+', (c1 + c2) / 2, y, { size: 5, font: 'mono', color: s.c('--ink-2') });
      column(s, c2, y, 'F(x)', FX.map(fmt), 'blue', (i) => (i === 0 ? first : 0));
      s.text('=', (c2 + c3) / 2, y, { size: 5, font: 'mono', color: s.c('--ink-2') });
      s.alpha(after(s, 'entries', 0.4), () => column(s, c3, y, 'x + F(x)', SUM.map(fmt), 'purple', (i) => (i === 0 ? first : i === 1 ? relu : 0)));
      s.alpha(relu, () => {
        s.text('ReLU', (c3 + c4) / 2, y - 2.6 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('gold') });
        s.arrow(c3 + 6.5 * s.u, y, c4 - 6.5 * s.u, y, s.c('gold'), 0.35, 1.8);
        column(s, c4, y, 'y', Y.map(fmt), 'green', (i) => (i === 1 ? after(s, 'relu', 0.55) : 0));
      });
    });
    s.alpha(s.win('entries', 'relu'), () => caption(s, '2 + 0.5 = 2.5, entry by entry', s.h * 0.93, 'purple', 3.4));
    s.alpha(after(s, 'relu', 0.55), () => caption(s, 'ReLU after the sum: −0.5 becomes 0', s.h * 0.93, 'gold', 3.4));
    cite(s, 'He, Zhang, Ren & Sun, 2015', relu);
  },
};

// ---- volumes: a front grid of positions, with sheets behind it for the channels

interface Vol {
  /** Front face, top left. */
  x: number;
  y: number;
  /** Positions across. */
  n: number;
  /** Sheets drawn for the channels. */
  sheets: number;
  pitch: number;
  step: number;
  k: Ink;
}
const side = (v: Vol) => v.n * v.pitch;
/** Width and height of the whole drawing, sheets included. */
const extent = (v: Vol) => side(v) + (v.sheets - 1) * v.step;

function vol(s: Scene, v: Vol, o: { lit?: (i: number, j: number) => number; dots?: (i: number, j: number) => number; column?: [number, number, number] } = {}) {
  const u = s.u;
  const p = v.pitch * u;
  const st = v.step * u;
  const sd = side(v) * u;
  for (let l = v.sheets - 1; l >= 1; l--) s.rrect(v.x + l * st, v.y - l * st, sd, sd, 0.5, { fill: s.tint(v.k, 0.12), stroke: s.tint(v.k, 0.55), lw: 0.22 });
  // A one-by-one column through every sheet, at position (i, j).
  if (o.column && o.column[2] > 0.003) {
    const [i, j, a] = o.column;
    s.alpha(a, () => {
      for (let l = v.sheets - 1; l >= 1; l--) s.rrect(v.x + j * p + l * st, v.y + i * p - l * st, p, p, 0.2, { fill: s.tint('orange', 0.55), stroke: s.c('orange'), lw: 0.15 });
    });
  }
  s.rrect(v.x, v.y, sd, sd, 0.5, { fill: s.c('--card'), stroke: s.c(v.k), lw: 0.3 });
  s.rrect(v.x, v.y, sd, sd, 0.5, { fill: s.tint(v.k, 0.14) });
  for (let i = 1; i < v.n; i++) {
    s.line(v.x + i * p, v.y, v.x + i * p, v.y + sd, s.tint(v.k, 0.35), 0.12);
    s.line(v.x, v.y + i * p, v.x + sd, v.y + i * p, s.tint(v.k, 0.35), 0.12);
  }
  for (let i = 0; i < v.n; i++) {
    for (let j = 0; j < v.n; j++) {
      const a = o.lit?.(i, j) ?? 0;
      if (a > 0.003) s.alpha(a, () => s.rrect(v.x + j * p + 0.15 * u, v.y + i * p + 0.15 * u, p - 0.3 * u, p - 0.3 * u, 0.2, { fill: s.tint(v.k, 0.6) }));
      const d = o.dots?.(i, j) ?? 0;
      if (d > 0.003) s.alpha(d, () => s.circle(v.x + (j + 0.5) * p, v.y + (i + 0.5) * p, 0.55 * u, { fill: s.c('orange') }));
    }
  }
  if (o.column && o.column[2] > 0.003) {
    const [i, j, a] = o.column;
    s.alpha(a, () => s.rrect(v.x + j * p, v.y + i * p, p, p, 0.2, { fill: s.tint('orange', 0.7), stroke: s.c('orange'), lw: 0.25 }));
  }
}

/** A volume's shape, under it. */
function shapeLabel(s: Scene, v: Vol, t: string, k: Ink, a = 1) {
  s.alpha(a, () => s.text(t, v.x + (extent(v) * s.u) / 2, v.y + side(v) * s.u + 4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k), halo: true }));
}

/** One line of working, `row` lines down from y0. */
function work(s: Scene, y0: number, row: number, runs: [string, Ink][], a: number): void {
  s.alpha(a, () => rich(s, runs, s.w / 2, y0 + row * 6 * s.u, { size: 3.1, weight: 600 }));
}

/** x at the left, F(x) at the right, both bottom-aligned on `base`. */
function pair(s: Scene, base: number) {
  const xv: Vol = { x: 0, y: 0, n: 8, sheets: 8, pitch: 2.3, step: 1.1, k: 'orange' };
  const fv: Vol = { x: 0, y: 0, n: 4, sheets: 16, pitch: 2.3, step: 0.9, k: 'blue' };
  xv.x = s.w * 0.08;
  xv.y = base - side(xv) * s.u;
  fv.x = s.w * 0.92 - extent(fv) * s.u;
  fv.y = base - side(fv) * s.u;
  return { xv, fv };
}

/** Stage by stage: smaller grids, more channels. */
function stages(s: Scene, a: number) {
  if (a <= 0.003) return;
  const base = s.h * 0.5;
  const vs: [number, number, string][] = [[8, 2, '(16, 32, 32)'], [4, 4, '(32, 16, 16)'], [2, 8, '(64, 8, 8)']];
  s.alpha(a, () => {
    vs.forEach(([n, sheets, t], i) => {
      const v: Vol = { x: 0, y: 0, n, sheets, pitch: 2.6 * (8 / n) ** 0.5, step: 1, k: 'slate' };
      v.x = s.w * (0.2 + 0.3 * i) - (extent(v) * s.u) / 2;
      v.y = base - side(v) * s.u;
      s.alpha(after(s, 'stages', 0.1 + 0.15 * i), () => {
        vol(s, v);
        shapeLabel(s, v, t, '--ink-2');
      });
    });
  });
}

const clash: SceneDef = {
  draw(s) {
    stages(s, 1 - s.ease('x', 0.5));
    const base = s.h * 0.4;
    const { xv, fv } = pair(s, base);
    const together = s.ease('clash', 0.9, 0.3);
    // In the clash, the two volumes slide toward a plus between them.
    const shift = together * s.w * 0.06;
    s.alpha(s.ease('x', 0.6, 0.3), () => {
      vol(s, { ...xv, x: xv.x + shift });
      shapeLabel(s, { ...xv, x: xv.x + shift }, 'x: (64, 8, 8)', 'orange');
    });
    s.alpha(after(s, 'second', 0.5), () => {
      vol(s, { ...fv, x: fv.x - shift });
      shapeLabel(s, { ...fv, x: fv.x - shift }, 'F(x): (128, 4, 4)', 'blue');
    });
    const mx = (xv.x + extent(xv) * s.u + shift + fv.x - shift) / 2;
    const my = base - side(xv) * s.u * 0.5;
    s.alpha(s.ease('first', 0.6) * (1 - together), () => {
      s.arrow(xv.x + extent(xv) * s.u + 3 * s.u, my, fv.x - 3 * s.u, my, s.c('--ink-3'), 0.35, 2);
      s.text('F', mx, my - 3.5 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue') });
    });
    s.alpha(together, () => {
      s.circle(mx, my, 4 * s.u, { fill: s.tint('red', 0.08), stroke: s.c('red'), lw: 0.4 });
      s.text('+', mx, my, { size: 5, font: 'mono', weight: 650, color: s.c('red') });
      s.alpha(after(s, 'clash', 0.5), () => s.text('✗', mx, my - 8 * s.u, { size: 5, font: 'mono', weight: 700, color: s.c('red'), halo: true }));
    });
    const y0 = s.h * 0.58;
    const k2 = '--ink-2';
    const fade = 1 - 0.5 * together;
    work(s, y0, 0, [['conv 1: ', k2], ['128', 'blue'], [' filters → ', k2], ['128', 'blue'], [' channels', k2]], s.ease('first', 0.6, 0.4) * fade);
    work(s, y0, 1, [['stride ', k2], ['2', 'blue'], [': every other position', k2]], after(s, 'first', 0.6) * fade);
    work(s, y0, 2, [['(8 − 3 + 2) / 2 + 1 = 4.5', k2], [' → ', '--ink-3'], ['4', 'blue']], after(s, 'round', 0.2) * fade);
    work(s, y0, 3, [['conv 2: stride 1, padding 1: keeps ', k2], ['4 × 4', 'blue']], after(s, 'second', 0.1) * fade);
    s.alpha(after(s, 'clash', 0.3), () => caption(s, 'twice as deep, half as wide: cannot add', s.h * 0.93, 'red', 3.3));
    s.alpha(s.win('stages', 'x'), () => caption(s, 'stage by stage: fewer positions, more channels', s.h * 0.93, '--ink-2', 3.2));
  },
};

// ---- the 1 x 1 conv on the shortcut: mixes channels at each position, strides like F

const fit: SceneDef = {
  draw(s) {
    const base = s.h * 0.42;
    const { xv, fv } = pair(s, base);
    const cv: Vol = { ...fv, k: 'orange' };
    const mix = s.win('mix', 'filters');
    const strideA = s.win('stride', 'sum');
    // x, with one position's column lit while the filter mixes it, then every other position.
    const outA = s.ease('filters', 0.6);
    const sumA = s.ease('sum', 0.6);
    s.alpha(1 - sumA, () => {
      vol(s, xv, { column: [2, 2, mix], dots: (i, j) => (i % 2 === 0 && j % 2 === 0 ? strideA * after(s, 'stride', 0.05 + 0.02 * (i * 8 + j) / 2) : 0) });
      shapeLabel(s, xv, 'x: (64, 8, 8)', 'orange');
    });
    s.alpha(outA * (1 - sumA), () => {
      vol(s, cv, { lit: (i, j) => (i === 1 && j === 1 ? mix : 0) });
      shapeLabel(s, cv, 'cut(x): (128, 4, 4)', 'orange', after(s, 'stride', 0.75));
    });
    // Before the output has its 128 channels, the one number the column mixes into.
    s.alpha(mix * (1 - outA), () => {
      const cx = cv.x + side(cv) * s.u * 0.5;
      const cy = cv.y + side(cv) * s.u * 0.5;
      cells(s, [cx], cy - 3 * s.u, ['1'], 'orange', { w: 8, h: 6, size: 3, on: [1] });
      s.text('one number', cx, cy + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('orange'), halo: true });
    });
    const my = base - side(xv) * s.u * 0.5;
    const ax0 = xv.x + extent(xv) * s.u + 3 * s.u;
    const ax1 = cv.x - 3 * s.u;
    s.alpha(s.ease('need', 0.6, 0.5) * (1 - sumA), () => {
      s.arrow(ax0, my, ax1, my, s.c('orange'), 0.4, 2);
      s.text('1 × 1', (ax0 + ax1) / 2, my - 3.5 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      s.text('conv', (ax0 + ax1) / 2, my + 3.5 * s.u, { size: 3, font: 'mono', color: s.c('orange'), halo: true });
    });
    // The sum: the shortcut's output and F(x), side by side, the same shape.
    s.alpha(sumA, () => {
      const left: Vol = { ...cv, x: s.w * 0.36 - extent(cv) * s.u };
      vol(s, left);
      vol(s, fv);
      shapeLabel(s, left, '(128, 4, 4)', 'orange');
      shapeLabel(s, fv, '(128, 4, 4)', 'blue');
      const mx = (left.x + extent(left) * s.u + fv.x) / 2;
      s.circle(mx, my, 4 * s.u, { fill: s.tint('green', 0.1), stroke: s.c('green'), lw: 0.4 });
      s.text('+', mx, my, { size: 5, font: 'mono', weight: 650, color: s.c('green') });
      s.alpha(after(s, 'sum', 0.6), () => s.text('✓', mx, my - 8 * s.u, { size: 5, font: 'mono', weight: 700, color: s.c('green'), halo: true }));
    });
    const y0 = s.h * 0.6;
    const k2 = '--ink-2';
    const fade = 1 - 0.5 * s.ease('proj', 0.6);
    work(s, y0, 0, [['at each position: ', k2], ['64', 'orange'], [' numbers → ', k2], ['1', 'orange']], s.ease('mix', 0.6, 1) * fade);
    work(s, y0, 1, [['128', 'orange'], [' filters → ', k2], ['128', 'orange'], [' channels, as in F', k2]], s.ease('filters', 0.6, 0.4) * fade);
    work(s, y0, 2, [['(8 − 1) / 2 + 1 = 4.5', k2], [' → ', '--ink-3'], ['4', 'orange']], after(s, 'stride', 0.6) * fade);
    s.alpha(s.win('stride', 'sum'), () => caption(s, 'stride 2: the positions F\'s first conv centers on', s.h * 0.93, 'orange', 3.1));
    s.alpha(s.win('proj', 'same'), () => caption(s, 'a projection shortcut: x into F\'s shape', s.h * 0.93, 'orange', 3.3));
    s.alpha(s.ease('same', 0.6), () => caption(s, 'shape kept: the shortcut is x, nothing to learn', s.h * 0.93, '--ink-2', 3.2));
    cite(s, 'He, Zhang, Ren & Sun, 2015', s.win('proj', 'same'));
  },
};

export const scenes: Record<string, SceneDef> = { block, clash, fit };
