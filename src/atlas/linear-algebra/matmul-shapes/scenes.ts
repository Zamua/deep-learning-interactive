import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { type Ink, rich } from '../draw';

const INNER = 'green';
const OUTER = 'gold';
const FAIL = 'red';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** One entry of a matrix: a tinted square whose top left is (x, y); `on` lights it, below 0 dims it. */
function cell(s: Scene, x: number, y: number, p: number, k: Ink, on = 0) {
  const q = 0.4 * s.u;
  s.rrect(x + q, y + q, p - 2 * q, p - 2 * q, 0.8, { fill: s.tint(k, 0.12 + 0.3 * on), stroke: s.tint(k, 0.45 + 0.5 * on), lw: 0.25 });
}

/** A size printed on a matrix's edge: grey until lit, then in its color. */
function size(s: Scene, t: string, x: number, y: number, k: Ink, lit: number, align: CanvasTextAlign = 'center') {
  s.text(t, x, y, { size: 3.4 + 0.5 * lit, font: 'mono', weight: 600 + 100 * lit, align, color: lit > 0.5 ? s.c(k) : s.c('--ink-3'), halo: true });
}

/** A size that turns, on its beat, from the number into the letter that stands for any size. */
function sizeSwap(s: Scene, num: string, letter: string, beat: string, x: number, y: number, k: Ink, lit: number, align: CanvasTextAlign = 'center') {
  // One after the other, never overlapping.
  s.alpha(1 - s.ease(beat, 0.3), () => size(s, num, x, y, k, lit, align));
  s.alpha(s.ease(beat, 0.4, 0.3), () => size(s, letter, x, y, k, 1, align));
}

/** An outline around a run of cells, for "this row" or "this column". */
function outline(s: Scene, x: number, y: number, w: number, h: number, k: Ink, a: number) {
  s.alpha(a, () => s.rrect(x - 0.3 * s.u, y - 0.3 * s.u, w + 0.6 * s.u, h + 0.6 * s.u, 1.4, { stroke: s.c(k), lw: 0.5 }));
}

/** `(m, n) @ (n, k)`, with the inner pair in `inner` and, when given, `→ out`. */
function shapes(m: number | string, n: number | string, n2: number | string, k: number | string, inner: Ink, out?: string): [string, Ink][] {
  const runs: [string, Ink][] = [['(', '--ink-2'], [String(m), '--ink-2'], [', ', '--ink-2'], [String(n), inner], [') @ (', '--ink-2'], [String(n2), inner], [', ', '--ink-2'], [String(k), '--ink-2'], [')', '--ink-2']];
  if (out) runs.push([' → ', '--ink-3'], [out, OUTER]);
  return runs;
}

// ---- four vectors through one matrix, then the same four as the columns of B

const [M1, N1, K1] = [2, 3, 4];

const columns: SceneDef = {
  draw(s) {
    const u = s.u;
    const p = 9.5 * u;
    const gap = 4 * u;
    const spread = 5 * u * (1 - s.ease('stand', 1.2));
    const top = s.h * 0.1;
    const width = N1 * p + gap + K1 * p + (K1 - 1) * spread;
    const left = s.w / 2 - width / 2;
    const A = { x: left, y: top + N1 * p + gap };
    const bx = (j: number) => left + N1 * p + gap + j * (p + spread);
    const by = top;

    // Which column is going through A: a sweep during `one`, and again during `AB`.
    const sweep = (beat: string, lead: number) => (s.since(beat) < 0 ? 0 : clamp01((s.t - s.at(beat) - lead) / Math.max(1, s.end(beat) - s.at(beat) - lead - 0.3)) * K1);
    const one = sweep('one', 0.6);
    const again = s.since('AB') >= 0 ? sweep('AB', 1.6) : -1;
    const run = again >= 0 ? again : one;
    const live = (s.since('one') >= 0 && run < K1 && (s.since('stand') < 0 || again >= 0)) ? Math.floor(run) : -1;

    for (let i = 0; i < M1; i++) for (let j = 0; j < N1; j++) cell(s, A.x + j * p, A.y + i * p, p, 'blue', live >= 0 ? 0.6 : 0);
    for (let j = 0; j < K1; j++) {
      for (let i = 0; i < N1; i++) cell(s, bx(j), by + i * p, p, 'orange', j === live ? 1 : 0);
      // The result's column j, once A has turned vector j into it.
      s.alpha(smooth((one - j - 0.5) * 3), () => {
        for (let i = 0; i < M1; i++) cell(s, bx(j), A.y + i * p, p, 'gold', j === live ? 1 : 0.4);
      });
    }

    // A row of A and a column of B: the two runs a dot product pairs up.
    const fit = s.win('fit', 'inner');
    outline(s, A.x, A.y, N1 * p, p, INNER, fit);
    outline(s, bx(0), by, p, N1 * p, INNER, fit);

    // Sizes on the edges: m and n on A, n and k on B.
    const inner = s.ease('fit', 0.6);
    const outer = s.ease('outer', 0.6);
    sizeSwap(s, String(M1), 'm', 'm', A.x - 2.5 * u, A.y + (M1 * p) / 2, OUTER, outer, 'right');
    sizeSwap(s, String(N1), 'n', 'n', A.x + (N1 * p) / 2, A.y - 3 * u, INNER, inner);
    s.alpha(s.ease('stand', 0.6, 0.8), () => {
      sizeSwap(s, String(N1), 'n', 'n', bx(0) - 2.5 * u, by + (N1 * p) / 2, INNER, inner, 'right');
      sizeSwap(s, String(K1), 'k', 'k', (bx(0) + bx(K1 - 1) + p) / 2, by - 3 * u, OUTER, outer);
      s.text('B', bx(K1 - 1) + p + 3 * u, by + (N1 * p) / 2, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
    });
    const nameY = A.y + M1 * p + 4 * u;
    s.text('A', A.x + (N1 * p) / 2, nameY, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
    s.alpha(s.ease('AB', 0.6), () => s.text('AB', (bx(0) + bx(K1 - 1) + p) / 2, nameY, { size: 3.8, font: 'mono', weight: 650, color: s.c(OUTER) }));

    // The working under the picture.
    const y1 = nameY + 9 * u;
    const y2 = y1 + 9 * u;
    const eq = { size: 4, weight: 600 } as const;
    const rule = s.ease('rule', 0.6);
    s.alpha(s.ease('inner', 0.6) * (1 - rule), () => rich(s, shapes(M1, N1, N1, K1, INNER, outer > 0.01 ? '(2, 4)' : undefined), s.w / 2, y1, eq));
    s.alpha(rule, () => rich(s, shapes('m', 'n', 'n', 'k', INNER, '(m, k)'), s.w / 2, y1, eq));
    const cap = { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('many', 'one'), () => s.text('one matrix, four vectors', s.w / 2, y2, cap));
    s.alpha(s.win('one', 'stand'), () => s.text('each: 3 numbers in, 2 out', s.w / 2, y2, cap));
    s.alpha(s.win('stand', 'AB'), () => s.text('four vectors side by side: B', s.w / 2, y2, { ...cap, color: s.c('orange') }));
    s.alpha(s.win('AB', 'shape'), () => s.text('A times each column of B', s.w / 2, y2, cap));
    s.alpha(s.win('shape', 'fit'), () => s.text('AB: 2 rows, 4 columns', s.w / 2, y2, { ...cap, color: s.c(OUTER) }));
    s.alpha(s.win('fit', 'm'), () => s.text("A's columns = B's rows", s.w / 2, y2, { ...cap, color: s.c(INNER) }));
    s.alpha(s.ease('rule', 0.6), () => s.text('inner sizes match, then vanish', s.w / 2, y2, cap));
  },
};

// ---- a matrix as a machine: B turns 4 numbers into 3, then A turns 3 into 2

type Item = { vec: number; k: Ink; on?: number } | { box: string; shape: string; k: Ink };

/**
 * Vectors and matrices in a row, with arrows pointing left: the vector goes in on the right,
 * as in A @ (B @ v), and each matrix hands its output to the one on its left.
 */
/** Pipeline sizes: a vector's cell, a matrix box, and the arrow between them. */
const pipe = (s: Scene) => ({ c: 7 * s.u, bw: 20 * s.u, bh: 16 * s.u, ar: 7.5 * s.u });

function pipeline(s: Scene, items: Item[], cy: number) {
  const u = s.u;
  const { c, bw, bh, ar } = pipe(s);
  const wOf = (it: Item) => ('vec' in it ? c : bw);
  const total = items.reduce((t, it) => t + wOf(it), 0) + ar * (items.length - 1);
  let x = s.w / 2 - total / 2;
  items.forEach((it, i) => {
    const w = wOf(it);
    if ('vec' in it) {
      for (let r = 0; r < it.vec; r++) cell(s, x, cy - (it.vec * c) / 2 + r * c, c, it.k, it.on ?? 0);
      s.text(String(it.vec), x + c / 2, cy + (it.vec * c) / 2 + 3.4 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    } else {
      s.rrect(x, cy - bh / 2, bw, bh, 1.4, { fill: s.tint(it.k, 0.14), stroke: s.tint(it.k, 0.75), lw: 0.35 });
      s.text(it.box, x + bw / 2, cy - 2.6 * u, { size: 4.6, font: 'mono', weight: 650, color: s.c(it.k) });
      s.text(it.shape, x + bw / 2, cy + 3.8 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
    }
    if (i < items.length - 1) s.arrow(x + w + ar - 1 * u, cy, x + w + 1 * u, cy, s.c('--ink-3'), 0.35, 2);
    x += w + ar;
  });
}

const chain: SceneDef = {
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.32;
    const once = s.ease('once', 0.8);
    const C = s.ease('C', 0.8);
    const ABC = s.ease('ABC', 0.8, 1.2);
    // Before the merge: v, B, its three, A, and two out. A and B fade in on their beats.
    s.alpha(1 - once, () => {
      const hand = s.win('handoff', 'cayley');
      const items: Item[] = [{ vec: 2, k: OUTER }, { box: 'A', shape: '(2, 3)', k: 'blue' }, { vec: 3, k: hand > 0.5 ? INNER : 'orange', on: hand }, { box: 'B', shape: '(3, 4)', k: 'orange' }, { vec: 4, k: 'orange' }];
      const shown = [s.ease('then', 0.6, 0.6), s.ease('then', 0.6), s.ease('turn', 0.6, 1.2), 1, 1];
      pipelineParts(s, items, cy, shown);
    });
    // B and A as one matrix; then C feeds it from the right; then all three as one.
    s.alpha(once * (1 - C), () => pipeline(s, [{ vec: 2, k: OUTER }, { box: 'AB', shape: '(2, 4)', k: OUTER }, { vec: 4, k: 'orange' }], cy));
    s.alpha(C * (1 - ABC), () => pipeline(s, [{ vec: 2, k: OUTER }, { box: 'AB', shape: '(2, 4)', k: OUTER }, { vec: 4, k: INNER, on: 1 }, { box: 'C', shape: '(4, 5)', k: 'teal' }, { vec: 5, k: 'orange' }], cy));
    s.alpha(ABC, () => pipeline(s, [{ vec: 2, k: OUTER }, { box: 'ABC', shape: '(2, 5)', k: OUTER }, { vec: 5, k: 'orange' }], cy));

    cite(s, 'Arthur Cayley, 1858', s.win('cayley', 'once'));

    const y1 = s.h * 0.64;
    const y2 = y1 + 9 * u;
    const cap = { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    const eq = { size: 3.9, weight: 600 } as const;
    s.alpha(s.win('turn', 'then'), () => rich(s, [['B', 'orange'], [': 4 numbers in, 3 out', '--ink-2']], s.w / 2, y1, eq));
    s.alpha(s.win('then', 'handoff'), () => rich(s, [['A', 'blue'], [': 3 in, 2 out', '--ink-2']], s.w / 2, y1, eq));
    s.alpha(s.win('handoff', 'once'), () => rich(s, [["B's rows = A's columns: ", '--ink-2'], ['3 = 3', INNER]], s.w / 2, y1, eq));
    s.alpha(s.win('rect', 'once'), () => s.text('rows of the 2nd = columns of the 1st', s.w / 2, y2, cap));
    s.alpha(s.win('once', 'C'), () => {
      rich(s, [['AB', OUTER], [': 4 in, 2 out', '--ink-2']], s.w / 2, y1, eq);
      s.text('the middle 3 is used up inside', s.w / 2, y2, cap);
    });
    s.alpha(s.win('C', 'ABC'), () => rich(s, [['C', 'teal'], [': 5 in, 4 out', '--ink-2']], s.w / 2, y1, eq));
    s.alpha(s.ease('ABC', 0.6), () => {
      rich(s, [['AB', OUTER], ['  ', '--ink-2'], ...shapes(2, 3, 3, 4, INNER, '(2, 4)')], s.w / 2, y1, eq);
      rich(s, [['ABC', OUTER], [' ', '--ink-2'], ...shapes(2, 4, 4, 5, INNER, '(2, 5)')], s.w / 2, y2, eq);
    });
  },
};

/** `pipeline`, with each item faded by its own alpha so the machine is built up a piece at a time. */
function pipelineParts(s: Scene, items: Item[], cy: number, alphas: number[]) {
  const c = s.ctx;
  const { c: cw, bw, ar } = pipe(s);
  const wOf = (it: Item) => ('vec' in it ? cw : bw);
  const total = items.reduce((t, it) => t + wOf(it), 0) + ar * (items.length - 1);
  let x = s.w / 2 - total / 2;
  items.forEach((it, i) => {
    const w = wOf(it);
    const x0 = x;
    s.alpha(alphas[i]!, () => {
      c.save();
      c.beginPath();
      // Each pass draws the whole row clipped to one slot: the item and the arrow that feeds it.
      c.rect(x0, 0, w + (i < items.length - 1 ? ar : 0), s.h);
      c.clip();
      pipeline(s, items, cy);
      c.restore();
    });
    x += w + ar;
  });
}

// ---- order: edges that do not meet, then a transpose that makes them meet

interface Side {
  rows: number;
  cols: number;
  k: Ink;
  name: string;
}

/** The classic layout: the first matrix low on the left, the second high on the right, their product where they cross. */
function place(s: Scene, a: Side, b: Side, p: number, top: number) {
  const gap = 4 * s.u;
  const left = s.w / 2 - (a.cols * p + gap + b.cols * p) / 2;
  const A = { x: left, y: top + b.rows * p + gap };
  const B = { x: left + a.cols * p + gap, y: top };
  return { A, B };
}

/** A product in the classic layout, its sizes on the edges; a product that does not fit marks its inner pair in red. */
function product(s: Scene, a: Side, b: Side, p: number, top: number, o: { result?: number; band?: number }) {
  const u = s.u;
  const { A, B } = place(s, a, b, p, top);
  const ok = a.cols === b.rows;
  const ink: Ink = ok ? INNER : FAIL;
  for (let i = 0; i < a.rows; i++) for (let j = 0; j < a.cols; j++) cell(s, A.x + j * p, A.y + i * p, p, a.k);
  for (let i = 0; i < b.rows; i++) for (let j = 0; j < b.cols; j++) cell(s, B.x + j * p, B.y + i * p, p, b.k);
  if (ok) s.alpha(o.result ?? 0, () => {
    for (let i = 0; i < a.rows; i++) for (let j = 0; j < b.cols; j++) cell(s, B.x + j * p, A.y + i * p, p, OUTER, 0.4);
  });
  outline(s, A.x, A.y, a.cols * p, p, ink, o.band ?? 0);
  outline(s, B.x, B.y, p, b.rows * p, ink, o.band ?? 0);
  const out = o.result ?? 0;
  size(s, String(a.rows), A.x - 2.5 * u, A.y + (a.rows * p) / 2, OUTER, out, 'right');
  size(s, String(a.cols), A.x + (a.cols * p) / 2, A.y - 3 * u, ink, 1);
  size(s, String(b.rows), B.x - 2.5 * u, B.y + (b.rows * p) / 2, ink, 1, 'right');
  size(s, String(b.cols), B.x + (b.cols * p) / 2, B.y - 3 * u, OUTER, out);
  const name = { size: 3.8, font: 'mono', weight: 650 } as const;
  s.text(a.name, A.x + (a.cols * p) / 2, A.y + a.rows * p + 4 * u, { ...name, color: s.c(a.k) });
  s.text(b.name, B.x + b.cols * p + 3 * u, B.y + (b.rows * p) / 2, { ...name, align: 'left', color: s.c(b.k) });
  if (!ok) s.alpha(o.band ?? 0, () => s.text('✗', B.x + (b.cols * p) / 2, A.y + (a.rows * p) / 2, { size: 7, font: 'ui', weight: 700, color: s.c(FAIL) }));
}

const SA: Side = { rows: 2, cols: 3, k: 'blue', name: 'A' };
const SB: Side = { rows: 3, cols: 4, k: 'orange', name: 'B' };
const SM: Side = { rows: 2, cols: 4, k: 'teal', name: 'M' };
const SAT: Side = { rows: 3, cols: 2, k: 'blue', name: 'A.T' };
const SMT: Side = { rows: 4, cols: 2, k: 'teal', name: 'M.T' };

const order: SceneDef = {
  draw(s) {
    const u = s.u;
    const p = 8 * u;
    const top = s.h * 0.09;
    const toM = s.ease('M', 0.6);
    const tr = s.ease('T', 1.2, 0.4);
    const flip = s.ease('flip', 0.7);
    s.alpha(1 - toM, () => product(s, SB, SA, p, top, { band: s.ease('swap', 0.6, 1.2) }));
    // A turns into its transpose: entry (i, j) of A moves to row j, column i.
    s.alpha(toM * (1 - flip), () => {
      if (tr <= 0) {
        product(s, SA, SM, p, top, { band: s.ease('M', 0.6, 1.4) });
        return;
      }
      if (tr >= 1) {
        product(s, SAT, SM, p, top, { result: s.ease('fix', 0.6, 0.6) });
        return;
      }
      const before = place(s, SA, SM, p, top);
      const after = place(s, SAT, SM, p, top);
      for (let i = 0; i < SA.rows; i++) for (let j = 0; j < SA.cols; j++) {
        cell(s, lerp(before.A.x + j * p, after.A.x + i * p, tr), lerp(before.A.y + i * p, after.A.y + j * p, tr), p, 'blue');
      }
      for (let i = 0; i < SM.rows; i++) for (let j = 0; j < SM.cols; j++) cell(s, lerp(before.B.x, after.B.x, tr) + j * p, lerp(before.B.y, after.B.y, tr) + i * p, p, 'teal');
    });
    s.alpha(flip, () => product(s, SMT, SA, p, top, { result: s.ease('flip', 0.6, 1.2) }));

    // The working, left-aligned so the products line up.
    const lx = s.w / 2 - 33 * u;
    const y0 = s.h * 0.73;
    const eq = { size: 3.5, weight: 600, align: 'left' } as const;
    const line = (name: [string, Ink][], runs: [string, Ink][], y: number) => rich(s, [...name, ...runs], lx, y, eq);
    s.alpha(s.win('swap', 'M'), () => line([['B @ A    ', '--ink-3']], [...shapes(3, 4, 2, 3, FAIL), ['  ✗', FAIL]], y0));
    s.alpha(s.win('M', 'T'), () => line([['A @ M    ', '--ink-3']], [...shapes(2, 3, 2, 4, FAIL), ['  ✗', FAIL]], y0));
    s.alpha(s.win('T', 'fix'), () => line([['A.T      ', '--ink-3']], [['(3, 2)', 'blue']], y0));
    s.alpha(s.ease('fix', 0.6), () => line([['A.T @ M  ', '--ink-3']], shapes(3, 2, 2, 4, INNER, '(3, 4)'), y0));
    s.alpha(s.ease('flip', 0.6, 0.6), () => line([['M.T @ A  ', '--ink-3']], shapes(4, 2, 2, 3, INNER, '(4, 3)'), y0 + 8 * u));
    const cap = { size: 3.3, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('swap', 'M'), () => s.text('a row of 4 against a column of 2', s.w / 2, y0 + 8 * u, cap));
    s.alpha(s.win('M', 'T'), () => s.text('a row of 3 against a column of 2', s.w / 2, y0 + 8 * u, cap));
    s.alpha(s.ease('flip', 0.6, 1.4), () => s.text('rows from the 1st, columns from the 2nd', s.w / 2, y0 + 16 * u, cap));
  },
};

export const scenes: Record<string, SceneDef> = { columns, chain, order };
