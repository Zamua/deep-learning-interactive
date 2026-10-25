import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, vec } from '../../kit';
import { E2, LN2, clean, dot, par, shuffled, terms, traps } from '../kit';

const TAU = '\\sym{tau}{\\tau}';

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
        : `Two views have unit-length embeddings $${vec(ua)}$ and $${vec(ub)}$, and the temperature is $${TAU} = ${num(tau)}$. What score does the softmax see for this pair?`;
      return {
        prompt: `${prompt} Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: cos, why: `That is the similarity before the temperature. Divide it by $${TAU} = ${num(tau)}$.` },
            { value: cos * tau, why: `That multiplies by the temperature. The similarity is divided by $${TAU}$, which stretches it when $${TAU}$ is small.` },
            ...(raw ? [{ value: dot(a!, b!) / tau, why: 'That skips scaling to length 1. Divide each vector by its length first, so only direction counts.' }] : []),
          ],
          2,
        ),
        solution: [
          ...(raw ? [`Lengths: $${num(la)}$ and $${num(lb)}$. Unit vectors: $${vec(ua)}$ and $${vec(ub)}$.`] : []),
          `The score is the similarity, a dot product, divided by $${TAU}$. Dot product: $${ua.map((x, i) => `${par(x)} \\cdot ${par(ub[i]!)}`).join(' + ')} = ${terms(ua.map((x, i) => clean(x * ub[i]!)))} = ${num(cos)}$.`,
          `Divide by the temperature: $${num(cos)} / ${num(tau)} = ${num(round(v, 2))}$.`,
        ],
      };
    },
  },
  {
    id: 'temperature',
    make(rng) {
      const sims = ints(rng, 3, -2, 9, true).map((x) => x / 10).sort((a, b) => b - a);
      const kind = pick(rng, ['lower', 'raise', 'hard'] as const);
      const lo = pick(rng, [0.05, 0.1, 0.2]);
      const hi = pick(rng, [1, 2]);
      const sharp = 'It gets sharper: the most similar candidates take almost all the probability';
      const flat = 'It gets flatter: every candidate gets nearly the same probability';
      const same = 'Nothing changes: softmax only sees the gaps between the scores';
      const longer = 'The similarities themselves change, because the embeddings get longer';
      const gaps = `Dividing by $${TAU}$ multiplies every gap between scores by $1 / ${TAU}$, so the gaps do change. Only adding the same amount to every score leaves softmax alone.`;
      const unit = `The embeddings stay unit length and the similarities stay $${vec(sims)}$. $${TAU}$ only rescales them on the way into the softmax.`;
      if (kind === 'hard')
        return {
          prompt: `An anchor's similarities to three negatives are $${vec(sims)}$, and the temperature is small, $${TAU} = ${num(lo)}$. When the loss pushes the negatives away, which does it push hardest?`,
          answer: shuffled(rng, [
            { text: `The one at $${num(sims[0]!)}$, the most similar to the anchor`, why: null },
            { text: `The one at $${num(sims[2]!)}$, the least similar`, why: 'That one already has almost no probability, so the loss has little to gain from it. The push follows the probability each negative takes.' },
            { text: 'All three equally', why: `That is closer to what a large $${TAU}$ does. A small $${TAU}$ makes the softmax sharp, so the closest negative takes most of the probability and most of the push.` },
            { text: 'None of them: only the positive is moved', why: 'The loss moves both: it pulls the positive in and pushes each negative away in proportion to its probability.' },
          ]),
          solution: [
            `Divided by $${num(lo)}$, the scores are $${vec(sims.map((x) => round(x / lo, 1)))}$: far apart, so softmax gives nearly all the negatives' probability to the closest one.`,
            'Cross-entropy lowers each negative\'s probability in proportion to how much it has, so the most similar negative, the hardest to tell from the positive, gets the strongest push.',
          ],
        };
      const lower = kind === 'lower';
      return {
        prompt: `An anchor's similarities to its candidates are $${vec(sims)}$. If the temperature $${TAU}$ ${lower ? `falls from $${num(hi)}$ to $${num(lo)}$` : `rises from $${num(lo)}$ to $${num(hi)}$`}, what happens to the softmax over the row?`,
        answer: shuffled(rng, [
          { text: sharp, why: lower ? null : `That is what a lower $${TAU}$ does. Raising it divides the scores by more, so they bunch up.` },
          { text: flat, why: lower ? `That is what a higher $${TAU}$ does. Lowering it divides by less, stretching the scores apart.` : null },
          { text: same, why: gaps },
          { text: longer, why: unit },
        ]),
        solution: [
          `At $${TAU} = ${num(lo)}$ the scores are $${vec(sims.map((x) => round(x / lo, 1)))}$; at $${TAU} = ${num(hi)}$ they are $${vec(sims.map((x) => round(x / hi, 2)))}$.`,
          lower ? 'Smaller temperature, wider gaps, sharper softmax: the closest candidates take almost all the probability.' : 'Larger temperature, narrower gaps, flatter softmax: the candidates share the probability more evenly.',
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
