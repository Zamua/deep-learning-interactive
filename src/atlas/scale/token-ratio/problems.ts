import type { Generator } from '../../../mastery/domain/types';
import { big, clean, num, pick, traps } from '../../kit';
import { whys } from '../../training/kit';
import { D, N, words } from '../kit';

/** Model sizes in billions, as real models come. */
const SIZES = [1, 2, 3, 7, 8, 13, 30, 65, 70, 175, 280];

/** A token count given in billions, in words: `600 billion`, `1.4 trillion`. */
const tokens = (b: number) => words(b * 1e9);

export const generators: Generator[] = [
  {
    id: 'trained',
    make(rng) {
      const cat = rng.int(3);
      const n = pick(rng, SIZES) * 1e9;
      const ratio = pick(rng, [[0.5, 1, 1.5, 2, 4, 5], [16, 20, 24], [100, 140, 200, 500, 1000, 2000]][cat]!);
      const t = clean(n * ratio);
      const options = ['Under-trained: too few tokens for its size', 'About compute-optimal', 'Trained well past compute-optimal: many more tokens per parameter'];
      const bn = (x: number) => `${big(clean(x / 1e9))}\\text{ billion}`;
      const said = `$${bn(t)} / ${bn(n)} = ${num(ratio)}$ tokens per parameter`;
      return {
        prompt: `A model with ${words(n)} parameters was trained on ${words(t)} tokens. Next to compute-optimal, how was it trained?`,
        answer: {
          kind: 'choice',
          options,
          correct: cat,
          why: whys(3, cat, (i) =>
            i === 0
              ? `It saw ${said}, not fewer than 20.`
              : i === 1
                ? `It saw ${said}: ${cat === 0 ? 'far below' : 'far above'} 20.`
                : `It saw ${said}, not more than 20.`,
          ),
        },
        solution: [
          ...(t >= 1e12 ? [`${words(t)} is $${bn(t)}$.`] : []),
          `Tokens per parameter: ${said}.`,
          cat === 0
            ? 'Far below 20: the same compute would have bought a lower loss with a smaller model trained on more tokens.'
            : cat === 1
              ? 'Close to 20: about the split that gives the lowest loss for its compute.'
              : 'Far above 20: a smaller model than this budget would choose, trained much longer. It costs extra training, and every forward pass afterwards is cheaper.',
        ],
      };
    },
  },
  {
    id: 'ratio-tokens',
    make(rng, d) {
      const m = pick(rng, d < 0.35 ? [1, 2, 3, 5, 10] : SIZES);
      const v = 20 * m;
      if (d < 0.5 || rng.int(2) === 0) {
        return {
          prompt: `A model with ${words(m * 1e9)} parameters is trained compute-optimally. How many billion tokens should it see?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: 6 * m, why: 'The 6 belongs to the compute, $6ND$ FLOPs. The compute-optimal ratio is about 20 tokens per parameter.' },
            { value: m / 20, why: 'That divides by 20. A compute-optimal model reads more tokens than it has parameters: 20 for each one.' },
          ]),
          solution: [`Compute-optimal training uses about 20 tokens per parameter: $${D} = 20${N}$.`, `$20 \\times ${m} = ${big(v)}$ billion tokens.`],
        };
      }
      return {
        prompt: `A model was trained compute-optimally on ${tokens(v)} tokens. How many billion parameters does it have?`,
        answer: { kind: 'number', value: m },
        traps: traps(m, [
          { value: 20 * v, why: 'That multiplies by 20. The tokens are 20 times the parameters, so the parameters are a twentieth of the tokens.' },
          { value: clean(v / 6), why: 'The 6 belongs to the compute, $6ND$ FLOPs. The compute-optimal ratio is about 20 tokens per parameter.' },
        ]),
        solution: [
          ...(v >= 1000 ? [`${tokens(v)} is $${big(v)}$ billion.`] : []),
          `Compute-optimal means $${D} = 20${N}$, so $${N} = ${D} / 20$.`,
          `$${big(v)} / 20 = ${m}$ billion parameters.`,
        ],
      };
    },
  },
  {
    id: 'same-budget',
    make(rng, d) {
      const n1 = pick(rng, d < 0.35 ? [1, 2, 10] : [1, 2, 4, 5, 10, 20, 40]);
      const r = pick(rng, d < 0.35 ? [2, 10] : [2, 4, 5, 10]);
      const bigger = d < 0.5 || n1 % r !== 0 || rng.int(2) === 0;
      const n2 = bigger ? n1 * r : n1 / r;
      const t = pick(rng, d < 0.35 ? [20, 50, 100, 200] : [20, 40, 50, 100, 150, 200, 300]);
      const d1 = bigger ? t * r : t;
      const d2 = bigger ? t : t * r;
      const verb = bigger ? 'grows' : 'shrinks';
      return {
        prompt: `A training budget is spent on a model with ${words(n1 * 1e9)} parameters, trained on ${tokens(d1)} tokens. Spent instead on a model with ${words(n2 * 1e9)} parameters, how many billion tokens can the same budget train it on?`,
        answer: { kind: 'number', value: d2 },
        traps: traps(d2, [
          { value: bigger ? d1 * r : d1 / r, why: `That moves the tokens the same way as the parameters. With $${N}${D}$ fixed, a ${bigger ? 'bigger' : 'smaller'} model reads ${bigger ? 'fewer' : 'more'} tokens.` },
          { value: d1, why: `The compute is $6${N}${D}$: with ${bigger ? 'more' : 'fewer'} parameters, the same budget buys ${bigger ? 'fewer' : 'more'} tokens.` },
        ]),
        solution: [
          ...(d1 >= 1000 ? [`${tokens(d1)} is $${big(d1)}$ billion.`] : []),
          `The budget is $6${N}${D}$ FLOPs, so with the budget fixed, $${N} \\times ${D}$ stays the same.`,
          `$${N}$ ${verb} from ${n1} to ${num(n2)} billion: ${r} times ${bigger ? 'bigger' : 'smaller'}.`,
          `So $${D}$ ${bigger ? 'shrinks' : 'grows'} ${r} times: $${big(d1)} ${bigger ? '/' : '\\times'} ${r} = ${big(d2)}$ billion tokens.`,
        ],
      };
    },
  },
];
