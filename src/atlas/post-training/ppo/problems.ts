import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, num, par, pick, traps } from '../../kit';
import { ADV, choose, EPS, OLD, PI, RHO } from '../kit';

const clip = (x: number, e: number) => Math.min(1 + e, Math.max(1 - e, x));

/** A ratio, an advantage and a clip range, set up to land in or out of the range. */
function setup(rng: Rng, d: number): { rho: number; a: number; e: number } {
  const e = d < 0.5 ? 0.2 : pick(rng, [0.1, 0.2, 0.3]);
  const rho = pick(rng, d < 0.35 ? [0.5, 0.7, 0.9, 1.1, 1.5, 2] : [0.6, 0.75, 0.85, 0.95, 1.05, 1.15, 1.25, 1.4, 1.6, 0.5]);
  const a = d < 0.35 ? pick(rng, [1, 2, -1, -2]) : pick(rng, [1, 2, -1, -2, 0.5, -0.5, 3, -3, 1.5]);
  return { rho, a, e };
}

export const generators: Generator[] = [
  {
    id: 'clipped',
    make(rng, d) {
      const { rho, a, e } = setup(rng, d);
      const raw = clean(rho * a);
      const c = clip(rho, e);
      const cl = clean(c * a);
      const v = Math.min(raw, cl);
      const hit = c !== rho;
      const lo = clean(1 - e);
      const hi = clean(1 + e);
      const other = clean((rho > 1 ? lo : hi) * a);
      return {
        prompt: `A token has $${RHO} = ${num(rho)}$ and $${ADV} = ${num(a)}$, with $${EPS} = ${num(e)}$. What is its term in PPO's clipped objective?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(raw !== v ? [{ value: raw, why: `That is $${RHO}${ADV}$ unclipped. The clipped term, $${num(cl)}$, is smaller here, and the objective takes the smaller.` }] : []),
          ...(cl !== v ? [{ value: cl, why: `That is the clipped term, but the objective takes the smaller of the two, and here that is $${RHO}${ADV} = ${num(raw)}$.` }] : []),
          ...(hit ? [{ value: other, why: `That clips to the wrong end. $${num(rho)}$ is ${rho > 1 ? 'above' : 'below'} the range, so it becomes $${num(c)}$.` }] : []),
          { value: a, why: `That is the advantage alone. Multiply it by the ratio${hit ? ', clipped or not, whichever gives less' : ''}.` },
        ]),
        solution: [
          `The clip range is $1 - ${EPS} = ${num(lo)}$ to $1 + ${EPS} = ${num(hi)}$.`,
          `Unclipped: $${RHO}${ADV} = ${num(rho)} \\times ${par(a)} = ${num(raw)}$.`,
          hit
            ? `Clipped: $${num(rho)}$ is ${rho > hi ? 'above' : 'below'} the range, so it becomes $${num(c)}$, and $${num(c)} \\times ${par(a)} = ${num(cl)}$.`
            : `Clipped: $${num(rho)}$ is inside the range, so it stays, and the clipped term is $${num(cl)}$ too.`,
          hit ? `The term is the smaller of $${num(raw)}$ and $${num(cl)}$: $${num(v)}$.` : `Both terms are the same, so the term is $${num(v)}$.`,
          ...(hit ? [v === cl ? 'The clip took away the reward for moving further.' : 'The ratio moved the wrong way, so the unclipped term is the lower one and stays: clipping only ever removes a reward.'] : []),
        ],
      };
    },
  },
  {
    id: 'push',
    make(rng, d) {
      const e = d < 0.5 ? 0.2 : pick(rng, [0.1, 0.2, 0.3]);
      const pos = rng.int(2) === 0;
      const a = pos ? pick(rng, [1, 2, 0.5, 3]) : pick(rng, [-1, -2, -0.5, -3]);
      const out = rng.int(2) === 0;
      // Out of range on the side the advantage pushes toward: clipped flat. Otherwise still pushed.
      const rho = out ? clean(pos ? 1 + e + pick(rng, [0.05, 0.1, 0.3]) : 1 - e - pick(rng, [0.05, 0.1, 0.2])) : pick(rng, [clean(1 + e * 0.5), clean(1 - e * 0.5), 1, clean(pos ? 1 - e - 0.1 : 1 + e + 0.1)]);
      const flat = (pos && rho > 1 + e) || (!pos && rho < 1 - e);
      const bound = clean(pos ? 1 + e : 1 - e);
      const correct = flat ? 2 : pos ? 0 : 1;
      const why: (string | null)[] = [
        pos ? `Past $1 + ${EPS} = ${num(clean(1 + e))}$ the clipped term is flat, and the smaller term is that one: no push.` : `The advantage is negative, so the objective rewards making this token less likely, not more.`,
        !pos ? `Below $1 - ${EPS} = ${num(clean(1 - e))}$ the clipped term is flat, and the smaller term is that one: no push.` : `The advantage is positive, so the objective rewards making this token more likely, not less.`,
        `Only a ratio past the bound in the advantage's own direction is clipped flat. Here $${RHO} = ${num(rho)}$ ${pos ? `is below $${num(clean(1 + e))}$` : `is above $${num(clean(1 - e))}$`}, so the term still changes with it.`,
      ];
      why[correct] = null;
      return {
        prompt: `A token has $${ADV} = ${num(a)}$, and after a few updates $${RHO} = ${num(rho)}$. With $${EPS} = ${num(e)}$, does PPO's clipped objective still push its probability, and which way?`,
        answer: { kind: 'choice', options: ['Yes, up: higher probability still raises the objective', 'Yes, down: lower probability still raises the objective', 'No: the objective is flat here, so there is no push'], correct, why },
        solution: [
          pos ? `$${ADV} = ${num(a)}$ is positive, so a higher $${RHO}$ raises the objective: any push is up.` : `$${ADV} = ${num(a)}$ is negative, so a lower $${RHO}$ raises the objective: any push is down.`,
          `The clip stops paying ${pos ? 'past' : 'below'} $1 ${pos ? '+' : '-'} ${EPS} = ${num(bound)}$.`,
          flat
            ? `$${RHO} = ${num(rho)}$ is already ${pos ? 'past' : 'below'} it, so the smaller term is the flat clipped one: no push.`
            : `$${RHO} = ${num(rho)}$ has not ${pos ? 'passed' : 'gone below'} it, so the smaller term is $${RHO}${ADV}$, which still changes with $${RHO}$: pushed ${pos ? 'up' : 'down'}.`,
        ],
      };
    },
  },
  {
    id: 'why-clip',
    make(rng) {
      const e = pick(rng, [0.1, 0.2, 0.3]);
      const n = pick(rng, [2, 4, 8, 3]);
      if (rng.int(2) === 0) {
        return {
          prompt: `PPO samples a batch of answers with $${OLD}$, then makes ${n} updates on that same batch, clipping the ratio to between $${num(clean(1 - e))}$ and $${num(clean(1 + e))}$. Why clip?`,
          answer: choose(`So reusing the batch cannot move the model far from $${OLD}$, which produced it`, [
            ['To keep every probability between zero and one as it is updated', `Probabilities stay between 0 and 1 anyway. The clip limits the ratio $${PI} / ${OLD}$, not the probabilities.`],
            ['To stop negative advantages from lowering any token\'s probability', `Negative advantages still lower probabilities, until the ratio falls to $1 - ${EPS}$.`],
            ['So the model can never move away from the frozen reference model', `That is the KL penalty's job, over the whole run. The clip is about $${OLD}$, the model that sampled this batch.`],
          ]),
          solution: [
            `The samples, and their advantages, describe answers from $${OLD}$. Far from it, the estimate stops being trustworthy.`,
            `Clipping removes any reward for pushing a ratio more than $${num(e)}$ from 1, so ${n} updates on one batch cannot run away with it.`,
          ],
        };
      }
      return {
        prompt: `In PPO for a language model, the reward carries a KL penalty to the reference model, and the objective clips the ratio $${RHO}$ with $${EPS} = ${num(e)}$. What does the clip limit?`,
        answer: choose(`How far one batch's updates move the model from $${OLD}$`, [
          ['How far the whole run moves the model from the reference', `That is the KL penalty. The clip compares with $${OLD}$, which is replaced by the new model every batch.`],
          ['How large an advantage can get before it is used', `The advantage is not clipped; the ratio it multiplies is.`],
          ['How many tokens a sampled answer may contain', 'Answers can be any length. The clip acts on each token\'s ratio.'],
        ]),
        solution: [
          `$${OLD}$ is the model that sampled the current batch; after the batch's updates, the trained model becomes the next $${OLD}$.`,
          'So the clip bounds each batch\'s step, while the KL penalty keeps the whole run near the reference.',
        ],
      };
    },
  },
];
