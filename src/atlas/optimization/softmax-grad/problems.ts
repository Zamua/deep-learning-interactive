import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { num, vec } from '../../kit';
import { clean, onehot, probs, traps, vtraps } from '../kit';

const ORD = ['first', 'second', 'third', 'fourth'];

/** Probabilities, the correct option and the score gradient p - onehot(y). */
function setup(rng: Rng, d: number) {
  const n = d < 0.6 ? 3 : 4;
  const p = probs(rng, n, d);
  const y = rng.int(n);
  const g = p.map((v, i) => clean(v - (i === y ? 1 : 0)));
  return { n, p, y, g };
}

const dLds = (j?: number | string) => (j === undefined ? '\\partial \\symL / \\partial \\syms' : `\\partial \\symL / \\partial \\syms_{${j}}`);

export const generators: Generator[] = [
  {
    id: 'grad-vector',
    make(rng, d) {
      const { n, p, y, g } = setup(rng, d);
      const top = p.indexOf(Math.max(...p));
      return {
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct option is $\\symy = ${y}$ (option 0 is the first entry). What is the gradient of the cross-entropy loss with respect to the scores, $${dLds()}$?`,
        answer: { kind: 'vector', value: g },
        traps: vtraps(g, [
          { value: p, why: 'That is $\\symp$ unchanged. Subtract the one-hot vector for $\\symy$: 1 comes off the correct option\'s entry.' },
          { value: g.map((x) => -x), why: 'That has every sign flipped: it is $\\mathrm{onehot}(\\symy) - \\symp$. The gradient is $\\symp - \\mathrm{onehot}(\\symy)$, negative only at the correct option.' },
          { value: p.map((x, i) => x - (i === top ? 1 : 0)), why: `That takes 1 off option ${top}, the most probable one. It comes off the correct option, $\\symy = ${y}$.` },
        ]),
        solution: [
          `The gradient is the probabilities minus the one-hot vector for $\\symy$: $${dLds()} = \\symp - \\mathrm{onehot}(\\symy)$.`,
          `The one-hot vector for option ${y} is $${vec(onehot(n, y))}$.`,
          `Subtract: only entry ${y} changes, $${num(p[y]!)} - 1 = ${num(g[y]!)}$, so the gradient is $${vec(g)}$.`,
          'Check: the entries add up to 0.',
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const { p, y, g } = setup(rng, d);
      const j = rng.next() < 0.5 ? y : (y + 1 + rng.int(p.length - 1)) % p.length;
      const v = g[j]!;
      const same = j === y;
      return {
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct option is $\\symy = ${y}$. What is $${dLds(j)}$, the gradient entry for option ${j} (the ${ORD[j]} score)?`,
        answer: { kind: 'number', value: v },
        traps: traps(
          v,
          same
            ? [
                { value: p[j]!, why: `That is $\\symp_{${j}}$ alone. Option ${j} is the correct option, so subtract 1 from its probability.` },
                { value: 1 - p[j]!, why: 'That has the wrong sign. The correct option\'s entry is $\\symp_{\\symy} - 1$, which is negative: raising its score lowers the loss.' },
              ]
            : [
                { value: p[j]! - 1, why: `That subtracts 1 at option ${j}, but the 1 comes off only at the correct option, $\\symy = ${y}$.` },
                { value: -p[j]!, why: 'That has the wrong sign. A wrong option\'s entry is $+\\symp_j$: raising its score raises the loss.' },
                { value: 0, why: 'Every option gets a gradient entry, not only the correct one: raising a wrong option\'s score takes probability from the correct one.' },
              ],
        ),
        solution: [
          `Entry $j$ of the gradient is $\\symp_j$, minus 1 when $j$ is the correct option.`,
          same ? `Option ${j} is the correct option: $${dLds(j)} = ${num(p[j]!)} - 1 = ${num(v)}$.` : `Option ${j} is not the correct option (that is ${y}), so $${dLds(j)} = \\symp_{${j}} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'sign',
    make(rng, d) {
      const { p, y } = setup(rng, d);
      const j = rng.next() < 0.5 ? y : (y + 1 + rng.int(p.length - 1)) % p.length;
      const same = j === y;
      const sj = `\\syms_{${j}}`;
      const why: (string | null)[] = [
        `Only the correct option's entry, $\\symp_{\\symy} - 1$, is negative. Option ${j} is a wrong option, so its entry is $\\symp_{${j}} > 0$.`,
        `The correct option's entry is $\\symp_{\\symy} - 1$, negative whenever $\\symp_{\\symy} < 1$.`,
        'Every score gets a gradient entry: softmax ties them together, so moving any score moves $\\symp_{\\symy}$ and the loss.',
        `A negative entry means the loss falls as the score rises, so lowering the score raises the loss.${same ? '' : ` And option ${j}'s entry is positive anyway.`}`,
        `A positive entry means the loss rises with the score, so raising the score raises the loss.${same ? ' And the correct option\'s entry is negative anyway.' : ''}`,
      ];
      why[same ? 0 : 1] = null;
      return {
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct option is $\\symy = ${y}$. What is the sign of $${dLds(j)}$, the cross-entropy gradient entry for option ${j}, and which way should $${sj}$ move to lower the loss?`,
        answer: {
          kind: 'choice',
          options: [`Negative, so raise $${sj}$ to lower the loss`, `Positive, so lower $${sj}$ to lower the loss`, `Zero, so $${sj}$ does not change the loss`, `Negative, so lower $${sj}$ to lower the loss`, `Positive, so raise $${sj}$ to lower the loss`],
          correct: same ? 0 : 1,
          why,
        },
        solution: [
          `$${dLds(j)} = \\symp_{${j}}${same ? ' - 1' : ''} = ${num(clean(p[j]! - (same ? 1 : 0)))}$.`,
          same
            ? 'The correct option always has a negative entry, so raising its score lowers the loss.'
            : 'Every wrong option has a positive entry, its own probability, so lowering its score lowers the loss.',
        ],
      };
    },
  },
  {
    id: 'missing',
    make(rng, d) {
      const { g } = setup(rng, d);
      const k = rng.int(g.length);
      const others = clean(g.reduce((a, v, i) => a + (i === k ? 0 : v), 0));
      const v = g[k]!;
      const shown = g.map((x, i) => (i === k ? '?' : num(x))).join(',\\ ');
      return {
        prompt: `The gradient of a cross-entropy loss with respect to the scores is $${dLds()} = [${shown}]$. What is the missing entry?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: others, why: 'That has the wrong sign. The missing entry cancels the others, so it is minus their sum.' },
          { value: 1 - others, why: 'That makes the entries add up to 1, like probabilities. A gradient $\\symp - \\mathrm{onehot}(\\symy)$ adds up to 0.' },
        ]),
        solution: [
          'The entries of $\\symp - \\mathrm{onehot}(\\symy)$ add up to $1 - 1 = 0$: the probabilities add up to 1, and the one-hot vector takes exactly 1 away.',
          `The others add up to $${num(others)}$, so the missing entry is $${num(v)}$.`,
          v < 0 ? 'It is negative, so it belongs to the correct option: $\\symp_{\\symy} - 1$.' : 'It is positive, so it belongs to a wrong option: its entry is just its probability.',
        ],
      };
    },
  },
];
