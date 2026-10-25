import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { rich } from '../draw';

const ANS = ['56', '54', '64'];
const PI = [0.5, 0.3, 0.2];
const R = [1, 0, 0];
/** The policy after one step of 0.5 along R ∇log π for the answer 56, with R = 1 and R = -1. */
const after = (r: number) => {
  const e = PI.map((p, i) => p * Math.exp(0.5 * r * ((i === 0 ? 1 : 0) - p)));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const UP = after(1);
const DOWN = after(-1);
/** The answers a run of draws picks, seeded so every viewing shows the same run. */
const DRAWS = [0, 1, 0, 2, 0, 0, 1, 0, 2, 1];
const f2 = (v: number) => v.toFixed(2);

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

const trick: SceneDef = {
  marks: {
    sum: { tex: String.raw`J = \sum_y \sym{pi}{\pi}(y)\,\sym{R}{R}(y)`, x: 0.5, y: 0.1, size: 4.6 },
    trick: { tex: String.raw`\nabla \sym{pi}{\pi}(y) = \sym{pi}{\pi}(y)\,\nabla \ln \sym{pi}{\pi}(y)`, x: 0.5, y: 0.3, size: 4.6 },
    avg: { tex: String.raw`\nabla J = \sum_y \sym{pi}{\pi}(y)\,\sym{R}{R}(y)\,\nabla \ln \sym{pi}{\pi}(y)`, x: 0.5, y: 0.5, size: 4.6 },
    est: { tex: String.raw`\approx \sym{R}{R}(y)\,\nabla \ln \sym{pi}{\pi}(y),\ \ y \sim \sym{pi}{\pi}`, x: 0.5, y: 0.66, size: 4.6 },
  },
  draw(s) {
    s.show('sum', 1);
    s.alpha(s.ease('sum', 0.6, 1.5) * (1 - s.ease('trick', 0.5)), () => s.text('only π depends on θ; R is a plain number', s.w / 2, s.h * 0.19, { size: 3, color: s.c('--ink-3') }));
    s.show('trick', s.ease('trick', 0.6));
    s.alpha(s.ease('trick', 0.6, 1.5), () => s.text('since the slope of ln u is 1 / u', s.w / 2, s.h * 0.39, { size: 3, color: s.c('--ink-3') }));
    s.show('avg', s.ease('avg', 0.6));
    s.alpha(s.ease('avg', 0.6, 2.5) * (1 - s.ease('est', 0.5)), () => s.text('a π-weighted average: estimate it from samples', s.w / 2, s.h * 0.59, { size: 3, color: s.c('--ink-3') }));
    s.show('est', s.ease('est', 0.6));
    s.alpha(s.ease('eg', 0.6), () => {
      const xs = columns(s, 3, 15);
      const y = s.h * 0.85;
      ANS.forEach((a, i) => s.text(a, xs[i]!, y - 7.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      cells(s, xs, y, ['0.5', '-0.3', '-0.2'], 'red', { w: 12, h: 7.5, on: [1, 0, 0] });
      s.text('R ∇ln π(56)', xs[0]! - 8 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('red') });
    });
  },
};

const push: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = -\sym{R}{R}\,\ln \sym{pi}{\pi}(y)`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
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
    s.show('loss', s.ease('loss', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { sample, trick, push };
