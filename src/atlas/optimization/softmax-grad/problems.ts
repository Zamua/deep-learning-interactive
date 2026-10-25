import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { num, vec } from '../../kit';
import { clean, onehot, probs, traps, vtraps } from '../kit';

const ORD = ['first', 'second', 'third', 'fourth'];

/** Probabilities, the correct class and the score gradient p - onehot(y). */
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
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct class is $\\symy = ${y}$ (class 0 is the first entry). What is the gradient of the cross-entropy loss with respect to the scores, $${dLds()}$?`,
        answer: { kind: 'vector', value: g },
        traps: vtraps(g, [
          { value: p, why: 'That is $\\symp$ unchanged. Subtract the one-hot label: 1 comes off the correct class\'s entry.' },
          { value: g.map((x) => -x), why: 'That has every sign flipped: it is $\\mathrm{onehot}(\\symy) - \\symp$. The gradient is $\\symp - \\mathrm{onehot}(\\symy)$, negative only at the correct class.' },
          { value: p.map((x, i) => x - (i === top ? 1 : 0)), why: `That takes 1 off class ${top}, the most probable class. It comes off the correct class, $\\symy = ${y}$.` },
        ]),
        solution: [
          `The gradient is the probabilities minus the one-hot label: $${dLds()} = \\symp - \\mathrm{onehot}(\\symy)$.`,
          `The one-hot label for class ${y} is $${vec(onehot(n, y))}$.`,
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
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct class is $\\symy = ${y}$. What is $${dLds(j)}$, the gradient for class ${j} (the ${ORD[j]} score)?`,
        answer: { kind: 'number', value: v },
        traps: traps(
          v,
          same
            ? [
                { value: p[j]!, why: `That is $\\symp_{${j}}$ alone. Class ${j} is the correct class, so subtract 1 from its probability.` },
                { value: 1 - p[j]!, why: 'That has the wrong sign. The correct class\'s entry is $\\symp_{\\symy} - 1$, which is negative: raising its score lowers the loss.' },
              ]
            : [
                { value: p[j]! - 1, why: `That subtracts 1 at class ${j}, but the 1 comes off only at the correct class, $\\symy = ${y}$.` },
                { value: -p[j]!, why: 'That has the wrong sign. A wrong class\'s entry is $+\\symp_j$: raising its score raises the loss.' },
                { value: 0, why: 'Every class gets a gradient, not only the correct one: raising a wrong class\'s score takes probability from the correct class.' },
              ],
        ),
        solution: [
          `Entry $j$ of the gradient is $\\symp_j$, minus 1 when $j$ is the correct class.`,
          same ? `Class ${j} is the correct class: $${dLds(j)} = ${num(p[j]!)} - 1 = ${num(v)}$.` : `Class ${j} is not the correct class (that is ${y}), so $${dLds(j)} = \\symp_{${j}} = ${num(v)}$.`,
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
        `Only the correct class's entry, $\\symp_{\\symy} - 1$, is negative. Class ${j} is a wrong class, so its entry is $\\symp_{${j}} > 0$.`,
        `The correct class's entry is $\\symp_{\\symy} - 1$, negative whenever $\\symp_{\\symy} < 1$.`,
        'Every score gets a gradient: softmax ties them together, so moving any score moves $\\symp_{\\symy}$ and the loss.',
        `A step goes against the gradient, so a negative entry raises the score.${same ? '' : ` And class ${j}'s entry is positive anyway.`}`,
        `A step goes against the gradient, so a positive entry lowers the score.${same ? ' And the correct class\'s entry is negative anyway.' : ''}`,
      ];
      why[same ? 0 : 1] = null;
      return {
        prompt: `Softmax gives $\\symp = ${vec(p)}$, and the correct class is $\\symy = ${y}$. What is the sign of $${dLds(j)}$, the cross-entropy gradient for class ${j}, and what does a gradient step do to $${sj}$?`,
        answer: {
          kind: 'choice',
          options: [`Negative, so a step raises $${sj}$`, `Positive, so a step lowers $${sj}$`, `Zero, so a step leaves $${sj}$ alone`, `Negative, so a step lowers $${sj}$`, `Positive, so a step raises $${sj}$`],
          correct: same ? 0 : 1,
          why,
        },
        solution: [
          `$${dLds(j)} = \\symp_{${j}}${same ? ' - 1' : ''} = ${num(clean(p[j]! - (same ? 1 : 0)))}$.`,
          same
            ? 'The correct class always has a negative entry, so a gradient step raises its score.'
            : 'Every wrong class has a positive entry, its own probability, so a gradient step lowers its score.',
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
          'The entries of $\\symp - \\mathrm{onehot}(\\symy)$ add up to $1 - 1 = 0$: the probabilities add up to 1, and the label takes exactly 1 away.',
          `The others add up to $${num(others)}$, so the missing entry is $${num(v)}$.`,
          v < 0 ? 'It is negative, so it belongs to the correct class: $\\symp_{\\symy} - 1$.' : 'It is positive, so it belongs to a wrong class: its entry is just its probability.',
        ],
      };
    },
  },
];
