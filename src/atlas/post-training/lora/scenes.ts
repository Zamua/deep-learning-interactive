import type { Scene, SceneDef } from '../../../lecture/scene';
import { block, brace, rich } from '../draw';

/** Stage sizes, in units: W's side and the thin side of B and A. */
const S = 34;
const T = 5;

/** x of W, the plus, B and A for `[W] + [B][A]`, centered on the stage. */
function sum(s: Scene) {
  const left = s.w / 2 - ((S + 9 + T + 2 + S) / 2) * s.u;
  return { W: left + (S / 2) * s.u, plus: left + (S + 4.5) * s.u, B: left + (S + 9 + T / 2) * s.u, A: left + (S + 9 + T + 2 + S / 2) * s.u };
}

/** B, tall and thin, and A, short and wide, side by side with B's top level with A. */
function pair(s: Scene, bx: number, ax: number, cy: number, a: { b: number; a: number }, labels = true): void {
  const top = cy - (S / 2) * s.u;
  s.alpha(a.b, () => block(s, bx, cy, T * s.u, S * s.u, labels ? 'B' : '', 'green'));
  s.alpha(a.a, () => block(s, ax, top + (T / 2) * s.u, S * s.u, T * s.u, labels ? 'A' : '', 'orange', { size: 3.6 }));
}

const full: SceneDef = {
  draw(s) {
    const cy = s.h * 0.45;
    const X = sum(s);
    const idea = s.ease('idea', 1);
    const wx = s.w / 2 + (X.W - s.w / 2) * idea;
    const frozen = s.ease('idea', 0.6, 0.6);
    block(s, wx, cy, S * s.u, S * s.u, 'W', frozen > 0.5 ? 'slate' : 'blue', { on: s.win('W', 'size') });
    const top = cy - (S / 2) * s.u;
    s.alpha(s.ease('W', 0.6, 1.5) * (1 - idea), () => {
      brace(s, 'top', wx - (S / 2) * s.u, wx + (S / 2) * s.u, top - 2 * s.u, 'k = 1,000', 'slate', 3.2);
      brace(s, 'left', top, top + S * s.u, wx - (S / 2 + 2) * s.u, 'd = 1,000', 'slate', 3.2);
    });
    s.alpha(s.ease('size', 0.6) * (1 - idea), () => {
      s.text('1,000,000 numbers', wx, cy + (S / 2 + 6) * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') });
      s.text('to train, and to store per task', wx, cy + (S / 2 + 11) * s.u, { size: 3, color: s.c('--ink-3') });
    });
    s.alpha(frozen, () => {
      s.text('frozen', wx, cy + (S / 2 + 5) * s.u, { size: 3.2, font: 'mono', color: s.c('slate') });
      s.text('+', X.plus, cy, { size: 7, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    pair(s, X.B, X.A, cy, { b: s.ease('idea', 0.6, 1), a: s.ease('idea', 0.6, 1.4) });
    s.alpha(s.ease('idea', 0.6, 2), () => s.text('learned', (X.B + X.A) / 2 + 6 * s.u, cy + (S / 2 + 5) * s.u, { size: 3.2, font: 'mono', color: s.c('green') }));
    s.alpha(s.ease('rank', 0.6), () => {
      brace(s, 'bottom', X.B - (T / 2) * s.u, X.B + (T / 2) * s.u, top + S * s.u + 9 * s.u, 'r = 4', 'green', 3);
      brace(s, 'top', X.A - (S / 2) * s.u, X.A + (S / 2) * s.u, top - 2 * s.u, 'k', 'orange', 3);
      s.text('d', X.B + (T / 2 + 1.5) * s.u, cy + 6 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('green') });
      s.text('r', X.A + (S / 2 + 2) * s.u, top + (T / 2) * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
    });
  },
};

const count: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{out} = \symW\symx + \sym{B}{B}\sym{A}{A}\symx`, x: 0.5, y: 0.08, size: 5 },
  },
  draw(s) {
    const cy = s.h * 0.4;
    const X = sum(s);
    // [B][A] = [BA], in the slots of [W] + [B][A] shifted left.
    const bx = X.W - (S / 2 - T / 2) * s.u;
    const ax = bx + (T / 2 + 2 + S / 2) * s.u;
    const px = ax + (S / 2 + 4.5) * s.u;
    const rx = px + (4.5 + S / 2) * s.u;
    const top = cy - (S / 2) * s.u;
    pair(s, bx, ax, cy, { b: 1, a: 1 });
    const prod = s.ease('shape', 0.8, 1.2);
    s.alpha(prod, () => {
      s.text('=', px, cy, { size: 7, font: 'mono', weight: 600, color: s.c('--ink-2') });
      block(s, rx, cy, S * s.u, S * s.u, 'BA', 'teal', { dash: true });
      brace(s, 'top', rx - (S / 2) * s.u, rx + (S / 2) * s.u, top - 2 * s.u, 'k', 'teal', 3);
      s.text('d', rx + (S / 2 + 2) * s.u, cy, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
    });
    s.alpha(s.ease('shape', 0.6) * (1 - s.ease('count', 0.6)), () => {
      s.text('(d, r) · (r, k) → (d, k)', s.w / 2, top + S * s.u + 7 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    });
    // What B and A hold, counted apart.
    s.alpha(s.ease('count', 0.6), () => {
      rich(s, [['B: 1,000 × 4 = 4,000', 'green'], ['   ', '--ink-3'], ['A: 4 × 1,000 = 4,000', 'orange']], s.w / 2, top + S * s.u + 6 * s.u, { size: 3.2, weight: 600 });
    });
    // How many numbers each holds, as bars on one scale.
    const cnt = s.ease('total', 0.8);
    const bl = s.w / 2 - 34 * s.u;
    const len = 68 * s.u;
    const y1 = top + S * s.u + 16 * s.u;
    const y2 = y1 + 9 * s.u;
    s.alpha(cnt, () => {
      s.rrect(bl, y1 - 2 * s.u, len, 4 * s.u, 0.8, { fill: s.tint('blue', 0.35), stroke: s.tint('blue', 0.8), lw: 0.25 });
      s.text('W: 1,000,000', bl, y1 - 4.4 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
      s.rrect(bl, y2 - 2 * s.u, Math.max(0.6 * s.u, len * 0.008), 4 * s.u, 0.3, { fill: s.c('green') });
      s.text('B + A: r(d + k) = 8,000', bl + 2 * s.u, y2, { size: 3, font: 'mono', align: 'left', color: s.c('green') });
    });
    s.alpha(s.ease('frac', 0.6, 0.6), () => {
      rich(s, [['8,000 / 1,000,000 = ', '--ink-2'], ['0.8%', 'green']], s.w / 2, y2 + 7.5 * s.u, { size: 3.4, weight: 600 });
    });
    s.show('f', s.ease('out', 0.6));
  },
};

const merge: SceneDef = {
  draw(s) {
    const q = 24;
    const g = 10;
    const xs = [-1, 0, 1].map((i) => s.w / 2 + i * (q + g) * s.u);
    const cy = s.h * 0.34;
    const z = s.win('zero', 'merge');
    const mg = s.ease('merge', 0.8);
    // Top: B, at zero, times A, makes zero.
    s.alpha(1 - mg, () => {
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
      s.text('step 0 is the original model;', s.w / 2, s.h * 0.68, { size: 3.2, color: s.c('--ink-2') });
      s.text('it moves only as B learns', s.w / 2, s.h * 0.68 + 5 * s.u, { size: 3.2, color: s.c('--ink-2') });
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
    s.alpha(s.ease('merge', 0.6, 2) * (1 - s.ease('tasks', 0.6)), () => s.text('one matrix: the layer runs as fast as before', s.w / 2, s.h * 0.68, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.ease('tasks', 0.6), () => {
      const y = s.h * 0.66;
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

/** The worked count: W of shape (2,000, 500) at rank 4, drawn with d and k to scale. */
const worked: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = s.w / 2;
    const top = s.h * 0.32 - 20 * u;
    const hd = 40 * u;
    const wk = 10 * u;
    const rr = 4 * u;
    const wx = c - 13 * u;
    const bx = c + 6 * u;
    const ax = c + 15 * u;
    block(s, wx, top + hd / 2, wk, hd, 'W', 'slate', { size: 3.6 });
    brace(s, 'left', top, top + hd, wx - wk / 2 - 2 * u, 'd = 2,000', 'slate', 3);
    brace(s, 'top', wx - wk / 2, wx + wk / 2, top - 2 * u, 'k = 500', 'slate', 3);
    s.alpha(s.ease('ask', 0.6, 1.5) * (1 - s.ease('B', 0.5)), () => s.text('r = 4', bx + 5 * u, top + hd / 2, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
    const b = s.ease('B', 0.6);
    s.alpha(b, () => {
      block(s, bx, top + hd / 2, rr, hd, 'B', 'green', { size: 3, on: s.win('B', 'A') });
      brace(s, 'bottom', bx - rr / 2, bx + rr / 2, top + hd + 2 * u, 'r = 4', 'green', 3);
      for (const y of [top, top + hd]) s.line(wx + wk / 2 + 1 * u, y, bx - rr / 2 - 1 * u, y, s.tint('green', 0.6), 0.25, [0.8, 0.6]);
    });
    const a = s.ease('A', 0.6);
    s.alpha(a, () => {
      block(s, ax, top + rr / 2, wk, rr, 'A', 'orange', { size: 2.8, on: s.win('A', 'sum') });
      brace(s, 'top', ax - wk / 2, ax + wk / 2, top - 2 * u, 'k = 500', 'orange', 3);
      s.text('r', ax + wk / 2 + 1.5 * u, top + rr / 2, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
    });
    const o = { size: 3.2, weight: 600 } as const;
    s.alpha(s.ease('B', 0.6, 1), () => rich(s, [['B: (2,000, 4) → 2,000 × 4 = ', '--ink-2'], ['8,000', 'green']], c, s.h * 0.64, o));
    s.alpha(s.ease('A', 0.6, 1), () => rich(s, [['A: (4, 500) → 4 × 500 = ', '--ink-2'], ['2,000', 'orange']], c, s.h * 0.72, o));
    s.alpha(s.ease('sum', 0.6), () => rich(s, [['8,000 + 2,000 = ', '--ink-2'], ['10,000', 'teal'], [' = 4 × (2,000 + 500)', '--ink-2']], c, s.h * 0.8, o));
    s.alpha(s.ease('pct', 0.6, 1), () => rich(s, [['10,000 / (2,000 × 500) = ', '--ink-2'], ['1%', 'teal']], c, s.h * 0.88, o));
  },
};

export const scenes: Record<string, SceneDef> = { full, count, merge, worked };
