import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, minus, nonzero, num, par, pick, tenth, traps, vec, vtraps } from '../../kit';

/** A 2-class, 2-feature classifier mid-step: W, b, x, y, the softmax output p and the score gradient ds. */
function setup(rng: Rng, d: number) {
  const x = d < 0.35 ? [int(rng, 1, 3), int(rng, 1, 3)] : [nonzero(rng, -3, 3), nonzero(rng, -3, 3)];
  const p0 = d < 0.7 ? int(rng, 1, 9) / 10 : int(rng, 5, 95) / 100;
  const p = [p0, clean(1 - p0)];
  const y = rng.int(2);
  const ds = p.map((v, i) => clean(v - (i === y ? 1 : 0)));
  const entry = () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2));
  const W = [
    [entry(), entry()],
    [entry(), entry()],
  ];
  const b = [entry(), entry()];
  const eta = d < 0.35 ? pick(rng, [0.1, 0.5, 1]) : pick(rng, [0.1, 0.5]);
  return { x, p, y, ds, W, b, eta };
}

const mat = (W: number[][]) => `\\begin{bmatrix} ${W.map((r) => r.map((v) => num(v)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
const Wij = (i: number, j: number) => `\\symW_{${i},${j}}`;
const given = (o: ReturnType<typeof setup>) =>
  `A linear classifier has $\\symW = ${mat(o.W)}$, one row per class, and the input $\\symx = ${vec(o.x)}$ has label $\\symy = ${o.y}$, counting from 0. Softmax gives $\\symp = ${vec(o.p)}$.`;
const dsStep = (o: ReturnType<typeof setup>) => `The score gradient is $d\\syms = \\symp - \\mathrm{onehot}(\\symy) = ${vec(o.p)} - ${vec(o.y === 0 ? [1, 0] : [0, 1])} = ${vec(o.ds)}$.`;

export const generators: Generator[] = [
  {
    id: 'update',
    make(rng, d) {
      const o = setup(rng, d);
      const i = rng.int(2);
      const j = rng.int(2);
      const dW = clean(o.ds[i]! * o.x[j]!);
      const step = clean(o.eta * dW);
      const v = clean(o.W[i]![j]! - step);
      const w = o.W[i]![j]!;
      return {
        prompt: `${given(o)} After one SGD step with $\\symeta = ${num(o.eta)}$, what is $${Wij(i, j)}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(i === o.y ? [{ value: w - o.eta * o.p[i]! * o.x[j]!, why: `That uses $\\symp_{${i}}$ as the score gradient. Class ${i} is the correct class, so its entry is $\\symp_{${i}} - 1$.` }] : []),
          { value: w + step, why: 'That adds $\\symeta\\, d\\symW$: a step uphill. SGD subtracts it.' },
          ...(i !== j ? [{ value: w - o.eta * o.ds[j]! * o.x[i]!, why: `That swaps row and column: $d${Wij(i, j)}$ is $d\\syms_{${i}}\\, \\symx_{${j}}$, the class's gradient times the feature.` }] : []),
          { value: w - o.eta * o.ds[i]!, why: `That leaves out $\\symx_{${j}}$, which is the bias's step. A weight's gradient is its class's score gradient times its input.` },
        ]),
        solution: [
          dsStep(o),
          `$${Wij(i, j)}$ sits in row ${i}, so it takes $d\\syms_{${i}} = ${num(o.ds[i]!)}$; column ${j} takes $\\symx_{${j}} = ${num(o.x[j]!)}$.`,
          `Its gradient: $d${Wij(i, j)} = d\\syms_{${i}}\\, \\symx_{${j}} = ${par(o.ds[i]!)} \\times ${par(o.x[j]!)} = ${num(dW)}$.`,
          `Step against it: $${Wij(i, j)} - \\symeta\\, d${Wij(i, j)} = ${num(w)} - ${num(o.eta)} \\times ${par(dW)} = ${minus(w, step)} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'bias',
    make(rng, d) {
      const o = setup(rng, d);
      const v = o.b.map((b, i) => clean(b - o.eta * o.ds[i]!));
      return {
        prompt: `${given(o)} The biases are $\\symb = ${vec(o.b)}$. After one SGD step with $\\symeta = ${num(o.eta)}$, what is $\\symb$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: o.b.map((b, i) => b + o.eta * o.ds[i]!), why: 'That adds $\\symeta\\, d\\symb$: a step uphill. SGD subtracts it.' },
          { value: o.b.map((b, i) => b - o.ds[i]!), why: 'That subtracts the whole gradient, leaving out $\\symeta$.' },
          { value: o.b.map((b, i) => b - o.eta * o.p[i]!), why: 'That uses $\\symp$ as the gradient. The correct class\'s entry is $\\symp_{\\symy} - 1$.' },
          { value: o.b.map((b, i) => b - o.eta * o.ds[i]! * o.x[i]!), why: 'That multiplies by $\\symx$, which belongs in the weights\' gradient. A bias adds straight into its score, so its gradient is just the score gradient.' },
        ]),
        solution: [
          'Each bias adds straight into its own score, so its gradient is that score\'s gradient: $\\partial \\symL / \\partial \\symb = \\symp - \\mathrm{onehot}(\\symy)$.',
          dsStep(o),
          ...o.b.map((b, k) => `Entry ${k} steps against its own gradient: $\\symb_{${k}} - \\symeta\\, d\\syms_{${k}} = ${num(b)} - ${num(o.eta)} \\times ${par(o.ds[k]!)} = ${minus(b, clean(o.eta * o.ds[k]!))} = ${num(v[k]!)}$.`),
        ],
      };
    },
  },
  {
    id: 'direction',
    make(rng, d) {
      const o = setup(rng, d);
      const k = rng.int(2);
      const right = k === o.y;
      const why: (string | null)[] = [
        `Only the correct class's row moves toward $\\symx$. Class ${k}'s score gradient is $\\symp_{${k}} = ${num(o.p[k]!)} > 0$, so the step subtracts a multiple of $\\symx$.`,
        `The correct class's score gradient is $\\symp_{\\symy} - 1 < 0$, so subtracting $\\symeta\\,(\\symp_{\\symy} - 1)\\,\\symx$ adds a positive multiple of $\\symx$.`,
        'Every row gets a gradient, $d\\syms_k\\, \\symx$, and it is zero only if $\\symp_k$ is exactly 0 or 1.',
        'Nothing in this step pulls weights toward 0. The step adds a multiple of $\\symx$ to the row.',
      ];
      why[right ? 0 : 1] = null;
      return {
        prompt: `${given(o)} After one SGD step, what happens to row ${k} of $\\symW$?`,
        answer: { kind: 'choice', options: ['It moves toward $\\symx$', 'It moves away from $\\symx$', 'It stays where it is', 'It shrinks toward 0'], correct: right ? 0 : 1, why },
        solution: [
          dsStep(o),
          `Row ${k} changes by $-\\symeta\\, d\\syms_{${k}}\\, \\symx = ${right ? '+' : '-'}${num(Math.abs(o.ds[k]!))}\\,\\symeta\\, \\symx$.`,
          right
            ? `That adds a positive multiple of $\\symx$: the row moves toward $\\symx$, so its dot product with $\\symx$, class ${k}'s score, goes up.`
            : `That subtracts a positive multiple of $\\symx$: the row moves away from $\\symx$, so class ${k}'s score for this input goes down.`,
        ],
      };
    },
  },
];
