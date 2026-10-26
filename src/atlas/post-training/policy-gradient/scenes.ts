import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { bars, cells, columns, rowLabel } from '../../draw';
import { rich } from '../draw';

const ANS = ['56', '54', '64'];
const PI = [0.5, 0.3, 0.2];
const R = [1, 0, 0];
/** The policy after one step of 0.5 along R ∇log π for the answer 56, with R = 1 and R = -1. */
const after1 = (r: number) => {
  const e = PI.map((p, i) => p * Math.exp(0.5 * r * ((i === 0 ? 1 : 0) - p)));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const UP = after1(1);
const DOWN = after1(-1);
/** The answers a run of draws picks, seeded so every viewing shows the same run: 56 five times in ten. */
const DRAWS = [0, 1, 0, 2, 0, 0, 1, 0, 2, 1];
/** ∇ln π for each answer of the 7 × 8 model: one-hot minus π. */
const GL = ANS.map((_, y) => PI.map((p, i) => Math.round(((i === y ? 1 : 0) - p) * 10) / 10));
// The worked problems: 54 with R = -1, then averaged with 56 with R = 1.
const E1 = GL[1]!.map((g) => -g);
const E2 = GL[0]!;
const SUM = E1.map((v, i) => Math.round((v + E2[i]!) * 10) / 10);
const AVG = SUM.map((v) => v / 2);
const f2 = (v: number) => v.toFixed(2);
const f1 = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v < 0 ? `−${-v}` : String(v));

/** Answers as chips over their probability bars. */
function answers(s: Scene, xs: number[], yc: number, base: number, p: number[], o: { on?: number[]; height?: number; labels?: boolean } = {}): void {
  ANS.forEach((a, i) => s.cell(xs[i]! - 6 * s.u, yc - 4 * s.u, 12 * s.u, 8 * s.u, a, 'purple', { on: o.on?.[i] ?? 0, size: 3.6 }));
  bars(s, xs, base, p, 'teal', { max: 1, height: o.height ?? 34, w: 10, fmt: o.labels === false ? undefined : f2 });
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

const avg: SceneDef = {
  marks: {
    avg: { tex: String.raw`\nabla J = \sum_y ${P}(y)\,\sym{R}{R}(y)\,\nabla\ln ${P}(y)`, x: 0.5, y: 0.08, size: 4.4 },
    t0: { tex: String.raw`= 0.5 \cdot 1 \cdot \nabla\ln ${P}(56)`, x: 0.5, y: 0.19, size: 4 },
    t1: { tex: String.raw`+\ 0.3 \cdot 0 \cdot \nabla\ln ${P}(54)`, x: 0.5, y: 0.27, size: 4 },
    t2: { tex: String.raw`+\ 0.2 \cdot 0 \cdot \nabla\ln ${P}(64)`, x: 0.5, y: 0.35, size: 4 },
    est: { tex: String.raw`\nabla J \approx \sym{R}{R}(y)\,\nabla \ln ${P}(y),\ \ y \sim ${P}`, x: 0.5, y: 0.7, size: 4.4 },
  },
  draw(s) {
    s.show('avg', 1);
    const zeros = 1 - 0.6 * s.ease('draws', 0.6);
    s.show('t0', after(s, 'avg', 0.45));
    s.show('t1', after(s, 'avg', 0.7) * zeros);
    s.show('t2', after(s, 'avg', 0.85) * zeros);
    // Ten draws: 56 lights up in five of them.
    s.alpha(s.ease('draws', 0.6, 0.4), () => {
      const n = DRAWS.length;
      const cw = 8 * s.u;
      const gap = 1.6 * s.u;
      const x0 = s.w / 2 - (n * cw + (n - 1) * gap) / 2;
      const y = s.h * 0.47;
      const shown = Math.min(n, Math.floor((s.since('draws') - 0.4) / 0.35) + 1);
      DRAWS.forEach((d, i) => {
        if (i >= shown) return;
        s.cell(x0 + i * (cw + gap), y - 3.5 * s.u, cw, 7 * s.u, ANS[d]!, 'purple', { on: d === 0 ? after(s, 'draws', 0.55) : 0, size: 2.8 });
      });
      s.alpha(after(s, 'draws', 0.55), () => s.text('56 in 5 of 10 draws: weight 0.5', s.w / 2, y + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') }));
    });
    s.show('est', s.ease('est', 0.6));
    s.alpha(s.ease('eg', 0.6), () => {
      const xs = columns(s, 3, 15);
      const y = s.h * 0.88;
      ['θ₀', 'θ₁', 'θ₂'].forEach((a, i) => s.text(a, xs[i]!, y - 7.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('blue') }));
      cells(s, xs, y, GL[0]!.map(f1), 'red', { w: 12, h: 7, on: [after(s, 'eg', 0.35) * (1 - after(s, 'eg', 0.7)), 0, 0] });
      s.text('R ∇ln π(56)', xs[0]! - 8 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('red') });
    });
  },
};

/** One worked row: a label at the left, three cells, and an optional note at the right. */
function vrow(s: Scene, xs: number[], y: number, label: string, vals: number[], k: 'teal' | 'red' | 'green', o: { note?: string; on?: number } = {}): void {
  cells(s, xs, y, vals.map(f1), k, { w: 11, h: 7, on: vals.map(() => o.on ?? 0) });
  s.text(label, xs[0]! - 7.5 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
  if (o.note) s.text(o.note, xs[2]! + 7.5 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
}

const push: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = -\sym{R}{R}\,\ln ${P}(y)`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
    const gone = 1 - s.ease('p1', 0.6);
    s.alpha(gone, () => {
      const xs = columns(s, 3, 22);
      const yc = s.h * 0.12;
      const base = s.h * 0.66;
      const up = s.ease('up', 1.2, 0.8);
      const back = s.ease('zero', 0.8);
      const down = s.ease('neg', 1.2, 0.6);
      const p = PI.map((v, i) => v + (UP[i]! - v) * up * (1 - back) + (DOWN[i]! - v) * down);
      // The starting probabilities stay as dashed outlines.
      const H = 50;
      xs.forEach((x, i) => {
        const hh = PI[i]! * H * s.u;
        s.ctx.save();
        s.ctx.setLineDash([1 * s.u, 0.8 * s.u]);
        s.rrect(x - 5 * s.u, base - hh, 10 * s.u, hh, 1, { stroke: s.tint('teal', 0.7), lw: 0.25 });
        s.ctx.restore();
      });
      answers(s, xs, yc, base, p, { on: [1, 0, 0], height: H, labels: false });
      // Values above the taller of the bar and its starting outline.
      xs.forEach((x, i) => s.text(f2(p[i]!), x, base - Math.max(p[i]!, PI[i]!) * H * s.u - 3.2 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal'), halo: true }));
      const label = (t: string, k: 'green' | 'slate' | 'red', a: number) => s.alpha(a, () => s.text(t, s.w / 2, s.h * 0.76, { size: 3.4, font: 'mono', weight: 600, color: s.c(k) }));
      label('sampled 56, R = 1: pushed up', 'green', s.win('up', 'zero'));
      label('R = 0: the estimate is zero', 'slate', s.win('zero', 'neg'));
      label('R = −1: pushed down', 'red', s.ease('neg', 0.6));
    });
    s.show('loss', s.ease('loss', 0.6) * gone);
    // The worked problems: one sample's estimate, then the average of two.
    const xs = columns(s, 3, 13);
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      s.text('sampled 54', s.w / 2, s.h * 0.08, { size: 3.2, font: 'mono', weight: 600, color: s.c('purple') });
      vrow(s, xs, s.h * 0.19, '∇ln π(54)', GL[1]!, 'teal', { note: 'R = −1' });
      s.alpha(after(s, 'p1', 0.8) * (1 - after(s, 'a1', 0, 0.3)), () => s.text('estimate?', s.w / 2, s.h * 0.3, { size: 3, color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.15), () => {
      xs.forEach((x) => s.text('× −1', x, s.h * 0.255, { size: 2.6, font: 'mono', color: s.c('gold'), halo: true }));
      vrow(s, xs, s.h * 0.33, 'R ∇ln π', E1, 'red', { on: 1 - after(s, 'p2', 0) });
    });
    s.alpha(after(s, 'a1', 0.7) * (1 - s.ease('p2', 0.5)), () => s.text('points where 54 gets less likely', s.w / 2, s.h * 0.43, { size: 3, color: s.c('--ink-3') }));
    s.alpha(s.ease('p2', 0.6, 0.3), () => {
      vrow(s, xs, s.h * 0.47, 'R ∇ln π(56)', E2, 'red', { note: 'R = 1' });
    });
    s.alpha(after(s, 'a2', 0.1), () => {
      s.line(xs[0]! - 6 * s.u, s.h * 0.545, xs[2]! + 6 * s.u, s.h * 0.545, s.c('--axis'), 0.35);
      vrow(s, xs, s.h * 0.61, 'sum', SUM, 'red');
    });
    s.alpha(after(s, 'a2', 0.5), () => {
      xs.forEach((x) => s.text('÷ 2', x, s.h * 0.685, { size: 2.6, font: 'mono', color: s.c('--ink-3'), halo: true }));
      vrow(s, xs, s.h * 0.76, 'average', AVG, 'green', { on: 1 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { sample, trick, avg, push };
