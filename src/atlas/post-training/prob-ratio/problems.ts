import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { ADV, choose, clean, E2, OLD, paren, PI, RHO, traps } from '../kit';

/** Old and new probabilities of one token, as the explainer's first example pairs them. */
const PAIRS = [[0.2, 0.3], [0.4, 0.5], [0.5, 0.4], [0.2, 0.1], [0.25, 0.5], [0.4, 0.6], [0.5, 0.6], [0.8, 0.6], [0.3, 0.6], [0.6, 0.3]] as const;

export const generators: Generator[] = [
  {
    id: 'ratio',
    make(rng, d) {
      if (d < 0.5) {
        const [po, pn] = pick(rng, PAIRS);
        const v = clean(pn / po);
        return {
          prompt: `A token had $${OLD} = ${num(po)}$ when its batch was sampled, and after one update $${PI} = ${num(pn)}$. What is its ratio $${RHO}$? Round to two decimals.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(
            v,
            [
              { value: po / pn, why: `That is old over new. The ratio puts the model being trained on top: $${PI} / ${OLD}$.` },
              { value: clean(pn - po), why: 'That is the difference. The ratio divides.' },
            ],
            2,
          ),
          solution: [
            `$${RHO} = ${PI} / ${OLD}$: the new probability over the old one.`,
            `$${RHO} = ${num(pn)} / ${num(po)} ${round(v, 2) === v ? '=' : '\\approx'} ${num(v, 2)}$.`,
            v > 1 ? 'Above 1: the update made this token more likely.' : 'Below 1: the update made this token less likely.',
          ],
        };
      }
      const delta = pick(rng, [0.1, 0.2, 0.3, -0.1, -0.2, -0.3, 0.5, -0.5]);
      const lo = -pick(rng, [12, 15, 20, 31, 8, 25]) - pick(rng, [0, 0.4, 0.7]);
      const ln = clean(lo + delta);
      const v = E2(delta);
      return {
        prompt: `For a sampled answer, $\\ln ${OLD} = ${num(lo)}$ and, after a few updates, $\\ln ${PI} = ${num(ln)}$. What is the ratio $${RHO}$? Round to two decimals.\n\nUse $e^{${num(delta)}} \\approx ${num(v, 2)}$.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: delta, why: 'That is the log of the ratio. Exponentiate it to get the ratio.' },
            { value: E2(-delta), why: `That is $${OLD} / ${PI}$, the wrong way round.` },
            { value: clean(ln / lo), why: 'That divides the logs. A ratio of probabilities is the exponential of the difference of their logs.' },
          ],
          2,
        ),
        solution: [
          `$${RHO} = ${PI} / ${OLD}$, and the log of a quotient is a difference of logs: $\\ln ${RHO} = \\ln ${PI} - \\ln ${OLD}$.`,
          `$\\ln ${RHO} = ${num(ln)} - (${num(lo)}) = ${num(delta)}$.`,
          `$${RHO} = e^{${num(delta)}} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'term',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [1, 2, -1, -2]) : pick(rng, [2, -2, 0.5, -0.5, 3, -3, 1.5, -1.5]);
      let rho: number;
      let given: string;
      let use = '';
      let first: string[];
      let wrongWay: { value: number; why: string };
      if (d < 0.7) {
        const [po, pn] = pick(rng, PAIRS);
        rho = clean(pn / po);
        given = `A token had $${OLD} = ${num(po)}$ when its batch was sampled. After one update, $${PI} = ${num(pn)}$, and its advantage is $${ADV} = ${num(a)}$.`;
        first = [`Its ratio: $${RHO} = ${PI} / ${OLD} = ${num(pn)} / ${num(po)} = ${num(rho)}$.`];
        wrongWay = { value: (po / pn) * a, why: `That uses $${OLD} / ${PI}$. The ratio puts the model being trained on top.` };
      } else {
        const delta = pick(rng, [0.1, 0.2, 0.3, -0.1, -0.2, -0.3]);
        const lo = -int(rng, 8, 30) - pick(rng, [0, 0.4, 0.7]);
        const ln = clean(lo + delta);
        rho = E2(delta);
        given = `A sampled answer has $\\ln ${OLD} = ${num(lo)}$ and, after a few updates, $\\ln ${PI} = ${num(ln)}$. Its advantage is $${ADV} = ${num(a)}$.`;
        use = `\n\nUse $e^{${num(delta)}} \\approx ${num(rho, 2)}$.`;
        first = [
          `$\\ln ${RHO} = \\ln ${PI} - \\ln ${OLD} = ${num(ln)} - (${num(lo)}) = ${num(delta)}$.`,
          `$${RHO} = e^{${num(delta)}} \\approx ${num(rho, 2)}$.`,
        ];
        wrongWay = { value: delta * a, why: `That multiplies $\\ln ${RHO}$ by the advantage. Exponentiate it first to get $${RHO}$.` };
      }
      // Exact: a product ending in 5 at the third place grades right either way it is rounded.
      const v = clean(rho * a);
      return {
        prompt: `${given} What is its term in the objective? Round to two decimals.${use}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: a, why: 'That is the advantage alone. The term weighs it by the ratio.' },
            { value: rho, why: 'That is the ratio alone. The term multiplies it by the advantage.' },
            wrongWay,
          ],
          2,
        ),
        solution: [
          ...first,
          `The term is the ratio times the advantage: $${RHO}${ADV} = ${num(rho)} \\times ${paren(a)} = ${num(v)}$.`,
          a > 0 ? 'The advantage is positive, so raising the objective makes this one more likely.' : 'The advantage is negative, so raising the objective makes this one less likely.',
        ],
      };
    },
  },
  {
    id: 'old',
    make(rng) {
      const n = pick(rng, [3, 4, 6, 8]);
      if (rng.int(2) === 0) {
        const k = int(rng, 2, n);
        return {
          prompt: `A trainer samples a batch of answers, then makes ${n} updates on that same batch. During update ${k}, which model gives each token's $${OLD}$ in its ratio $${RHO}$?`,
          answer: choose('The model as it was when it sampled this batch', [
            [`The model as it was after update ${k - 1}`, `$${OLD}$ does not move from update to update. It stays the model that sampled the batch until the batch is used up.`],
            ['The model being trained, as it is right now', `That is $${PI}$, the top of the ratio. With $${PI}$ on both sides the ratio would always be 1.`],
            ['The model that sampled the batch before this one', `$${OLD}$ is replaced with every new batch: this batch's $${OLD}$ is the model that sampled it.`],
          ]),
          solution: [
            `$${OLD}$ is the model that sampled the batch. It stays fixed while the ${n} updates move $${PI}$.`,
            `So during update ${k}, $${OLD}$ is still the model that sampled this batch.`,
          ],
        };
      }
      const b = int(rng, 2, 5);
      return {
        prompt: `A trainer makes ${n} updates on each batch it samples. It has finished the ${n} updates on batch ${b - 1} and now samples batch ${b}. In batch ${b}'s ratios, which model is $${OLD}$?`,
        answer: choose(`The model as trained on batch ${b - 1}, which sampled batch ${b}`, [
          [`The model that sampled batch ${b - 1}`, `That was $${OLD}$ for batch ${b - 1}. Batch ${b} was sampled by the trained model, so that one is the new $${OLD}$.`],
          ['The model as it was before any training began', `Each batch's $${OLD}$ is the model that sampled that batch, not the starting model.`],
          [`The model after the first update on batch ${b}`, `That is $${PI}$ partway through batch ${b}. $${OLD}$ is fixed when the batch is sampled.`],
        ]),
        solution: [
          `When a batch is used up, the trained model samples the next one.`,
          `So batch ${b} was sampled by the model as trained on batch ${b - 1}, and that model is batch ${b}'s $${OLD}$.`,
        ],
      };
    },
  },
];
