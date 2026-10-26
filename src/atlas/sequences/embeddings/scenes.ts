import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { cells, rowLabel } from '../../draw';
import { band, brace, chip, fmt, grid, type Grid, matrix, rich, stack } from '../draw';

const VOCAB = ['h', 'e', 'l', 'o'];
const E = [
  [0.2, 1.0, -0.5],
  [-1.0, 0.4, 0.8],
  [0.5, -1.0, 2.0],
  [1.5, 0.3, -0.2],
];
const K = 2;
const f1 = (v: number) => fmt(v, 1);
const IDS = [
  [2, 0, 3],
  [1, 2, 2],
];

/** The table, with room on its left for the vocabulary or the one-hot vector. */
function table(s: Scene): Grid {
  return grid(s, s.w / 2 + 8 * s.u, s.h * 0.4, 4, 3, 13, 10);
}

function drawE(s: Scene, g: Grid, on: (i: number) => number, a = 1): void {
  s.alpha(a, () => {
    matrix(s, g, E.map((r) => r.map(f1)), 'blue', { w: 12, h: 8, size: 3.2, on: (i) => on(i) });
    brace(s, 'top', g.l + 1.5 * s.u, g.r - 1.5 * s.u, g.t - 1.5 * s.u, 'd = 3', 'blue', 3.2);
    brace(s, 'right', g.t + 1.5 * s.u, g.b - 1.5 * s.u, g.r + 1.5 * s.u, 'V = 4', 'blue', 3.2);
  });
}

/** Row `K` of E as a row of cells under the table, one under each column. */
function lookupRow(s: Scene, g: Grid, label: string, a: number): void {
  s.alpha(a, () => {
    const y = g.b + 10 * s.u;
    rowLabel(s, label, g.l - 4 * s.u, y, 'gold', 3.8);
    cells(s, [0, 1, 2].map((j) => g.x(j)), y, E[K]!.map(f1), 'gold', { w: 12, h: 8, size: 3.2, on: [1, 1, 1] });
  });
}

const tableScene: SceneDef = {
  draw(s) {
    const g = table(s);
    const tokX = g.l - 22 * s.u;
    const idX = g.l - 9 * s.u;
    const look = s.win('lookup', 'learned');
    const head = { size: 3, font: 'mono', color: s.c('--ink-3') } as const;
    s.text('token', tokX, g.t - 5 * s.u, head);
    s.alpha(s.ease('ids', 0.6, 1), () => s.text('id', idX, g.t - 5 * s.u, head));
    VOCAB.forEach((t, i) => {
      chip(s, tokX, g.y(i), t, 'orange', { on: i === K ? look : 0 });
      s.alpha(s.ease('ids', 0.5, 1.2 + 0.5 * i), () => {
        s.text('→', (tokX + idX) / 2 - 0.5 * s.u, g.y(i), { size: 3, color: s.c('--ink-3') });
        s.text(String(i), idX, g.y(i), { size: 3.6, font: 'mono', weight: 650, color: s.c(i === K && look > 0.5 ? 'gold' : '--ink-2') });
      });
    });
    drawE(s, g, (i) => (i === K ? look : 0), s.ease('table', 0.7));
    band(s, g, 'row', K, 'gold', look);
    lookupRow(s, g, 'E[2]', s.ease('lookup', 0.6, 1.2) * (1 - s.ease('count', 0.5)));
    const o = { size: 3.4, color: s.c('--ink-2') } as const;
    s.alpha(s.win('learned', 'count'), () => s.text('free numbers, not set by spelling', s.w / 2, s.h * 0.86, o));
    s.alpha(s.ease('count', 0.6), () => {
      rich(s, [['V × d', 'blue'], [' = 4 × 3 = 12', '--ink-2']], s.w / 2, g.b + 10 * s.u, { size: 3.6 });
      rich(s, [['50,000 × 768', 'blue'], [' = 38,400,000', '--ink-2']], s.w / 2, s.h * 0.86, { size: 3.6 });
    });
  },
};

/** The batch picture: ids above, each replaced by its row of E below. */
function batch(s: Scene, a: number): void {
  s.alpha(a, () => {
    const pitch = 23 * s.u;
    const xs = [-1, 0, 1].map((j) => s.w / 2 + j * pitch);
    const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
    s.text('ids: (m, n) = (2, 3)', s.w / 2, s.h * 0.08, lab);
    IDS.forEach((r, i) => r.forEach((id, j) => chip(s, xs[j]!, s.h * (0.17 + 0.1 * i), String(id), 'orange', { size: 3.4 })));
    s.arrow(s.w / 2, s.h * 0.33, s.w / 2, s.h * 0.42, s.c('--ink-3'), 0.4, 2.2);
    s.text('E[ids]', s.w / 2 + 3 * s.u, s.h * 0.375, { size: 3.2, font: 'mono', align: 'left', color: s.c('blue') });
    const grow = s.ease('batch', 0.8, 1);
    IDS.forEach((r, i) =>
      r.forEach((id, j) => {
        const y = s.h * (0.52 + 0.12 * i);
        E[id]!.forEach((v, k) => {
          const x = xs[j]! + (k - 1) * 6 * s.u;
          s.alpha(grow, () => s.cell(x - 2.7 * s.u, y - 3 * s.u, 5.4 * s.u, 6 * s.u, '', 'gold', { on: Math.min(1, Math.abs(v) / 2) }));
        });
      }),
    );
    s.alpha(grow, () => {
      s.text('E[ids]: (m, n, d) = (2, 3, 3)', s.w / 2, s.h * 0.75, lab);
      s.text('every id becomes its row of d numbers', s.w / 2, s.h * 0.88, { size: 3.2, color: s.c('--ink-3') });
    });
  });
}

const V = [1, 2, 0, 0];
/** Fades in as beat `id`'s narration passes fraction `f` of the way. */
const at = (s: Scene, id: string, f: number) => smooth((s.prog(id) - f) / 0.06);
/** The rows `V` weighs, scaled, and their sum: what `mix` and `entries` add up column by column. */
const SCALED = V.map((v, i) => E[i]!.map((x) => v * x)).filter((_, i) => V[i] !== 0);
const MIX = E[0]!.map((_, j) => SCALED.reduce((t, r) => t + r[j]!, 0));

/** `v @ E` worked under the table: each weighted row, then their sum, entry by entry. */
function mixRows(s: Scene, g: Grid, a: number): void {
  s.alpha(a, () => {
    const xs = [0, 1, 2].map((j) => g.x(j));
    const lx = g.l - 4 * s.u;
    const ys = [g.b + 8 * s.u, g.b + 17 * s.u, g.b + 28 * s.u];
    const o = { w: 12, h: 7, size: 3.2 };
    s.alpha(at(s, 'mix', 0.7), () => {
      rowLabel(s, '1 × E[0]', lx, ys[0]!, '--ink-2', 3.2);
      cells(s, xs, ys[0]!, SCALED[0]!.map(f1), 'blue', o);
    });
    s.alpha(at(s, 'mix', 0.82), () => {
      rowLabel(s, '2 × E[1]', lx, ys[1]!, '--ink-2', 3.2);
      cells(s, xs, ys[1]!, SCALED[1]!.map(f1), 'blue', o);
    });
    const on = xs.map((_, j) => at(s, 'entries', 0.2 + 0.28 * j));
    s.alpha(s.ease('entries', 0.5), () => {
      s.line(g.l, (ys[1]! + ys[2]!) / 2, g.r, (ys[1]! + ys[2]!) / 2, s.c('--ink-3'), 0.3);
      rowLabel(s, 'v @ E', lx, ys[2]!, 'gold', 3.4);
    });
    xs.forEach((x, j) => s.alpha(on[j]!, () => cells(s, [x], ys[2]!, [f1(MIX[j]!)], 'gold', { ...o, on: [1] })));
  });
}

const onehotScene: SceneDef = {
  draw(s) {
    const g = table(s);
    const b = s.ease('batch', 0.6);
    const picks = s.ease('picks', 0.8);
    const oh = s.ease('onehot', 0.6);
    const mix = at(s, 'mix', 0.45) * (1 - oh);
    s.alpha(1 - b, () => {
      const ohX = g.l - 16 * s.u;
      const cy = (g.t + g.b) / 2;
      const st = { w: 8, h: 8, gap: 10, size: 3.4 };
      s.alpha(at(s, 'mix', 0.15) * (1 - oh), () => {
        stack(s, ohX, cy, V.map(String), 'orange', { ...st, on: V.map((v) => (v ? 1 : 0)) });
        s.text('v', ohX, g.t - 5 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange') });
      });
      const ohv = VOCAB.map((_, i) => (i === K ? '1' : '0'));
      s.alpha(s.ease('onehot', 0.6, 0.6), () => {
        stack(s, ohX, cy, ohv, 'orange', { ...st, on: ohv.map((v) => (v === '1' ? 1 : 0)) });
        s.text('one-hot', ohX, g.t - 5 * s.u, { size: 3, font: 'mono', color: s.c('orange') });
      });
      s.alpha(at(s, 'mix', 0.15), () => s.text('@', (ohX + g.l) / 2 + 0.5 * s.u, cy, { size: 4, font: 'mono', color: s.c('--ink-3') }));
      const tag = (i: number, v: number) => s.text(`× ${v}`, g.r + 3 * s.u, g.y(i), { size: 3, font: 'mono', align: 'left', color: s.c(v ? 'gold' : '--ink-3') });
      s.alpha(mix, () => V.forEach((v, i) => tag(i, v)));
      s.alpha(s.ease('product', 0.6, 0.8), () => VOCAB.forEach((_, i) => tag(i, i === K ? 1 : 0)));
      for (let i = 0; i < 4; i++) {
        const dim = i === K ? 0.75 * mix : 0.75 * Math.max(picks, V[i] ? 0 : mix);
        s.alpha(1 - dim, () => matrix(s, { ...g, m: 1, y: () => g.y(i) } as Grid, [E[i]!.map(f1)], 'blue', { w: 12, h: 8, size: 3.2, on: () => (i === K ? picks : V[i] ? 0.5 * mix : 0) }));
      }
      s.alpha(1 - s.ease('product', 0.4), () => brace(s, 'top', g.l + 1.5 * s.u, g.r - 1.5 * s.u, g.t - 1.5 * s.u, 'E', 'blue', 3.4));
      band(s, g, 'row', K, 'gold', picks);
      mixRows(s, g, 1 - oh);
      lookupRow(s, g, 'onehot @ E', s.ease('picks', 0.6, 1));
      s.alpha(s.ease('layer', 0.6), () => {
        rich(s, [['onehot @ E', 'orange'], [' = ', '--ink-3'], ['E[2]', 'gold']], s.w / 2, s.h * 0.84, { size: 3.6, weight: 600 });
        s.text('a product that picks out one row', s.w / 2, s.h * 0.92, { size: 3.2, color: s.c('--ink-3') });
      });
    });
    batch(s, b);
  },
};

export const scenes: Record<string, SceneDef> = { table: tableScene, onehot: onehotScene };
