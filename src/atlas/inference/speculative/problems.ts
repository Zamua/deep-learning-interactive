import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick } from '../../kit';
import { choice, clean, traps } from '../kit';

/** Accept (true) or reject for each of `k` drafted tokens, with the first rejection at `cut` (k for none). */
function verdicts(rng: Rng, k: number, cut: number): boolean[] {
  return Array.from({ length: k }, (_, i) => (i < cut ? true : i === cut ? false : rng.next() < 0.6));
}

const word = (ok: boolean) => (ok ? 'accept' : 'reject');

export const generators: Generator[] = [
  {
    id: 'tokens-per-pass',
    make(rng, d) {
      const k = d < 0.35 ? pick(rng, [3, 4]) : int(rng, 4, 8);
      const cut = rng.next() < 0.2 ? k : int(rng, 0, k - 1);
      const v = verdicts(rng, k, cut);
      const kept = cut;
      const ans = kept + 1;
      const all = v.filter(Boolean).length;
      const list = v.map((ok, i) => `${i}: ${word(ok)}`).join(', ');
      return {
        prompt: `A draft model proposes $k = ${k}$ tokens, and one pass of the large model gives these verdicts on them, in order: ${list}. How many tokens does this pass add to the text?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: kept, why: cut === k ? 'That leaves out the bonus: when every guess is accepted, the same pass also gives the large model\'s next token after the last one.' : `That leaves out the large model's own token at position ${cut}, which replaces the rejected guess.` },
          ...(all !== kept ? [{ value: all, why: `That counts accepts after the first rejection. Guesses after position ${cut} were drafted after a token that is now thrown away, so they are discarded too.` }] : []),
          ...(all + 1 !== ans ? [{ value: all + 1, why: `That counts accepts after the first rejection. Everything drafted after position ${cut} is discarded.` }] : []),
          { value: k + 1, why: `That is the most a pass can give, when every guess is accepted. Here guess ${cut} is rejected.` },
        ]),
        solution:
          cut === k
            ? [`All ${k} guesses are accepted, so all ${k} are kept.`, `The same pass also predicted the token after the last guess, which comes free: $${k} + 1 = ${ans}$ tokens.`]
            : [
                cut === 0 ? 'Guess 0 is rejected, so no guess is kept.' : cut === 1 ? 'Guess 0 is accepted and kept.' : `Guesses 0 to ${cut - 1} are accepted: ${cut} kept.`,
                cut === 0
                  ? "The large model's own token from the same pass takes guess 0's place, and every later guess is discarded."
                  : `Guess ${cut} is rejected: the large model's own token from the same pass takes its place, and everything drafted after it is discarded.`,
                `$${kept} + 1 = ${ans}$ token${ans === 1 ? '' : 's'} from this pass.`,
              ],
      };
    },
  },
  {
    id: 'speedup',
    make(rng, d) {
      const k = d < 0.35 ? 4 : pick(rng, [3, 4, 5, 6]);
      const passes = d < 0.35 ? 3 : int(rng, 3, 5);
      const acc = Array.from({ length: passes }, () => int(rng, 0, k));
      const tokens = acc.reduce((a, x) => a + x + 1, 0);
      const askSpeed = d >= 0.35;
      const v = askSpeed ? clean(tokens / passes) : tokens;
      const kept = acc.reduce((a, x) => a + x, 0);
      return {
        prompt: `Speculative decoding drafts $k = ${k}$ tokens per pass. Over ${passes} passes of the large model, the accepted prefixes have lengths ${acc.join(', ')}. ${askSpeed ? 'How many times fewer large-model passes than plain decoding did those tokens take? Round to two decimals.' : 'How many tokens were written in all?'}`,
        answer: askSpeed ? { kind: 'number', value: v, places: 2 } : { kind: 'number', value: v },
        traps: traps(v, [
          { value: askSpeed ? clean(kept / passes) : kept, why: 'That leaves out the one token every pass adds after its accepted prefix: the correction, or the bonus when all are accepted.' },
          { value: askSpeed ? k + 1 : passes * (k + 1), why: 'That assumes every guess is accepted. Count the prefixes as given.' },
          ...(askSpeed ? [{ value: tokens, why: `That is the number of tokens. Plain decoding needs ${tokens} passes for them; divide by the ${passes} passes used.` }] : []),
        ]).filter((t) => !askSpeed || Math.abs(t.value - v) >= 0.005),
        solution: [
          `Each pass writes its accepted prefix plus one token: ${acc.map((a) => `$${a} + 1$`).join(', ')}.`,
          `In all $${acc.map((a) => a + 1).join(' + ')} = ${tokens}$ tokens.`,
          ...(askSpeed ? [`Plain decoding needs ${tokens} passes for them, against ${passes} here: $${tokens} / ${passes} ${Number.isInteger((tokens * 100) / passes) ? '=' : '\\approx'} ${num(clean(tokens / passes), 2)}$ times fewer.`] : []),
        ],
      };
    },
  },
  {
    id: 'same-output',
    make(rng) {
      const greedy = rng.next() < 0.5;
      const big = pick(rng, [7, 13, 34, 70]);
      const small = pick(rng, [0.1, 0.5, 1]);
      const k = pick(rng, [3, 4, 5, 8]);
      return {
        prompt: `A ${big}-billion-parameter model uses a ${num(small)}-billion-parameter draft that proposes $k = ${k}$ tokens per pass, ${greedy ? 'with greedy decoding' : 'sampling with the accept rule of speculative sampling'}. Compared with the large model decoding on its own, what text comes out?`,
        answer: choice([
          { text: greedy ? 'The very same text the large model would write alone' : 'Text with exactly the large model\'s own probabilities', why: null },
          { text: 'A blend of the two: partly the small model\'s text', why: 'Every token that survives is one the large model accepts or writes itself, so nothing of the small model\'s choosing gets through unchecked.' },
          { text: 'The small model\'s text, with only its worst errors fixed', why: 'Each guess is compared with the large model\'s own choice at that position, and the first disagreement is replaced. The large model decides every token.' },
          { text: 'Slightly worse text: some of the draft\'s mistakes slip through', why: 'A guess is kept only when the large model accepts it, so the draft can only save time, never change the result.' },
        ]),
        solution: greedy
          ? [
              'The large model checks each guess against the token it would pick itself at that position.',
              'Matching guesses are kept, and the first mismatch is replaced by its own pick, so every token is the large model\'s choice.',
              'The draft only decides how many tokens one pass yields: the speed, not the text.',
            ]
          : [
              'With sampling, a guess is kept with a chance set by how much the large model agrees with it, and on a rejection the large model draws from what is left.',
              'The two parts are balanced so each token comes out with exactly the large model\'s probabilities.',
              'The draft only changes how many tokens one pass yields: the speed, not the distribution.',
            ],
      };
    },
  },
  {
    id: 'one-pass',
    make(rng) {
      const k = pick(rng, [3, 4, 5, 6, 8]);
      const big = pick(rng, [13, 34, 70]);
      return {
        prompt: `A ${big}-billion-parameter model checks $k = ${k}$ drafted tokens. Why does that take one pass, costing about as much as writing a single token?`,
        answer: choice([
          { text: 'The guesses are all known, so one pass runs them side by side, like a prefill, reading the weights once', why: null },
          { text: 'The large model skips the guesses the draft was most sure of', why: 'Every guess goes through the large model: the check is its own choice at that position, which needs a full pass.' },
          { text: 'The large model reuses the draft model\'s keys and values', why: 'The two models have different weights, so their keys and values differ. The large model computes its own, for all the guesses in one pass.' },
          { text: 'Checking a guess needs only the large model\'s last layer', why: 'The large model\'s choice at a position comes out of all its layers. What saves time is running every position in the same pass.' },
        ]),
        solution: [
          `The ${k} guesses are written before the check, so like a prompt they can all go through the large model in one pass.`,
          'A decode pass is limited by reading the weights from memory. Reading them once for several positions costs about the same as for one.',
          `So one pass gives the large model's own choice at all ${k} positions, plus one after the last, for about the price of one token.`,
        ],
      };
    },
  },
];
