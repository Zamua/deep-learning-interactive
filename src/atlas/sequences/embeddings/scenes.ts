import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, rowLabel } from '../../draw';
import { band, brace, grid, type Grid, matrix, rich } from '../../linear-algebra/draw';
import { Frame } from '../../networks/draw';
import { chip, fmt, stack } from '../draw';

const VOCAB = ['cat', 'car', 'dog', 'bus'];
/** Each token's point: cat and dog close together, car and bus off in another direction. */
const E = [
  [3, 1],
  [-1, 3],
  [3, 2],
  [-2, 3],
];
const DOG = 2;
const INK: Ink[] = ['gold', 'teal', 'gold', 'teal'];
const str = (v: number) => fmt(v);

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4, italic = false) {
  s.text(text, s.w / 2, y, { size, font: italic ? 'serif' : 'mono', italic, color: s.c(k), halo: true });
}

// ---- tokens, ids, and then a point for every token

const XR: [number, number] = [-3, 4.2];
const YR: [number, number] = [-0.8, 3.9];

/** The plane, one scale on both axes so a right angle looks like one. */
function plane(s: Scene): Frame {
  const W = Math.min(s.w - 24 * s.u, 100 * s.u);
  const H = s.h * 0.7;
  const k = Math.min(W / (XR[1] - XR[0]), H / (YR[1] - YR[0]));
  const w = k * (XR[1] - XR[0]);
  const h = k * (YR[1] - YR[0]);
  const l = s.w / 2 - w / 2;
  const t = s.h * 0.08 + (H - h) / 2;
  return new Frame(s, l, t, l + w, t + h, XR, YR);
}

/** Where each token's label sits, as an offset from its point in stage units. */
const LAB: [number, number, CanvasTextAlign][] = [
  [3, 0, 'left'],
  [2.5, -2, 'left'],
  [3, 0, 'left'],
  [-2.5, -2, 'right'],
];

const points: SceneDef = {
  draw(s) {
    const u = s.u;
    // The vocabulary as chips in id order; their ids make a number line.
    const pitch = Math.min(20, (s.w / u - 20) / 4);
    const xs = VOCAB.map((_, i) => s.w / 2 + (i - 1.5) * pitch * u);
    const yTok = s.h * 0.3;
    const yId = s.h * 0.48;
    const toPlane = s.ease('points', 0.8);
    s.alpha(1 - toPlane, () => {
      VOCAB.forEach((w, i) => s.alpha(s.ease('tokens', 0.5, 0.1 + 0.3 * i), () => chip(s, xs[i]!, yTok, w, 'orange', { w: 14, h: 8, size: 3.6 })));
      s.alpha(s.ease('vocab', 0.6), () => {
        const x0 = xs[0]! - 9.5 * u;
        const x1 = xs[3]! + 9.5 * u;
        s.rrect(x0, yTok - 7 * u, x1 - x0, 14 * u, 2, { stroke: s.tint('orange', 0.6), lw: 0.3 });
        s.text('vocabulary', s.w / 2, yTok - 10.5 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
      });
      VOCAB.forEach((_, i) => s.alpha(s.ease('vocab', 0.5, 2.5 + 0.4 * i), () => {
        s.arrow(xs[i]!, yTok + 5 * u, xs[i]!, yId - 4 * u, s.c('--ink-3'), 0.3, 1.6);
        s.text(`id ${i}`, xs[i]!, yId, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
      }));
      // The number line through the ids, with car halfway from cat to dog.
      const ln = s.ease('line', 0.6);
      s.alpha(ln, () => {
        const yL = s.h * 0.6;
        s.line(xs[0]! - 6 * u, yL, xs[3]! + 6 * u, yL, s.c('--axis'), 0.35);
        xs.forEach((x, i) => {
          s.line(x, yL - 1.2 * u, x, yL + 1.2 * u, s.c('--axis'), 0.35);
          s.text(String(i), x, yL + 4 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        });
        s.alpha(after(s, 'line', 0.3), () => {
          const yB = yL + 10 * u;
          s.line(xs[0]!, yB - 1.2 * u, xs[0]!, yB, s.c('red'), 0.35);
          s.line(xs[0]!, yB, xs[2]!, yB, s.c('red'), 0.35);
          s.line(xs[2]!, yB - 1.2 * u, xs[2]!, yB, s.c('red'), 0.35);
          s.text('car: halfway from cat to dog?', s.w / 2, yB + 4.5 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
        });
      });
    });
    // The plane: a point for every token.
    s.alpha(toPlane, () => {
      const F = plane(s);
      F.axes();
      E.forEach(([a, b], i) => {
        const on = i === 0 ? Math.max(s.win('dot', 'name'), 0) : i === 2 ? s.win('dot', 'dot2') : i === 1 ? s.win('dot2', 'name') : 0;
        const dim = (s.win('dot', 'name') > 0.5 && !on ? 0.6 : 0) * s.win('dot', 'name');
        s.alpha(s.ease('points', 0.6, 0.6 + 0.4 * i) * (1 - dim), () => {
          s.arrow(F.X(0), F.Y(0), F.X(a!), F.Y(b!), s.c(INK[i]!), 0.45 + 0.25 * on, 2);
          const [dx, dy, al] = LAB[i]!;
          s.text(VOCAB[i]!, F.X(a!) + dx * u, F.Y(b!) + dy * u, { size: 3.6, font: 'mono', weight: 650, align: al, color: s.c(INK[i]!), halo: true });
          s.alpha(after(s, 'points', 0.5), () => s.text(`[${a}, ${b}]`.replace('-', '−'), F.X(a!) + dx * u, F.Y(b!) + dy * u + 4 * u, { size: 2.9, font: 'mono', align: al, color: s.c('--ink-3'), halo: true }));
        });
      });
      // The right angle between cat and car.
      s.alpha(s.win('dot2', 'name') * after(s, 'dot2', 0.4), () => {
        const k = 0.45;
        const c = [E[0]![0]! / Math.hypot(3, 1), E[0]![1]! / Math.hypot(3, 1)];
        const r = [E[1]![0]! / Math.hypot(1, 3), E[1]![1]! / Math.hypot(1, 3)];
        const p1 = [c[0]! * k, c[1]! * k];
        const p2 = [p1[0]! + r[0]! * k, p1[1]! + r[1]! * k];
        const p3 = [r[0]! * k, r[1]! * k];
        s.line(F.X(p1[0]!), F.Y(p1[1]!), F.X(p2[0]!), F.Y(p2[1]!), s.c('--ink-2'), 0.3);
        s.line(F.X(p2[0]!), F.Y(p2[1]!), F.X(p3[0]!), F.Y(p3[1]!), s.c('--ink-2'), 0.3);
      });
    });
    const cy = s.h * 0.88;
    const cy2 = s.h * 0.94;
    s.alpha(s.win('tokens', 'vocab') * after(s, 'tokens', 0.5), () => caption(s, 'tokens: the pieces a model reads', cy));
    s.alpha(s.win('points', 'dot'), () => caption(s, 'a vector per token: a point', cy));
    s.alpha(s.win('dot', 'dot2'), () => rich(s, [['cat · dog', 'gold'], [' = 3·3 + 1·2 = 11', '--ink-2']], s.w / 2, cy, { size: 3.5, halo: true }));
    s.alpha(s.win('dot2', 'name'), () => rich(s, [['cat', 'gold'], [' · ', '--ink-2'], ['car', 'teal'], [' = −3 + 3 = 0', '--ink-2']], s.w / 2, cy, { size: 3.5, halo: true }));
    s.alpha(s.win('name', 'firth'), () => caption(s, 'embedding: a token set in place as a point', cy, 'blue', 3.3));
    s.alpha(s.ease('firth', 0.6), () => {
      caption(s, '“You shall know a word', cy, '--ink', 3.8, true);
      caption(s, 'by the company it keeps”', cy2, '--ink', 3.8, true);
    });
    cite(s, 'J. R. Firth, 1957', s.ease('firth', 0.6));
  },
};

// ---- the table: one row per token

/** The table, with room on its left for the vocabulary or a vector. */
function table(s: Scene, cy = 0.36): Grid {
  return grid(s, s.w / 2 + 10 * s.u, s.h * cy, 4, 2, 14, 10);
}

/** Row `k` of E as cells under the table, one under each column. */
function lookupRow(s: Scene, g: Grid, label: string, k: number, a: number): void {
  s.alpha(a, () => {
    const y = g.b + 10 * s.u;
    rowLabel(s, label, g.l - 4 * s.u, y, 'gold', 3.6);
    cells(s, [0, 1].map((j) => g.x(j)), y, E[k]!.map(str), 'gold', { w: 12, h: 8, size: 3.4, on: [1, 1] });
  });
}

const tableScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const g = table(s);
    const tokX = g.l - 25 * u;
    const idX = g.l - 9 * u;
    const look = s.win('lookup', 'count');
    const head = { size: 3, font: 'mono', color: s.c('--ink-3') } as const;
    s.text('token', tokX, g.t - 5 * u, head);
    s.text('id', idX, g.t - 5 * u, head);
    VOCAB.forEach((t, i) => {
      chip(s, tokX, g.y(i), t, 'orange', { w: 13, h: 7.5, on: i === DOG ? look : 0 });
      s.text('→', (tokX + idX) / 2 + 0.5 * u, g.y(i), { size: 3, color: s.c('--ink-3') });
      s.text(String(i), idX, g.y(i), { size: 3.6, font: 'mono', weight: 650, color: s.c(i === DOG && look > 0.5 ? 'gold' : '--ink-2') });
    });
    E.forEach((r, i) => {
      s.alpha(s.ease('stack', 0.5, 1 + 0.5 * i), () => {
        const gi: Grid = { ...g, m: 1, y: () => g.y(i) };
        matrix(s, gi, [r.map(str)], 'blue', { w: 12, h: 8, size: 3.4, on: () => (i === DOG ? look : i === 0 ? s.win('stack', 'V') * after(s, 'stack', 0.6) : 0) });
      });
    });
    s.alpha(s.ease('stack', 0.6, 3), () => s.text('E', g.r + 4 * u, g.t - 4 * u, { size: 4.6, font: 'mono', weight: 700, align: 'left', color: s.c('blue') }));
    s.alpha(s.ease('V', 0.6), () => brace(s, 'right', g.t + 1.5 * u, g.b - 1.5 * u, g.r + 1.5 * u, 'V = 4', 'blue', 3.4));
    s.alpha(s.ease('d', 0.6), () => brace(s, 'top', g.l + 1.5 * u, g.r - 1.5 * u, g.t - 1.5 * u, 'd = 2', 'blue', 3.4));
    band(s, g, 'row', DOG, 'gold', look);
    lookupRow(s, g, 'E[2]', DOG, s.ease('lookup', 0.6, 1.2) * (1 - s.ease('count', 0.5)));
    s.alpha(look * after(s, 'lookup', 0.6), () => caption(s, 'row 2: the third row, counting from 0', s.h * 0.9, '--ink-2', 3.2));
    const y = g.b + 11 * u;
    const o = { size: 3.6, halo: true } as const;
    s.alpha(s.win('count', 'bengio'), () => rich(s, [['V × d', 'blue'], [' = 4 × 2 = 8 numbers', '--ink-2']], s.w / 2, y, o));
    cite(s, 'Bengio, Ducharme, Vincent & Jauvin, 2003', s.ease('bengio', 0.6));
    s.alpha(s.win('bengio', 'big'), () => caption(s, 'one learned row per word', y, '--ink-2', 3.4));
    s.alpha(s.ease('big', 0.6), () => rich(s, [['V × d', 'blue'], [' = 17,000 × 100 = 1,700,000', '--ink-2']], s.w / 2, y, { ...o, size: 3.3 }));
  },
};

// ---- a vector on the left of E weighs its rows; a one-hot vector picks one

const X = [1, 2, 0, 0];
const ONE = VOCAB.map((_, i) => (i === DOG ? 1 : 0));
/** The rows `X` weighs, scaled, and their sum: x @ E. */
const SCALED = X.map((v, i) => E[i]!.map((x) => v * x)).filter((_, i) => X[i] !== 0);
const MIX = [0, 1].map((j) => SCALED.reduce((t, r) => t + r[j]!, 0));

const onehotScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const g = table(s, 0.33);
    const oh = s.ease('onehot', 0.6);
    const picks = s.ease('picks', 0.8);
    const vA = s.ease('x', 0.6, 0.8);
    const vx = g.l - 16 * u;
    const cy = (g.t + g.b) / 2;
    const st = { w: 8, h: 8, gap: 10, size: 3.4 };
    // v, then the one-hot in its place.
    s.alpha(vA * (1 - oh), () => {
      stack(s, vx, cy, X.map(String), 'orange', { ...st, on: X.map((v) => (v ? s.win('col', 'onehot') : 0)) });
      s.text('x', vx, g.t - 4.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange') });
    });
    s.alpha(s.ease('onehot', 0.6, 0.6), () => {
      stack(s, vx, cy, ONE.map(String), 'orange', { ...st, on: ONE });
      s.text('one-hot', vx, g.t - 4.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('orange') });
    });
    s.alpha(vA, () => s.text('@', (vx + g.l) / 2 + 0.5 * u, cy, { size: 4, font: 'mono', color: s.c('--ink-3') }));
    // E, with the rows the vector weighs by zero dimmed.
    const mixOn = s.win('rows', 'onehot');
    for (let i = 0; i < 4; i++) {
      const dim = 0.7 * Math.max(i === DOG ? 0 : picks, X[i] ? 0 : mixOn);
      s.alpha(1 - dim, () => matrix(s, { ...g, m: 1, y: () => g.y(i) }, [E[i]!.map(str)], 'blue', { w: 12, h: 8, size: 3.4, on: () => (i === DOG ? picks : X[i] ? 0.6 * mixOn : 0) }));
    }
    s.text('E', g.r + 4 * u, g.t - 4 * u, { size: 4.6, font: 'mono', weight: 700, align: 'left', color: s.c('blue') });
    band(s, g, 'col', 0, 'orange', s.win('col', 'rows') * (1 - after(s, 'col', 0.75)));
    band(s, g, 'row', DOG, 'gold', picks);
    const tag = (i: number, v: number) => s.text(`× ${v}`, g.r + 3 * u, g.y(i), { size: 3.1, font: 'mono', align: 'left', color: s.c(v ? 'gold' : '--ink-3') });
    s.alpha(mixOn, () => X.forEach((v, i) => tag(i, v)));
    s.alpha(s.ease('picks', 0.6) * (1 - s.ease('same', 0.6)), () => ONE.forEach((v, i) => tag(i, v)));
    // Under the table: x @ E, column by column, then as a sum of weighted rows.
    const xs = [0, 1].map((j) => g.x(j));
    const lx = g.l - 4 * u;
    const ys = [g.b + 7 * u, g.b + 16 * u, g.b + 27 * u];
    const o = { w: 12, h: 7.5, size: 3.4 };
    s.alpha(1 - oh, () => {
      s.alpha(mixOn * after(s, 'rows', 0.25), () => {
        rowLabel(s, '1 × E[0]', lx, ys[0]!, '--ink-2', 3.2);
        cells(s, xs, ys[0]!, SCALED[0]!.map(str), 'blue', o);
      });
      s.alpha(mixOn * after(s, 'rows', 0.45), () => {
        rowLabel(s, '2 × E[1]', lx, ys[1]!, '--ink-2', 3.2);
        cells(s, xs, ys[1]!, SCALED[1]!.map(str), 'blue', o);
        s.line(g.l, (ys[1]! + ys[2]!) / 2, g.r, (ys[1]! + ys[2]!) / 2, s.c('--ink-3'), 0.3);
      });
      s.alpha(after(s, 'col', 0.3), () => rowLabel(s, 'x @ E', lx, ys[2]!, 'gold', 3.4));
      xs.forEach((x, j) => s.alpha(after(s, 'col', j ? 0.8 : 0.55), () => cells(s, [x], ys[2]!, [str(MIX[j]!)], 'gold', { ...o, on: [1] })));
    });
    s.alpha(s.win('col', 'rows'), () => caption(s, 'column 0: 1·3 + 2·(−1) = 1', s.h * 0.94, 'orange', 3.3));
    s.alpha(s.win('rows', 'onehot') * after(s, 'rows', 0.5), () => caption(s, 'each row times its entry of x, added up', s.h * 0.94, '--ink-2', 3.2));
    lookupRow(s, g, 'one-hot @ E', DOG, s.ease('picks', 0.6, 1.2));
    s.alpha(s.ease('same', 0.6), () => {
      rich(s, [['one-hot @ E', 'orange'], [' = ', '--ink-3'], ['E[2]', 'gold']], s.w / 2, s.h * 0.85, { size: 3.6, weight: 600, halo: true });
      caption(s, 'a product that picks out one row', s.h * 0.92, '--ink-3', 3.2);
    });
  },
};

// ---- whole sequences: every id becomes its row

const SEQ = [2, 0, 3, 1];
const IDS = [SEQ, [1, 3, 0, 0], [0, 2, 2, 3]];

/** Two shaded cells: one token's row of E, small. */
function rowCells(s: Scene, x: number, y: number, r: number[], labels: boolean, a: number) {
  s.alpha(a, () => {
    const w = (labels ? 7.5 : 6) * s.u;
    const h = (labels ? 7 : 5.5) * s.u;
    r.forEach((v, k) => s.cell(x + (k - 1) * w + 0.3 * s.u, y - h / 2, w - 0.6 * s.u, h, labels ? str(v) : '', 'gold', { on: Math.min(1, Math.abs(v) / 3), size: 3 }));
  });
}

const batchScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const pitch = Math.min(22, (s.w / u - 16) / 4);
    const xs = SEQ.map((_, j) => s.w / 2 + (j - 1.5) * pitch * u);
    const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
    const b = s.ease('batch', 0.7);
    // One sequence: its tokens, their ids, and the rows they become.
    s.alpha(1 - b, () => {
      SEQ.forEach((id, j) => {
        chip(s, xs[j]!, s.h * 0.14, VOCAB[id]!, 'orange', { w: 13, h: 7.5 });
        s.alpha(s.ease('seq', 0.5, 2 + 0.4 * j), () => chip(s, xs[j]!, s.h * 0.27, String(id), 'orange', { w: 9, h: 7.5, size: 3.6 }));
        s.alpha(s.ease('rows', 0.5, 0.6 + 0.4 * j), () => {
          s.arrow(xs[j]!, s.h * 0.27 + 5 * u, xs[j]!, s.h * 0.42 - 5 * u, s.c('--ink-3'), 0.3, 1.6);
          rowCells(s, xs[j]!, s.h * 0.42, E[id]!, true, 1);
        });
      });
      s.alpha(s.ease('seq', 0.6, 3), () => s.text('ids: (4,)', s.w / 2, s.h * 0.55, lab));
      s.alpha(after(s, 'rows', 0.6), () => s.text('E[ids]: (4, 2)', s.w / 2, s.h * 0.62, { ...lab, color: s.c('gold') }));
    });
    // Three sequences: the ids keep their shape and gain an axis of d.
    s.alpha(b, () => {
      const y0 = s.h * 0.17;
      s.text('ids: (3, 4)', s.w / 2, s.h * 0.08, lab);
      IDS.forEach((r, i) => r.forEach((id, j) => chip(s, xs[j]!, y0 + i * 8.5 * u, String(id), 'orange', { w: 8, h: 6.5, size: 3.2 })));
      const grow = after(s, 'batch', 0.35, 0.8);
      const y1 = s.h * 0.53;
      s.alpha(grow, () => {
        s.arrow(s.w / 2, y0 + 22 * u, s.w / 2, y1 - 7 * u, s.c('--ink-3'), 0.4, 2);
        IDS.forEach((r, i) => r.forEach((id, j) => rowCells(s, xs[j]!, y1 + i * 8 * u, E[id]!, false, 1)));
        s.text('E[ids]: (3, 4, 2)', s.w / 2, y1 + 24 * u, { ...lab, color: s.c('gold'), weight: 650 });
      });
      s.alpha(after(s, 'batch', 0.7), () => caption(s, 'every id becomes its row of d = 2', s.h * 0.92, '--ink-3', 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { points, table: tableScene, onehot: onehotScene, batch: batchScene };
