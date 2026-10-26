import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { big, bigText, E2, SENTENCES, softmax2, T, traps, useExp, vecT, vtraps } from '../kit';

const sent = (ws: readonly string[]) => ws.map((w) => `\`${w}\``).join(' ');

export const generators: Generator[] = [
  {
    id: 'which',
    make(rng) {
      const ws = pick(rng, SENTENCES);
      const n = int(rng, 3, 4);
      const words = ws.slice(0, n);
      return {
        prompt: `A causal mask is applied to self-attention's scores for ${sent(words)}. Which entries, at row $i$ and column $j$, does it set to $-\\infty$?`,
        answer: {
          kind: 'choice',
          options: [
            'Every entry above the diagonal: $j > i$, a key that comes after the query',
            'Every entry below the diagonal: $j < i$, a key that comes before the query',
            'Every entry on the diagonal: $j = i$, each token\'s score for itself',
            `Every entry in the last row: the scores of the last token, \`${words[n - 1]}\``,
          ],
          correct: 0,
          why: [
            null,
            'Those are the past, which every token may use. The mask hides the future.',
            'A token may attend to itself: it is not a later token. Only keys after the query are hidden.',
            `The last token may look at every token, since none comes after it. It is the first row that sees least: only itself.`,
          ],
        },
        solution: [
          `Row $i$ may use token $i$ and every token before it, columns $0$ to $i$.`,
          `So the mask hides columns $j > i$: everything above the diagonal. Row 0, \`${words[0]}\`, keeps only itself; row ${n - 1}, \`${words[n - 1]}\`, keeps all ${n}.`,
        ],
      };
    },
  },
  {
    id: 'count',
    make(rng, d) {
      if (d < 0.35) {
        const n = int(rng, 4, 9);
        const i = rng.int(n);
        const v = i + 1;
        return {
          prompt: `A causal mask is applied to self-attention over ${n} tokens. With tokens numbered from 0, how many can token ${i} attend to?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: i, why: `That leaves out token ${i} itself. A token may attend to itself and to every token before it.` },
            { value: n - i, why: `That counts token ${i} and the tokens after it. The mask keeps the ones before it instead.` },
            { value: n, why: 'That is every token: no mask. The tokens after it are hidden.' },
          ]),
          solution: [`Token ${i} keeps itself and every token before it: tokens 0 to ${i}.`, `That is ${i} + 1 = ${v} tokens.`],
        };
      }
      const n = d < 0.7 ? int(rng, 4, 16) : pick(rng, [64, 100, 128, 256, 512, 1000, 1024]);
      const masked = d >= 0.7 && rng.int(2) === 0;
      const kept = (n * (n + 1)) / 2;
      const hidden = (n * (n - 1)) / 2;
      const v = masked ? hidden : kept;
      return {
        prompt: `A causal mask is applied to self-attention over $${T} = ${big(n)}$ tokens. How many of the scores does it ${masked ? 'set to $-\\infty$' : 'keep'}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: (n * n) / 2, why: `That is exactly half. The diagonal is ${masked ? 'kept' : 'kept too'}, so the split is $${T}(${T} + 1)/2$ kept and $${T}(${T} - 1)/2$ masked.` },
          { value: masked ? kept : hidden, why: masked ? 'That is how many are kept: the diagonal and below.' : 'That leaves out the diagonal. Each token may attend to itself.' },
          { value: n * n, why: 'That is every entry. The mask hides the ones above the diagonal.' },
        ]),
        solution: masked
          ? [
              `The grid has one score per query and key: $${T}^2 = ${big(n)} \\times ${big(n)} = ${big(n * n)}$.`,
              `The mask keeps the diagonal and below: $1 + 2 + \\dots + ${big(n)} = ${T}(${T} + 1)/2$.`,
              `That is $${big(n)} \\times ${big(n + 1)} / 2 = ${big(kept)}$ kept.`,
              `It hides the rest: $${big(n * n)} - ${big(kept)} = ${big(hidden)}$.`,
              `The same in one step: $${T}(${T} - 1)/2 = ${big(n)} \\times ${big(n - 1)} / 2 = ${big(hidden)}$.`,
            ]
          : [
              `Row $i$ keeps tokens 0 to $i$: 1 entry in row 0, 2 in row 1, up to ${bigText(n)} in the last.`,
              `$1 + 2 + \\dots + ${big(n)} = ${T}(${T} + 1)/2$: pair the rows from the ends, each pair adding to $${T} + 1$.`,
              `$${big(n)} \\times ${big(n + 1)} = ${big(n * (n + 1))}$, and half of that is $${big(kept)}$.`,
            ],
      };
    },
  },
  {
    id: 'renorm',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const i = n === 3 ? 1 : int(rng, 1, 2);
      for (;;) {
        const e = Array.from({ length: n }, () => int(rng, d < 0.35 ? 0 : -1, 3));
        const keep = e.map((_, j) => j <= i);
        if (new Set(e.slice(0, i + 1)).size < 2) continue;
        const w = softmax2(e, keep);
        const full = softmax2(e);
        const zeroed = full.map((x, j) => (keep[j] ? x : 0));
        return {
          prompt: `Token ${i}'s scores against the ${n} keys, counting from 0, are $${vecT(e)}$. With a causal mask, what are its attention weights? Round to two decimals.\n\nUse ${useExp(e)}.`,
          answer: { kind: 'vector', value: w, places: 2 },
          traps: vtraps(w, [
            { value: full, why: `That is the softmax with no mask. Keys after token ${i} are set to $-\\infty$ first, so they get weight 0.` },
            { value: zeroed, why: 'That zeroes the later keys after the softmax, so the weights no longer add up to 1. Mask first, then take the softmax over what is left.' },
          ], 2),
          solution: [
            `Keys ${i + 1}${n - 1 > i + 1 ? ` to ${n - 1}` : ''} come after token ${i}: their scores become $-\\infty$, and $e^{-\\infty} = 0$.`,
            `Exponentiate the rest: ${e.slice(0, i + 1).map((x) => `$e^{${x}} \\approx ${num(E2(x), 2)}$`).join(', ')}; they add up to $${num(e.slice(0, i + 1).reduce((a, x) => a + E2(x), 0), 2)}$.`,
            `Divide each by the total: $${vecT(w, 2)}$. The kept weights add up to 1.`,
          ],
        };
      }
    },
  },
  {
    id: 'why',
    make(rng) {
      const ws = pick(rng, SENTENCES);
      const i = int(rng, 0, 2);
      return {
        prompt: `A model is trained on ${sent(ws)} to predict, at every position at once, the token that comes next: at position ${i}, \`${ws[i]}\`, it should predict \`${ws[i + 1]}\`. Why does its self-attention need a causal mask?`,
        answer: {
          kind: 'choice',
          options: [
            `Without it, position ${i} could attend to \`${ws[i + 1]}\` and copy the answer`,
            'Without it, the attention weights in a row would not add up to 1',
            'It halves the work, which is its purpose: the masked half is skipped',
            'Earlier tokens matter less, so the mask removes them from each row',
          ],
          correct: 0,
          why: [
            null,
            'Softmax makes every row add up to 1 with or without a mask.',
            `Saving work is a side effect at best. The mask exists so that no position can see the token it has to predict.`,
            'The mask removes later tokens, not earlier ones: each token keeps itself and everything before it.',
          ],
        },
        solution: [
          `Every position predicts the next token, and that token is in the same sequence. Unmasked, position ${i} could simply attend to \`${ws[i + 1]}\`.`,
          'The mask hides every later token, so each position predicts from the past only, as it must when generating, where the next token does not exist yet.',
        ],
      };
    },
  },
];
