import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { ints, num, pick, vec } from '../../kit';
import { add, B1, B2, mat, matvec, prods, relu, straps, terms, transpose, vtraps, traps, W1, W2 } from '../kit';

interface Net {
  x: number[];
  W1: number[][];
  b1: number[];
  z: number[];
  h: number[];
  W2: number[][];
  b2: number[];
  s: number[];
}

/** A tiny network whose hidden layer has a unit on and a unit off, so the ReLU always matters. */
function net(rng: Rng, d: number, H: number): Net {
  for (;;) {
    const x = d < 0.35 ? ints(rng, 2, 0, 3) : ints(rng, 2, -2, 3);
    const W1 = Array.from({ length: H }, () => ints(rng, 2, -2, 2));
    const b1 = ints(rng, H, -2, 2);
    const z = add(matvec(W1, x), b1);
    if (!z.some((v) => v > 0) || !z.some((v) => v < 0)) continue;
    const h = z.map(relu);
    const W2 = Array.from({ length: 2 }, () => (d < 0.35 ? ints(rng, H, -1, 3) : ints(rng, H, -2, 3)));
    const b2 = ints(rng, 2, -2, 2);
    const s = add(matvec(W2, h), b2);
    // Forgetting the ReLU must change the scores, or the trap would equal the answer.
    const noRelu = add(matvec(W2, z), b2);
    if (noRelu.every((v, k) => v === s[k])) continue;
    return { x, W1, b1, z, h, W2, b2, s };
  }
}

const hiddenSteps = (N: Net) => [
  ...N.W1.map((r, i) => `Unit ${i}: row ${i} of $${W1}$ dotted with $\\symx$, plus its bias: $${terms([prods(r, N.x), N.b1[i]!])} = ${num(N.z[i]!)}$.`),
  `ReLU, entry by entry: $\\symh = \\mathrm{ReLU}(${vec(N.z)}) = ${vec(N.h)}$.`,
];

const given = (N: Net) => `$$${W1} = ${mat(N.W1)}, \\qquad ${B1} = ${vec(N.b1)}$$`;

export const generators: Generator[] = [
  {
    id: 'hidden',
    make(rng, d) {
      const H = d < 0.6 ? 2 : 3;
      const N = net(rng, d, H);
      const ts = [
        { value: N.z, why: `That is $${W1}\\symx + ${B1}$ before the ReLU. Negative entries become 0.` },
        { value: matvec(N.W1, N.x).map(relu), why: `That leaves out $${B1}$. Add each unit's bias before the ReLU.` },
      ];
      if (H === 2) ts.push({ value: add(matvec(transpose(N.W1), N.x), N.b1).map(relu), why: `That dots the columns of $${W1}$ with $\\symx$. Each hidden unit's weights are a row.` });
      return {
        prompt: `A two-layer network's first layer has\n\n${given(N)}\n\nFor the input $\\symx = ${vec(N.x)}$, what is the hidden layer $\\symh = \\mathrm{ReLU}(${W1}\\symx + ${B1})$?`,
        answer: { kind: 'vector', value: N.h },
        traps: vtraps(N.h, ts),
        solution: hiddenSteps(N),
      };
    },
  },
  {
    id: 'score',
    make(rng, d) {
      const H = d < 0.8 ? 2 : 3;
      const N = net(rng, d, H);
      const both = d >= 0.6;
      const k = rng.int(2);
      const noRelu = add(matvec(N.W2, N.z), N.b2);
      const noB2 = matvec(N.W2, N.h);
      const swapped = H === 2 ? add(matvec(N.W1, N.h), N.b2) : null;
      const ask = both ? `what are the scores $\\syms = ${W2}\\symh + ${B2}$? Enter class 0 first.` : `what is the score of class ${k}, $\\syms_{${k}}$, the ${k ? 'second' : 'first'} entry of $\\syms = ${W2}\\symh + ${B2}$?`;
      const steps = [
        ...hiddenSteps(N),
        ...(both ? [0, 1] : [k]).map((c) => `Class ${c}: row ${c} of $${W2}$ dotted with $\\symh$, plus its bias: $${terms([prods(N.W2[c]!, N.h), N.b2[c]!])} = ${num(N.s[c]!)}$.`),
      ];
      const prompt = `A two-layer network has\n\n${given(N)}\n\n$$${W2} = ${mat(N.W2)}, \\qquad ${B2} = ${vec(N.b2)}$$\n\nThe input is $\\symx = ${vec(N.x)}$. With $\\symh = \\mathrm{ReLU}(${W1}\\symx + ${B1})$, ${ask}`;
      if (both) {
        const ts = [
          { value: noRelu, why: `That skips the ReLU: it scores $${W1}\\symx + ${B1}$ itself. Zero its negative entries first.` },
          { value: noB2, why: `That leaves out $${B2}$.` },
        ];
        if (swapped) ts.push({ value: swapped, why: `That multiplies $\\symh$ by $${W1}$. The second layer has its own weights, $${W2}$.` });
        return { prompt, answer: { kind: 'vector', value: N.s }, traps: vtraps(N.s, ts), solution: [...steps, `So $\\syms = ${vec(N.s)}$.`] };
      }
      const ts = [
        { value: noRelu[k]!, why: `That skips the ReLU: it scores $${W1}\\symx + ${B1}$ itself. Zero its negative entries first.` },
        { value: noB2[k]!, why: `That leaves out $${B2}$.` },
        { value: N.s[1 - k]!, why: `That is class ${1 - k}'s score. Class ${k} is row ${k} of $${W2}$, counting from 0.` },
      ];
      if (swapped) ts.push({ value: swapped[k]!, why: `That multiplies $\\symh$ by $${W1}$. The second layer has its own weights, $${W2}$.` });
      return { prompt, answer: { kind: 'number', value: N.s[k]! }, traps: traps(N.s[k]!, ts), solution: steps };
    },
  },
  {
    id: 'shapes',
    make(rng, d) {
      const D = pick(rng, [4, 784, 3072, 12288]);
      const H = pick(rng, [10, 50, 100, 200, 500]);
      const C = pick(rng, [2, 3, 10, 100]);
      const what = d < 0.4 ? pick(rng, ['W1', 'W2']) : pick(rng, ['W1', 'W2', 'b1', 'b2', 'h', 's']);
      const tex: Record<string, string> = { W1, W2, b1: B1, b2: B2, h: '\\symh', s: '\\syms' };
      const shape: Record<string, number[]> = { W1: [H, D], W2: [C, H], b1: [H], b2: [C], h: [H], s: [C] };
      const ts: Record<string, { value: number[]; why: string }[]> = {
        W1: [
          { value: [D, H], why: `That is transposed. $${W1}$ has one row per hidden unit, so it is (H, D), and $${W1}\\symx$ has H entries.` },
          { value: [C, D], why: 'That is a one-layer classifier\'s W, straight from inputs to scores. The first layer maps inputs to hidden units.' },
        ],
        W2: [
          { value: [H, C], why: `That is transposed. $${W2}$ has one row per class, so it is (C, H).` },
          { value: [C, D], why: `$${W2}$ reads the hidden layer $\\symh$, not the input: its columns are the H hidden units.` },
        ],
        b1: [
          { value: [D], why: 'One bias per hidden unit, not per input feature.' },
          { value: [C], why: `That is $${B2}$'s shape. $${B1}$ has one bias per hidden unit.` },
        ],
        b2: [
          { value: [H], why: `That is $${B1}$'s shape. $${B2}$ is added to the scores: one per class.` },
          { value: [D], why: 'One bias per class, added to the scores.' },
        ],
        h: [
          { value: [D], why: 'The hidden layer has one entry per hidden unit, not per input feature.' },
          { value: [C], why: 'That is the scores\' shape. $\\symh$ has one entry per hidden unit.' },
        ],
        s: [
          { value: [H], why: 'That is the hidden layer\'s shape. The scores have one entry per class.' },
          { value: [D], why: 'One score per class.' },
        ],
      };
      const why: Record<string, string> = {
        W1: `$${W1}\\symx$ must give one number per hidden unit from ${D} inputs: H rows of D columns.`,
        W2: `$${W2}\\symh$ must give one score per class from ${H} hidden units: C rows of H columns.`,
        b1: 'One bias per hidden unit, added to $W_1\\symx$ before the ReLU.',
        b2: 'One bias per class, added to $W_2\\symh$.',
        h: 'One activation per hidden unit.',
        s: 'One score per class.',
      };
      const dims = `$\\symD = ${D}$ input features, $\\symH = ${H}$ hidden units and $\\symC = ${C}$ classes`;
      return {
        prompt: `A two-layer network $\\syms = ${W2}\\,\\mathrm{ReLU}(${W1}\\symx + ${B1}) + ${B2}$ has ${dims}. What is the shape of $${tex[what]}$?`,
        answer: { kind: 'shape', value: shape[what]! },
        traps: straps(shape[what]!, ts[what]!),
        solution: [
          `The shapes chain: $\\symx$ is (${D},), $\\symh$ is (${H},) and $\\syms$ is (${C},).`,
          why[what]!,
          `So $${tex[what]}$ is (${shape[what]!.join(', ')}${shape[what]!.length === 1 ? ',' : ''}).`,
        ],
      };
    },
  },
  {
    id: 'collapse',
    make(rng) {
      const H = pick(rng, [2, 10, 100, 1000]);
      const D = pick(rng, [2, 784, 3072]);
      const C = pick(rng, [2, 10]);
      return {
        prompt: `A two-layer network with $\\symD = ${D}$ inputs, $\\symH = ${H}$ hidden units and $\\symC = ${C}$ classes is built without the ReLU: $\\symh = ${W1}\\symx + ${B1}$, then $\\syms = ${W2}\\symh + ${B2}$. What can it compute?`,
        answer: {
          kind: 'choice',
          options: [
            'Exactly what one linear classifier can: the two layers collapse into one',
            'More than one linear classifier, since it has two sets of weights',
            'Curved boundaries, only less sharp than with the ReLU in place',
            'Nothing useful: without an activation every score comes out 0',
          ],
          correct: 0,
          why: [
            null,
            `More weights do not help: $${W2}${W1}$ is a single (${C}, ${D}) matrix, so every function it computes is one linear classifier.`,
            'Linear maps of linear maps stay linear: the boundaries between classes are still straight.',
            `The scores are not 0: they are $${W2}${W1}\\symx$ plus a constant, a perfectly good linear classifier, and no more.`,
          ],
        },
        solution: [
          `Substitute: $\\syms = ${W2}(${W1}\\symx + ${B1}) + ${B2} = (${W2}${W1})\\symx + (${W2}${B1} + ${B2})$.`,
          `$${W2}${W1}$ is one (${C}, ${D}) matrix and $${W2}${B1} + ${B2}$ one vector of ${C} biases: a single linear classifier, whatever $\\symH$ is.`,
          'The ReLU between the layers is what stops the collapse, and what lets the boundaries between classes bend.',
        ],
      };
    },
  },
];
