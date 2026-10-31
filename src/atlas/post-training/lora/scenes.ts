import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { brace, rich } from '../../linear-algebra/draw';
import { block } from '../draw';

/** Stage sizes, in units: W's side and the thin side of B and A. */
const S = 34;
const T = 5;

/** x of W, the plus, B and A for `[W] + [B][A]`, centered on the stage. */
function sum(s: Scene) {
  const left = s.w / 2 - ((S + 9 + T + 2 + S) / 2) * s.u;
  return { W: left + (S / 2) * s.u, plus: left + (S + 4.5) * s.u, B: left + (S + 9 + T / 2) * s.u, A: left + (S + 9 + T + 2 + S / 2) * s.u, BA: left + (S + 9 + (T + 2 + S) / 2) * s.u };
}

/** B, tall and thin, and A, short and wide, side by side with B's top level with A. */
function pair(s: Scene, bx: number, ax: number, cy: number, a: { b: number; a: number }): void {
  const top = cy - (S / 2) * s.u;
  s.alpha(a.b, () => block(s, bx, cy, T * s.u, S * s.u, 'B', 'green'));
  s.alpha(a.a, () => block(s, ax, top + (T / 2) * s.u, S * s.u, T * s.u, 'A', 'orange', { size: 3.6 }));
}

// ---- scene 1: what fine-tuning costs, and LoRA's answer

const cost: SceneDef = {
  draw(s) {
    const cy = s.h * 0.46;
    const X = sum(s);
    const top = cy - (S / 2) * s.u;
    const bot = cy + (S / 2) * s.u;
    // W slides left once the change joins it.
    const side = s.ease('size', 1, 1.2);
    const wx = s.w / 2 + (X.W - s.w / 2) * side;
    const frozen = s.ease('idea', 0.6);
    block(s, wx, cy, S * s.u, S * s.u, 'W', frozen > 0.5 ? 'slate' : 'blue', { on: s.win('W', 'size') });
    s.alpha(s.ease('W', 0.6, 1.5) * (1 - side), () => {
      brace(s, 'top', wx - (S / 2) * s.u, wx + (S / 2) * s.u, top - 2 * s.u, 'k = 1,000', 'slate', 3.2);
      brace(s, 'left', top, bot, wx - (S / 2 + 2) * s.u, 'd = 1,000', 'slate', 3.2);
    });
    s.alpha(s.ease('size', 0.6) * (1 - side), () => s.text('1,000,000 numbers', wx, bot + 6 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') }));
    s.alpha(side, () => s.text('+', X.plus, cy, { size: 7, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    // The change: W's shape, one per task, until LoRA rebuilds it from B and A.
    const swap = s.ease('idea', 0.8, 0.6);
    const copies = s.ease('size', 0.8, 3);
    s.alpha(side * (1 - swap), () => {
      for (let i = 2; i >= 0; i--) {
        const off = i * 2.4 * s.u * copies;
        s.alpha(i === 0 ? 1 : copies * 0.7, () => block(s, X.BA + off, cy - off, S * s.u, S * s.u, i === 0 ? 'change' : '', 'teal', { size: 3.6, on: i === 0 ? s.win('big', 'lora') : 0 }));
      }
      s.text('(d, k), per task', X.BA, bot + 5 * s.u, { size: 3, font: 'mono', color: s.c('teal') });
    });
    s.alpha(s.ease('size', 0.6, 1.5) * (1 - frozen), () => s.text('1,000,000 more for every task', s.w / 2, bot + 12 * s.u, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.win('big', 'lora'), () => s.text('at 175,000,000,000 weights: too costly', s.w / 2, bot + 18 * s.u, { size: 3.2, color: s.c('red') }));
    // The name, with its initials picked out.
    s.alpha(s.win('lora', 'rank'), () =>
      rich(s, [['Lo', 'green'], ['w-', '--ink-2'], ['R', 'green'], ['ank ', '--ink-2'], ['A', 'green'], ['daptation', '--ink-2']], s.w / 2, top - 10 * s.u, { size: 4.2, weight: 650 }),
    );
    cite(s, 'LoRA · Edward Hu et al., 2021', s.ease('lora', 0.6));
    s.alpha(frozen, () => s.text('frozen', wx, bot + 5 * s.u, { size: 3.2, font: 'mono', color: s.c('slate') }));
    pair(s, X.B, X.A, cy, { b: swap, a: s.ease('idea', 0.6, 1) });
    s.alpha(s.ease('idea', 0.6, 1.6), () => s.text('learned', X.BA, bot + 5 * s.u, { size: 3.2, font: 'mono', color: s.c('green') }));
    s.alpha(s.ease('rank', 0.6), () => {
      brace(s, 'bottom', X.B - (T / 2) * s.u, X.B + (T / 2) * s.u, bot + 9 * s.u, 'r = 4', 'green', 3);
      brace(s, 'top', X.A - (S / 2) * s.u, X.A + (S / 2) * s.u, top - 2 * s.u, 'k', 'orange', 3);
      s.text('d', X.B + (T / 2 + 1.5) * s.u, cy + 6 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('green') });
      s.text('r', X.A + (S / 2 + 2) * s.u, top + (T / 2) * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
    });
  },
};

// ---- scene 2: a small change, its columns built from B's columns

const B1 = [1, 2, 0, -1, 1];
const A1 = [1, 2, -1, 3, -2, 1];
const B2 = [1, 0, 1, 1, -1];
const A2 = [0, 1, 1, -1, 1, 2];
const prod = (cols: number[][], rows: number[][]) => cols[0]!.map((_, i) => rows[0]!.map((_, j) => cols.reduce((t, c, q) => t + c[i]! * rows[q]![j]!, 0)));
const P1 = prod([B1], [A1]);
const P2 = prod([B1, B2], [A1, A2]);
const nf = (v: number) => String(v).replace('-', '−');

/** A cell shaded by its value, teal above zero and red below, so a column's pattern reads at a glance. */
function vcell(s: Scene, x: number, y: number, v: number, w: number, o: { on?: number; a?: number } = {}): void {
  const k: Ink = v > 0 ? 'teal' : v < 0 ? 'red' : 'slate';
  const m = Math.min(1, Math.abs(v) / 6);
  const on = o.on ?? 0;
  s.alpha(o.a ?? 1, () => {
    s.rrect(x - w / 2, y - w / 2, w, w, 1, { fill: s.tint(k, 0.08 + 0.42 * m), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.25 + 0.3 * on });
    s.text(nf(v), x, y + 0.2 * s.u, { size: 2.9, font: 'mono', weight: 600, color: s.c('--ink') });
  });
}

const rank: SceneDef = {
  draw(s) {
    const p = 8;
    const w = 7 * s.u;
    const two = s.ease('two', 0.9);
    const gx = (j: number) => s.w / 2 + (4 + (j - 2.5) * p) * s.u;
    const gy = (i: number) => s.h * 0.56 + (i - 2) * p * s.u;
    const bx = (q: number) => gx(0) - (p + 3 + (1 - q) * p) * s.u;
    const ay = (q: number) => gy(0) - (p + 3 + (1 - q) * p) * s.u;
    // Which column the voice is on: column 1 on `col`, column 2 once r is two.
    const hotCol = (j: number) => (j === 1 ? s.win('col', 'all') : 0) + (j === 2 ? s.win('two', 'def') * after(s, 'two', 0.4) : 0);
    // B's columns down the left, A's rows across the top: entry (i, j) is row i of B times column j of A.
    B1.forEach((v, i) => vcell(s, bx(0), gy(i), v, w, { on: s.win('col', 'two') }));
    A1.forEach((v, j) => vcell(s, gx(j), ay(0), v, w, { on: hotCol(j) }));
    s.alpha(two, () => {
      B2.forEach((v, i) => vcell(s, bx(1), gy(i), v, w));
      A2.forEach((v, j) => vcell(s, gx(j), ay(1), v, w, { on: hotCol(j) }));
    });
    const lab = { size: 3.4, font: 'mono' as const, weight: 650 };
    s.text('B', bx(0) + ((bx(1) - bx(0)) / 2) * two, gy(4) + 7 * s.u, { ...lab, color: s.c('green') });
    s.text('A', gx(0) - w / 2 - 2 * s.u, ay(0) + ((ay(1) - ay(0)) / 2) * two, { ...lab, color: s.c('orange'), align: 'right' });
    // The change, B times A: empty slots, then each column fills in.
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 6; j++) {
        const fill = j === 1 ? s.ease('col', 0.6, 3) : s.ease('all', 0.5, 0.2 * j);
        const c = s.ctx;
        c.save();
        c.setLineDash([0.8 * s.u, 0.8 * s.u]);
        s.rrect(gx(j) - w / 2, gy(i) - w / 2, w, w, 1, { stroke: s.tint('teal', 0.5), lw: 0.25 });
        c.restore();
        s.alpha(fill * (1 - two), () => vcell(s, gx(j), gy(i), P1[i]![j]!, w, { on: hotCol(j) }));
        s.alpha(fill * two, () => vcell(s, gx(j), gy(i), P2[i]![j]!, w, { on: hotCol(j) }));
      }
    }
    const cy = gy(4) + 13 * s.u;
    const o = { size: 3.2, weight: 600 };
    s.alpha(s.win('small', 'col'), () => rich(s, [['B (5, 1)', 'green'], [' times ', '--ink-3'], ['A (1, 6)', 'orange'], [' = ', '--ink-3'], ['(5, 6)', 'teal']], s.w / 2, cy, o));
    s.alpha(s.win('col', 'all'), () => rich(s, [['column 1 = ', 'teal'], ['2', 'orange'], [' × ', '--ink-3'], ['B', 'green']], s.w / 2, cy, o));
    s.alpha(s.win('all', 'two'), () => rich(s, [['every column = ', 'teal'], ['a number', 'orange'], [' × ', '--ink-3'], ['B', 'green']], s.w / 2, cy, o));
    s.alpha(s.win('two', 'def') * after(s, 'two', 0.4), () => rich(s, [['column 2 = ', 'teal'], ['−1', 'orange'], [' × first + ', '--ink-3'], ['1', 'orange'], [' × second', '--ink-3']], s.w / 2, cy, o));
    s.alpha(s.win('def', 'bet'), () => rich(s, [['rank(BA) ≤ r', 'teal']], s.w / 2, cy, { ...o, size: 3.6 }));
    s.alpha(s.ease('bet', 0.6), () => rich(s, [['r = 4: ', 'green'], ['1,000 columns, mixed from 4', '--ink-2']], s.w / 2, cy, o));
    s.alpha(s.ease('two', 0.6) * (1 - s.ease('def', 0.6)) * (1 - after(s, 'two', 0.4)), () => rich(s, [['r = 2: ', 'green'], ['two directions', '--ink-2']], s.w / 2, cy, o));
    const rx = (gx(0) + gx(5)) / 2;
    const ry = ay(0) - 6.5 * s.u;
    s.alpha(1 - two, () => s.text('r = 1', rx, ry, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
    s.alpha(two, () => s.text('r = 2', rx, ry, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
    cite(s, 'Hu et al., 2021', s.ease('bet', 0.6, 2));
  },
};

// ---- scene 3: the count, for a square W and then a tall one

const count: SceneDef = {
  draw(s) {
    const sq = 1 - s.ease('wide', 0.6);
    s.alpha(sq, () => square(s));
    s.alpha(s.ease('wide', 0.6, 0.3), () => tall(s));
  },
};

/** [B][A] = [BA] for W of shape (1,000, 1,000) at rank 4, with what each holds. */
function square(s: Scene): void {
  const cy = s.h * 0.36;
  const X = sum(s);
  const bx = X.W - (S / 2 - T / 2) * s.u;
  const ax = bx + (T / 2 + 2 + S / 2) * s.u;
  const px = ax + (S / 2 + 4.5) * s.u;
  const rx = px + (4.5 + S / 2) * s.u;
  const top = cy - (S / 2) * s.u;
  const bot = top + S * s.u;
  pair(s, bx, ax, cy, { b: 1, a: 1 });
  s.alpha(s.ease('shape', 0.8, 1.2), () => {
    s.text('=', px, cy, { size: 7, font: 'mono', weight: 600, color: s.c('--ink-2') });
    block(s, rx, cy, S * s.u, S * s.u, 'BA', 'teal', { dash: true });
    brace(s, 'top', rx - (S / 2) * s.u, rx + (S / 2) * s.u, top - 2 * s.u, 'k', 'teal', 3);
    s.text('d', rx + (S / 2 + 2) * s.u, cy, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
  });
  s.alpha(s.ease('shape', 0.6) * (1 - s.ease('B', 0.6)), () => {
    s.text('(d, r) · (r, k) → (d, k)', s.w / 2, bot + 7 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    s.alpha(after(s, 'shape', 0.75), () => s.text("W's shape: it can be added to W", s.w / 2, bot + 13 * s.u, { size: 3.2, color: s.c('teal') }));
  });
  const o = { size: 3.2, weight: 600 };
  s.alpha(s.ease('B', 0.6), () => rich(s, [['B: 1,000 × 4 = ', '--ink-2'], ['4,000', 'green']], s.w / 2, bot + 6 * s.u, o));
  s.alpha(s.ease('A', 0.6), () => rich(s, [['A: 4 × 1,000 = ', '--ink-2'], ['4,000', 'orange']], s.w / 2, bot + 12 * s.u, o));
  // How many numbers each holds, as bars on one scale.
  const bl = s.w / 2 - 34 * s.u;
  const len = 68 * s.u;
  const y1 = bot + 23 * s.u;
  const y2 = y1 + 9 * s.u;
  s.alpha(s.ease('total', 0.8), () => {
    s.rrect(bl, y1 - 2 * s.u, len, 4 * s.u, 0.8, { fill: s.tint('blue', 0.35), stroke: s.tint('blue', 0.8), lw: 0.25 });
    s.text('W: 1,000,000', bl, y1 - 4.4 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
    s.rrect(bl, y2 - 2 * s.u, Math.max(0.6 * s.u, len * 0.008), 4 * s.u, 0.3, { fill: s.c('green') });
    s.text('B + A: r(d + k) = 8,000', bl + 2 * s.u, y2, { size: 3, font: 'mono', align: 'left', color: s.c('green') });
  });
  s.alpha(s.ease('frac', 0.6, 0.6), () => rich(s, [['8,000 / 1,000,000 = ', '--ink-2'], ['0.8%', 'green']], s.w / 2, y2 + 7.5 * s.u, { size: 3.4, weight: 600 }));
}

/** W of shape (2,000, 500) at rank 4, with d and k drawn to scale. */
function tall(s: Scene): void {
  const u = s.u;
  const c = s.w / 2;
  const top = s.h * 0.34 - 20 * u;
  const hd = 40 * u;
  const wk = 10 * u;
  const rr = 4 * u;
  const wx = c - 13 * u;
  const bx = c + 6 * u;
  const ax = c + 15 * u;
  block(s, wx, top + hd / 2, wk, hd, 'W', 'slate', { size: 3.6 });
  brace(s, 'left', top, top + hd, wx - wk / 2 - 2 * u, 'd = 2,000', 'slate', 3);
  brace(s, 'top', wx - wk / 2, wx + wk / 2, top - 2 * u, 'k = 500', 'slate', 3);
  s.alpha(s.ease('wide', 0.6, 2), () => {
    block(s, bx, top + hd / 2, rr, hd, 'B', 'green', { size: 3, on: s.win('wide', 'wideA') });
    brace(s, 'bottom', bx - rr / 2, bx + rr / 2, top + hd + 2 * u, 'r = 4', 'green', 3);
    for (const y of [top, top + hd]) s.line(wx + wk / 2 + 1 * u, y, bx - rr / 2 - 1 * u, y, s.tint('green', 0.6), 0.25, [0.8, 0.6]);
  });
  s.alpha(s.ease('wideA', 0.6), () => {
    block(s, ax, top + rr / 2, wk, rr, 'A', 'orange', { size: 2.8, on: s.win('wideA', 'pct') });
    brace(s, 'top', ax - wk / 2, ax + wk / 2, top - 2 * u, 'k = 500', 'orange', 3);
    s.text('r', ax + wk / 2 + 1.5 * u, top + rr / 2, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
  });
  const o = { size: 3.2, weight: 600 } as const;
  s.alpha(after(s, 'wide', 0.6), () => rich(s, [['B: (2,000, 4) → ', '--ink-2'], ['8,000', 'green']], c, s.h * 0.68, o));
  s.alpha(s.ease('wideA', 0.6, 0.6), () => rich(s, [['A: (4, 500) → ', '--ink-2'], ['2,000', 'orange']], c, s.h * 0.76, o));
  s.alpha(s.ease('pct', 0.6), () => rich(s, [['8,000 + 2,000 = ', '--ink-2'], ['10,000', 'teal']], c, s.h * 0.84, o));
  s.alpha(after(s, 'pct', 0.4), () => rich(s, [['10,000 / (2,000 × 500) = ', '--ink-2'], ['1%', 'teal']], c, s.h * 0.92, o));
}

// ---- scene 4: B starts at zero, and B A merges into W

/** `out = Wx + BAx` as colored runs, returning each run's center so labels can sit under it. */
function formula(s: Scene, y: number, size: number): number[] {
  const runs: [string, Ink][] = [['out = ', '--ink-2'], ['Wx', 'blue'], [' + ', '--ink-2'], ['BAx', 'teal']];
  const o = { size, font: 'mono' as const, weight: 600 };
  const ws = runs.map(([t]) => s.measure(t, o));
  let x = s.w / 2 - ws.reduce((a, b) => a + b, 0) / 2;
  return runs.map(([t, k], i) => {
    s.text(t, x, y, { ...o, align: 'left', color: s.c(k) });
    x += ws[i]!;
    return x - ws[i]! / 2;
  });
}

const merge: SceneDef = {
  draw(s) {
    const q = 24;
    const g = 10;
    const xs = [-1, 0, 1].map((i) => s.w / 2 + i * (q + g) * s.u);
    const cy = s.h * 0.4;
    const z = s.win('zero', 'merge');
    const mg = s.ease('merge', 0.8);
    // The layer while it trains: the frozen path plus the learned one.
    s.alpha(1 - mg, () => {
      const up = s.ease('zero', 0.8);
      const fy = s.h * (0.4 - 0.28 * up);
      const at = formula(s, fy, 5.4 - 1.2 * up);
      s.alpha(s.ease('out', 0.6, 1.2) * (1 - s.ease('zero', 0.6)), () => {
        s.text('frozen', at[1]!, fy + 6.5 * s.u, { size: 3, font: 'mono', color: s.c('slate') });
        s.text('learned', at[3]!, fy + 6.5 * s.u, { size: 3, font: 'mono', color: s.c('green') });
      });
    });
    // B, at zero, times A, makes zero.
    s.alpha(s.ease('zero', 0.6) * (1 - mg), () => {
      const bx = xs[0]! - 4 * s.u;
      const ax = xs[0]! + 7 * s.u;
      block(s, bx, cy, T * s.u, q * s.u, '0', 'green', { on: z, size: 3.2 });
      block(s, ax, cy - (q / 2 - T / 2) * s.u, 16 * s.u, T * s.u, 'A', 'orange', { size: 3.2 });
      s.text('B', bx, cy + (q / 2 + 4) * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('green') });
      s.text('random', ax, cy - (q / 2 - T - 4) * s.u, { size: 2.8, color: s.c('--ink-3') });
      s.text('=', xs[0]! + (q / 2 + g / 2) * s.u, cy, { size: 6, font: 'mono', color: s.c('--ink-2') });
      block(s, xs[1]!, cy, q * s.u, q * s.u, 'BA = 0', 'teal', { dash: true, size: 3.4 });
      s.alpha(s.ease('zero', 0.6, 2), () => {
        rich(s, [['out = ', '--ink-2'], ['Wx', 'blue'], [' + 0', '--ink-3']], xs[2]!, cy - 3 * s.u, { size: 3.6, weight: 600 });
        s.text('the pretrained layer', xs[2]!, cy + 3 * s.u, { size: 2.8, color: s.c('--ink-3') });
      });
    });
    s.alpha(s.ease('start', 0.6) * (1 - mg), () => {
      s.text('step 0 is the pretrained network;', s.w / 2, s.h * 0.72, { size: 3.2, color: s.c('--ink-2') });
      s.text('it moves only as B learns', s.w / 2, s.h * 0.72 + 5 * s.u, { size: 3.2, color: s.c('--ink-2') });
    });
    // Merge: W + BA = W', all (d, k).
    s.alpha(mg, () => {
      block(s, xs[0]!, cy, q * s.u, q * s.u, 'W', 'blue');
      s.text('+', xs[0]! + (q / 2 + g / 2) * s.u, cy, { size: 6, font: 'mono', color: s.c('--ink-2') });
      block(s, xs[1]!, cy, q * s.u, q * s.u, 'BA', 'teal');
      s.text('=', xs[1]! + (q / 2 + g / 2) * s.u, cy, { size: 6, font: 'mono', color: s.c('--ink-2') });
      block(s, xs[2]!, cy, q * s.u, q * s.u, "W'", 'blue', { on: 1 });
      xs.forEach((x) => s.text('(d, k)', x, cy + (q / 2 + 4) * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(s.ease('merge', 0.6, 2) * (1 - s.ease('tasks', 0.6)), () => s.text('one matrix: the layer runs as fast as before', s.w / 2, s.h * 0.72, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.ease('tasks', 0.6), () => {
      const y = s.h * 0.68;
      ['task 1', 'task 2', 'task 3'].forEach((t, i) => {
        const x = s.w / 2 + (i - 1) * 26 * s.u;
        s.text(t, x, y, { size: 3, font: 'mono', color: s.c('--ink-3') });
        block(s, x - 4 * s.u, y + 9 * s.u, 2.4 * s.u, 12 * s.u, '', 'green');
        block(s, x + 3.5 * s.u, y + 4.2 * s.u, 12 * s.u, 2.4 * s.u, '', 'orange');
      });
      s.text('8,000 numbers each, sharing one frozen W', s.w / 2, y + 20 * s.u, { size: 3.2, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { cost, rank, count, merge };
