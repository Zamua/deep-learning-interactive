import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { clean, traps } from '../kit';

/** Decimals that show `v` to two significant figures. */
const sigPlaces = (v: number) => Math.max(2, 1 - Math.floor(Math.log10(Math.abs(v))));

/** `3 \times 10^{-8}` for small numbers, plain decimals from 0.01 up. */
function sci(v: number): string {
  if (v >= 0.01) return num(v);
  const e = Math.floor(Math.log10(v) + 1e-9);
  const m = round(v / 10 ** e, 1);
  return `${m === 1 ? '' : `${num(m)} \\times `}10^{${e}}`;
}

const REL = '\\dfrac{|a - n|}{\\max(|a|, |n|)}';
const VERDICTS = ['Almost certainly right', 'Suspicious: worth a closer look', 'Almost certainly a bug'];

export const generators: Generator[] = [
  {
    id: 'centered',
    make(rng, d) {
      const cubic = d >= 0.7 && rng.int(2) === 0;
      const h = d < 0.35 ? 0.1 : cubic || d < 0.85 ? 0.01 : 0.001;
      const a = cubic ? pick(rng, [1, 2]) : pick(rng, d < 0.35 ? [1, 2, 3] : [1, 2, 3, -1, -2]);
      const b = int(rng, d < 0.35 ? 0 : -4, 4);
      const c = int(rng, 0, 5);
      const x = int(rng, d < 0.35 ? 1 : -3, 4);
      const f = (t: number) => (cubic ? a * t ** 3 : a * t * t) + b * t + c;
      const fp = round(f(x + h), 9);
      const fm = round(f(x - h), 9);
      const rise = clean(fp - fm);
      const v = clean(rise / (2 * h));
      const xp = num(clean(x + h));
      const xm = num(clean(x - h));
      return {
        prompt: `For $h = ${num(h)}$, $f(${xp}) = ${num(fp)}$ and $f(${xm}) = ${num(fm)}$. What is the centered-difference estimate of $f'(${num(x)})$? Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: rise / h, why: 'That divides by $h$. The two points are $2h$ apart, so the run is $2h$.' },
            { value: rise, why: 'That is the rise alone. Divide it by the run, $2h$.' },
            { value: -v, why: 'That subtracts in the wrong order: take $f(x + h) - f(x - h)$, the right point minus the left.' },
          ],
          2,
        ),
        solution: [
          'The centered difference is $\\dfrac{f(x + h) - f(x - h)}{2h}$: rise over run between the two points.',
          `Rise: $${num(fp)} - ${fm < 0 ? `(${num(fm)})` : num(fm)} = ${num(rise)}$.`,
          `Run: $2h = ${num(clean(2 * h))}$. So the estimate is $${num(rise)} / ${num(clean(2 * h))} ${Number.isInteger(round(v, 6)) ? '=' : '\\approx'} ${num(round(v, 2), 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'relative-error',
    make(rng, d) {
      let a: number;
      let b: number;
      if (d < 0.35) {
        a = int(rng, 2, 9);
        b = a + pick(rng, [1, -1, 2]);
      } else if (d < 0.7) {
        a = int(rng, 10, 50) / 10;
        b = clean(a + pick(rng, [0.1, -0.1, 0.2, 0.05, -0.05]));
      } else {
        a = int(rng, 20, 300) / 100 * pick(rng, [1, -1]);
        b = rng.int(6) === 0 ? -a : clean(a + pick(rng, [0.01, -0.02, 0.04, -0.05, 0.03]) * Math.sign(a));
      }
      const diff = clean(Math.abs(a - b));
      const big = Math.max(Math.abs(a), Math.abs(b));
      const v = diff / big;
      const places = sigPlaces(v);
      const ts = [
        { value: diff, why: 'That is the absolute difference. Divide by the larger size to make it relative.' },
        { value: diff / Math.min(Math.abs(a), Math.abs(b)), why: 'That divides by the smaller size. The relative error divides by the larger one.' },
      ];
      if (a < b) ts.push({ value: (a - b) / big, why: 'A relative error is a size, never negative: take the absolute value of $a - n$.' });
      const words = ['two', 'three', 'four', 'five'][places - 2];
      return {
        prompt: `Backprop gives the gradient $a = ${num(a)}$, and the centered difference gives $n = ${num(b)}$. What is their relative error? Round to ${words} decimals.`,
        answer: { kind: 'number', value: v, places },
        traps: traps(v, ts, places),
        solution: [
          `The relative error is $${REL}$.`,
          `The difference: $|a - n| = |${num(a)} - ${b < 0 ? `(${num(b)})` : num(b)}| = ${num(diff)}$.`,
          `The larger size: $\\max(|a|, |n|) = ${num(big)}$.`,
          `So the relative error is $${num(diff)} / ${num(big)} \\approx ${num(round(v, places), places)}$${v >= 0.01 ? ': far too big to be rounding, so one of the two is wrong.' : '.'}`,
        ],
      };
    },
  },
  {
    id: 'verdict',
    make(rng, d) {
      const cls = rng.int(3);
      const rel = pick(rng, cls === 0 ? [1e-8, 3e-8, 2e-9, 5e-8, 1e-7] : cls === 1 ? [1e-4, 3e-4, 5e-5, 2e-4, 6e-4] : [0.02, 0.05, 0.3, 0.01, 0.1, 0.5]);
      const shown = d >= 0.5 && rng.int(2) === 0;
      let given = `gives a relative error of $${sci(rel)}$`;
      let work = [`The relative error is $${sci(rel)}$.`];
      if (shown) {
        const a = int(rng, 200, 3000) / 1000;
        const dp = Math.max(2, Math.ceil(-Math.log10(rel * a)) + 1);
        const b = round(a * (1 + rel * pick(rng, [1, -1])), dp);
        given = `has backprop give $${num(a)}$ for one input, and the centered difference give $${num(b)}$`;
        const diff = round(Math.abs(a - b), Math.max(dp, 3));
        const dTex = diff >= 1e-3 ? num(diff) : sci(diff);
        const big = Math.max(a, b);
        work = [
          `The difference: $|a - n| = |${num(a)} - ${num(b)}| = ${dTex}$.`,
          `The larger size: $\\max(|a|, |n|) = ${num(big)}$.`,
          `The relative error: $${dTex} / ${num(big)} \\approx ${sci(Number((diff / big).toPrecision(1)))}$.`,
        ];
      }
      const why: (string | null)[] =
        cls === 0
          ? [null, 'Agreement near $10^{-7}$ or better is about as close as the arithmetic gets. Suspicion starts near $10^{-4}$.', 'A bug shows up as errors near $10^{-2}$ or more, not this small.']
          : cls === 1
            ? ['Correct gradients agree to about $10^{-7}$. This is a thousand times worse: worth a look.', null, 'A clear bug gives errors near $10^{-2}$ or more. This is much smaller: suspicious, not certainly wrong.']
            : ['The two disagree in the second digit or sooner. Correct gradients agree to about $10^{-7}$.', 'Errors of $10^{-2}$ and more mean the formula is wrong, not just imprecise.', null];
      return {
        prompt: `A gradient check ${given}. What does that say about backprop's gradient?`,
        answer: { kind: 'choice', options: [...VERDICTS], correct: cls, why },
        solution: [
          ...work,
          'Around $10^{-7}$ or less, the gradients agree. Around $10^{-4}$, be suspicious. Around $10^{-2}$ or more, there is a bug.',
          cls === 0 ? 'So backprop is almost certainly right.' : cls === 1 ? 'So it is suspicious: worth checking for a small mistake.' : 'So there is almost certainly a bug in the backward pass.',
        ],
      };
    },
  },
  {
    id: 'why-centered',
    make(rng, d) {
      const c = d < 0.5 ? 1 : pick(rng, [1, 2]);
      const b = pick(rng, d < 0.5 ? [0, 1] : [0, 1, -2, 3]);
      const x = int(rng, 1, 3);
      const h = pick(rng, [0.1, 0.01]);
      const slope = 3 * c * x * x + b;
      const one = round(slope + 3 * c * x * h + c * h * h, 6);
      const mid = round(slope + c * h * h, 6);
      const err1 = (t: number) => round(3 * c * x * t + c * t * t, 6);
      const err2 = (t: number) => round(c * t * t, 6);
      const fTex = `${c === 1 ? '' : c}x^{3}${b === 0 ? '' : b > 0 ? ` + ${b === 1 ? '' : b}x` : ` - ${-b}x`}`;
      return {
        prompt: `For $f(x) = ${fTex}$ at $x = ${x}$, the true slope is $${slope}$. With $h = ${num(h)}$, the one-sided difference gives $${num(one)}$ and the centered difference gives $${num(mid)}$. Why is the centered one so much closer?`,
        answer: {
          kind: 'choice',
          options: [
            'Its error shrinks like $h^{2}$, not $h$: the errors on the two sides cancel',
            'It takes a finer step, so its secant hugs the curve more tightly',
            'It is exact for any smooth function, whatever the step size',
            'It averages two evaluations, which cancels floating-point noise',
          ],
          correct: 0,
          why: [
            null,
            'Its points are $2h$ apart, a wider span than the one-sided $h$. Its accuracy comes from symmetry, not from a smaller step.',
            `Here it gives $${num(mid)}$, not $${slope}$: it is only exact for quadratics.`,
            'Rounding noise is tiny at this $h$. The gap is the error of the formula itself, which the symmetric points cancel.',
          ],
        },
        solution: [
          `The one-sided difference is off by $${num(one)} - ${slope} = ${num(round(one - slope, 6))}$.`,
          `The centered difference is off by $${num(mid)} - ${slope} = ${num(round(mid - slope, 6))}$: far less.`,
          `At $h = 0.1$ the two errors are $${num(err1(0.1))}$ and $${num(err2(0.1))}$; at $h = 0.01$, $${num(err1(0.01))}$ and $${num(err2(0.01))}$.`,
          'A tenth of the step cuts the one-sided error about ten times, like $h$, but the centered error a hundred times, like $h^{2}$.',
          'The centered difference is the average of a step to the right, which overshoots the slope, and a step to the left, which undershoots it by about as much. Their errors cancel.',
        ],
      };
    },
  },
];
