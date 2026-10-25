import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, round, vec } from '../../kit';
import { probs } from '../../optimization/kit';
import { E, K, big, clean, commas, experts, traps } from '../modern-kit';

/** Indices of the `k` largest entries, largest first. */
const topk = (xs: readonly number[], k: number): number[] => xs.map((_, i) => i).sort((a, b) => xs[b]! - xs[a]!).slice(0, k);

/** Router logits with a clear top k: distinct integers, so no tie decides the choice. */
function logits(rng: Rng, n: number, d: number): number[] {
  return ints(rng, n, d < 0.5 ? -1 : -3, 4, true);
}

const label = (ids: readonly number[]): string => {
  const t = experts(ids);
  return t[0]!.toUpperCase() + t.slice(1);
};

export const generators: Generator[] = [
  {
    id: 'params',
    make(rng, d) {
      const total = rng.next() < 0.5;
      if (d < 0.35) {
        const n = pick(rng, [4, 8, 16]);
        const k = pick(rng, [1, 2]);
        const p = pick(rng, [2, 3, 5, 10, 25]);
        const ans = (total ? n : k) * p;
        return {
          prompt: `An MoE layer has $${E} = ${n}$ experts of ${p} million parameters each, and its router sends every token to $${K} = ${k}$ of them. How many expert parameters, in millions, does ${total ? 'the layer store' : 'one token run through'}?`,
          answer: { kind: 'number', value: ans },
          traps: traps(ans, [
            total
              ? { value: k * p, why: `That counts only the $${K}$ experts one token runs: the active parameters. Every expert is stored.` }
              : { value: n * p, why: `That counts all $${E}$ experts: the total, which must be stored. One token runs only $${K}$ of them.` },
            { value: n * k * p, why: `That multiplies by both $${E}$ and $${K}$. Stored is $${E}$ experts, run is $${K}$.` },
          ]),
          solution: [
            total ? `Every one of the $${E} = ${n}$ experts is stored, whichever a token uses.` : `A token runs only the $${K} = ${k}$ experts its router picks.`,
            `$${total ? n : k} \\times ${p} = ${ans}$ million.`,
          ],
        };
      }
      const L = pick(rng, [4, 8, 16, 32]);
      const S = pick(rng, [100, 200, 500, 1000]);
      const n = pick(rng, [8, 16, 32, 64]);
      const k = pick(rng, [1, 2, 4]);
      const p = pick(rng, [5, 10, 20, 50]);
      const tot = S + L * n * p;
      const act = S + L * k * p;
      const ans = total ? tot : act;
      return {
        prompt: `A model has ${L} layers. Each has an MoE layer of $${E} = ${n}$ experts with ${p} million parameters each, routing every token to $${K} = ${k}$ of them. Attention, embeddings and everything else every token uses add ${commas(S)} million more. How many parameters, in millions, are ${total ? 'in the model in total' : 'active for one token'}?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          total
            ? { value: act, why: `That is the active count: $${K}$ experts per layer. The total stores all $${E}$.` }
            : { value: tot, why: `That is the total: every expert stored. A token runs only $${K}$ per layer.` },
          { value: ans - S, why: 'That leaves out the shared parameters, which every token uses and which are stored once.' },
          { value: S + (total ? n : k) * p, why: `That counts one layer's experts; every one of the ${L} layers has its own.` },
        ]),
        solution: [
          `Experts per layer: $${total ? `${E} = ${n}` : `${K} = ${k}`}$, so $${L} \\times ${total ? n : k} \\times ${p} = ${big(ans - S)}$ million in experts.`,
          `Add the shared ${commas(S)} million: $${big(ans - S)} + ${big(S)} = ${big(ans)}$ million.`,
          total ? 'The total sets the memory needed to hold the model.' : 'The active count sets the compute per token.',
        ],
      };
    },
  },
  {
    id: 'pick',
    make(rng, d) {
      const n = d < 0.5 ? 4 : pick(rng, [6, 8]);
      const k = d < 0.75 ? 2 : pick(rng, [2, 3]);
      for (;;) {
        const s = logits(rng, n, d);
        const top = topk(s, k);
        const low = topk(s.map((v) => -v), k);
        const first = Array.from({ length: k }, (_, i) => i);
        const one = [top[0]!];
        const sets = [top, low, first, one];
        const keys = sets.map((x) => [...x].sort((a, b) => a - b).join());
        if (new Set(keys).size !== 4) continue;
        const options = sets.map((x) => (x.length === 1 ? `Only expert ${x[0]}` : label(x)));
        const why = [
          null,
          'That picks the lowest scores. Top-k keeps the largest.',
          `That takes the first ${k} experts in order. The router picks by score, not by position.`,
          `That is top-1. This router keeps $${K} = ${k}$.`,
        ];
        return {
          prompt: `A router gives one token the logits $${vec(s)}$ for experts 0 to ${n - 1}, then a softmax, then keeps the top $${K} = ${k}$. Which experts run for this token?`,
          answer: { kind: 'choice', options, correct: 0, why },
          solution: [
            'Softmax keeps the order of the scores: a larger logit always gets a larger probability.',
            `So the top ${k} probabilities belong to the top ${k} logits: ${top.map((i) => `$${s[i]}$ (expert ${i})`).join(', ')}.`,
            `${label(top)} run; the other ${n - k} do no work for this token.`,
          ],
        };
      }
    },
  },
  {
    id: 'gates',
    make(rng, d) {
      const n = d < 0.5 ? 4 : pick(rng, [5, 6]);
      const k = d < 0.75 ? 2 : 3;
      for (;;) {
        const p = probs(rng, n, d);
        const order = topk(p, n);
        if (p[order[k - 1]!] === p[order[k]!]) continue;
        const top = order.slice(0, k);
        const j = pick(rng, top);
        const kept = clean(top.reduce((a, i) => a + p[i]!, 0));
        const ans = p[j]! / kept;
        if (Math.abs(ans - 1 / k) < 0.01) continue;
        return {
          prompt: `The router's softmax gives $\\symp = ${vec(p)}$ over experts 0 to ${n - 1}. The layer keeps the top $${K} = ${k}$ and renormalizes their gates to add up to 1. What is the gate of expert ${j}? Round to two decimals.`,
          answer: { kind: 'number', value: ans, places: 2 },
          traps: traps(ans, [
            { value: p[j]!, why: 'That is the router\'s probability before renormalizing. The kept gates must add up to 1 again.' },
            { value: 1 / k, why: `That splits the weight evenly. The gates keep the router's proportions.` },
            { value: kept, why: 'That is the total of the kept probabilities: the number to divide by.' },
          ], 2),
          solution: [
            `The top ${k}: ${label(top).toLowerCase()}, with $${top.map((i) => num(p[i]!)).join(' + ')} = ${num(kept)}$.`,
            `Divide expert ${j}'s probability by that total: $${num(p[j]!)} / ${num(kept)} \\approx ${num(round(ans, 2), 2)}$.`,
            'The dropped experts get gate 0, and the kept gates add up to 1.',
          ],
        };
      }
    },
  },
  {
    id: 'balance',
    make(rng) {
      const n = pick(rng, [4, 8, 16, 32, 64]);
      const j = int(rng, 0, n - 1);
      const kind = rng.int(3);
      if (kind === 0) {
        const pct = pick(rng, [40, 50, 60, 70, 80]);
        return {
          prompt: `Early in training, the router of an MoE layer with $${E} = ${n}$ experts starts sending ${pct}% of the tokens to expert ${j}. Left alone, what tends to happen?`,
          answer: {
            kind: 'choice',
            options: [
              `Expert ${j} gets the most gradient, improves fastest, and draws even more tokens`,
              `The router spreads the tokens out again by itself, since expert ${j} is busy`,
              `Each token costs more compute, because expert ${j} does more work`,
              `Nothing much: every token still runs $${K}$ experts either way`,
            ],
            correct: 0,
            why: [
              null,
              `Nothing in the task loss rewards spreading out. The busy expert improves fastest, so the router favors it more.`,
              `Compute per token depends on $${K}$, not on which experts run: every expert is the same size.`,
              'The idle experts barely train, so their parameters are paid for and wasted, and the busy expert becomes the bottleneck.',
            ],
          },
          solution: [
            'An expert that gets more tokens gets more gradient, so it improves faster.',
            'The router learns to prefer whatever lowers the loss, so it sends that expert even more: the imbalance feeds itself.',
            'The end point is collapse: a few experts do all the work and the rest sit idle. A balancing loss is added to prevent it.',
          ],
        };
      }
      if (kind === 1) {
        return {
          prompt: `A load-balancing loss is added to an MoE layer with $${E} = ${n}$ experts. What is it lowest for?`,
          answer: {
            kind: 'choice',
            options: [
              `Every expert getting about $1/${n}$ of the tokens`,
              'The router being as confident as possible',
              `Each token running fewer than $${K}$ experts`,
              'The best expert getting most of the tokens',
            ],
            correct: 0,
            why: [
              null,
              'A confident router can still send every token to the same expert. The loss is about the spread of tokens.',
              `$${K}$ is fixed by the design. The loss only shapes which experts get the tokens.`,
              'That is exactly the imbalance the loss is there to prevent.',
            ],
          },
          solution: [
            'The balancing loss is smallest when the tokens are spread evenly across the experts.',
            `With $${E} = ${n}$, an even load is $1/${n}$ of the tokens each.`,
            'It is kept small next to the task loss, so balance never outweighs doing the task well.',
          ],
        };
      }
      const share = pick(rng, [30, 40, 50]);
      return {
        prompt: `In an MoE layer with $${E} = ${n}$ experts, expert ${j} gets ${share}% of the tokens and many others get almost none. The model still trains. Why is this a problem?`,
        answer: {
          kind: 'choice',
          options: [
            'The busy expert slows the whole layer, and the idle ones are wasted parameters',
            'Each token now runs through more active parameters than before',
            'The router\'s probabilities no longer add up to 1',
            'The idle experts are deleted, so the total parameter count shrinks',
          ],
          correct: 0,
          why: [
            null,
            `Every token still runs exactly $${K}$ experts, so its active parameters do not change.`,
            'A softmax always adds up to 1, however uneven it is.',
            'Every expert is still stored: the idle ones are paid for in memory and do no work.',
          ],
        },
        solution: [
          'The experts run side by side, so the layer waits for its busiest expert to finish.',
          'Experts that get almost no tokens barely train: their parameters are stored and wasted.',
        ],
      };
    },
  },
];
