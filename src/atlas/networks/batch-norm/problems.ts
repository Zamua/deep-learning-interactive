import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, round, vec } from '../../kit';
import { clean, mat, nonzero, placesFor, sum, terms, traps } from '../kit';

const P = 2;

/** The rounding instruction, only when two decimals actually round the answer. */
const round2 = (v: number): string => (placesFor(v) ? ' Round to two decimals.' : '');
const xh = '\\hat{x}';
const G = '\\symgamma';
const BETA = '\\symbeta';

/** Deviations from the mean whose variance is a perfect square, with its root. */
const PATTERNS: [number[], number][] = [
  [[-1, -1, 1, 1], 1],
  [[-2, -2, 2, 2], 2],
  [[-3, -3, 3, 3], 3],
  [[-7, -1, 1, 7], 5],
  [[-3, -1, -1, 5], 3],
  [[3, 1, 1, -5], 3],
  [[-1, -1, -1, -1, 4], 2],
  [[2, 2, 2, 2, -8], 4],
  [[-2, 2], 2],
  [[-3, 3], 3],
];

/** Variances with a clean square root, for the harder problems. */
const VARS: [number, number][] = [0.25, 0.04, 0.16, 0.36, 0.64, 1.44, 2.25, 4, 6.25, 0.09].map((v) => [v, round(Math.sqrt(v), 2)]);

/** A feature value `t` standard deviations from a mean, both printable. */
function point(rng: Rng): { mu: number; v: number; sd: number; t: number; x: number } {
  const [v, sd] = pick(rng, VARS);
  const mu = nonzero(rng, -20, 50) / 10;
  const t = pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]);
  return { mu, v, sd, t, x: clean(mu + t * sd) };
}

export const generators: Generator[] = [
  {
    id: 'mean',
    make(rng, d) {
      const B = d < 0.5 ? int(rng, 3, 4) : 4;
      const F = d < 0.5 ? 2 : 3;
      const j = rng.int(F);
      const [lo, hi] = d < 0.5 ? [0, 9] : [-5, 9];
      for (;;) {
        const X = Array.from({ length: B }, () => ints(rng, F, lo, hi));
        const col = X.map((r) => r[j]!);
        const mu = clean(sum(col) / B);
        // Whole means first; quarters once the learner is fluent.
        if (d < 0.75 && !Number.isInteger(mu)) continue;
        const ts = [
          { value: sum(col), why: `That is the sum of column ${j}. Divide by the batch size, ${B}.` },
          { value: sum(X.flat()) / (B * F), why: 'That averages every entry. Batch norm keeps one mean per feature: one column.' },
        ];
        if (j < B) ts.splice(1, 0, { value: sum(X[j]!) / F, why: `That averages row ${j}: one example's features. Batch norm averages one feature over the examples of the batch: a column.` });
        return {
          prompt: `A batch of ${B} examples with ${F} features each, one example per row:\n\n$$X = ${mat(X)}$$\n\nWhat is the batch mean $\\mu$ of feature ${j}, counting from 0?${round2(mu)}`,
          answer: { kind: 'number', value: mu, places: placesFor(mu) },
          traps: traps(mu, ts, P),
          solution: [`Feature ${j} is column ${j}: $${vec(col)}$, one value per example.`, `Its mean over the batch: $(${terms(col)}) / ${B} = ${num(sum(col))} / ${B} = ${num(round(mu, 2))}$.`],
        };
      }
    },
  },
  {
    id: 'normalize',
    make(rng, d) {
      if (d < 0.5) {
        const [devs, sd] = pick(rng, PATTERNS);
        const mu = int(rng, d < 0.25 ? 2 : -3, 8);
        const xs = rng.shuffle(devs.map((e) => mu + e));
        const k = rng.int(xs.length);
        const x = xs[k]!;
        const want = clean((x - mu) / sd);
        const varT = clean(sd * sd);
        return {
          prompt: `One feature takes the values $${vec(xs)}$ across a batch. What is $${xh}$ for $x = ${num(x)}$?${round2(want)}`,
          answer: { kind: 'number', value: want, places: placesFor(want) },
          traps: traps(want, [
            { value: (x - mu) / varT, why: 'That divides by the variance. Divide by its square root, the standard deviation.' },
            { value: x - mu, why: 'That subtracts the mean but does not divide by the standard deviation.' },
            { value: x / sd, why: 'That divides by the standard deviation but does not subtract the mean first.' },
          ], P),
          solution: [
            `The mean: $\\mu = ${num(sum(xs))} / ${xs.length} = ${mu}$.`,
            `The squared distances from it: $${vec(xs.map((v) => (v - mu) ** 2))}$, which average to $\\sigma^2 = ${varT}$, so $\\sigma = ${sd}$.`,
            `$${xh} = (x - \\mu) / \\sigma = (${num(x)} - ${mu < 0 ? `(${mu})` : mu}) / ${sd} = ${num(clean(x - mu))} / ${sd} ${round(want, 2) === want ? '=' : '\\approx'} ${num(round(want, 2))}$.`,
          ],
        };
      }
      const { mu, v, sd, x, t } = point(rng);
      return {
        prompt: `Over a batch, one feature has $\\mu = ${num(mu)}$ and $\\sigma^2 = ${num(v)}$. What is $${xh}$ for $x = ${num(x)}$?${round2(t)}`,
        answer: { kind: 'number', value: t, places: placesFor(t) },
        traps: traps(t, [
          { value: (x - mu) / v, why: 'That divides by the variance. Divide by its square root, the standard deviation.' },
          { value: x - mu, why: 'That subtracts the mean but does not divide by the standard deviation.' },
          { value: x / sd, why: 'That divides by the standard deviation but does not subtract the mean first.' },
        ], P),
        solution: [`The standard deviation is $\\sigma = \\sqrt{${num(v)}} = ${num(sd)}$.`, `$${xh} = (x - \\mu) / \\sigma = (${num(x)} - ${mu < 0 ? `(${num(mu)})` : num(mu)}) / ${num(sd)} = ${num(clean(x - mu))} / ${num(sd)} = ${num(t)}$.`],
      };
    },
  },
  {
    id: 'scale-shift',
    make(rng, d) {
      if (d < 0.5) {
        const xhat = pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]);
        const g = pick(rng, [2, 3, 4, 0.5]);
        const b = nonzero(rng, -3, 3);
        const y = clean(g * xhat + b);
        return {
          prompt: `With $${xh} = ${num(xhat)}$, $${G} = ${num(g)}$ and $${BETA} = ${num(b)}$, what is the batch-norm output $y$?`,
          answer: { kind: 'number', value: y, places: placesFor(y) },
          traps: traps(y, [
            { value: g * (xhat + b), why: `That adds $${BETA}$ before scaling. The order is scale, then shift: $${G}${xh} + ${BETA}$.` },
            { value: b * xhat + g, why: `That swaps the roles: $${G}$ is the scale that multiplies, $${BETA}$ the shift that is added.` },
            { value: xhat, why: `That is $${xh}$ itself. Scale it by $${G}$ and shift it by $${BETA}$.` },
          ], P),
          solution: [`$y = ${G}\\,${xh} + ${BETA} = ${num(g)} \\times ${xhat < 0 ? `(${num(xhat)})` : num(xhat)} + ${b < 0 ? `(${b})` : b}$.`, `$= ${terms([clean(g * xhat), b])} = ${num(y)}$.`],
        };
      }
      const { mu, v, sd, x, t } = point(rng);
      const g = pick(rng, [2, 3, 0.5, 1.5]);
      const b = nonzero(rng, -3, 3);
      const y = clean(g * t + b);
      return {
        prompt: `At test time, a batch-norm layer has running averages $\\mu = ${num(mu)}$ and $\\sigma^2 = ${num(v)}$ for one feature, with $${G} = ${num(g)}$ and $${BETA} = ${num(b)}$. What does it output for $x = ${num(x)}$?${round2(y)}`,
        answer: { kind: 'number', value: y, places: placesFor(y) },
        traps: traps(y, [
          { value: g * t, why: `That leaves out the shift. Add $${BETA} = ${b}$.` },
          { value: g * (x - mu) / v + b, why: 'That divides by the variance. Normalize with the standard deviation, its square root.' },
          { value: t, why: `That is $${xh}$, before the learned scale and shift.` },
        ], P),
        solution: [
          `Normalize with the running statistics: $\\sigma = \\sqrt{${num(v)}} = ${num(sd)}$, so $${xh} = (${num(x)} - ${mu < 0 ? `(${num(mu)})` : num(mu)}) / ${num(sd)} = ${num(t)}$.`,
          `Scale and shift: $y = ${num(g)} \\times ${t < 0 ? `(${num(t)})` : num(t)} + ${b < 0 ? `(${b})` : b} = ${num(y)}$.`,
        ],
      };
    },
  },
  {
    id: 'test-time',
    make(rng) {
      const B = pick(rng, [32, 64, 128, 256, 512]);
      const one = rng.next() < 0.5;
      return {
        prompt: `A network with batch norm was trained on batches of ${B}. At test time it ${one ? 'classifies one image at a time' : 'classifies a batch of test images'}. Which mean and variance does batch norm use for a test image's features?`,
        answer: {
          kind: 'choice',
          options: [
            'The running averages from training, the same for every test image',
            one ? 'The mean and variance of the test batch: here, that one image' : 'The mean and variance of the test batch it arrives in',
            `None: it skips normalizing and applies only $${G}$ and $${BETA}$`,
            'Mean 0 and variance 1, the values that normalizing aims for',
          ],
          correct: 0,
          why: [
            null,
            one ? 'With one image the batch mean is that image\'s value and the variance is 0, so every feature would normalize to 0.' : 'Then an image\'s prediction would change with whichever other images happen to share its batch.',
            `The layers after it were trained on normalized values. Skipping the normalization shifts and rescales everything they see, and $${G}$ and $${BETA}$ were learned for normalized inputs.`,
            `0 and 1 are what $\\hat{x}$ ends up with after normalizing, not the statistics it is normalized with.`,
          ],
        },
        solution: [
          'During training, each batch is normalized with its own mean and variance, and the layer keeps running averages of both.',
          `At test time it normalizes with those running averages, then applies $${G}$ and $${BETA}$.`,
          'So each test image gets the same treatment whatever else is in its batch, even a batch of one.',
        ],
      };
    },
  },
];
