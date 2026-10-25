import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { big, clean, mat, placesFor, sum, terms, traps, vecT, vtraps } from '../kit';

const xh = '\\hat{x}';
const G = '\\symgamma';
const BETA = '\\symbeta';
const DF = '\\sym{d}{d}';

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
  [[-4, 4], 4],
];

/** One example's features with a whole mean and a whole standard deviation, in random order. */
function example(rng: Rng, d: number): { xs: number[]; mu: number; sd: number } {
  const [devs, sd] = pick(rng, d < 0.35 ? PATTERNS.slice(0, 4) : PATTERNS);
  const mu = int(rng, d < 0.35 ? 2 : -4, 9);
  return { xs: rng.shuffle(devs.map((e) => mu + e)), mu, sd };
}

const stats = (xs: number[], mu: number, sd: number) => [
  `The mean of the ${xs.length} features: $\\mu = (${terms(xs)}) / ${xs.length} = ${num(mu)}$.`,
  `The squared distances from it, $${vecT(xs.map((x) => (x - mu) ** 2))}$, average to $\\sigma^2 = ${sd * sd}$, so $\\sigma = ${sd}$.`,
];

export const generators: Generator[] = [
  {
    id: 'normalize',
    make(rng, d) {
      const { xs, mu, sd } = example(rng, d);
      const j = rng.int(xs.length);
      const x = xs[j]!;
      const want = clean((x - mu) / sd);
      const P = placesFor(want);
      return {
        prompt: `One example has ${xs.length} features, $x = ${vecT(xs)}$. What does layer norm turn feature ${j}, $x_{${j}} = ${num(x)}$, into before its learned scale and shift? Ignore $\\epsilon$${P ? ', and round to two decimals' : ''}.`,
        answer: { kind: 'number', value: want, places: P },
        traps: traps(want, [
          { value: (x - mu) / (sd * sd), why: 'That divides by the variance. Divide by its square root, the standard deviation.' },
          { value: x - mu, why: 'That subtracts the mean but does not divide by the standard deviation.' },
          { value: x / sd, why: 'That divides by the standard deviation but does not subtract the mean first.' },
        ], P),
        solution: [...stats(xs, mu, sd), `$${xh}_{${j}} = (${num(x)} - ${mu < 0 ? `(${mu})` : mu}) / ${sd} = ${num(round(want, 2))}$.`],
      };
    },
  },
  {
    id: 'affine',
    make(rng, d) {
      const { xs, mu, sd } = example(rng, Math.min(d, 0.3));
      const xhat = xs.map((x) => clean((x - mu) / sd));
      const n = xs.length;
      const g = Array.from({ length: n }, () => pick(rng, d < 0.5 ? [1, 2, 3] : [0.5, 1, 2, 3]));
      const b = Array.from({ length: n }, () => int(rng, -2, 2));
      const y = xhat.map((v, i) => clean(g[i]! * v + b[i]!));
      const P = placesFor(...y);
      if (d < 0.5) {
        return {
          prompt: `Layer norm has normalized one example to $${xh} = ${vecT(xhat)}$. Its learned scale and shift, one entry per feature, are $${G} = ${vecT(g)}$ and $${BETA} = ${vecT(b)}$. What is its output, $${G} ${xh} + ${BETA}$, feature by feature?`,
          answer: { kind: 'vector', value: y, places: P },
          traps: vtraps(y, [
            { value: xhat.map((v, i) => g[i]! * (v + b[i]!)), why: `That adds $${BETA}$ before scaling. Scale first, then shift.` },
            { value: xhat.map((v, i) => b[i]! * v + g[i]!), why: `That swaps the roles: $${G}$ multiplies, $${BETA}$ is added.` },
            { value: xhat, why: `That is $${xh}$ itself, before the learned scale and shift.` },
          ], P),
          solution: [`Feature by feature, $y_i = ${G}_i\\, ${xh}_i + ${BETA}_i$.`, `${xhat.map((v, i) => `$${num(g[i]!)} \\times ${v < 0 ? `(${num(v)})` : num(v)} + ${b[i]! < 0 ? `(${b[i]})` : b[i]} = ${num(y[i]!)}$`).join(', ')}.`],
        };
      }
      return {
        prompt: `One example has features $x = ${vecT(xs)}$. Layer norm's learned scale and shift, one entry per feature, are $${G} = ${vecT(g)}$ and $${BETA} = ${vecT(b)}$. What does it output? Ignore $\\epsilon$${P ? ', and round to two decimals' : ''}.`,
        answer: { kind: 'vector', value: y, places: P },
        traps: vtraps(y, [
          { value: xhat, why: `That is $${xh}$, before the learned scale and shift.` },
          { value: xs.map((x, i) => clean(g[i]! * x + b[i]!)), why: 'That scales and shifts the raw features. Normalize them first.' },
        ], P),
        solution: [...stats(xs, mu, sd), `Normalized: $${xh} = ${vecT(xhat)}$.`, `Scale and shift each feature: $${G}\\,${xh} + ${BETA} = ${vecT(y)}$.`],
      };
    },
  },
  {
    id: 'params',
    make(rng, d) {
      const dm = d < 0.35 ? pick(rng, [4, 8, 10, 16, 32]) : pick(rng, [128, 256, 512, 768, 1024, 4096]);
      const B = pick(rng, [16, 32, 64, 128]);
      const L = d < 0.6 ? 1 : int(rng, 2, 48);
      const v = 2 * dm * L;
      const many = L > 1;
      return {
        prompt: many
          ? `A network has ${L} layer norms, each over $${DF} = ${big(dm)}$ features, and is trained on batches of ${B}. How many learned numbers do they hold in all?`
          : `A layer norm acts on vectors of $${DF} = ${big(dm)}$ features, in batches of ${B} examples. How many learned numbers does it hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 2 * L, why: `That is one $${G}$ and one $${BETA}$ per layer norm. Each holds one of each per feature.` },
          { value: dm * L, why: `That counts only $${G}$. There is a $${BETA}$ per feature too.` },
          { value: 2 * B * L, why: `That counts one per example in the batch. $${G}$ and $${BETA}$ have one entry per feature; the batch size never enters.` },
        ]),
        solution: [
          `Layer norm learns a scale $${G}$ and a shift $${BETA}$, each with one entry per feature: $2 \\times ${big(dm)} = ${big(2 * dm)}$.`,
          ...(many ? [`${L} of them: $${L} \\times ${big(2 * dm)} = ${big(v)}$.`] : []),
          'The batch size does not enter.',
        ],
      };
    },
  },
  {
    id: 'axis',
    make(rng, d) {
      const B = int(rng, 3, 4);
      const F = int(rng, 3, 5);
      const X = Array.from({ length: B }, () => Array.from({ length: F }, () => int(rng, d < 0.5 ? 0 : -3, 6)));
      const i = rng.int(B);
      const ask = rng.int(2);
      const lead = `A batch of ${B} examples with ${F} features each, one example per row:\n\n$$${'\\symX'} = ${mat(X)}$$\n\n`;
      if (ask === 0) {
        const rowMean = round(sum(X[i]!) / F, 2);
        return {
          prompt: `${lead}Layer norm computes a mean and a standard deviation to normalize example ${i}, row ${i}. Which numbers does that mean average?`,
          answer: {
            kind: 'choice',
            options: [
              `Row ${i}: example ${i}'s own ${F} features`,
              `Each column: one feature over the ${B} examples`,
              `All ${B * F} entries of the batch at once`,
              `Column ${i % F}: feature ${i % F} over the batch`,
            ],
            correct: 0,
            why: [
              null,
              'That is batch norm, one mean per feature. Layer norm turns it sideways: one mean per example, over its own features.',
              'Layer norm keeps each example separate: one mean per row.',
              'A column is one feature across the batch, as batch norm uses. Layer norm averages along the row.',
            ],
          },
          solution: [`Layer norm normalizes each example on its own, over its features: row ${i}, with mean $${num(rowMean)}$.`, 'Batch norm averages down each column instead, over the examples.'],
        };
      }
      const j = (i + 1) % B;
      return {
        prompt: `${lead}Example ${j}, row ${j}, changes and example ${i} stays the same. What happens to layer norm's output for example ${i}?`,
        answer: {
          kind: 'choice',
          options: [
            `Nothing: it uses only example ${i}'s own features`,
            `It changes: the mean is taken over the batch`,
            'It changes during training, but not at test time',
            `It changes only if feature ${i} of example ${j} changed`,
          ],
          correct: 0,
          why: [
            null,
            'That is batch norm. Layer norm takes the mean and spread of each example over its own features.',
            'Layer norm has no running averages: training and test work the same way, and neither looks at other examples.',
            'Layer norm never reads another example\'s features, whichever feature changed.',
          ],
        },
        solution: [`Layer norm's mean and standard deviation for example ${i} come from row ${i} alone.`, `So example ${i}'s output depends only on example ${i}, whatever else is in the batch.`],
      };
    },
  },
];
