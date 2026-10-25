import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, vec } from '../../kit';
import { clean, minus, nonzero, paren, sum, sumTex, tenth, traps, vtraps } from '../kit';

/** Weights: small whole numbers at first, then negatives, then tenths. */
function weights(rng: Rng, n: number, d: number): number[] {
  if (d < 0.35) return ints(rng, n, 0, 3);
  if (d < 0.7) return ints(rng, n, -3, 3);
  for (;;) {
    const w = Array.from({ length: n }, () => tenth(rng, -1.5, 1.5));
    if (new Set(w).size > 1) return w;
  }
}

const lams = (rng: Rng, d: number) => pick(rng, d < 0.35 ? [0.1, 0.5, 1] : d < 0.7 ? [0.01, 0.05, 0.1, 0.2] : [0.001, 0.01, 0.05, 0.1]);
const sq = (w: readonly number[]) => sum(w.map((x) => x * x));
const squares = (w: readonly number[]) => w.map((x) => `${paren(x)}^2`).join(' + ');
const penaltyTex = '\\symlam \\sum_i \\symw_i^2';

export const generators: Generator[] = [
  {
    id: 'penalty',
    make(rng, d) {
      const n = d < 0.35 ? 2 : d < 0.7 ? 3 : 4;
      const w = weights(rng, n, d);
      const lam = lams(rng, d);
      const S = sq(w);
      const R = clean(lam * S);
      const data = d >= 0.5 && rng.next() < 0.5 ? pick(rng, [0.42, 0.87, 1.05, 1.31, 2.04]) : null;
      const v = data === null ? R : clean(data + R);
      const absSum = sum(w.map(Math.abs));
      return {
        prompt: `The weights are $\\symw = ${vec(w)}$ and the regularization strength is $\\symlam = ${num(lam)}$. ${data === null ? `What is the L2 penalty $${penaltyTex}$?` : `The data loss is $${num(data)}$. What is the full loss, the data loss plus $${penaltyTex}$?`}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: data === null ? S : data + S, why: 'That leaves out $\\symlam$: the sum of squares is multiplied by the regularization strength.' },
          { value: (data ?? 0) + lam * absSum, why: 'That adds up the sizes $|\\symw_i|$, which is the L1 penalty. L2 squares each weight.' },
          { value: (data ?? 0) + lam * sum(w) ** 2, why: 'That squares the sum of the weights. L2 squares each weight first, then adds.' },
          ...(data === null ? [] : [{ value: R, why: 'That is the penalty alone. The full loss adds it to the data loss.' }]),
        ]),
        solution: [
          `Square each weight and add: $${squares(w)} = ${sumTex(w.map((x) => clean(x * x)))} = ${num(S)}$.`,
          `Times $\\symlam$: $${num(lam)} \\times ${num(S)} = ${num(R)}$.`,
          ...(data === null ? [] : [`Add the data loss: $${num(data)} + ${num(R)} = ${num(v)}$.`]),
        ],
      };
    },
  },
  {
    id: 'gradient',
    make(rng, d) {
      const n = d < 0.35 ? 2 : 3;
      const w = weights(rng, n, d);
      const lam = lams(rng, d);
      const pen = w.map((x) => clean(2 * lam * x));
      const withData = d >= 0.5;
      const g = withData ? Array.from({ length: n }, () => (d < 0.8 ? nonzero(rng, -3, 3) : tenth(rng, -2, 2))) : [];
      const v = withData ? pen.map((p, i) => clean(g[i]! + p)) : pen;
      const plus = (u: number[]) => (withData ? u.map((x, i) => clean(x + g[i]!)) : u);
      return {
        prompt: withData
          ? `The weights are $\\symw = ${vec(w)}$ with $\\symlam = ${num(lam)}$, and the gradient of the data loss is $\\symg = ${vec(g)}$. What is the gradient of the full loss, data loss plus $${penaltyTex}$?`
          : `The weights are $\\symw = ${vec(w)}$ and $\\symlam = ${num(lam)}$. What is the gradient of the L2 penalty $${penaltyTex}$ with respect to $\\symw$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: plus(w.map((x) => lam * x)), why: 'That is $\\symlam\\symw$: the 2 from differentiating $\\symw^2$ is missing. The gradient of $\\symlam\\symw^2$ is $2\\symlam\\symw$.' },
          { value: plus(w.map((x) => 2 * x)), why: 'That is $2\\symw$, without $\\symlam$. The penalty is scaled by $\\symlam$, and so is its gradient.' },
          { value: plus(w.map((x) => lam * x * x)), why: 'That is each weight\'s penalty, $\\symlam\\symw_i^2$, not its slope.' },
          ...(withData ? [{ value: g, why: 'That is the data gradient alone. The penalty adds $2\\symlam\\symw$ to it.' }, { value: pen, why: 'That is the penalty\'s gradient alone. Add the data gradient to it.' }] : []),
        ]),
        solution: [
          'Each weight appears once in the penalty, as $\\symlam\\symw_i^2$, whose slope is $2\\symlam\\symw_i$.',
          `So the penalty's gradient is $2\\symlam\\symw = ${num(clean(2 * lam))} \\times ${vec(w)} = ${vec(pen)}$.`,
          ...(withData ? [`Add the data gradient entry by entry: $${vec(g)} + ${vec(pen)} = ${vec(v)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'decay-step',
    make(rng, d) {
      const flat = d < 0.35;
      const w = d < 0.7 ? (flat ? int(rng, 1, 5) : nonzero(rng, -5, 5)) : tenth(rng, -3, 3);
      const g = flat ? 0 : d < 0.7 ? nonzero(rng, -4, 4) : tenth(rng, -2, 2);
      const eta = pick(rng, flat ? [0.1, 0.5, 1] : [0.1, 0.2, 0.5]);
      const lam = pick(rng, flat ? (eta === 1 ? [0.1, 0.25] : [0.1, 0.25, 0.5]) : [0.01, 0.05, 0.1, 0.5]);
      const full = clean(g + 2 * lam * w);
      const v = clean(w - eta * full);
      return {
        prompt: flat
          ? `A weight is at $\\symw = ${num(w)}$, where the data loss is flat: its gradient is $0$. With the L2 penalty $\\symlam\\symw^2$, $\\symlam = ${num(lam)}$ and learning rate $\\symeta = ${num(eta)}$, where is $\\symw$ after one gradient step?`
          : `A weight is at $\\symw = ${num(w)}$ and the gradient of the data loss there is $\\symg = ${num(g)}$. With the L2 penalty $\\symlam\\symw^2$, $\\symlam = ${num(lam)}$ and $\\symeta = ${num(eta)}$, where is $\\symw$ after one step of $\\symw \\leftarrow \\symw - \\symeta(\\symg + 2\\symlam\\symw)$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(flat ? [] : [{ value: w - eta * g, why: 'That leaves out the penalty: the step uses $\\symg + 2\\symlam\\symw$, not $\\symg$ alone.' }]),
          { value: w - eta * (g + lam * w), why: 'That uses $\\symlam\\symw$ for the penalty\'s slope. The slope of $\\symlam\\symw^2$ is $2\\symlam\\symw$.' },
          { value: w + eta * full, why: 'That steps uphill. The update subtracts $\\symeta$ times the gradient.' },
          ...(flat ? [{ value: w, why: 'The data gradient is 0, but the penalty\'s is not: $2\\symlam\\symw$ still pulls the weight toward 0.' }] : [{ value: w - eta * 2 * lam * w, why: 'That leaves out the data gradient $\\symg$: the step uses both.' }]),
        ]),
        solution: [
          `The full gradient is $\\symg + 2\\symlam\\symw = ${num(g)} + 2 \\times ${num(lam)} \\times ${paren(w)} = ${num(full)}$.`,
          `The step: $\\symeta \\times ${paren(full)} = ${num(clean(eta * full))}$.`,
          `$\\symw \\leftarrow ${minus(w, clean(eta * full))} = ${num(v)}$.`,
          ...(flat ? [`With no data gradient, each step multiplies $\\symw$ by $1 - 2\\symeta\\symlam = ${num(clean(1 - 2 * eta * lam))}$: weight decay.`] : []),
        ],
      };
    },
  },
  {
    id: 'prefer',
    make(rng, d) {
      let x: number[];
      let wa: number[];
      let wb: number[];
      if (d < 0.35) {
        const n = pick(rng, [2, 3, 4]);
        const S = pick(rng, n === 3 ? [3, 6] : n === 2 ? [1, 2, 3, 4] : [1, 2, 4]);
        const k = rng.int(n);
        x = Array.from({ length: n }, () => 1);
        const conc = x.map((_, i) => (i === k ? S : 0));
        const spread = x.map(() => clean(S / n));
        [wa, wb] = rng.next() < 0.5 ? [conc, spread] : [spread, conc];
      } else {
        const n = d < 0.7 ? 3 : 4;
        for (;;) {
          x = ints(rng, n, 1, 3);
          wa = ints(rng, n, d < 0.7 ? 0 : -1, 3);
          wb = ints(rng, n, d < 0.7 ? 0 : -1, 3);
          const da = sum(wa.map((w, i) => w * x[i]!));
          if (!(da > 0 && da === sum(wb.map((w, i) => w * x[i]!)) && Math.abs(sq(wa) - sq(wb)) >= 2)) continue;
          // The cheaper vector must also be the more spread out one: a smaller largest weight, and no fewer in use.
          const [lo, hi] = sq(wa) < sq(wb) ? [wa, wb] : [wb, wa];
          const top = (w: number[]) => Math.max(...w.map(Math.abs));
          const used = (w: number[]) => w.filter((v) => v !== 0).length;
          if (top(lo) < top(hi) && used(lo) >= used(hi)) break;
        }
      }
      const score = sum(wa.map((w, i) => w * x[i]!));
      const [A, B] = [sq(wa), sq(wb)];
      const correct = A < B ? 0 : 1;
      const big = correct === 0 ? 'b' : 'a';
      return {
        prompt: `Two weight vectors give the input $\\symx = ${vec(x)}$ the same score, $\\symw \\cdot \\symx = ${num(score)}$: $\\symw_a = ${vec(wa)}$ and $\\symw_b = ${vec(wb)}$. With an L2 penalty added to the loss, which one does training prefer?`,
        answer: {
          kind: 'choice',
          options: ['$\\symw_a$', '$\\symw_b$', 'Neither: with the same score the loss is the same'],
          correct,
          why: whyList(correct, big, A, B),
        },
        solution: [
          `Both scores are $${num(score)}$, so the data loss ties.`,
          `The penalties differ: $\\sum \\symw_a^2 = ${squares(wa)} = ${num(A)}$ and $\\sum \\symw_b^2 = ${squares(wb)} = ${num(B)}$.`,
          `$\\symw_${correct === 0 ? 'a' : 'b'}$ costs less, so L2 prefers it. Squaring makes large weights expensive, so L2 favors weight spread over many inputs.`,
        ],
      };
    },
  },
];

function whyList(correct: number, big: string, A: number, B: number): (string | null)[] {
  const wrong = `Its penalty is $\\symlam \\times ${num(Math.max(A, B))}$ against $\\symlam \\times ${num(Math.min(A, B))}$ for $\\symw_${big === 'a' ? 'b' : 'a'}$. Squaring makes one large weight cost more than the same score spread over many small ones.`;
  const tie = `The data loss ties, but the penalty does not: $\\sum \\symw^2$ is ${num(A)} for $\\symw_a$ and ${num(B)} for $\\symw_b$.`;
  return [correct === 0 ? null : wrong, correct === 1 ? null : wrong, tie];
}
