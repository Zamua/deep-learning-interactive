import { Rng } from '../../../core/rand';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after, Frame, rich } from '../../networks/draw';

const ANS = ['56', '54', '64'];
const PI = [0.5, 0.3, 0.2];
const R = [1, 0, 0];
/** The scores θ that the softmax turns into 0.5, 0.3 and 0.2. */
const TH = ['0', '−0.51', '−0.92'];
/** The answers a run of draws picks, seeded so every viewing shows the same run. */
const DRAWS = [0, 1, 0, 2, 0, 0, 1, 0, 2, 1];
const f2 = (v: number) => v.toFixed(2);

/** π(56) as θ₀ moves with the other two scores held: their exponentials add up to 1, so it is a sigmoid. */
const p56 = (t: number) => 1 / (1 + Math.exp(-t));
const lnp56 = (t: number) => -Math.log(1 + Math.exp(-t));
/** J with rewards 1, 0, −1: e^θ₁ = 0.6 and e^θ₂ = 0.4, so π(64) = 0.4 / (e^θ₀ + 1). */
const J2 = (t: number) => (Math.exp(t) - 0.4) / (Math.exp(t) + 1);

/** One draw at each of N settings of θ₀: a reward of 1 when it lands on 56, else 0. */
const N = 41;
const SET = Array.from({ length: N }, (_, i) => -3 + (6 * i) / (N - 1));
const ONE = (() => {
  const rng = new Rng(11);
  return SET.map((t) => (rng.next() < p56(t) ? 1 : 0));
})();
/** Two neighbouring settings nearest θ₀ = 0 whose single draws disagree. */
const PAIR = (() => {
  let best = 0;
  for (let i = 0; i < N - 1; i++) if (ONE[i] !== ONE[i + 1] && Math.abs(SET[i]!) < Math.abs(SET[best]!)) best = i;
  return best;
})();

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.4) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

const model: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 22);
    const yc = s.h * 0.2;
    const base = s.h * 0.56;
    s.text('7 × 8 = ?', s.w / 2, s.h * 0.07, { size: 4.4, font: 'mono', weight: 600, color: s.c('--ink') });
    // From the first beat until `reward`, a ring hops to each new draw.
    const k = Math.max(0, Math.floor((s.since('stuck') - 1.5) / 0.9));
    const drawing = s.since('stuck') > 1.5 && s.since('reward') < 0;
    const cur = DRAWS[k % DRAWS.length]!;
    ANS.forEach((a, i) => s.cell(xs[i]! - 6 * s.u, yc - 4 * s.u, 12 * s.u, 8 * s.u, a, 'purple', { on: drawing && i === cur ? 1 : 0, size: 3.6 }));
    bars(s, xs, base, PI, 'teal', { max: 1, height: 40, w: 10, fmt: f2 });
    s.alpha(after(s, 'ask', 0.8), () => rowLabel(s, 'π', xs[0]! - 9 * s.u, base - 6 * s.u, 'teal', 3.8));
    s.alpha(s.ease('theta', 0.6, 4), () => {
      rowLabel(s, 'θ', xs[0]! - 9 * s.u, base + 8 * s.u, 'blue', 3.8);
      cells(s, xs, base + 8 * s.u, TH, 'blue', { w: 12, h: 7 });
    });
    s.alpha(s.ease('reward', 0.6, 0.6), () => {
      rowLabel(s, 'R', xs[0]! - 9 * s.u, base + 18 * s.u, 'gold', 3.8);
      cells(s, xs, base + 18 * s.u, R.map(String), 'gold', { w: 10, h: 7, on: [1, 0, 0] });
    });
    const cy = s.h * 0.93;
    s.alpha(after(s, 'stuck', 0.5) * (1 - s.ease('ask', 0.5)), () => caption(s, 'a random draw: no slope to follow', cy, 'red'));
    s.alpha(after(s, 'ask', 0.75) * (1 - s.ease('reward', 0.5)), () => caption(s, 'drawn at random, as often as π says', cy, 'teal'));
    s.alpha(s.win('reward', 'theta'), () => caption(s, 'R: 1 if right, 0 if wrong', cy, 'gold'));
    s.alpha(s.ease('theta', 0.6, 4), () => caption(s, 'θ: three scores → softmax → π', cy, 'blue'));
  },
};

const P = String.raw`\sym{pi}{\pi}`;
const RR = String.raw`\sym{R}{R}`;

const average: SceneDef = {
  marks: {
    J: { tex: String.raw`J = \sum_y ${P}(y)\,${RR}(y)`, x: 0.5, y: 0.2, size: 4.8 },
    grad: { tex: String.raw`\nabla J = \sum_y ${RR}(y)\,\nabla ${P}(y)`, x: 0.5, y: 0.5, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    const F = new Frame(s, 12 * u, s.h * 0.07, s.w - 6 * u, s.h * 0.68, [-3.2, 3.2], [-0.55, 1.25]);
    const plot = 1 - s.ease('only', 0.6);
    const cy = s.h * 0.8;
    s.alpha(plot, () => {
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
      s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
      F.seg(-3.2, 1, 3.2, 1, '--axis', 0.25, [1, 1]);
      const tick = { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') } as const;
      s.text('1', F.l - 2 * u, F.Y(1), tick);
      s.text('0', F.l - 2 * u, F.Y(0), tick);
      s.text('θ₀ →', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('blue'), halo: true });
      // One draw per setting, appearing left to right; dimmed once the average arrives, gone once the rewards change.
      const shown = Math.floor(Math.min(1, Math.max(0, (s.prog('nudge') - 0.45) / 0.5)) * N + (s.since('jump') >= 0 ? N : 0));
      const dim = 1 - 0.65 * s.ease('avg', 0.8) - 0.35 * s.ease('any', 0.6);
      s.alpha(dim, () => SET.forEach((t, i) => {
        if (i < shown) F.dot(t, ONE[i]!, 'gold', 1.05);
      }));
      s.alpha(s.win('jump', 'avg') * after(s, 'jump', 0.3), () => {
        [PAIR, PAIR + 1].forEach((i) => s.circle(F.X(SET[i]!), F.Y(ONE[i]!), 2.4 * u, { stroke: s.c('red'), lw: 0.45 }));
      });
      s.alpha(s.win('nudge', 'jump') * after(s, 'nudge', 0.3), () => s.text('reward of one draw', F.l + 2 * u, F.t + 1 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold'), halo: true }));
      // The average: the expected reward, then reshaped when 64 costs a point.
      const grow = s.ease('avg', 1.6, 0.4);
      const m = s.ease('any', 1.2, 1);
      F.fn((t) => p56(t) + (J2(t) - p56(t)) * m, 'purple', 0.8, -3.2, -3.2 + 6.4 * grow);
      s.alpha(after(s, 'avg', 0.3) * (1 - s.ease('J', 0.5)), () => s.text('J: the average', F.X(2), F.Y(0.55), { size: 3.4, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
      const jv = 0.5 + (0.3 - 0.5) * m;
      s.alpha(s.ease('J', 0.6, 0.4), () => {
        F.seg(0, -0.55, 0, jv, '--ink-3', 0.3, [1, 1]);
        F.dot(0, jv, 'purple', 1.5);
        s.text(`J = ${jv.toFixed(1)}`, F.X(0) - 2.5 * u, F.Y(jv) - 3.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple'), halo: true });
      });
      s.alpha(s.win('nudge', 'jump'), () => caption(s, 'nudge θ₀, draw once at each setting', cy));
      s.alpha(s.win('jump', 'avg'), () => caption(s, 'a hair apart, and R jumps: no slope', cy, 'red'));
      s.alpha(s.win('avg', 'J'), () => caption(s, 'averaged over many draws: smooth', cy, 'purple'));
      const eq = { size: 3.4, weight: 600 } as const;
      s.alpha(s.win('J', 'any'), () => rich(s, [['J = ', 'purple'], ['0.5·1 + 0.3·0 + 0.2·0', '--ink-2'], [' = 0.5', 'purple']], s.w / 2, cy, eq));
      s.alpha(s.ease('any', 0.6), () => rich(s, [['J = ', 'purple'], ['0.5·1 + 0.3·0 + 0.2·', '--ink-2'], ['(−1)', 'gold'], [' = 0.3', 'purple']], s.w / 2, cy, eq));
    });
    cite(s, 'Williams, 1992', s.win('avg', 'J'));
    // Off the plot: J is weighted by π, its gradient as written is not.
    s.show('J', s.ease('only', 0.6, 0.3));
    s.show('grad', s.ease('only', 0.6, 1.2));
    s.alpha(s.ease('only', 0.6, 0.3) * (1 - s.ease('lost', 0.5)), () => caption(s, 'R: fixed numbers · π: moves with θ', s.h * 0.82, '--ink-2'));
    s.alpha(after(s, 'lost', 0.1), () => caption(s, 'each term weighed by π(y): an average', s.h * 0.31, 'teal', 3.2));
    s.alpha(after(s, 'lost', 0.4), () => caption(s, 'no π(y) weighs these terms', s.h * 0.62, 'red', 3.2));
  },
};

const TH0 = String.raw`\sym{theta}{\theta}_0`;
const DP = String.raw`\dfrac{\partial ${P}}{\partial ${TH0}}`;
const DL = String.raw`\dfrac{\partial \ln ${P}}{\partial ${TH0}}`;

/** The two plots, side by side and drawn to the same scale, so a slope twice as big looks twice as steep. */
function pair(s: Scene): [Frame, Frame] {
  const u = s.u;
  const l0 = 12 * u;
  const r1 = s.w - 5 * u;
  const gap = 11 * u;
  const pw = (r1 - l0 - gap) / 2;
  const t = s.h * 0.08;
  const b = s.h * 0.5;
  return [new Frame(s, l0, t, l0 + pw, b, [-2.5, 2.5], [-0.05, 1.05]), new Frame(s, l0 + pw + gap, t, r1, b, [-2.5, 2.5], [-1.15, -0.05])];
}

function box(s: Scene, F: Frame, ticks: number[], name: string, k: 'teal' | 'orange') {
  const u = s.u;
  s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
  s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
  for (const y of ticks) {
    F.seg(F.xr[0], y, F.xr[1], y, '--axis', 0.2, [0.8, 0.8]);
    s.text(String(y).replace('-', '−'), F.l - 1.5 * u, F.Y(y), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
  }
  s.text(name, F.l + 2 * u, F.t + 1.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true });
  s.text('θ₀', F.r, F.b + 3.5 * u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
}

const trick: SceneDef = {
  marks: {
    dp: { tex: String.raw`${DP} = 0.25`, x: 0.3, y: 0.73, size: 3.6 },
    dl: { tex: String.raw`${DL} = 0.5`, x: 0.72, y: 0.73, size: 3.6 },
    rule: { tex: String.raw`${DL} = \dfrac{1}{${P}}\,${DP} = \dfrac{0.25}{0.5} = 0.5`, x: 0.5, y: 0.88, size: 3.6 },
    back: { tex: String.raw`${DP} = ${P}\,${DL} = 0.5 \times 0.5 = 0.25`, x: 0.5, y: 0.88, size: 3.6 },
    trick: { tex: String.raw`\nabla ${P}(y) = ${P}(y)\,\nabla \ln ${P}(y)`, x: 0.5, y: 0.66, size: 5 },
    payoff: { tex: String.raw`\nabla J = \sum_y ${P}(y)\,${RR}(y)\,\nabla \ln ${P}(y)`, x: 0.5, y: 0.86, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const [A, B] = pair(s);
    const late = 1 - s.ease('trick', 0.6);
    // The two curves, the right one drawn in once the voice reaches it.
    box(s, A, [0, 0.5, 1], 'π(56)', 'teal');
    const ga = s.ease('two', 1.4, 2.5);
    A.fn(p56, 'teal', 0.75, -2.5, -2.5 + 5 * ga);
    s.alpha(after(s, 'two', 0.7, 0.4), () => box(s, B, [-1, -0.5], 'ln π(56)', 'orange'));
    B.fn(lnp56, 'orange', 0.75, -2.5, -2.5 + 5 * after(s, 'two', 0.72, 1.4));
    // Where θ₀ is now, and its nudge.
    s.alpha(s.ease('nudge', 0.6), () => {
      A.seg(0, -0.05, 0, 0.5, '--ink-3', 0.25, [1, 1]);
      B.seg(0, -1.15, 0, Math.log(0.5), '--ink-3', 0.25, [1, 1]);
      A.dot(0, 0.5, 'teal', 1.3);
      B.dot(0, Math.log(0.5), 'orange', 1.3);
    });
    s.alpha(s.win('nudge', 'dpi'), () => {
      [A, B].forEach((F) => {
        s.arrow(F.X(0) + 1.5 * u, F.b - 2.5 * u, F.X(0) + 9 * u, F.b - 2.5 * u, s.c('blue'), 0.45, 1.6);
        s.text('+0.01', F.X(0) + 10 * u, F.b - 2.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('blue'), halo: true });
      });
    });
    // The tangents: slope 0.25 on the left, 0.5 on the right, at the same scale.
    s.alpha(s.ease('dpi', 0.8, 0.8) * late, () => A.clip(() => A.seg(-1.1, 0.5 - 1.1 * 0.25, 1.1, 0.5 + 1.1 * 0.25, 'gold', 0.55)));
    s.alpha(s.ease('dlog', 0.8, 0.8) * late, () => B.clip(() => B.seg(-1.1, Math.log(0.5) - 1.1 * 0.5, 1.1, Math.log(0.5) + 1.1 * 0.5, 'gold', 0.55)));
    const mono = { size: 3.1, font: 'mono', weight: 600, halo: true } as const;
    const ax = (A.l + A.r) / 2;
    const bx = (B.l + B.r) / 2;
    s.alpha(after(s, 'nudge', 0.4) * late, () => s.text('0.5 → 0.5025', ax, s.h * 0.58, { ...mono, color: s.c('teal') }));
    s.alpha(after(s, 'nudge', 0.6) * late, () => s.text('−0.693 → −0.688', bx, s.h * 0.58, { ...mono, color: s.c('orange') }));
    s.alpha(s.ease('dpi', 0.6) * late, () => s.text('+0.0025', ax, s.h * 0.64, { ...mono, color: s.c('teal') }));
    s.alpha(s.ease('dlog', 0.6) * late, () => s.text('+0.005', bx, s.h * 0.64, { ...mono, color: s.c('orange') }));
    s.show('dp', after(s, 'dpi', 0.6) * late);
    s.show('dl', after(s, 'dlog', 0.6) * late);
    // Why twice: growth relative to size.
    s.alpha(s.win('why', 'rule'), () => {
      caption(s, '0.0025 is 0.5% of 0.5', s.h * 0.84, 'teal', 3.2);
      s.alpha(after(s, 'why', 0.55), () => caption(s, 'ln π grows by that fraction: 0.005', s.h * 0.91, 'orange', 3.2));
    });
    s.show('rule', s.win('rule', 'trick'));
    s.show('back', s.win('trick', 'payoff'));
    s.show('trick', s.ease('trick', 0.6, 0.3));
    s.show('payoff', s.ease('payoff', 0.6, 0.3));
  },
};

const PY = String.raw`${P}(y)`;
const DPY = String.raw`\dfrac{\partial ${PY}}{\partial ${TH0}}`;
const DLY = String.raw`\dfrac{\partial \ln ${PY}}{\partial ${TH0}}`;

const tryIt: SceneDef = {
  marks: {
    pi: { tex: String.raw`${PY} = 0.2`, x: 0.5, y: 0.14, size: 4.6 },
    dp: { tex: String.raw`${DPY} = 0.16`, x: 0.5, y: 0.3, size: 4.4 },
    ask: { tex: String.raw`${DLY} = \ ?`, x: 0.5, y: 0.5, size: 4.4 },
    ans: { tex: String.raw`${DLY} = \dfrac{1}{${PY}}\,${DPY} = \dfrac{0.16}{0.2} = 0.8`, x: 0.5, y: 0.5, size: 3.8 },
  },
  draw(s) {
    s.show('pi', s.ease('p1', 0.6, 0.3));
    s.show('dp', s.ease('p1', 0.6, 2.5));
    s.show('ask', after(s, 'p1', 0.7) * (1 - s.ease('a1', 0.4)));
    s.show('ans', after(s, 'a1', 0.05));
    s.alpha(after(s, 'a1', 0.05), () => s.text('slope of ln u = 1/u: divide by π', s.w / 2, s.h * 0.66, { size: 3.2, color: s.c('--ink-3') }));
    s.alpha(after(s, 'a1', 0.45), () => rich(s, [['∂ln π/∂θ₀ = ', '--ink-2'], ['0.8', 'green']], s.w / 2, s.h * 0.78, { size: 3.8, weight: 650 }));
    s.alpha(after(s, 'a1', 0.7), () => s.text('small π: a steep log', s.w / 2, s.h * 0.88, { size: 3.2, font: 'mono', color: s.c('orange') }));
  },
};

export const scenes: Record<string, SceneDef> = { model, average, trick, try: tryIt };
