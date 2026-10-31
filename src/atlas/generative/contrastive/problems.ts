import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { E2, ints, num, pick, round, shuffled, traps, vec } from '../../kit';

const TAU = '\\sym{tau}{\\tau}';

/** Scores and the positive's index; `distinct` keeps the negatives' scores apart. */
function row(rng: Rng, d: number, distinct = false): { s: number[]; k: number } {
  const n = d < 0.6 ? 3 : 4;
  const lo = d < 0.35 ? 0 : -1;
  const hi = d < 0.35 ? 2 : 3;
  for (;;) {
    const s = ints(rng, n, lo, hi, distinct);
    if (new Set(s).size > 1) return { s, k: rng.int(n) };
  }
}

const lead = (s: number[], k: number) =>
  `In a contrastive batch, one anchor's positive is candidate ${k}, counting from 0. Its similarities to the ${s.length} candidates, already divided by the temperature, are $${vec(s)}$.`;

export const generators: Generator[] = [
  {
    id: 'push',
    make(rng, d) {
      const { s, k } = row(rng, d);
      const n = s.length;
      const j = d < 0.35 ? pick(rng, [...Array(n).keys()].filter((i) => i !== k)) : rng.int(n);
      const e = s.map(E2);
      const T = round(e.reduce((a, b) => a + b, 0), 2);
      const p = round(e[j]! / T, 2);
      const pos = j === k;
      const v = pos ? round(p - 1, 2) : p;
      const distinct = [...new Set(s)].sort((a, b) => b - a);
      return {
        prompt: `${lead(s, k)} What is the slope of this row's loss on candidate ${j}'s score? Round to two decimals.\n\nUse ${distinct.map((x) => `$e^{${x}} \\approx ${num(E2(x), 2)}$`).join(', ')}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          pos
            ? [
                { value: p, why: 'That is the positive\'s probability alone. Its score is also subtracted from the loss on its own, so its slope is its probability minus 1.' },
                { value: round(1 - p, 2), why: 'That has the sign flipped. Raising the positive\'s score lowers the loss, so its slope is below 0.' },
                { value: e[j]!, why: `That is $e^{${s[j]}}$ itself. Divide it by the total, ${num(T, 2)}, to get the probability.` },
              ]
            : [
                { value: round(p - 1, 2), why: 'That subtracts 1, which only the positive\'s slope does. A negative\'s score enters the loss only through the total.' },
                { value: -p, why: 'That has the sign flipped. Raising a negative\'s score raises the loss, so its slope is above 0.' },
                { value: e[j]!, why: `That is $e^{${s[j]}}$ itself. Divide it by the total, ${num(T, 2)}, to get the probability.` },
              ],
          2,
        ),
        solution: [
          `The total is $${e.map((x) => num(x, 2)).join(' + ')} = ${num(T, 2)}$.`,
          pos
            ? `Candidate ${j} is the positive: its score enters through the total and is also subtracted on its own, so its slope is its probability minus 1.`
            : `Candidate ${j} is a negative: its score enters the loss only through the total, so its slope is its probability.`,
          `Its probability is $${num(e[j]!, 2)} / ${num(T, 2)} \\approx ${num(p, 2)}$.`,
          ...(pos ? [`So the slope is $${num(p, 2)} - 1 = ${num(v, 2)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'push-order',
    make(rng, d) {
      let { s, k } = row(rng, d, true);
      // A positive with the lowest score would make score order the answer.
      while (s[k] === Math.min(...s)) ({ s, k } = row(rng, d, true));
      const negs = [...s.keys()].filter((i) => i !== k).sort((a, b) => s[b]! - s[a]!);
      const order = [...negs, k];
      return {
        prompt: `${lead(s, k)} Order the candidates by the slope of this row's loss on their scores, largest first.`,
        answer: { kind: 'order', items: order.map((i) => `Candidate ${i}, score $${s[i]}$`) },
        solution: [
          'A negative\'s slope is its probability: above 0, and larger the larger its score.',
          `So the negatives go by score, largest first: ${negs.map((i) => `candidate ${i} (score $${s[i]}$)`).join(', ')}.`,
          `The positive's slope is its probability minus 1, below 0: candidate ${k} comes last, whatever its score.`,
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
            `Divided by $${TAU} = ${num(lo)}$, the scores are $${vec(sims.map((x) => round(x / lo, 1)))}$.`,
            'The loss pushes each negative\'s score down by that negative\'s probability: its $e^{s}$ over the total.',
            `The largest score, $${num(round(sims[0]! / lo, 1))}$, has the largest $e^{s}$, so it holds the most probability of the three. The small $${TAU}$ stretched the gaps, which makes its share bigger still.`,
            `So the negative at $${num(sims[0]!)}$, the most similar to the anchor and the hardest to tell from the positive, gets the strongest push.`,
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
];
