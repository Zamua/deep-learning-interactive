import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { ADV, choose, clean, E2, EPS, OLD, PI, RHO, traps } from '../kit';

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
    id: 'ratio',
    make(rng, d) {
      if (d < 0.5) {
        const [po, pn] = pick(rng, [[0.2, 0.3], [0.4, 0.5], [0.5, 0.4], [0.2, 0.1], [0.25, 0.5], [0.4, 0.6], [0.5, 0.6], [0.8, 0.6], [0.3, 0.6], [0.6, 0.3]] as const);
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
          solution: [`$${RHO} = ${PI} / ${OLD} = ${num(pn)} / ${num(po)} \\approx ${num(v, 2)}$.`, v > 1 ? 'Above 1: the update made this token more likely.' : 'Below 1: the update made this token less likely.'],
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
        solution: [`$${RHO} = ${PI} / ${OLD}$, and a ratio is the exponential of a difference of logs: $${RHO} = e^{\\ln ${PI} - \\ln ${OLD}}$.`, `$\\ln ${PI} - \\ln ${OLD} = ${num(ln)} - (${num(lo)}) = ${num(delta)}$.`, `$${RHO} = e^{${num(delta)}} \\approx ${num(v, 2)}$.`],
      };
    },
  },
  {
    id: 'clipped',
    make(rng, d) {
      const { rho, a, e } = setup(rng, d);
      const raw = clean(rho * a);
      const cl = clean(clip(rho, e) * a);
      const v = Math.min(raw, cl);
      const hit = clip(rho, e) !== rho;
      const other = clean((rho > 1 ? 1 - e : 1 + e) * a);
      return {
        prompt: `A token has $${RHO} = ${num(rho)}$ and $${ADV} = ${num(a)}$, with $${EPS} = ${num(e)}$. What is its term in PPO's clipped objective?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(raw !== v ? [{ value: raw, why: `That is $${RHO}${ADV}$ unclipped. The ratio is outside $${num(clean(1 - e))}$ to $${num(clean(1 + e))}$, and the clipped term is smaller here.` }] : []),
          ...(cl !== v ? [{ value: cl, why: `That is the clipped term, but the objective takes the smaller of the two, and here that is $${RHO}${ADV}$.` }] : []),
          { value: other, why: `That clips to the wrong end. A ratio of $${num(rho)}$ is ${rho > 1 ? 'above 1, so its bound is' : 'below 1, so its bound is'} $${num(clean(rho > 1 ? 1 + e : 1 - e))}$.` },
          { value: a, why: `That is the advantage alone. Multiply it by the ratio${hit ? ', clipped or not, whichever gives less' : ''}.` },
        ]),
        solution: [
          `The term is the smaller of $${RHO}${ADV}$ and $${ADV}$ times $${RHO}$ clipped to between $1 - ${EPS}$ and $1 + ${EPS}$.`,
          `Unclipped: $${RHO}${ADV} = ${num(rho)} \\times ${a < 0 ? `(${num(a)})` : num(a)} = ${num(raw)}$.`,
          hit ? `Clipped: $${num(rho)}$ lies outside $${num(clean(1 - e))}$ to $${num(clean(1 + e))}$, so it becomes $${num(clip(rho, e))}$, giving $${num(cl)}$.` : `$${num(rho)}$ lies inside $${num(clean(1 - e))}$ to $${num(clean(1 + e))}$, so clipping changes nothing.`,
          `The smaller of the two: $${num(v)}$.${hit && v === cl ? ' The clip took away the reward for moving further.' : hit ? ' Clipping only ever removes a reward, so the unclipped term stays when it is lower.' : ''}`,
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
          `With $${ADV} ${pos ? '> 0' : '< 0'}$, the objective wants the ratio ${pos ? 'up' : 'down'}, but the clip stops paying past $${num(clean(pos ? 1 + e : 1 - e))}$.`,
          flat ? `$${RHO} = ${num(rho)}$ is already past it: the smaller term is the flat clipped one, so this token gets no push.` : `$${RHO} = ${num(rho)}$ has not passed it, so the smaller term is $${RHO}${ADV}$ and the token is still pushed ${pos ? 'up' : 'down'}.`,
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
