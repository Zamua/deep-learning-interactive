import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../backprop/draw';
import { fmt, push, rich, type Ink } from '../draw';

const R = [0.9, 0.6, 0.5, 0.2];
const MEAN = R.reduce((a, b) => a + b, 0) / R.length;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** One line of plain text across the stage, centered. */
function caption(s: Scene, text: string, y: number, k: Ink, a: number, size = 3.2) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, color: s.c(k), halo: true }));
}

/** The four reward bars, rows of numbers under them, and the pushes below. */
function layout(s: Scene) {
  const xs = columns(s, 4, 19);
  const base = s.h * 0.4;
  return { xs, base, H: 26, yR: base + 6 * s.u, yA: base + 14 * s.u, yp: s.h * 0.74, lx: xs[0]! - 9.5 * s.u };
}
type L = ReturnType<typeof layout>;

/** The rewards as bars: labelled on top, or with a row of cells under them, which a moving level cannot cross. */
function rewards(s: Scene, L: L, hi: number[], row = false) {
  if (!row) rowLabel(s, 'R', L.lx, L.base - (L.H + 5) * s.u, 'gold', 3.8);
  bars(s, L.xs, L.base, R, 'gold', { max: 1, height: L.H, w: 11, fmt: row ? undefined : (v) => v.toFixed(1), hi });
  if (row) {
    rowLabel(s, 'R', L.lx, L.yR, 'gold', 3.6);
    cells(s, L.xs, L.yR, R.map((v) => v.toFixed(1)), 'gold', { w: 12, h: 6.5, size: 3, on: hi });
  }
}

/** A push whose length follows the weight's square root, so it shrinks smoothly through zero and small ones stay visible. */
const len = (v: number) => Math.sign(v) * Math.sqrt(Math.abs(v));

function pushes(s: Scene, L: L, ws: number[], a: number, dim: number[] = []) {
  s.alpha(a, () => {
    rowLabel(s, 'push', L.lx, L.yp, '--ink-3', 3);
    L.xs.forEach((x, i) => s.alpha(1 - 0.8 * (dim[i] ?? 0), () => push(s, x, L.yp, len(ws[i]!), 12, 1)));
  });
}

// ---- scene 1: with every reward positive, every answer is pushed up

const allup: SceneDef = {
  draw(s) {
    const L = layout(s);
    const one = s.win('one', 'noise');
    rewards(s, L, [0, 0, 0, one]);
    const pa = s.ease('allup', 0.8, 0.8);
    pushes(s, L, R, pa, [one, one, one, 0]);
    // The one answer drawn, ringed.
    s.alpha(one, () => {
      const x = L.xs[3]!;
      s.rrect(x - 7.5 * s.u, L.base - (0.2 * L.H + 8) * s.u, 15 * s.u, L.yp - L.base + (0.2 * L.H + 8) * s.u + 4 * s.u, 1.4, { stroke: s.tint('gold', 0.9), lw: 0.4 });
      s.text('drawn', x, L.base + 4 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('gold') });
    });
    caption(s, 'every R > 0: all pushed up, even the worst', s.h * 0.94, 'green', after(s, 'allup', 0.55) * (1 - s.ease('one', 0.5)));
    caption(s, 'one draw, the worst: made more likely', s.h * 0.94, 'red', after(s, 'one', 0.4) * (1 - s.ease('noise', 0.5)));
    caption(s, 'each step pushes up whatever was drawn', s.h * 0.94, '--ink-2', s.win('noise', 'sutton'));
    caption(s, 'unbalanced: nearly all positive', s.h * 0.94, '--ink-2', s.ease('sutton', 0.6));
    cite(s, 'Sutton, 1984', s.ease('sutton', 0.6));
  },
};

// ---- scene 2: a level b, raised from zero; each push is R − b

/** Where the level stands at time t: 0, raised past every bar, then settled at the mean. */
function level(s: Scene): number {
  const up = 0.75 * s.prog('raise');
  const top = lerp(up, 1.1, s.ease('top', 1.4));
  return lerp(top, MEAN, s.ease('mean', 1.6));
}

const show2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : fmt(v));
const code2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2).replace(/^(-?)0\./, '$1.'));

const baseline: SceneDef = {
  draw(s) {
    const L = layout(s);
    const b = level(s);
    const A = R.map((r) => r - b);
    s.slot('b', b.toFixed(2));
    s.slot('A', A.map(code2).join(' '));
    const third = s.win('third', 'zero');
    rewards(s, L, [0, 0, third, 0], true);
    // The level: a dashed line across the bars, named at its right end.
    const la = s.ease('level', 0.8);
    const yb = L.base - b * L.H * s.u;
    s.alpha(la, () => {
      const x0 = L.xs[0]! - 7 * s.u;
      const x1 = x0 + (L.xs[3]! - L.xs[0]! + 14 * s.u) * la;
      s.line(x0, yb, x1, yb, s.c('green'), 0.5, [1.4, 1]);
      s.text('b', x1 + 1.5 * s.u, yb, { size: 3.6, font: 'mono', weight: 700, align: 'left', color: s.c('green'), halo: true });
    });
    s.alpha(la * (1 - s.ease('williams', 0.4)), () => s.text(`b = ${b.toFixed(2)}`, s.w - 5 * s.u, 5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') }));
    // The advantages, live, under the bars.
    s.alpha(s.ease('adv', 0.6, 0.4), () => {
      rowLabel(s, 'A', L.lx, L.yA, 'red', 3.6);
      cells(s, L.xs, L.yA, A.map(show2), 'red', { w: 12, h: 6.5, size: 3, on: [0, 0, third, 0] });
    });
    pushes(s, L, A, s.ease('level', 0.6, 0.6));
    caption(s, 'b = 0: each push is just R', s.h * 0.94, '--ink-2', after(s, 'level', 0.5) * (1 - s.ease('raise', 0.5)));
    caption(s, 'raise b: every push shrinks, then flips', s.h * 0.94, '--ink-2', s.win('raise', 'top'));
    caption(s, 'b above every bar: all pushed down', s.h * 0.94, 'red', s.win('top', 'mean'));
    caption(s, 'b = the average: better up, worse down', s.h * 0.94, 'green', after(s, 'mean', 0.4) * (1 - s.ease('name', 0.5)));
    caption(s, 'the baseline: the line you measure from', s.h * 0.94, 'green', s.win('name', 'adv'));
    caption(s, 'A = R − b: ahead of expected, or behind', s.h * 0.94, 'red', s.win('adv', 'third'));
    caption(s, 'R = 0.5 > 0, but below b: pushed down', s.h * 0.94, 'red', s.win('third', 'zero'));
    caption(s, 'R = b: A = 0, no push', s.h * 0.94, '--ink-2', s.win('zero', 'williams'));
    caption(s, 'the reinforcement baseline', s.h * 0.94, '--ink-2', s.ease('williams', 0.6));
    cite(s, 'Williams, 1992', s.ease('williams', 0.6));
  },
};

// ---- scene 3: the worked problems, advantages from a mean baseline, then one entry of the estimate

const R2 = [1, 0.4, 0.1];
const B2 = 0.5;
const A2 = R2.map((r) => Math.round((r - B2) * 10) / 10);

const tryIt: SceneDef = {
  marks: {
    q2: { tex: String.raw`\dfrac{\partial \ln \sym{pi}{\pi}(y)}{\partial \sym{theta}{\theta}_0} = 2`, x: 0.5, y: 0.6, size: 4.2 },
  },
  draw(s) {
    const xs = columns(s, 3, 18);
    const lx = xs[0]! - 9 * s.u;
    const yR = s.h * 0.14;
    const yA = s.h * 0.4;
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      rowLabel(s, 'R', lx, yR, 'gold', 3.6);
      cells(s, xs, yR, R2.map(String), 'gold', { w: 12, h: 7, on: [0, s.ease('p2', 0.6), 0] });
      xs.forEach((x, i) => s.text(`answer ${i}`, x, yR - 6.5 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.1), () => rich(s, [['b = (1 + 0.4 + 0.1) / 3 = ', '--ink-2'], ['0.5', 'green']], s.w / 2, s.h * 0.25, { size: 3.2, weight: 600 }));
    s.alpha(after(s, 'a1', 0.45), () => {
      xs.forEach((x) => s.text('− 0.5', x, s.h * 0.32, { size: 2.8, font: 'mono', color: s.c('green'), halo: true }));
      rowLabel(s, 'A', lx, yA, 'red', 3.6);
      cells(s, xs, yA, A2.map((v) => (v < 0 ? `−${-v}` : String(v))), 'red', { w: 12, h: 7, on: [0, s.ease('p2', 0.6), 0] });
    });
    s.show('q2', s.ease('p2', 0.6, 0.5));
    s.alpha(after(s, 'a2', 0.1), () => rich(s, [['A · ∂ln π/∂θ₀ = −0.1 × 2 = ', '--ink-2'], ['−0.2', 'red']], s.w / 2, s.h * 0.74, { size: 3.2, weight: 600 }));
    s.alpha(after(s, 'a2', 0.55), () => {
      s.text('positive reward, below b: pushed down', s.w / 2, s.h * 0.84, { size: 3, color: s.c('red') });
      push(s, xs[1]!, yA + 4.5 * s.u, -0.5, 10, after(s, 'a2', 0.55));
    });
  },
};

export const scenes: Record<string, SceneDef> = { allup, baseline, try: tryIt };
