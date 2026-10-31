import type { Generator } from '../../../mastery/domain/types';
import { big, clean, commas, int, num, pick, traps } from '../../kit';
import { choice } from '../kit';

/** Tasks whose answer takes several steps, each built on the last. */
const MULTI = [
  'What is $47 \\times 38$?',
  'Ana has 3 boxes of 12 eggs, uses 7, then buys 5 more. How many eggs does she have?',
  'A ball sits under the left of three cups, and the cups are swapped 8 times. Where is the ball?',
  'What is the sum of these twelve two-digit numbers: 23, 58, 41, 77, 12, 36, 94, 65, 19, 80, 47, 52?',
  'What day of the week is it 100 days after a Tuesday?',
  'Solve $3x + 7 = 31$ for $x$.',
  'A train leaves at 9:40 and the trip takes 2 hours 35 minutes. When does it arrive?',
];

/** Tasks answered by recalling one fact. */
const RECALL = [
  'What is the capital of France?',
  'What is the Spanish word for *cat*?',
  'What is the opposite of *hot*?',
  'What is the chemical symbol for gold?',
  'Who wrote *Hamlet*?',
  'How many legs does a spider have?',
];

/** Milliseconds per token that keep every time a whole number of hundredths of a second. */
const MS = [10, 20, 40, 50];

export const generators: Generator[] = [
  {
    id: 'time',
    make(rng, d) {
      const t = d < 0.35 ? pick(rng, [10, 20]) : pick(rng, MS);
      const A = d < 0.35 ? pick(rng, [2, 4, 5]) : int(rng, 2, 20);
      const kind = d < 0.35 ? 'total' : pick(rng, ['total', 'extra', 'ratio'] as const);
      if (kind === 'ratio') {
        const m = int(rng, 5, 60);
        const R = m * A;
        const v = m + 1;
        return {
          prompt: `Asked directly, a model answers in ${A} tokens. With chain of thought it first writes ${commas(R)} tokens of steps, then the same ${A}-token answer. Each token takes the same time to write. How many times as long does the reply with steps take?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: m, why: `That is the steps alone over the direct answer. The reply with steps writes the steps and then the ${A}-token answer too.` },
            { value: R + A, why: 'That is the number of tokens in the reply with steps. Compare it with the direct reply, which has tokens of its own.' },
          ]),
          solution: [
            `The reply with steps writes $${big(R)} + ${A} = ${big(R + A)}$ tokens; the direct one writes $${A}$.`,
            'Every token costs the same time, so the times compare as the token counts.',
            `$${big(R + A)} / ${A} = ${v}$: ${v} times as long.`,
          ],
        };
      }
      const R = d < 0.35 ? pick(rng, [100, 200, 300, 400, 500]) : int(rng, 3, 60) * 50;
      const total = clean(((R + A) * t) / 1000);
      const extra = clean((R * t) / 1000);
      if (kind === 'extra') {
        return {
          prompt: `A model writes one token every ${t} ms. Asked directly, it answers in ${A} tokens. With chain of thought it first writes ${commas(R)} tokens of steps, then the same answer. How many seconds longer does the reply with steps take?`,
          answer: { kind: 'number', value: extra },
          traps: traps(extra, [
            { value: total, why: 'That is the whole reply with steps. The direct reply writes the same answer tokens, so only the steps are extra.' },
            { value: R * t, why: 'That is in milliseconds. Divide by 1,000 for seconds.' },
          ]),
          solution: [
            `The two replies end with the same ${A} answer tokens, so the extra time is the ${commas(R)} tokens of steps.`,
            `$${big(R)} \\times ${t}\\text{ ms} = ${big(R * t)}\\text{ ms}$.`,
            `That is $${num(extra)}$ seconds.`,
          ],
        };
      }
      return {
        prompt: `A model writes one token every ${t} ms. With chain of thought, it writes ${commas(R)} tokens of steps and then a ${A}-token answer. How many seconds does the whole reply take?`,
        answer: { kind: 'number', value: total },
        traps: traps(total, [
          { value: extra, why: `That counts the steps only. The ${A} answer tokens are written after them, one at a time like the rest.` },
          { value: clean((A * t) / 1000), why: 'That is the answer alone, as if the model answered directly. The steps are written first, token by token.' },
          { value: (R + A) * t, why: 'That is in milliseconds. Divide by 1,000 for seconds.' },
        ]),
        solution: [
          `Every token is one more pass, so the reply takes $${big(R)} + ${A} = ${big(R + A)}$ token times.`,
          `$${big(R + A)} \\times ${t}\\text{ ms} = ${big((R + A) * t)}\\text{ ms}$.`,
          `That is $${num(total)}$ seconds.`,
        ],
      };
    },
  },
  {
    id: 'budget',
    make(rng, d) {
      const t = d < 0.35 ? pick(rng, [10, 20]) : pick(rng, [10, 20, 25, 40, 50]);
      const X = d < 0.35 ? pick(rng, [2, 3, 5]) : pick(rng, [2, 3, 4, 5, 8, 10, 15, 30, 60]);
      const all = (X * 1000) / t;
      const A = pick(rng, (d < 0.35 ? [10, 20, 50] : [5, 10, 15, 20, 25, 40, 50]).filter((a) => a <= all / 2));
      const v = all - A;
      return {
        prompt: `A model writes one token every ${t} ms, and its final answer takes ${A} tokens. The reply must be done within ${X} seconds. At most how many tokens of steps can it write before the answer?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: all, why: `That is every token that fits in ${X} seconds. ${A} of them are needed for the answer itself.` },
          { value: all + A, why: 'That adds the answer\'s tokens to the budget. They come out of it.' },
          { value: X * t - A, why: `That multiplies the seconds by the time per token. Divide instead: $${big(X * 1000)}\\text{ ms} / ${t}\\text{ ms}$ is the number of tokens that fit.` },
        ]),
        solution: [
          `${X} seconds is $${X} \\times 1{,}000 = ${big(X * 1000)}$ ms.`,
          `Each token takes ${t} ms, so $${big(X * 1000)} / ${t} = ${big(all)}$ tokens fit in all.`,
          `The answer needs ${A} of them, which leaves $${big(all)} - ${A} = ${big(v)}$ for the steps.`,
        ],
      };
    },
  },
  {
    id: 'helps',
    make(rng) {
      const multi = rng.next() < 0.5;
      const task = multi ? pick(rng, MULTI) : pick(rng, RECALL);
      return {
        prompt: `A model is asked: ${task}\n\nWill writing out steps before the answer make it more likely to be right, or only cost tokens?`,
        answer: choice([
          { text: 'It helps: the answer needs several steps, each built on the one before', why: multi ? null : 'Here the answer is one fact the model knows or does not. Writing steps gives it nothing to build on.' },
          { text: 'It only costs tokens: the answer is one fact, with no steps to build on', why: multi ? 'Each step here uses the result of the one before, and one pass has only so many layers to work them all out.' : null },
          { text: 'It helps on any question: more tokens always make a better answer', why: 'Steps help only where there are steps. For a single fact they add tokens and time, and nothing to build on.' },
          { text: 'It never helps: the layers stay the same, so the model cannot compute more', why: 'The layers stay the same, but every written token is read back in, so each later pass starts from a result already worked out.' },
        ]),
        solution: multi
          ? [
              'Every pass runs through the same fixed stack of layers, so one pass can take only so many steps one after another.',
              'This answer takes several steps, each using the result of the last. Written out, each step becomes an input that the next pass reads and builds on.',
              'So the steps raise the chance of a right answer, at the price of more tokens.',
            ]
          : [
              'This answer is one recalled fact: there is no chain of steps for one pass to run out of layers on.',
              'Writing steps first only adds tokens, and every token is one more pass of time.',
            ],
      };
    },
  },
  {
    id: 'why',
    make(rng) {
      const layers = pick(rng, [4, 6, 8, 12, 24, 32]);
      const steps = pick(rng, [10, 20, 40, 50, 100]);
      return {
        prompt: `A model with ${layers} layers is asked a question whose solution takes ${steps} steps, each using the result of the one before. Why can writing those steps out before the answer help?`,
        answer: choice([
          { text: 'Each written step is read back in, so the next pass starts from its result', why: null },
          { text: 'Writing steps adds extra layers to the model for as long as it writes', why: `The model keeps its ${layers} layers. What grows is the number of passes: one per written token.` },
          { text: 'The model\'s weights learn from each step it writes, as in training', why: 'Nothing is learned while a model writes: its weights stay fixed. The steps help because the model reads them back.' },
          { text: 'Each layer works harder on every token when the reply is longer', why: 'A pass does the same work per token however long the reply is. The help comes from making more passes, each reading the steps so far.' },
        ]),
        solution: [
          `One pass runs through the same ${layers} layers, so it can carry out only so many steps one after another.`,
          'A written token goes back in as input. The next pass does not redo that step: it reads the result and does the next one.',
          `So ${steps} small steps, one or a few per token, fit where one pass alone would run out of layers.`,
        ],
      };
    },
  },
];
