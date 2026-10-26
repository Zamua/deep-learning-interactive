import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { clean, traps } from '../kit';

/** Mean-0 values spread evenly over a symmetric set: the set, then whether its std is a whole number. */
const SETS: [number[], boolean][] = [
  [[-3, 0, 3], false],
  [[-6, 0, 6], false],
  [[-1.5, 0, 1.5], false],
  [[-7, -1, 1, 7], true],
  [[-14, -2, 2, 14], true],
  [[-3, -1, 1, 3], false],
  [[-4, -2, 2, 4], false],
  [[-21, -3, 3, 21], true],
];

const list = (xs: readonly number[]): string => (xs.length === 2 ? `$${num(xs[0]!)}$ or $${num(xs[1]!)}$` : `${xs.slice(0, -1).map((x) => `$${num(x)}$`).join(', ')} or $${num(xs.at(-1)!)}$`);

/** Pairs of term counts whose ratio has a whole square root. */
const COUNTS: [number, number][] = [[25, 100], [4, 16], [9, 81], [16, 64], [100, 400], [10, 90], [4, 100], [2, 50], [100, 10000]];

export const generators: Generator[] = [
  {
    id: 'sum-variance',
    make(rng, d) {
      const kind = d < 0.35 ? rng.int(2) : d < 0.7 ? rng.int(3) : 2;
      if (kind === 0) {
        const n = pick(rng, [2, 3, 4, 5, 10, 50, 100]);
        const v = pick(rng, [1, 2, 3, 0.5, 4]);
        const want = clean(n * v);
        return {
          prompt: `$z$ is the sum of ${n} independent terms, each with mean 0 and variance ${num(v)}. What is the variance of $z$?`,
          answer: { kind: 'number', value: want },
          traps: traps(want, [
            { value: v, why: 'That is one term\'s variance. Every independent term adds its own.' },
            { value: Math.sqrt(n) * v, why: 'The variances add up, $n$ of them. It is the standard deviation that grows like $\\sqrt{n}$.' },
            { value: n * n * v, why: `Independent variances add: $${n} \\times ${num(v)}$, not $${n}^2 \\times ${num(v)}$.` },
          ]),
          solution: [`For independent terms the variances add: the variance of $z$ is $${n} \\times ${num(v)} = ${num(want)}$.`],
        };
      }
      if (kind === 1) {
        const n = pick(rng, [4, 9, 16, 25, 100, 400]);
        const sd = pick(rng, [1, 2, 0.5, 3]);
        const want = clean(Math.sqrt(n) * sd);
        return {
          prompt: `$z$ is the sum of ${n} independent terms, each with mean 0 and standard deviation ${num(sd)}. What is the standard deviation of $z$?`,
          answer: { kind: 'number', value: want },
          traps: traps(want, [
            { value: n * sd, why: 'Standard deviations do not add; variances do. The sum\'s variance is $n$ times as big, so its standard deviation is $\\sqrt{n}$ times as big.' },
            { value: n * sd * sd, why: 'That is the variance of the sum. Take its square root.' },
            { value: sd, why: 'That is one term\'s. The sum spreads wider as terms pile up.' },
          ]),
          solution: [
            `Square the standard deviation: each term has variance $${num(sd)}^2 = ${num(clean(sd * sd))}$.`,
            `For independent terms the variances add: $${n} \\times ${num(clean(sd * sd))} = ${num(clean(n * sd * sd))}$.`,
            `The standard deviation is the square root: $\\sqrt{${num(clean(n * sd * sd))}} = ${num(want)}$, which is $\\sqrt{${n}} = ${Math.sqrt(n)}$ times one term's.`,
          ],
        };
      }
      const n = pick(rng, [25, 100, 400, 2500]);
      const s = pick(rng, [1, 0.1, 0.01, 0.2, 0.5]);
      const want = clean(Math.sqrt(n) * s);
      return {
        prompt: `A unit computes $z = \\symw \\cdot \\symx$ over $n = ${n}$ inputs. Each input has mean 0 and variance 1, and each weight is drawn independently with mean 0 and standard deviation ${num(s)}. What is the standard deviation of $z$?`,
        answer: { kind: 'number', value: want },
        traps: traps(want, [
          { value: n * s, why: 'Standard deviations do not add; variances do. Add the $n$ variances, then take the square root.' },
          { value: n * s * s, why: 'That is the variance of $z$. Take its square root.' },
          { value: s, why: 'That is one weight\'s. The sum of $n$ terms spreads $\\sqrt{n}$ times wider.' },
        ]),
        solution: [
          `Square the weight's standard deviation for its variance: $${num(s)}^2 = ${num(clean(s * s))}$.`,
          `Each term $\\symw_i \\symx_i$ has the weight's variance times the input's: $${num(clean(s * s))} \\times 1 = ${num(clean(s * s))}$.`,
          `The ${n} variances add: $${n} \\times ${num(clean(s * s))} = ${num(clean(n * s * s))}$.`,
          `So the standard deviation is $\\sqrt{${num(clean(n * s * s))}} = ${num(want)}$.`,
        ],
      };
    },
  },
  {
    id: 'variance',
    make(rng, d) {
      const many = d >= 0.35 && rng.next() < 0.6;
      const [xs, whole] = many ? pick(rng, d < 0.7 ? SETS.slice(0, 5) : SETS) : (() => {
        const a = pick(rng, d < 0.35 ? [1, 2, 3, 4, 5] : [2, 3, 5, 0.5, 10, 0.1, 0.3]);
        return [[-a, a], true] as [number[], boolean];
      })();
      const askStd = whole && rng.next() < 0.5;
      const sqs = xs.map((x) => clean(x * x));
      const total = clean(sqs.reduce((p, q) => p + q, 0));
      const variance = clean(total / xs.length);
      const std = clean(Math.sqrt(variance));
      const want = askStd ? std : variance;
      const meanAbs = clean(xs.reduce((p, x) => p + Math.abs(x), 0) / xs.length);
      return {
        prompt: `A value is ${list(xs)}, each equally often. What is its ${askStd ? 'standard deviation' : 'variance'}?`,
        answer: { kind: 'number', value: want },
        traps: traps(want, askStd
          ? [
              { value: variance, why: 'That is the variance. The standard deviation is its square root.' },
              { value: meanAbs, why: 'That averages the distances from the mean. The standard deviation is the square root of the average squared distance.' },
            ]
          : [
              { value: std, why: 'That is the standard deviation. The variance is the average squared distance, its square.' },
              { value: meanAbs, why: 'That averages the distances from the mean. Square each distance before averaging.' },
              { value: total, why: 'That adds the squared distances without averaging them. Divide by how many values there are.' },
            ].filter((t) => t.value > 0)),
        solution: [
          'The values are balanced around 0, so the mean is 0.',
          `The squared distances from 0: $${sqs.map((v) => num(v)).join(',\\ ')}$.`,
          `Their average: $(${sqs.map((v) => num(v)).join(' + ')}) / ${xs.length} = ${num(total)} / ${xs.length} = ${num(variance)}$: the variance.`,
          ...(askStd ? [`The standard deviation is its square root: $\\sqrt{${num(variance)}} = ${num(std)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'grows',
    make(rng) {
      const [n1, n2] = pick(rng, COUNTS);
      const r = n2 / n1;
      const k = Math.sqrt(r);
      const v = pick(rng, [1, 2, 0.5, 4]);
      const opts = [`$${k}$ times as large`, `$${r}$ times as large`, 'The same', `$${k}$ times smaller`];
      const why = [
        null,
        `That is how the variance grows. The standard deviation is its square root: $\\sqrt{${r}} = ${k}$ times.`,
        `Each term has the same spread, but every independent term adds its variance: $z_2$ has $${r}$ times the variance of $z_1$.`,
        'That holds for an average, which divides by the count. A sum keeps every term, so its spread grows with the count.',
      ];
      return {
        prompt: `$z_1$ adds up ${n1} independent terms and $z_2$ adds up ${n2}, every term with mean 0 and variance ${num(v)}. How does the standard deviation of $z_2$ compare with that of $z_1$?`,
        answer: { kind: 'choice', options: opts, correct: 0, why },
        solution: [
          `Variances add: $z_1$ has variance $${n1} \\times ${num(v)} = ${num(clean(n1 * v))}$, and $z_2$ has $${n2} \\times ${num(v)} = ${num(clean(n2 * v))}$.`,
          `So $z_2$'s variance is $${num(clean(n2 * v))} / ${num(clean(n1 * v))} = ${r}$ times $z_1$'s.`,
          `The standard deviation is the square root of the variance, so it grows $\\sqrt{${r}} = ${k}$ times.`,
        ],
      };
    },
  },
];
