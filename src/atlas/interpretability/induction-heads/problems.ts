import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { pick } from '../../kit';
import { repeatSeq, seqText, traps, whys } from '../kit';

const lengthFor = (rng: Rng, d: number) => (d < 0.4 ? 6 : pick(rng, [7, 8, 9]));

export const generators: Generator[] = [
  {
    id: 'predict',
    make(rng, d) {
      const { seq, i } = repeatSeq(rng, lengthFor(rng, d));
      const n = seq.length;
      const A = seq[n - 1]!;
      const next = seq[i + 1]!;
      const options = [next, A, seq[i - 1]!, seq[n - 2]!].map((t) => `\`${t}\``);
      return {
        prompt: `A model reads the letters ${seqText(seq)}. An induction head works at the last position, the second \`${A}\`. Which letter does it push up as the next token?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [
            null,
            `That repeats the current letter. The head copies what came after the earlier \`${A}\`.`,
            `That is the letter before the earlier \`${A}\`. The head copies the one after it.`,
            `That is the letter just before the current \`${A}\`: where a previous-token head looks, not what the induction head copies.`,
          ],
        },
        solution: [
          `The current letter \`${A}\` appeared once before, at position ${i}, and \`${next}\` came right after it.`,
          `The rule: having seen \`${A} ${next}\`, on seeing \`${A}\` again, predict \`${next}\`.`,
        ],
      };
    },
  },
  {
    id: 'attend',
    make(rng, d) {
      const { seq, i } = repeatSeq(rng, lengthFor(rng, d));
      const n = seq.length;
      const A = seq[n - 1]!;
      const ans = i + 1;
      return {
        prompt: `A model reads ${seqText(seq)}, at positions 0 to ${n - 1}. At the last position, the second \`${A}\`, which position does the induction head attend to most?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: i, why: `That is the earlier \`${A}\` itself. The head attends one past it, to the position whose previous token was \`${A}\`.` },
          { value: n - 2, why: 'That is one position back: where a previous-token head looks.' },
          { value: n - 1, why: 'That is the current position. The head looks back to the earlier copy\'s successor.' },
        ]),
        solution: [
          `The earlier \`${A}\` is at position ${i}, so position ${i + 1}, holding \`${seq[i + 1]}\`, has \`${A}\` as its previous token.`,
          `The induction head's query at the current \`${A}\` matches that position's key, so it attends to position ${ans} and copies \`${seq[i + 1]}\`.`,
        ],
      };
    },
  },
  {
    id: 'steps',
    make(rng, d) {
      const { seq, i } = repeatSeq(rng, lengthFor(rng, d));
      const A = seq[seq.length - 1]!;
      const B = seq[i + 1]!;
      return {
        prompt: `A model reads ${seqText(seq)} and predicts \`${B}\` after the second \`${A}\`. Put the steps of the induction circuit in order.`,
        answer: {
          kind: 'order',
          items: [
            'A previous-token head writes into each position the token just before it',
            `At the second \`${A}\`, the induction head's query looks for a position whose previous token was \`${A}\``,
            `It attends to position ${i + 1}, the \`${B}\` right after the first \`${A}\``,
            `It copies \`${B}\` into the stream, raising the score of \`${B}\` as the next token`,
          ],
        },
        solution: [
          'The previous-token head comes first, in an earlier layer: it attends one step back everywhere and writes what it finds into the stream.',
          `Now position ${i + 1}'s stream says "my previous token was \`${A}\`", which the induction head's keys can read.`,
          `At the second \`${A}\`, the query finds that key, attends to position ${i + 1}, and copies \`${B}\`.`,
        ],
      };
    },
  },
  {
    id: 'two-heads',
    make(rng, d) {
      const { seq } = repeatSeq(rng, lengthFor(rng, d));
      const A = seq[seq.length - 1]!;
      const options = [
        `Its query must match a key saying "my previous token was \`${A}\`", which only an earlier head writes`,
        `The causal mask hides the earlier \`${A}\` unless another head copies it forward`,
        'Attention can only look one position back, so two heads are needed to look further',
        'The previous-token head predicts the next token, and the induction head checks the guess',
      ];
      const reasons = [
        '',
        `The earlier \`${A}\` is in the past, and the mask only hides later positions.`,
        'Attention can look at any earlier position. What a lone head lacks is a way to tell which position follows an earlier copy.',
        'The previous-token head predicts nothing: it writes the token before each position into the stream.',
      ];
      return {
        prompt: `In ${seqText(seq)}, an induction head at the second \`${A}\` relies on a previous-token head in an earlier layer. Why can it not do the job alone?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          'A key is computed from its own position\'s stream. On its own, the position after the earlier copy says nothing about the token before it.',
          `The previous-token head writes "previous token: \`${A}\`" there, so the induction head's query at \`${A}\` can find it.`,
        ],
      };
    },
  },
];
