import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { bars, cells, columns, rowLabel } from '../../draw';
import { rich } from '../draw';

const ANS = ['56', '54', '64'];
const PI = [0.5, 0.3, 0.2];
const R = [1, 0, 0];
/** The answers a run of draws picks, seeded so every viewing shows the same run. */
const DRAWS = [0, 1, 0, 2, 0, 0, 1, 0, 2, 1];
const f2 = (v: number) => v.toFixed(2);

/** Answers as chips over their probability bars. */
function answers(s: Scene, xs: number[], yc: number, base: number, p: number[], o: { on?: number[] } = {}): void {
  ANS.forEach((a, i) => s.cell(xs[i]! - 6 * s.u, yc - 4 * s.u, 12 * s.u, 8 * s.u, a, 'purple', { on: o.on?.[i] ?? 0, size: 3.6 }));
  bars(s, xs, base, p, 'teal', { max: 1, height: 34, w: 10, fmt: f2 });
}

const sample: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 22);
    const yc = s.h * 0.24;
    const base = s.h * 0.6;
    s.text('7 × 8 = ?', s.w / 2, s.h * 0.09, { size: 4.4, font: 'mono', weight: 600, color: s.c('--ink') });
    // During `ask`, a ring hops to each new draw.
    const k = Math.max(0, Math.floor((s.since('ask') - 1.5) / 0.9));
    const drawing = s.since('ask') > 1.5 && s.since('reward') < 0;
    const cur = DRAWS[k % DRAWS.length]!;
    answers(s, xs, yc, base, PI, { on: [0, 1, 2].map((i) => (drawing && i === cur ? 1 : 0)) });
    rowLabel(s, 'π', xs[0]! - 9 * s.u, base - 6 * s.u, 'teal', 3.8);
    s.alpha(s.ease('reward', 0.6, 0.6), () => {
      rowLabel(s, 'R', xs[0]! - 9 * s.u, base + 9 * s.u, 'gold', 3.8);
      cells(s, xs, base + 9 * s.u, R.map(String), 'gold', { w: 10, h: 7, on: [1, 0, 0] });
      s.text('a number from a checker', s.w / 2, base + 16 * s.u, { size: 2.8, color: s.c('--ink-3') });
    });
    s.alpha(s.ease('goal', 0.6, 0.4), () => {
      rich(s, [['J = ', 'purple'], ['0.5·1 + 0.3·0 + 0.2·0', '--ink-2'], [' = 0.5', 'purple']], s.w / 2, s.h * 0.84, { size: 3.4, weight: 600 });
    });
    s.alpha(s.ease('stuck', 0.6, 0.6), () => {
      rich(s, [['θ → π → ', '--ink-2'], ['random draw', 'red'], [' → R', '--ink-2']], s.w / 2, s.h * 0.92, { size: 3.2 });
    });
  },
};

const P = String.raw`\sym{pi}{\pi}`;
const TH0 = String.raw`\sym{theta}{\theta}_0`;
const DP = String.raw`\dfrac{\partial ${P}}{\partial ${TH0}}`;
const DL = String.raw`\dfrac{\partial \ln ${P}}{\partial ${TH0}}`;

const trick: SceneDef = {
  marks: {
    sum: { tex: String.raw`J = \sum_y ${P}(y)\,\sym{R}{R}(y)`, x: 0.5, y: 0.08, size: 4.4 },
    grad: { tex: String.raw`\nabla J = \sum_y \sym{R}{R}(y)\,\nabla ${P}(y)`, x: 0.5, y: 0.19, size: 4.4 },
    one: { tex: String.raw`${P}(56) = 0.5`, x: 0.5, y: 0.25, size: 4.2 },
    nudge: { tex: String.raw`${TH0} + 0.01\!:\ \ ${P}(56) = 0.5025`, x: 0.5, y: 0.34, size: 4.2 },
    slope: { tex: String.raw`${DP} = \dfrac{0.0025}{0.01} = 0.25`, x: 0.5, y: 0.46, size: 3.8 },
    chain: { tex: String.raw`${DL} = \dfrac{1}{${P}}\,${DP} = \dfrac{0.25}{0.5} = 0.5`, x: 0.5, y: 0.61, size: 3.8 },
    back: { tex: String.raw`${DP} = ${P}\,${DL} = 0.5 \times 0.5 = 0.25`, x: 0.5, y: 0.76, size: 3.8 },
    trick: { tex: String.raw`\nabla ${P}(y) = ${P}(y)\,\nabla \ln ${P}(y)`, x: 0.5, y: 0.9, size: 4.6 },
  },
  draw(s) {
    const lift = s.ease('one', 0.8);
    s.show('sum', 1 - lift);
    s.show('grad', s.ease('sum', 0.6, 3), { y: 0.19 - 0.11 * lift });
    s.alpha(s.ease('sum', 0.6, 1.5) * (1 - s.ease('one', 0.5)), () => s.text('only π depends on θ; R is a plain number', s.w / 2, s.h * 0.29, { size: 3, color: s.c('--ink-3') }));
    s.show('one', s.ease('one', 0.6, 0.6));
    s.show('nudge', s.ease('nudge', 0.6));
    s.show('slope', after(s, 'nudge', 0.55));
    s.show('chain', s.ease('chain', 0.6));
    s.show('back', s.ease('back', 0.6));
    s.show('trick', s.ease('trick', 0.6));
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
    s.show('ans', after(s, 'a1', 0.3));
    s.alpha(after(s, 'a1', 0.05), () => s.text('slope of ln u = 1/u: divide by π', s.w / 2, s.h * 0.66, { size: 3.2, color: s.c('--ink-3') }));
    s.alpha(after(s, 'a1', 0.7), () => rich(s, [['∂ln π/∂θ₀ = ', '--ink-2'], ['0.8', 'green']], s.w / 2, s.h * 0.8, { size: 3.8, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { sample, trick, try: tryIt };
