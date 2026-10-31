import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, par, pick, traps, vtraps } from '../../kit';
import { dd, n } from '../kit';

type V = { x: number; y: number; z: number };
const D = (v: string) => dd('f', v);

interface Template {
  tex: string;
  /** The nodes, in TeX, in forward order. */
  nodes: string[];
  level: number;
  ok?: (v: V) => boolean;
  /** The gradient of f with respect to x, y and z. */
  grad: (v: V) => [number, number, number];
  /** Intermediate nodes whose gradient a problem can ask for, each defined from the inputs. */
  inner: { name: string; def: string; value: (v: V) => number; grad: (v: V) => number; traps: (v: V) => { value: number; why: string }[] }[];
  /** Whole wrong gradients from the usual mistakes. */
  wrong: (v: V) => { value: [number, number, number]; why: string }[];
  /** The forward and backward pass, one solution line each. */
  steps: (v: V) => string[];
}

const UNSWAP = 'That forgets to swap at a multiply: each input of a multiply gets the other input\'s value times the gradient from above.';
const HALF = 'That splits the gradient in half at the add. An add passes all of it to both inputs.';
const SEED = 'Start at the output with $\\partial f / \\partial f = 1$.';

const T: Template[] = [
  {
    tex: '(x + y) \\cdot z',
    nodes: ['q = x + y', 'f = q \\cdot z'],
    level: 0,
    grad: ({ x, y, z }) => [z, z, x + y],
    inner: [
      {
        name: 'q',
        def: 'q = x + y',
        value: ({ x, y }) => x + y,
        grad: ({ z }) => z,
        traps: ({ x, y }) => [{ value: x + y, why: 'That is $q$\'s value from the forward pass. Its gradient is what the multiply sends it: $z$ times the upstream 1.' }],
      },
    ],
    wrong: ({ x, y, z }) => [
      { value: [x + y, x + y, z], why: UNSWAP },
      { value: [z / 2, z / 2, x + y], why: HALF },
      { value: [1, 1, x + y], why: 'That stops at the add\'s local slope, 1. Multiply it by the gradient arriving from the multiply, $z$.' },
    ],
    steps: ({ x, y, z }) => [
      `Forward: $q = x + y = ${n(x + y)}$, then $f = q \\cdot z = ${n(clean((x + y) * z))}$.`,
      `${SEED} The multiply swaps: $${D('q')} = z = ${n(z)}$ and $${D('z')} = q = ${n(x + y)}$.`,
      `The add passes $${D('q')}$ to both inputs: $${D('x')} = ${D('y')} = ${n(z)}$.`,
    ],
  },
  {
    tex: 'x \\cdot y + z',
    nodes: ['q = x \\cdot y', 'f = q + z'],
    level: 0,
    grad: ({ x, y }) => [y, x, 1],
    inner: [],
    wrong: ({ x, y, z }) => [
      { value: [x, y, 1], why: UNSWAP },
      { value: [y, x, z], why: 'That gives $z$ its own value. The add passes the upstream gradient, 1, to $z$.' },
      { value: [y / 2, x / 2, 0.5], why: HALF },
    ],
    steps: ({ x, y, z }) => [
      `Forward: $q = x \\cdot y = ${n(clean(x * y))}$, then $f = q + z = ${n(clean(x * y + z))}$.`,
      `${SEED} The add passes it to both: $${D('q')} = ${D('z')} = 1$.`,
      `The multiply swaps: $${D('x')} = y \\times 1 = ${n(y)}$ and $${D('y')} = x \\times 1 = ${n(x)}$.`,
    ],
  },
  {
    tex: 'x \\cdot (y + z)',
    nodes: ['q = y + z', 'f = x \\cdot q'],
    level: 0,
    grad: ({ x, y, z }) => [y + z, x, x],
    inner: [
      {
        name: 'q',
        def: 'q = y + z',
        value: ({ y, z }) => y + z,
        grad: ({ x }) => x,
        traps: ({ y, z }) => [{ value: y + z, why: 'That is $q$\'s value from the forward pass. Its gradient is what the multiply sends it: $x$ times the upstream 1.' }],
      },
    ],
    wrong: ({ x, y, z }) => [
      { value: [x, y + z, y + z], why: UNSWAP },
      { value: [y + z, x / 2, x / 2], why: HALF },
    ],
    steps: ({ x, y, z }) => [
      `Forward: $q = y + z = ${n(y + z)}$, then $f = x \\cdot q = ${n(clean(x * (y + z)))}$.`,
      `${SEED} The multiply swaps: $${D('x')} = q = ${n(y + z)}$ and $${D('q')} = x = ${n(x)}$.`,
      `The add passes $${D('q')}$ to both inputs: $${D('y')} = ${D('z')} = ${n(x)}$.`,
    ],
  },
  {
    tex: '(x \\cdot y) \\cdot z',
    nodes: ['q = x \\cdot y', 'f = q \\cdot z'],
    level: 0,
    grad: ({ x, y, z }) => [clean(y * z), clean(x * z), clean(x * y)],
    inner: [
      {
        name: 'q',
        def: 'q = x \\cdot y',
        value: ({ x, y }) => x * y,
        grad: ({ z }) => z,
        traps: ({ x, y }) => [{ value: x * y, why: 'That is $q$\'s value from the forward pass. Its gradient is what the multiply sends it: $z$ times the upstream 1.' }],
      },
    ],
    wrong: ({ x, y, z }) => [
      { value: [y, x, x * y], why: 'That stops at the first multiply\'s local slopes. They still need the gradient arriving from the second multiply, $z$.' },
      { value: [y * x * y, x * x * y, z], why: UNSWAP },
    ],
    steps: ({ x, y, z }) => [
      `Forward: $q = x \\cdot y = ${n(clean(x * y))}$, then $f = q \\cdot z = ${n(clean(x * y * z))}$.`,
      `${SEED} The second multiply swaps: $${D('q')} = z = ${n(z)}$ and $${D('z')} = q = ${n(clean(x * y))}$.`,
      `The first multiply swaps too, times $${D('q')}$: $${D('x')} = y \\cdot ${par(z)} = ${n(clean(y * z))}$ and $${D('y')} = x \\cdot ${par(z)} = ${n(clean(x * z))}$.`,
    ],
  },
  {
    tex: '\\max(x, y) \\cdot z',
    nodes: ['m = \\max(x, y)', 'f = m \\cdot z'],
    level: 1,
    ok: ({ x, y }) => x !== y,
    grad: ({ x, y, z }) => [x > y ? z : 0, y > x ? z : 0, Math.max(x, y)],
    inner: [
      {
        name: 'm',
        def: 'm = \\max(x, y)',
        value: ({ x, y }) => Math.max(x, y),
        grad: ({ z }) => z,
        traps: ({ x, y }) => [{ value: Math.max(x, y), why: 'That is $m$\'s value from the forward pass. Its gradient is what the multiply sends it: $z$ times the upstream 1.' }],
      },
    ],
    wrong: ({ x, y, z }) => [
      { value: [z, z, Math.max(x, y)], why: 'That gives the max\'s gradient to both inputs. Only the larger one gets it; the other gets 0.' },
      { value: [x > y ? 0 : z, y > x ? 0 : z, Math.max(x, y)], why: 'That routes the gradient to the smaller input. The max follows the larger one.' },
      { value: [x > y ? Math.max(x, y) : 0, y > x ? Math.max(x, y) : 0, z], why: UNSWAP },
    ],
    steps: ({ x, y, z }) => [
      `Forward: $m = \\max(${n(x)}, ${n(y)}) = ${n(Math.max(x, y))}$, then $f = m \\cdot z = ${n(clean(Math.max(x, y) * z))}$.`,
      `${SEED} The multiply swaps: $${D('m')} = z = ${n(z)}$ and $${D('z')} = m = ${n(Math.max(x, y))}$.`,
      `The max routes $${D('m')}$ to its larger input, $${x > y ? 'x' : 'y'}$: $${D(x > y ? 'x' : 'y')} = ${n(z)}$ and $${D(x > y ? 'y' : 'x')} = 0$.`,
    ],
  },
  {
    tex: '(x \\cdot y + z)^{2}',
    nodes: ['q = x \\cdot y', 'r = q + z', 'f = r^{2}'],
    level: 2,
    ok: ({ x, y, z }) => x * y + z !== 0,
    grad: ({ x, y, z }) => {
      const r = x * y + z;
      return [clean(2 * r * y), clean(2 * r * x), clean(2 * r)];
    },
    inner: [
      {
        name: 'r',
        def: 'r = x \\cdot y + z',
        value: ({ x, y, z }) => x * y + z,
        grad: ({ x, y, z }) => 2 * (x * y + z),
        traps: ({ x, y, z }) => [{ value: x * y + z, why: 'That is $r$ itself. The square\'s local slope is $2r$.' }],
      },
      {
        name: 'q',
        def: 'q = x \\cdot y',
        value: ({ x, y }) => x * y,
        grad: ({ x, y, z }) => 2 * (x * y + z),
        traps: ({ x, y, z }) => [
          { value: 1, why: 'That is the add\'s local slope alone. Multiply it by the gradient arriving from the square, $2(q + z)$.' },
          { value: x * y, why: 'That is $q$\'s value from the forward pass, not its gradient.' },
          { value: x * y + z, why: 'That drops the 2 from the square\'s local slope: the slope of $(q + z)^{2}$ is $2(q + z)$.' },
        ],
      },
    ],
    wrong: ({ x, y, z }) => {
      const r = x * y + z;
      return [
        { value: [r * y, r * x, r], why: 'That drops the 2 from the square\'s local slope: the slope of $(x \\cdot y + z)^{2}$ is $2(x \\cdot y + z)$.' },
        { value: [2 * r * x, 2 * r * y, 2 * r], why: UNSWAP },
        { value: [y, x, 1], why: 'That leaves out the square. Everything below it is scaled by its local slope, $2(x \\cdot y + z)$.' },
      ];
    },
    steps: ({ x, y, z }) => {
      const r = clean(x * y + z);
      return [
        `Forward: $q = x \\cdot y = ${n(clean(x * y))}$, $r = q + z = ${n(r)}$, $f = r^{2} = ${n(clean(r * r))}$.`,
        `${SEED} The square's local slope is $2r = ${n(clean(2 * r))}$, so $${D('r')} = ${n(clean(2 * r))}$.`,
        `The add passes that to both: $${D('q')} = ${D('z')} = ${n(clean(2 * r))}$.`,
        `The multiply swaps: $${D('x')} = y \\cdot ${par(2 * r)} = ${n(clean(2 * r * y))}$ and $${D('y')} = x \\cdot ${par(2 * r)} = ${n(clean(2 * r * x))}$.`,
      ];
    },
  },
  {
    tex: '(x + y)^{2} \\cdot z',
    nodes: ['q = x + y', 'r = q^{2}', 'f = r \\cdot z'],
    level: 2,
    ok: ({ x, y }) => x + y !== 0,
    grad: ({ x, y, z }) => {
      const q = x + y;
      return [clean(2 * q * z), clean(2 * q * z), clean(q * q)];
    },
    inner: [
      {
        name: 'r',
        def: 'r = (x + y)^{2}',
        value: ({ x, y }) => (x + y) ** 2,
        grad: ({ z }) => z,
        traps: ({ x, y }) => [{ value: (x + y) ** 2, why: 'That is $r$\'s value from the forward pass. Its gradient is what the multiply sends it: $z$ times the upstream 1.' }],
      },
      {
        name: 'q',
        def: 'q = x + y',
        value: ({ x, y }) => x + y,
        grad: ({ x, y, z }) => 2 * (x + y) * z,
        traps: ({ x, y, z }) => [
          { value: 2 * (x + y), why: 'That is the square\'s local slope alone. Multiply it by the gradient arriving from the multiply, $z$.' },
          { value: (x + y) * z, why: 'That uses $q$ as the square\'s local slope. The slope of $q^{2}$ is $2q$.' },
        ],
      },
    ],
    wrong: ({ x, y, z }) => {
      const q = x + y;
      return [
        { value: [q * z, q * z, q * q], why: 'That drops the 2 from the square\'s local slope: the slope of $(x + y)^{2}$ is $2(x + y)$.' },
        { value: [2 * q * q * q, 2 * q * q * q, z], why: UNSWAP },
        { value: [2 * q, 2 * q, q * q], why: 'That leaves out the multiply\'s factor $z$ on the way back to the square.' },
      ];
    },
    steps: ({ x, y, z }) => {
      const q = clean(x + y);
      return [
        `Forward: $q = x + y = ${n(q)}$, $r = q^{2} = ${n(clean(q * q))}$, $f = r \\cdot z = ${n(clean(q * q * z))}$.`,
        `${SEED} The multiply swaps: $${D('r')} = z = ${n(z)}$ and $${D('z')} = r = ${n(clean(q * q))}$.`,
        `The square's local slope is $2q = ${n(clean(2 * q))}$, so $${D('q')} = ${n(clean(2 * q))} \\times ${par(z)} = ${n(clean(2 * q * z))}$.`,
        `The add passes that to both: $${D('x')} = ${D('y')} = ${n(clean(2 * q * z))}$.`,
      ];
    },
  },
];

function draw(rng: Rng, d: number, ok?: (v: V) => boolean): V {
  const [lo, hi] = d < 0.35 ? [1, 4] : d < 0.7 ? [-3, 4] : [-3, 3];
  for (;;) {
    const v: V = { x: int(rng, lo, hi), y: int(rng, lo, hi), z: int(rng, lo, hi) };
    if (d >= 0.85 && rng.int(2) === 0) v[pick(rng, ['x', 'y', 'z'] as const)] = pick(rng, [0.5, -0.5, 1.5]);
    if (!ok || ok(v)) return v;
  }
}

const usable = (d: number) => T.filter((t) => (d < 0.35 ? t.level === 0 : d < 0.7 ? t.level <= 1 : t.level >= 1));
const at = (v: V) => `$x = ${n(v.x)}$, $y = ${n(v.y)}$ and $z = ${n(v.z)}$`;

/** Graphs where one input feeds two nodes: the gradient each use sends back, and the steps that produce it. */
const TWICE: { tex: string; who: 'x' | 'y'; uses: [string, string]; branch: (v: V) => [number, number]; steps: (v: V) => [string, string, string]; check: string }[] = [
  {
    tex: 'x \\cdot y + x',
    who: 'x',
    uses: ['the multiply', 'the add'],
    branch: ({ y }) => [y, 1],
    steps: ({ y }) => [
      `${SEED} The add passes that 1 to both its inputs: the product $x \\cdot y$, and $x$ itself.`,
      `Back through the multiply, which swaps: $x$ gets the other factor times 1, $y \\times 1 = ${n(y)}$.`,
      'Back through the add, directly: $x$ is one of its inputs, so it gets $1$.',
    ],
    check: '$f = xy + x$, so $\\partial f / \\partial x = y + 1$.',
  },
  {
    tex: '(x + y) \\cdot x',
    who: 'x',
    uses: ['the add', 'the multiply'],
    branch: ({ x, y }) => [x, clean(x + y)],
    steps: ({ x, y }) => [
      `${SEED} The multiply swaps: its input $x + y$ gets the other factor, $x = ${n(x)}$, and its input $x$ gets $x + y = ${n(clean(x + y))}$.`,
      `Back through the add, which copies what it got: $x$ gets $${n(x)}$.`,
      `Back through the multiply, directly: $x$ is its other input, so it gets $x + y = ${n(clean(x + y))}$.`,
    ],
    check: '$f = x^{2} + xy$, so $\\partial f / \\partial x = 2x + y$.',
  },
  {
    tex: '(x + y) \\cdot (y + z)',
    who: 'y',
    uses: ['the first add', 'the second add'],
    branch: ({ x, y, z }) => [clean(y + z), clean(x + y)],
    steps: ({ x, y, z }) => [
      `${SEED} The multiply swaps: $x + y$ gets the other factor, $y + z = ${n(clean(y + z))}$, and $y + z$ gets $x + y = ${n(clean(x + y))}$.`,
      `Back through the first add, $x + y$, which copies what it got: $y$ gets $${n(clean(y + z))}$.`,
      `Back through the second add, $y + z$, which copies too: $y$ gets $${n(clean(x + y))}$.`,
    ],
    check: '$\\partial f / \\partial y = (y + z) + (x + y)$: each add passes on what the multiply sent it.',
  },
  {
    tex: 'x \\cdot y + x \\cdot z',
    who: 'x',
    uses: ['the first multiply', 'the second multiply'],
    branch: ({ y, z }) => [y, z],
    steps: ({ y, z }) => [
      `${SEED} The add passes that 1 to both products, $x \\cdot y$ and $x \\cdot z$.`,
      `Back through the first multiply, which swaps: $x$ gets $y \\times 1 = ${n(y)}$.`,
      `Back through the second multiply, which swaps too: $x$ gets $z \\times 1 = ${n(z)}$.`,
    ],
    check: '$f = x(y + z)$, so $\\partial f / \\partial x = y + z$.',
  },
];

export const generators: Generator[] = [
  {
    id: 'node-grad',
    make(rng, d) {
      const t = pick(rng, usable(d).filter((x) => x.inner.length));
      const v = draw(rng, d, t.ok);
      const node = pick(rng, t.inner);
      const ans = clean(node.grad(v));
      return {
        prompt: `In $f = ${t.tex}$, let $${node.def}$. At ${at(v)}, what is $${D(node.name)}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, node.traps(v)),
        solution: t.steps(v).slice(0, node.name === 'q' && t.nodes.length === 3 ? 3 : 2).concat(`So $${D(node.name)} = ${n(ans)}$.`),
      };
    },
  },
  {
    id: 'input-grad',
    make(rng, d) {
      const t = pick(rng, usable(d));
      const v = draw(rng, d, t.ok);
      const k = rng.int(3);
      const name = 'xyz'[k]!;
      const ans = t.grad(v)[k]!;
      return {
        prompt: `For $f = ${t.tex}$ at ${at(v)}, what is $${D(name)}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, t.wrong(v).map((w) => ({ value: w.value[k]!, why: w.why }))),
        solution: t.steps(v).concat(`So $${D(name)} = ${n(ans)}$.`),
      };
    },
  },
  {
    id: 'gradient',
    make(rng, d) {
      const t = pick(rng, usable(d));
      const v = draw(rng, d, t.ok);
      const ans = t.grad(v).map(clean);
      return {
        prompt: `For $f = ${t.tex}$ at ${at(v)}, what is the gradient $\\left[${D('x')},\\ ${D('y')},\\ ${D('z')}\\right]$?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, t.wrong(v)),
        solution: t.steps(v).concat(`So the gradient is $[${ans.map((x) => n(x)).join(',\\ ')}]$.`),
      };
    },
  },
  {
    id: 'used-twice',
    make(rng, d) {
      for (;;) {
        const i = rng.int(TWICE.length);
        const t = TWICE[i]!;
        const v = draw(rng, Math.min(d, 0.69));
        const [a, c] = t.branch(v).map(clean) as [number, number];
        const sum = clean(a + c);
        const opts = [sum, clean(a * c), a, clean(sum / 2)];
        if (new Set(opts).size < 4 || a === c) continue;
        const one = rng.int(2);
        if (one) opts[2] = c;
        if (new Set(opts).size < 4) continue;
        const who = t.who;
        const vars = t.tex.includes('z') ? at(v) : `$x = ${n(v.x)}$ and $y = ${n(v.y)}$`;
        return {
          prompt: `For $f = ${t.tex}$ at ${vars}, what is $${D(who)}$?`,
          answer: {
            kind: 'choice',
            options: opts.map((o) => `$${n(o)}$`),
            correct: 0,
            why: [
              null,
              'That multiplies the two branch gradients. Gradients multiply along one path; separate paths add.',
              `That keeps only the gradient from ${t.uses[one]}. $${who}$ also moves $f$ through ${t.uses[1 - one]}, and both effects count.`,
              'That averages the branches. Each path carries its own full effect on $f$, so they add.',
            ],
          },
          solution: [
            ...t.steps(v),
            `A value used twice adds the gradients from its uses: $${n(a)} + ${par(c)} = ${n(sum)}$.`,
            `Check: ${t.check}`,
          ],
        };
      }
    },
  },
];
