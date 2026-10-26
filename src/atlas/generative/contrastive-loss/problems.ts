import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, vec } from '../../kit';
import { E2, LN2, clean, dot, par, shuffled, terms, traps } from '../kit';

const TAU = '\\sym{tau}{\\tau}';

/** `6^2 + 8^2`, with negative entries in parentheses. */
const sq = (v: number[]) => v.map((x) => `${par(x)}^2`).join(' + ');

/** Scores (similarity over temperature), the similarities and the temperature behind them. */
function row(rng: Rng, d: number): { s: number[]; sim: number[] | null; tau: number } {
  const n = d < 0.6 ? 3 : 4;
  if (d < 0.35) return { s: ints(rng, n, 0, 2), sim: null, tau: 1 };
  // Similarities of unit vectors stay within [-1, 1].
  const tau = d < 0.7 ? 0.5 : pick(rng, [0.25, 0.2, 0.1]);
  const s = ints(rng, n, Math.max(-2, Math.ceil(-1 / tau)), Math.min(3, Math.floor(1 / tau)));
  return { s, sim: s.map((v) => clean(v * tau)), tau };
}

export const generators: Generator[] = [
  {
    id: 'row-loss',
    make(rng, d) {
      const { s, sim, tau } = row(rng, d);
      const n = s.length;
      const k = rng.int(n);
      const e = s.map(E2);
      const T = round(e.reduce((a, b) => a + b, 0), 2);
      const lnT = LN2(T);
      const v = round(lnT - s[k]!, 2);
      const top = s.indexOf(Math.max(...s));
      const distinct = [...new Set(s)].sort((a, b) => b - a);
      const given = sim
        ? `Its similarities to the ${n} candidates are $${vec(sim)}$, and the temperature is $${TAU} = ${num(tau)}$.`
        : `Its similarities to the ${n} candidates, already divided by the temperature, are $${vec(s)}$.`;
      return {
        prompt: `In a contrastive batch, one anchor's positive is candidate ${k}, counting from 0. ${given} What is this row's loss? Round to two decimals.\n\nUse ${distinct.map((x) => `$e^{${x}} \\approx ${num(E2(x), 2)}$`).join(', ')}, and $\\ln ${num(T, 2)} \\approx ${num(lnT, 2)}$.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: s[k]! - lnT, why: 'That has the sign flipped. The loss is the log of the total minus the positive\'s score, never negative.' },
            { value: e[k]! / T, why: `That is the softmax probability of the positive. The loss is minus its log.` },
            ...(top !== k ? [{ value: lnT - s[top]!, why: `That treats candidate ${top}, the most similar, as the positive. The positive is fixed by the pairing: candidate ${k}.` }] : []),
          ],
          2,
        ),
        solution: [
          ...(sim ? [`Divide by the temperature: $${vec(sim)} / ${num(tau)} = ${vec(s)}$.`] : []),
          `The loss is the cross-entropy of a softmax over the row, with the positive as the right answer. The total is $${e.map((x) => num(x, 2)).join(' + ')} = ${num(T, 2)}$.`,
          `So the loss is $-\\ln(e^{${s[k]}} / ${num(T, 2)}) = \\ln ${num(T, 2)} - ${par(s[k]!)}$.`,
          `$${num(lnT, 2)} - ${par(s[k]!)} = ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'score',
    make(rng, d) {
      const UNIT: [number, number][] = [[0.6, 0.8], [0.8, 0.6], [1, 0], [0, 1], [-0.6, 0.8], [0.8, -0.6], [-0.8, 0.6], [0.6, -0.8], [0, -1], [-1, 0]];
      const RAW: [number, number][] = [[3, 4], [4, 3], [0, 5], [5, 0], [-3, 4], [4, -3], [6, 8], [8, 6], [0, 2], [-4, 3], [2, 0]];
      const raw = d >= 0.7;
      const pickTwo = (xs: [number, number][]) => {
        for (;;) {
          const a = pick(rng, xs);
          const b = pick(rng, xs);
          if (a !== b) return [a, b];
        }
      };
      const [a, b] = pickTwo(raw ? RAW : UNIT);
      const la = Math.hypot(...a!);
      const lb = Math.hypot(...b!);
      const ua = a!.map((x) => clean(x / la));
      const ub = b!.map((x) => clean(x / lb));
      const cos = dot(ua, ub);
      const tau = d < 0.35 ? pick(rng, [1, 0.5]) : pick(rng, [0.5, 0.2, 0.1, 0.25]);
      const v = clean(cos / tau);
      const prompt = raw
        ? `An encoder outputs $${vec(a!)}$ for one view and $${vec(b!)}$ for another, and the temperature is $${TAU} = ${num(tau)}$. What score does the softmax see for this pair?`
        : `Two views are encoded as the unit vectors $${vec(ua)}$ and $${vec(ub)}$, and the temperature is $${TAU} = ${num(tau)}$. What score does the softmax see for this pair?`;
      return {
        prompt: `${prompt} Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: cos, why: `That is the similarity before the temperature. Divide it by $${TAU} = ${num(tau)}$.` },
            { value: cos * tau, why: `That multiplies by the temperature. The similarity is divided by $${TAU}$, which stretches it when $${TAU}$ is small.` },
            ...(raw ? [{ value: dot(a!, b!) / tau, why: 'That skips scaling to unit vectors. Divide each vector by its length as an arrow first, so only its direction counts.' }] : []),
          ],
          2,
        ),
        solution: [
          ...(raw
            ? [
                `Length of $${vec(a!)}$ as an arrow: $${sq(a!)} = ${num(la * la)}$, whose square root is $${num(la)}$.`,
                `Length of $${vec(b!)}$: $${sq(b!)} = ${num(lb * lb)}$, whose square root is $${num(lb)}$.`,
                `Divide each entry by its vector's length to get the unit vectors: $${vec(ua)}$ and $${vec(ub)}$.`,
              ]
            : []),
          `The similarity is their dot product: $${ua.map((x, i) => `${par(x)} \\cdot ${par(ub[i]!)}`).join(' + ')} = ${terms(ua.map((x, i) => clean(x * ub[i]!)))} = ${num(cos)}$.`,
          `The score divides it by the temperature: $${num(cos)} / ${num(tau)} = ${num(round(v, 2))}$.`,
        ],
      };
    },
  },
  {
    id: 'positives',
    make(rng) {
      const N = pick(rng, [4, 8, 16, 32, 64, 128, 256]);
      const i = int(rng, 0, Math.min(N, 10) - 1);
      const kind = pick(rng, ['which', 'which', 'lookalike'] as const);
      const lead = `A batch holds $${N}$ unlabeled images. Each is cropped twice at random, giving $${2 * N}$ views, and every view is encoded.`;
      if (kind === 'which')
        return {
          prompt: `${lead} For the first crop of image ${i}, which view is its positive?`,
          answer: shuffled(rng, [
            { text: `The second crop of image ${i}, cut from the same photo`, why: null },
            { text: `Every view of an image of the same class as image ${i}`, why: 'There are no labels, so nothing says which images share a class. The pairs come only from how the views were made.' },
            { text: 'Whichever view is most similar to it right now', why: 'The positive is fixed by construction, before any similarity is measured. Early in training the most similar view is often the wrong one.' },
            { text: `All the other $${2 * N - 1}$ views`, why: `Only one of them comes from the same image. The other $${2 * N - 2}$ are its negatives.` },
          ]),
          solution: [
            `The two crops of image ${i} show the same thing, so they form a positive pair.`,
            `Every view of the other $${N - 1}$ images is a negative: $${2 * N - 2}$ negatives in all.`,
            'No labels are involved: the pairs come from the cropping itself.',
          ],
        };
      return {
        prompt: `${lead} Image ${i} and another image in the batch are two different photos of dogs. For the first crop of image ${i}, what are the crops of the other dog photo?`,
        answer: shuffled(rng, [
          { text: 'Negatives, even though they show the same kind of thing', why: null },
          { text: 'Positives, because they also show a dog', why: 'Nothing tells the loss what a photo shows. Only the two crops of one image are positives.' },
          { text: 'Ignored by the loss', why: `Every view in the batch except the anchor\'s own pair sits in the softmax as a negative, the other dog included.` },
          { text: 'Half positive and half negative', why: 'Each candidate is either the anchor\'s own pair or a negative. There is nothing in between.' },
        ]),
        solution: [
          `Only the second crop of image ${i} is a positive: it is the same photo.`,
          'The other dog photo is a different image, so its crops are negatives, and the loss pushes them away a little even though they are similar.',
        ],
      };
    },
  },
];
