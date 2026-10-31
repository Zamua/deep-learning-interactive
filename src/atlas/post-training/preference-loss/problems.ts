import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, LN2, minus, num, pick, traps } from '../../kit';
import { choose, SIG, useSig } from '../kit';

const r = '\\sym{r}{r}';

/** Scores for two answers to one prompt, never tied; whole at first, halves when harder. */
function scores(rng: Rng, d: number): [number, number] {
  for (;;) {
    const unit = d < 0.6 ? 1 : 2;
    const lo = d < 0.3 ? 0 : -3;
    const a = int(rng, lo * unit, 4 * unit) / unit;
    const b = int(rng, lo * unit, 4 * unit) / unit;
    if (a !== b && Math.abs(a - b) <= 3) return [a, b];
  }
}

const ra = `${r}_a`;
const rb = `${r}_b`;
const ri = (who: string) => `${r}_${who}`;
const useLnSig = (zs: number[]) => [...new Set(zs.map(SIG))].sort((x, y) => y - x).map((p) => `$\\ln ${num(p, 2)} \\approx ${num(LN2(p), 2)}$`).join(', ');

export const generators: Generator[] = [
  {
    id: 'loss',
    make(rng, d) {
      const [a, b] = scores(rng, d);
      const aWins = rng.int(2) === 0;
      const z = clean(aWins ? a - b : b - a);
      const v = -LN2(SIG(z));
      const w = aWins ? 'a' : 'b';
      const l = aWins ? 'b' : 'a';
      return {
        prompt: `A labeler preferred answer ${w}. The reward model scores $${ra} = ${num(a)}$ and $${rb} = ${num(b)}$. What is its loss on this pair? Round to two decimals.\n\nUse ${useSig([z, -z])}, ${useLnSig([z, -z])}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: -LN2(SIG(-z)), why: `That subtracts the scores the wrong way round: the loss uses the preferred answer's score minus the other's.` },
            { value: LN2(SIG(z)), why: 'That leaves out the minus sign. A loss is never negative.' },
            { value: SIG(z), why: `That is the probability the model gives answer ${w}. The loss is minus its log.` },
          ],
          2,
        ),
        solution: [
          `The loss is $-\\ln \\sigma(${ri(w)} - ${ri(l)})$. The gap, preferred minus other: $${ri(w)} - ${ri(l)} = ${minus(aWins ? a : b, aWins ? b : a)} = ${num(z)}$.`,
          `$\\sigma(${num(z)}) \\approx ${num(SIG(z), 2)}$: the probability the model gives the labeler's choice.`,
          `The loss is $-\\ln ${num(SIG(z), 2)} \\approx ${num(v, 2)}$.${z < 0 ? ' Large, because the model scored the rejected answer higher.' : ''}`,
        ],
      };
    },
  },
  {
    id: 'prob',
    make(rng, d) {
      const [a, b] = scores(rng, d);
      const askA = rng.int(2) === 0;
      const z = clean(askA ? a - b : b - a);
      const v = SIG(z);
      const who = askA ? 'a' : 'b';
      return {
        prompt: `A reward model scores two answers to the same prompt: $${ra} = ${num(a)}$ and $${rb} = ${num(b)}$. What probability does it give that people prefer answer ${who}? Round to two decimals.\n\nUse ${useSig([z, -z])}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: SIG(-z), why: `That is the probability that the other answer wins. Answer ${who} wins with $\\sigma$ of its own score minus the other's.` },
            { value: Math.abs(z) <= 1 ? Math.abs(z) : NaN, why: 'That is the gap between the scores. The probability is the sigmoid of the gap.' },
          ],
          2,
        ),
        solution: [
          `Answer ${who} wins with $\\sigma(${ri(who)} - ${ri(askA ? 'b' : 'a')})$.`,
          `The gap: $${minus(askA ? a : b, askA ? b : a)} = ${num(z)}$.`,
          `$\\sigma(${num(z)}) \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'learns',
    make(rng, d) {
      const [a, b] = scores(rng, Math.max(d, 0.3));
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      const gap = clean(hi - lo);
      const c = pick(rng, [5, 10, 20, 100]);
      if (rng.int(2) === 0) {
        return {
          prompt: `A reward model scores two answers to one prompt: $${ra} = ${num(hi)}$ and $${rb} = ${num(lo)}$. If $${c}$ is added to every score it gives, what probability does it give that people prefer answer a?`,
          answer: choose(`Still $\\sigma(${num(gap)})$: the gap has not changed`, [
            [`More: $\\sigma(${num(clean(hi + c))})$, from answer a's new score`, `The prediction is $\\sigma$ of the gap between the scores. Both grew by ${c}, so the gap is still ${num(gap)}.`],
            ['Exactly one half: both answers moved together', 'Moving together keeps them apart by the same gap, and the prediction depends only on the gap.'],
            ['Less: the scores are now closer in ratio', 'Ratios of scores mean nothing to the model. Only their difference goes into the sigmoid.'],
          ]),
          solution: [
            `The prediction is $\\sigma(${ra} - ${rb})$, and adding the same $${c}$ to both cancels in the difference.`,
            `So it is still $\\sigma(${num(gap)})$. Comparisons fix only the gaps between scores, never their zero point.`,
          ],
        };
      }
      return {
        prompt: `A reward model trained on comparisons gives an answer the score $${r} = ${num(hi)}$. What does that number alone tell you?`,
        answer: choose('Little: only gaps between scores for the same prompt mean something', [
          [hi > 0 ? 'That the answer is good, since its score is positive' : 'That the answer is fine, since scores are relative to zero', 'Adding any constant to every score changes no prediction, so where zero sits means nothing.'],
          [`That people prefer it with probability $\\sigma(${num(hi)})$`, 'A preference probability needs a second answer: it is $\\sigma$ of the gap between two scores.'],
          ['How many times better it is than an answer scoring 1', 'The model only learns differences between scores. Ratios mean nothing to it.'],
        ]),
        solution: [
          `The loss depends only on differences $${ra} - ${rb}$ between answers to the same prompt.`,
          `Adding a constant to every score leaves every difference, and every prediction, unchanged. So $${num(hi)}$ means something only next to another answer's score.`,
        ],
      };
    },
  },
];
