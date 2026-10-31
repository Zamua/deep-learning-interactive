import type { Generator, Problem } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, ints, mat, num, par, traps, vec, vtraps } from '../../kit';
import { B2, matvec, nonzeros, relu, transpose, W1, W2 } from '../kit';

interface Back {
  z: number[];
  h: number[];
  W2: number[][];
  ds: number[];
  dh: number[];
  dz: number[];
}

/** A hidden layer with units on and off, the second layer's weights, and a softmax-style gradient on two scores. */
function back(rng: Rng, d: number, H: number): Back {
  for (;;) {
    const z = nonzeros(rng, H, -3, 3);
    if (!z.some((v) => v > 0) || !z.some((v) => v < 0)) continue;
    const W2 = Array.from({ length: 2 }, () => (d < 0.35 ? ints(rng, H, -1, 3) : ints(rng, H, -2, 3)));
    const a = d < 0.7 ? int(rng, 1, 9) / 10 : int(rng, 5, 95) / 100;
    const ds = rng.next() < 0.5 ? [a, -a] : [-a, a];
    const dh = matvec(transpose(W2), ds);
    // The mask must zero something, and the gradient must reach the units that stay on.
    if (!z.some((v, j) => v < 0 && dh[j] !== 0) || !z.some((v, j) => v > 0 && dh[j] !== 0)) continue;
    const h = z.map(relu);
    const dz = dh.map((g, j) => (z[j]! > 0 ? g : 0));
    return { z, h, W2, ds, dh, dz };
  }
}

const dS = 'd\\syms';
const dH = 'd\\symh';
/** The forward pass's hidden layer, before and after the ReLU. */
const ON = (B: Back) => `the pre-activations are $z = ${vec(B.z)}$, the hidden layer is $\\symh = ${vec(B.h)}$`;

/** One worked line per hidden unit of dh = W2^T ds: column j of W2 dotted with ds. */
const dhSteps = (B: Back) => B.dh.map((g, j) => `Unit ${j}: column ${j} of $${W2}$ dotted with $${dS}$: $${par(B.W2[0]![j]!)} \\cdot ${par(B.ds[0]!)} + ${par(B.W2[1]![j]!)} \\cdot ${par(B.ds[1]!)} = ${num(g)}$.`);

function dbProblem(rng: Rng, d: number): Problem {
  let B = back(rng, d, d < 0.5 ? 2 : 3);
  while (String(B.dh) === String(B.ds)) B = back(rng, d, B.z.length);
  const zero = B.ds.map(() => 0);
  const options = [`$${vec(B.ds)}$`, `$${vec(B.dh)}$`, '$0$', `$${vec(zero)}$`];
  return {
    prompt: `In a two-layer network, $${W2} = ${mat(B.W2)}$, the hidden layer is $\\symh = ${vec(B.h)}$, and $${dS} = ${vec(B.ds)}$. What is $d${B2}$?`,
    answer: {
      kind: 'choice',
      options,
      correct: 0,
      why: [
        null,
        `That is $${dH} = ${W2}^T ${dS}$, the gradient passed down to $\\symh$. The bias adds straight onto the scores, so its gradient is $${dS}$ itself.`,
        `That adds up the entries of $${dS}$. Each class has its own bias, and each bias gets its own class's gradient.`,
        'A bias moves the loss like any other parameter: it adds straight onto its score, so it gets that score\'s gradient.',
      ],
    },
    solution: [
      `$${B2}$ adds onto the scores: $\\syms_i = (${W2}\\symh)_i + (${B2})_i$, so raising $(${B2})_i$ raises $\\syms_i$ by the same amount.`,
      `Its local gradient is 1, so the chain rule passes $${dS}$ through unchanged: $d${B2} = ${dS} = ${vec(B.ds)}$.`,
    ],
  };
}

function deadRowProblem(rng: Rng, d: number): Problem {
  for (;;) {
    const B = back(rng, d, 3);
    const off = B.z.map((v, j) => (v < 0 ? j : -1)).filter((j) => j >= 0);
    // One unit off, and a unit on with a negative gradient to tempt reading the mask off dh.
    if (off.length !== 1 || !B.dh.some((g, j) => g < 0 && B.z[j]! > 0) || B.dh.some((g) => g === 0)) continue;
    const j = off[0]!;
    const x = nonzeros(rng, 2, -2, 3);
    const why: (string | null)[] = [0, 1, 2].map((k) => {
      if (k === j) return null;
      const on = `Unit ${k} was on ($z_{${k}} = ${num(B.z[k]!)} > 0$), so its gradient passes the ReLU, and its row is $dz_{${k}} = ${num(B.dz[k]!)}$ times $\\symx$.`;
      return B.dh[k]! < 0 ? `$${dH}_{${k}}$ is negative, but that is a gradient, not the unit's state. ${on}` : on;
    });
    why.push(`Unit ${j} was off ($z_{${j}} = ${num(B.z[j]!)} < 0$). The ReLU's slope there is 0, so $dz_{${j}} = 0$ and its whole row is 0.`);
    return {
      prompt: `In a two-layer network with input $\\symx = ${vec(x)}$, ${ON(B)}, and $${dH} = ${vec(B.dh)}$. Which row of $d${W1}$ is all zeros?`,
      answer: { kind: 'choice', options: ['Row 0', 'Row 1', 'Row 2', 'None of the rows'], correct: j, why },
      solution: [
        'The ReLU passes the gradient where its input was positive and stops it where it was negative: $dz = d\\symh$ masked by $z > 0$.',
        `$z = ${vec(B.z)}$, so $dz = ${vec(B.dz)}$.`,
        `$d${W1} = dz\\,\\symx^T$, so row $k$ is $dz_k\\,\\symx^T$. Only unit ${j}, which was off, has $dz_{${j}} = 0$: row ${j} is all zeros: no gradient from this example reaches that unit's weights.`,
      ],
    };
  }
}

export const generators: Generator[] = [
  {
    id: 'dW2',
    make(rng, d) {
      const H = d < 0.5 ? 2 : 3;
      const B = back(rng, d, H);
      const i = rng.int(2);
      const onUnits = B.z.map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0);
      const j = rng.next() < 0.75 ? onUnits[rng.int(onUnits.length)]! : rng.int(H);
      const v = clean(B.ds[i]! * B.h[j]!);
      const ts = [
        { value: B.ds[i]! * B.z[j]!, why: `That multiplies by $z_{${j}}$, the pre-activation. The second layer saw $\\symh$, after the ReLU: $h_{${j}} = ${num(B.h[j]!)}$.` },
        { value: B.ds[i]!, why: `That is $${dS}_{${i}}$ alone. A weight's gradient is the gradient on its output times the input it multiplied: $h_{${j}}$.` },
        { value: B.ds[1 - i]! * B.h[j]!, why: `That uses $${dS}_{${1 - i}}$. Row $i$ of $d${W2}$ belongs to class $i$, so entry (${i}, ${j}) takes $${dS}_{${i}}$.` },
      ];
      if (j < 2 && i < H) ts.unshift({ value: B.ds[j]! * B.h[i]!, why: `That is entry (${j}, ${i}): the indices are swapped. Row $i$ is the class, column $j$ the hidden unit.` });
      return {
        prompt: `In a two-layer network, ${ON(B)}, and $${dS} = ${vec(B.ds)}$. What is the entry in row ${i}, column ${j} of $d${W2}$, counting from 0?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, ts),
        solution: [
          `$d${W2} = ${dS}\\,\\symh^T$: entry $(i, j)$ is $${dS}_i\\, h_j$, the gradient on score $i$ times $h_j$, the value that weight $(i, j)$ multiplied.`,
          `Entry (${i}, ${j}): $${par(B.ds[i]!)} \\times ${par(B.h[j]!)} = ${num(v)}$.`,
          ...(B.h[j] === 0 ? [`Unit ${j} was off, so every weight reading it gets a zero gradient.`] : []),
        ],
      };
    },
  },
  {
    id: 'dh',
    make(rng, d) {
      const H = d < 0.5 ? 2 : 3;
      const B = back(rng, d, H);
      const ts = [{ value: B.dz, why: `That already applies the ReLU's mask: it is $dz$, one step further down. $${dH}$ is the gradient on the ReLU's output, before the mask.` }];
      if (H === 2) ts.unshift({ value: matvec(B.W2, B.ds), why: `That is $${W2}\\,${dS}$, without the transpose. Unit $j$ collects from column $j$ of $${W2}$: the weights it fed.` });
      return {
        prompt: `In a two-layer network, ${ON(B)}, $${W2} = ${mat(B.W2)}$, and $${dS} = ${vec(B.ds)}$. What is $${dH}$?`,
        answer: { kind: 'vector', value: B.dh },
        traps: vtraps(B.dh, ts),
        solution: [`$${dH} = ${W2}^T ${dS}$: each hidden unit collects the gradient of every score it fed, weighted by the weight it fed it through.`, ...dhSteps(B), `So $${dH} = ${vec(B.dh)}$. The ReLU's mask comes next, on the way to $z$.`],
      };
    },
  },
  {
    id: 'mask',
    make(rng, d) {
      const H = d < 0.35 ? 2 : 3;
      const B = back(rng, d, H);
      return {
        prompt: `In a two-layer network, ${ON(B)}, and $${dH} = ${vec(B.dh)}$. What is $dz$?`,
        answer: { kind: 'vector', value: B.dz },
        traps: vtraps(B.dz, [
          { value: B.dh, why: 'That skips the ReLU. Its slope is 0 wherever $z$ was negative, so the gradient stops there.' },
          { value: B.dh.map((g, j) => g * B.z[j]!), why: 'That multiplies by $z$ itself. The ReLU\'s slope is 1 or 0, not $z$: keep the gradient where $z > 0$ and zero it elsewhere.' },
          { value: B.dh.map(relu), why: `That zeroes the negative gradients. The mask comes from $z$, the unit's input, not from the sign of $${dH}$.` },
        ]),
        solution: [
          'The ReLU\'s slope is 1 where $z > 0$ and 0 where $z < 0$, so the chain rule multiplies by 1 or 0.',
          ...B.z.map((v, j) => `Unit ${j}: $z_{${j}} = ${num(v)}$, ${v > 0 ? `on, so $dz_{${j}} = ${num(B.dh[j]!)}$` : 'off, so $dz_{' + j + '} = 0$'}.`),
          `So $dz = ${vec(B.dz)}$.`,
        ],
      };
    },
  },
  {
    id: 'rules',
    make(rng, d) {
      return rng.next() < 0.5 ? dbProblem(rng, d) : deadRowProblem(rng, d);
    },
  },
];
