import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, par, pick, round, traps } from '../../kit';
import { n } from '../kit';

type Op = 'add' | 'mul' | 'max' | 'sq' | 'exp';
/** One operation node: its name and its arguments, each an input, an earlier node or a constant. */
type Node = [name: string, op: Op, args: string[]];
type Vals = Record<string, number>;

const E = (k: number) => round(Math.exp(k), 2);

function apply(op: Op, a: number[]): number {
  switch (op) {
    case 'add':
      return a[0]! + a[1]!;
    case 'mul':
      return a[0]! * a[1]!;
    case 'max':
      return Math.max(a[0]!, a[1]!);
    case 'sq':
      return a[0]! * a[0]!;
    case 'exp':
      return E(a[0]!);
  }
}

function opTex(op: Op, a: string[]): string {
  switch (op) {
    case 'add':
      return `${a[0]} + ${a[1]}`;
    case 'mul':
      return `${a[0]} \\cdot ${a[1]}`;
    case 'max':
      return `\\max(${a[0]}, ${a[1]})`;
    case 'sq':
      return `${a[0]}^{2}`;
    case 'exp':
      return `e^{${a[0]}}`;
  }
}

/** `a`, `a and b`, `a, b and c`. */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const OP_NAME: Record<Op, string> = { add: 'add', mul: 'multiply', max: 'max', sq: 'square', exp: 'exp' };
const PLURAL: Record<Op, string> = { add: 'adds', mul: 'multiplies', max: 'maxes', sq: 'squares', exp: 'exps' };
const COUNT_WORD = ['zero', 'one', 'two', 'three', 'four'];

/** Every node's value, inputs included. Exponentials use their two-decimal values, as the prompts give them. */
function run(nodes: Node[], v: Vals): Vals {
  const env: Vals = { ...v };
  const val = (a: string) => (a in env ? env[a]! : Number(a));
  for (const [nm, op, args] of nodes) env[nm] = clean(apply(op, args.map(val)));
  return env;
}

/** The solution line for one node: its formula, the numbers put in, and its value. */
function step(node: Node, env: Vals): string {
  const [nm, op, args] = node;
  const vals = args.map((a) => (a in env ? (op === 'max' ? n(env[a]!) : par(env[a]!)) : a));
  const x = env[nm]!;
  if (op === 'exp') return `The exp node: $${nm} = e^{${args[0]}} = e^{${num(env[args[0]!]!)}} \\approx ${num(x, 2)}$.`;
  const rhs = op === 'sq' ? `${vals[0]}^{2}` : opTex(op, vals);
  return `The ${OP_NAME[op]} node: $${nm} = ${opTex(op, args)} = ${rhs} = ${n(x)}$.`;
}

const inputs = (v: Vals, names = ['x', 'y', 'z']) => list(names.filter((k) => k in v).map((k) => `$${k} = ${num(v[k]!)}$`));

/** Exponential values to quote: the one needed and its neighbors, so the hint does not give the exponent away. */
function expHint(k: number): string {
  const ks = [k - 1, k, k + 1].filter((j) => j >= -3 && j <= 3);
  return `Use ${ks.map((j) => `$e^{${j}} \\approx ${num(E(j), 2)}$`).join(', ')}.`;
}

interface Out {
  tex: string;
  nodes: Node[];
  level: number;
  ok?: (v: Vals) => boolean;
  traps?: (v: Vals, env: Vals) => { value: number; why: string }[];
}

const OUT: Out[] = [
  {
    tex: '(x + y) \\cdot z',
    nodes: [['q', 'add', ['x', 'y']], ['f', 'mul', ['q', 'z']]],
    level: 0,
    traps: (v) => [
      { value: v.x! + v.y! * v.z!, why: 'That multiplies $y$ by $z$ first. In this graph the add node runs first, and the multiply takes its output.' },
      { value: v.x! + v.y! + v.z!, why: 'That adds $z$. The second node multiplies the sum by $z$.' },
    ],
  },
  {
    tex: 'x \\cdot y + z',
    nodes: [['q', 'mul', ['x', 'y']], ['f', 'add', ['q', 'z']]],
    level: 0,
    traps: (v) => [{ value: v.x! * (v.y! + v.z!), why: 'That adds $y$ and $z$ first. The multiply node runs first, and the add takes its output and $z$.' }],
  },
  {
    tex: 'x \\cdot (y + z)',
    nodes: [['q', 'add', ['y', 'z']], ['f', 'mul', ['x', 'q']]],
    level: 0,
    traps: (v) => [{ value: v.x! * v.y! + v.z!, why: 'That multiplies $x$ by $y$ first. The parentheses make the add node run first.' }],
  },
  {
    tex: '\\max(x, y) \\cdot z',
    nodes: [['q', 'max', ['x', 'y']], ['f', 'mul', ['q', 'z']]],
    level: 1,
    ok: (v) => v.x !== v.y,
    traps: (v) => [{ value: Math.min(v.x!, v.y!) * v.z!, why: 'That takes the smaller input. A max node passes on the larger one.' }],
  },
  {
    tex: '(x + y)^{2}',
    nodes: [['q', 'add', ['x', 'y']], ['f', 'sq', ['q']]],
    level: 1,
    traps: (v) => [
      { value: v.x! * v.x! + v.y! * v.y!, why: 'That squares each input and then adds. The square node takes the sum.' },
      { value: 2 * (v.x! + v.y!), why: 'That doubles the sum. The square node multiplies it by itself.' },
    ],
  },
  {
    tex: '\\max(x + y, z)',
    nodes: [['q', 'add', ['x', 'y']], ['f', 'max', ['q', 'z']]],
    level: 1,
    ok: (v) => v.x! + v.y! !== v.z!,
    traps: (v) => [
      { value: Math.min(v.x! + v.y!, v.z!), why: 'That is the smaller of the two inputs to the max. A max node passes on the larger one.' },
      { value: v.x! + Math.max(v.y!, v.z!), why: 'That takes the max before adding. The add node runs first, and the max compares its output with $z$.' },
    ],
  },
  {
    tex: '(x \\cdot y + z)^{2}',
    nodes: [['q', 'mul', ['x', 'y']], ['r', 'add', ['q', 'z']], ['f', 'sq', ['r']]],
    level: 2,
    traps: (v, env) => [
      { value: env.r!, why: 'That is the value going into the square node. The output squares it.' },
      { value: v.x! * v.y! + v.z! * v.z!, why: 'That squares only $z$. The square node takes the whole sum $x \\cdot y + z$.' },
    ],
  },
  {
    tex: 'e^{x \\cdot y + z}',
    nodes: [['q', 'mul', ['x', 'y']], ['r', 'add', ['q', 'z']], ['f', 'exp', ['r']]],
    level: 2,
    ok: (v) => Number.isInteger(v.x! * v.y! + v.z!) && v.x! * v.y! + v.z! !== 0 && Math.abs(v.x! * v.y! + v.z!) <= 2,
    traps: (_, env) => [{ value: env.r!, why: 'That is the value going into the exp node. Its output is $e$ to that power.' }],
  },
  {
    tex: '(\\max(x, 0) + y) \\cdot z',
    nodes: [['q', 'max', ['x', '0']], ['r', 'add', ['q', 'y']], ['f', 'mul', ['r', 'z']]],
    level: 2,
    ok: (v) => v.x! < 0,
    traps: (v) => [{ value: (v.x! + v.y!) * v.z!, why: 'That skips the max node. With $x$ negative, $\\max(x, 0)$ passes on $0$.' }],
  },
  {
    tex: '\\max(x, y)^{2} + z',
    nodes: [['q', 'max', ['x', 'y']], ['r', 'sq', ['q']], ['f', 'add', ['r', 'z']]],
    level: 2,
    ok: (v) => v.x !== v.y && v.x! * v.x! !== v.y! * v.y!,
    traps: (v) => [{ value: Math.min(v.x!, v.y!) ** 2 + v.z!, why: 'That squares the smaller input. The max node passes on the larger one.' }],
  },
];

/** Inputs for a template, drawn until its constraint holds. */
function draw(rng: Rng, d: number, vars: string[], ok?: (v: Vals) => boolean): Vals {
  const [lo, hi] = d < 0.35 ? [1, 4] : d < 0.7 ? [-3, 4] : [-3, 3];
  for (;;) {
    const v: Vals = {};
    for (const k of vars) v[k] = int(rng, lo, hi);
    if (d >= 0.85 && rng.int(2) === 0) v[pick(rng, vars)] = pick(rng, [0.5, 1.5, -0.5, -1.5]);
    if (!ok || ok(v)) return v;
  }
}

const usable = (d: number, t: { level: number }) => (d < 0.35 ? t.level === 0 : d < 0.7 ? t.level <= 1 : t.level >= 1);

const nodeList = (nodes: Node[]) => list(nodes.map(([nm, op, args]) => `$${nm} = ${opTex(op, args)}$`));

interface Feed {
  tex: string;
  node: string;
  options: [string, string, string, string];
  why: [string, string, string];
}

const FEEDS: Feed[] = [
  {
    tex: '(x \\cdot y + z)^{2}',
    node: 'the add node',
    options: ['$x \\cdot y$ and $z$', '$x$, $y$ and $z$', '$(x \\cdot y + z)^{2}$', 'only $z$'],
    why: [
      'The add never sees $x$ and $y$ themselves. The multiply node combines them first and passes on one value, $x \\cdot y$.',
      'That is the square node\'s output, further along. Values flow forward: an add takes the values computed before it.',
      'The add also takes the multiply\'s output, $x \\cdot y$, on its other wire.',
    ],
  },
  {
    tex: '(x \\cdot y + z)^{2}',
    node: 'the square node',
    options: ['$x \\cdot y + z$', '$x$, $y$ and $z$', '$x \\cdot y$', '$x \\cdot y$ and $z$, separately'],
    why: [
      'The square node takes a single value: whatever the add node sends out.',
      'That is the multiply\'s output, which goes into the add, not straight into the square.',
      'Those are the add node\'s inputs. The square takes what the add sends out: their sum.',
    ],
  },
  {
    tex: 'e^{\\max(x, y) \\cdot z}',
    node: 'the multiply node',
    options: ['$\\max(x, y)$ and $z$', '$x$, $y$ and $z$', '$e^{\\max(x, y) \\cdot z}$', '$x$ and $z$'],
    why: [
      'The multiply never sees $x$ and $y$ both. The max node passes on one value, the larger.',
      'That is the exp node\'s output, further along. The multiply runs before the exp.',
      'The max decides which of $x$ and $y$ passes on, and the multiply receives its output, whichever it is.',
    ],
  },
  {
    tex: '\\max(x + y, z) \\cdot x',
    node: 'the max node',
    options: ['$x + y$ and $z$', '$x$, $y$ and $z$', '$\\max(x + y, z) \\cdot x$', '$x + y$ and $x$'],
    why: [
      'The max never sees $x$ and $y$ separately. The add node combines them first.',
      'That is the multiply\'s output, the last node. The max runs before it.',
      'This $x$ goes into the multiply at the end, not into the max.',
    ],
  },
  {
    tex: '(x + y)^{2} \\cdot z',
    node: 'the multiply node',
    options: ['$(x + y)^{2}$ and $z$', '$x + y$ and $z$', '$x$, $y$ and $z$', 'only $(x + y)^{2}$'],
    why: [
      'That skips the square node. The multiply takes the square\'s output, $(x + y)^{2}$.',
      'The multiply never sees $x$ and $y$ themselves: the add and the square come first.',
      'The multiply has two inputs: $z$ comes in on its other wire.',
    ],
  },
  {
    tex: 'e^{x} \\cdot (y + z)',
    node: 'the multiply node',
    options: ['$e^{x}$ and $y + z$', '$x$, $y$ and $z$', '$x$ and $y + z$', '$e^{x}$, $y$ and $z$'],
    why: [
      'The multiply sees the outputs of the exp and the add, not the raw inputs.',
      'That skips the exp node. The multiply receives $e^{x}$, not $x$.',
      'The add node combines $y$ and $z$ into one value first.',
    ],
  },
  {
    tex: '\\max(x \\cdot y, z)^{2}',
    node: 'the max node',
    options: ['$x \\cdot y$ and $z$', '$x$, $y$ and $z$', '$\\max(x \\cdot y, z)^{2}$', '$x$ and $z$'],
    why: [
      'The max never sees $x$ and $y$ separately. The multiply combines them first.',
      'That is the square node\'s output, the last one. The max runs before it.',
      'The max takes the multiply\'s output, $x \\cdot y$, not $x$ alone.',
    ],
  },
];

const COUNT: { tex: string; ops: Op[] }[] = [
  { tex: '(x + y) \\cdot (y + z)', ops: ['add', 'add', 'mul'] },
  { tex: 'x \\cdot y + y \\cdot z', ops: ['mul', 'mul', 'add'] },
  { tex: '(x + y)^{2} + z', ops: ['add', 'sq', 'add'] },
  { tex: '\\max(x, y) \\cdot \\max(y, z)', ops: ['max', 'max', 'mul'] },
  { tex: 'e^{x + y} + z', ops: ['add', 'exp', 'add'] },
  { tex: '(x \\cdot y + z)^{2} \\cdot x', ops: ['mul', 'add', 'sq', 'mul'] },
  { tex: '\\max(x \\cdot y, x \\cdot z)', ops: ['mul', 'mul', 'max'] },
  { tex: '(x + y)^{2} + (x + z)^{2}', ops: ['add', 'sq', 'add', 'sq', 'add'] },
  { tex: 'e^{x \\cdot y} \\cdot z', ops: ['mul', 'exp', 'mul'] },
  { tex: '\\max(x + y, 0) + z', ops: ['add', 'max', 'add'] },
];

/** Chains for the ordering: each node uses the one before, so only one order works. `#k` refers to node k. */
const ORDER: { tex: string; nodes: [Op, string[]][] }[] = [
  { tex: '((x + y) \\cdot z)^{2}', nodes: [['add', ['x', 'y']], ['mul', ['#0', 'z']], ['sq', ['#1']]] },
  { tex: 'e^{x \\cdot y + z}', nodes: [['mul', ['x', 'y']], ['add', ['#0', 'z']], ['exp', ['#1']]] },
  { tex: '\\max(x + y, 0) \\cdot z', nodes: [['add', ['x', 'y']], ['max', ['#0', '0']], ['mul', ['#1', 'z']]] },
  { tex: '(\\max(x, y) + z)^{2}', nodes: [['max', ['x', 'y']], ['add', ['#0', 'z']], ['sq', ['#1']]] },
  { tex: 'e^{(x + y)^{2}}', nodes: [['add', ['x', 'y']], ['sq', ['#0']], ['exp', ['#1']]] },
  { tex: '\\max(x \\cdot y, z) + x', nodes: [['mul', ['x', 'y']], ['max', ['#0', 'z']], ['add', ['#1', 'x']]] },
  { tex: '(\\max(x \\cdot y, z) + x)^{2}', nodes: [['mul', ['x', 'y']], ['max', ['#0', 'z']], ['add', ['#1', 'x']], ['sq', ['#2']]] },
  { tex: 'e^{(x + y) \\cdot z + x}', nodes: [['add', ['x', 'y']], ['mul', ['#0', 'z']], ['add', ['#1', 'x']], ['exp', ['#2']]] },
  { tex: '\\max((x + y)^{2}, z) \\cdot y', nodes: [['add', ['x', 'y']], ['sq', ['#0']], ['max', ['#1', 'z']], ['mul', ['#2', 'y']]] },
  { tex: '(e^{x} + y)^{2} \\cdot z', nodes: [['exp', ['x']], ['add', ['#0', 'y']], ['sq', ['#1']], ['mul', ['#2', 'z']]] },
];

const NAMES = ['a', 'h', 'k', 'm', 'u', 'v'];

export const generators: Generator[] = [
  {
    id: 'output',
    make(rng, d) {
      const t = pick(rng, OUT.filter((o) => usable(d, o)));
      const vars = ['x', 'y', 'z'].filter((k) => t.tex.includes(k));
      const v = draw(rng, d, vars, t.ok);
      const env = run(t.nodes, v);
      const f = env.f!;
      const ex = t.nodes.find((x) => x[1] === 'exp');
      const places = ex ? 2 : undefined;
      return {
        prompt: `For $f = ${t.tex}$ at ${inputs(v, vars)}, what is $f$?${ex ? ` ${expHint(env[ex[2][0]!]!)} Round to two decimals.` : ''}`,
        answer: { kind: 'number', value: f, ...(places ? { places } : {}) },
        traps: traps(f, t.traps?.(v, env) ?? [], places),
        solution: [
          `Break it into nodes: ${nodeList(t.nodes)}. Evaluate them from the inputs forward.`,
          ...t.nodes.map((x) => step(x, env)),
        ],
      };
    },
  },
  {
    id: 'node-value',
    make(rng, d) {
      const pool = OUT.filter((o) => usable(d, o) && !(o.nodes.length === 2 && o.nodes[1]![1] === 'exp'));
      const t = pick(rng, pool);
      const vars = ['x', 'y', 'z'].filter((k) => t.tex.includes(k));
      const v = draw(rng, d, vars, t.ok);
      const env = run(t.nodes, v);
      const k = t.nodes.length === 2 ? 0 : rng.int(2);
      const [nm] = t.nodes[k]!;
      const ans = env[nm]!;
      const others = t.nodes.filter((_, i) => i !== k && t.nodes[i]![1] !== 'exp');
      return {
        prompt: `A graph has the nodes ${nodeList(t.nodes)}. At ${inputs(v, vars)}, what is $${nm}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(
          ans,
          others.map(([o]) => ({
            value: env[o]!,
            why: t.nodes.findIndex((x) => x[0] === o) > k ? `That is the value at $${o}$, further along the graph. $${nm}$ is computed before it.` : `That is the value at $${o}$, the node before $${nm}$. Carry it one node further.`,
          })),
        ),
        solution: t.nodes.slice(0, k + 1).map((x) => step(x, env)).concat(k + 1 < t.nodes.length ? [`So $${nm} = ${n(ans)}$. The later nodes do not change it.`] : []),
      };
    },
  },
  {
    id: 'structure',
    make(rng, d) {
      if (rng.int(2) === 0) {
        const t = pick(rng, COUNT);
        const N = t.ops.length;
        const kinds = [...new Set(t.ops)];
        const rep = kinds.find((k) => t.ops.filter((o) => o === k).length > 1)!;
        return {
          prompt: `How many operation nodes does the computational graph of $f = ${t.tex}$ have?`,
          answer: {
            kind: 'choice',
            options: [N, kinds.length, N + 3, N + 1].map(String),
            correct: 0,
            why: [
              null,
              `That counts the kinds of operation. Each operation gets its own node, so the ${COUNT_WORD[t.ops.filter((o) => o === rep).length]} ${PLURAL[rep]} are separate nodes.`,
              'That counts the inputs $x$, $y$ and $z$ too. They are where values enter the graph, not operations.',
              'That counts $f$ as a node of its own. $f$ is the output of the last operation, not another one.',
            ],
          },
          solution: [
            `One node per operation: ${t.ops.map((o) => OP_NAME[o]).join(', ')}.`,
            `That is ${N} nodes. The inputs feed them, and $f$ is the last node's output.`,
          ],
        };
      }
      const t = pick(rng, d < 0.35 ? FEEDS.slice(0, 4) : FEEDS);
      return {
        prompt: `In the computational graph of $f = ${t.tex}$, which values flow into ${t.node}?`,
        answer: { kind: 'choice', options: [...t.options], correct: 0, why: [null, ...t.why] },
        solution: [
          `Each node takes the outputs of the nodes computed just before it, or raw inputs.`,
          `${t.node[0]!.toUpperCase()}${t.node.slice(1)} receives ${t.options[0]}.`,
        ],
      };
    },
  },
  {
    id: 'forward-order',
    make(rng, d) {
      const pool = d < 0.5 ? ORDER.filter((o) => o.nodes.length === 3) : ORDER;
      const t = pick(rng, pool);
      const names = rng.shuffle([...NAMES]).slice(0, t.nodes.length - 1).concat('f');
      const nodes: Node[] = t.nodes.map(([op, args], i) => [names[i]!, op, args.map((a) => (a.startsWith('#') ? names[Number(a.slice(1))]! : a))]);
      const items = nodes.map(([nm, op, args]) => `$${nm} = ${opTex(op, args)}$`);
      return {
        prompt: `Put the nodes of $f = ${t.tex}$ in the order the forward pass runs them.`,
        answer: { kind: 'order', items },
        solution: nodes.map(([nm, op, args], i) =>
          i === 0
            ? `$${nm} = ${opTex(op, args)}$ needs only inputs, so it runs first.`
            : `$${nm} = ${opTex(op, args)}$ needs $${nodes[i - 1]![0]}$, so it runs ${i === nodes.length - 1 ? 'last' : 'next'}.`,
        ),
      };
    },
  },
];
