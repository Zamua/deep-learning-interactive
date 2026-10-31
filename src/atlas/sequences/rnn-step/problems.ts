import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, mat, nonzero, num, par, pick, shp, traps, vec, vtraps } from '../../kit';
import { mv, T2, useTanh } from '../kit';

/** Pre-activations whose tanh a prompt can quote. */
const NICE = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
const HALF = [-0.5, 0.5];
const relu = (v: number) => Math.max(0, v);

const add = (...vs: number[][]) => vs[0]!.map((_, i) => clean(vs.reduce((a, v) => a + v[i]!, 0)));
const ints = (rng: Rng, m: number, n: number, lo: number, hi: number) => Array.from({ length: m }, () => Array.from({ length: n }, () => int(rng, lo, hi)));

/** A matrix with no all-zero row, so every term of the product shows. */
function weights(rng: Rng, m: number, n: number, lo: number, hi: number): number[][] {
  for (;;) {
    const W = ints(rng, m, n, lo, hi);
    if (W.every((r) => r.some((v) => v !== 0))) return W;
  }
}

const PRE = 'The pre-activation is $\\symWhh\\symh_{t-1} + \\symWxh\\symx_t + \\symb$: everything before the tanh.';
const STEP = (t = 't', prev = 't-1') => `The step computes $\\symh_{${t}} = \\tanh(\\symWhh\\symh_{${prev}} + \\symWxh\\symx_{${t}} + \\symb)$.`;

/** The whole one-step setup as display math, on two lines so it fits a phone. */
function given(Whh: string, h: string, Wxh: string, x: string, b: string, prev = 't-1', t = 't'): string {
  const top = `\\symWhh = ${Whh}, \\quad \\symh_{${prev}} = ${h}`;
  const bottom = `\\symWxh = ${Wxh}, \\quad \\symx_{${t}} = ${x}, \\quad \\symb = ${b}`;
  return `$$${top}$$\n\n$$${bottom}$$`;
}

export const generators: Generator[] = [
  {
    id: 'preact',
    make(rng, d) {
      if (d < 0.35) {
        const h = pick(rng, HALF);
        const whh = pick(rng, [2, 4, -2]);
        const x = int(rng, 1, 3);
        const wxh = pick(rng, [1, 2, 3, -1]);
        const b = int(rng, -2, 2);
        const a = clean(whh * h + wxh * x + b);
        return {
          prompt: `A one-unit RNN takes a step:\n\n${given(num(whh), num(h), num(wxh), num(x), num(b))}\n\nWhat is the pre-activation?`,
          answer: { kind: 'number', value: a },
          traps: traps(a, [
            { value: whh * h + wxh * x, why: 'That leaves out the bias $\\symb$.' },
            { value: whh * x + wxh * h, why: 'That swaps the weights: $\\symWhh$ multiplies the old state $\\symh_{t-1}$, and $\\symWxh$ multiplies the input $\\symx_t$.' },
            { value: wxh * x + b, why: 'That leaves out the memory term $\\symWhh\\symh_{t-1}$, the part that carries the past.' },
          ]),
          solution: [
            PRE,
            `The memory term: $\\symWhh\\symh_{t-1} = ${num(whh)} \\times ${par(h)} = ${num(clean(whh * h))}$.`,
            `The input term: $\\symWxh\\symx_t = ${num(wxh)} \\times ${num(x)} = ${num(wxh * x)}$.`,
            `Add them and the bias: $${num(clean(whh * h))} + ${par(wxh * x)} + ${par(b)} = ${num(a)}$.`,
          ],
        };
      }
      const D = d < 0.7 ? 1 : 2;
      const Whh = weights(rng, 2, 2, -1, 2);
      const Wxh = weights(rng, 2, D, -1, 2);
      const h = d < 0.7 ? [pick(rng, HALF), pick(rng, HALF)] : [pick(rng, [-0.8, -0.2, 0.2, 0.8]), pick(rng, HALF)];
      const x = Array.from({ length: D }, () => nonzero(rng, -2, 2));
      const b = [int(rng, -2, 2), int(rng, -2, 2)];
      const mh = mv(Whh, h).map(clean);
      const mx = mv(Wxh, x).map(clean);
      const a = add(mh, mx, b);
      const ts = [
        { value: add(mh, mx), why: 'That leaves out the bias $\\symb$.' },
        { value: add(mx, b), why: 'That leaves out the memory term $\\symWhh\\symh_{t-1}$, the part that carries the past.' },
      ];
      if (D === 2) ts.push({ value: add(mv(Whh, x), mv(Wxh, h), b), why: 'That swaps the weights: $\\symWhh$ multiplies the old state $\\symh_{t-1}$, and $\\symWxh$ multiplies the input $\\symx_t$.' });
      return {
        prompt: `An RNN with two hidden units takes a step:\n\n${given(mat(Whh), vec(h), mat(Wxh), vec(x), vec(b))}\n\nWhat is the pre-activation?`,
        answer: { kind: 'vector', value: a },
        traps: vtraps(a, ts),
        solution: [
          PRE,
          `The memory term, row by row: $\\symWhh\\symh_{t-1} = ${vec(mh)}$.`,
          `The input term: $\\symWxh\\symx_t = ${vec(mx)}$.`,
          `Add them and the bias, entry by entry: $${vec(mh)} + ${vec(mx)} + ${vec(b)} = ${vec(a)}$.`,
        ],
      };
    },
  },
  {
    id: 'step',
    make(rng, d) {
      const pool = d < 0.25 ? NICE.filter((v) => v > 0) : NICE;
      if (d < 0.5) {
        const first = d < 0.25 && rng.int(2) === 0;
        const a = pick(rng, pool);
        const whh = pick(rng, [1, 2, -1]);
        const h = first ? 0 : pick(rng, HALF);
        const wxh = pick(rng, [1, 2, -1]);
        const x = pick(rng, [-1, 1, 2]);
        const b = clean(a - whh * h - wxh * x);
        const decoy = pick(rng, NICE.filter((v) => Math.abs(v) !== Math.abs(a)));
        const v = T2(a);
        return {
          prompt: `A one-unit RNN takes ${first ? 'its first step' : 'a step'}:\n\n${given(num(whh), num(h), num(wxh), num(x), num(b), first ? '0' : 't-1', first ? '1' : 't')}\n\nWhat is $\\symh_{${first ? '1' : 't'}}$? Round to two decimals. Use ${useTanh([a, decoy])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: a, why: 'That is the pre-activation. The step ends by squashing it with tanh.' },
            { value: relu(a), why: 'That is ReLU. The recurrence squashes with tanh, which keeps $\\symh$ between $-1$ and $1$.' },
          ]).filter((t) => Math.abs(t.value - v) >= 0.01),
          solution: [
            first ? STEP('1', '0') : STEP(),
            first
              ? `$\\symh_0 = 0$, so the memory term vanishes: $\\symWhh\\symh_0 = 0$.`
              : `The memory term: $\\symWhh\\symh_{t-1} = ${num(whh)} \\times ${par(h)} = ${num(clean(whh * h))}$.`,
            `Pre-activation: $${num(clean(whh * h))} + ${par(wxh)} \\times ${par(x)} + ${par(b)} = ${num(a)}$.`,
            `Squash it: $\\tanh(${num(a)}) \\approx ${num(v, 2)}$.`,
          ],
        };
      }
      const a = [pick(rng, pool), pick(rng, pool)];
      const D = d < 0.75 ? 1 : 2;
      const Whh = weights(rng, 2, 2, -1, 2);
      const Wxh = weights(rng, 2, D, -1, 2);
      const h = [pick(rng, HALF), pick(rng, HALF)];
      const x = Array.from({ length: D }, () => nonzero(rng, -1, 2));
      const mh = mv(Whh, h).map(clean);
      const mx = mv(Wxh, x).map(clean);
      const b = a.map((v, i) => clean(v - mh[i]! - mx[i]!));
      const v = a.map(T2);
      const decoy = pick(rng, NICE.filter((u) => !a.some((w) => Math.abs(w) === Math.abs(u))));
      return {
        prompt: `An RNN with two hidden units takes a step:\n\n${given(mat(Whh), vec(h), mat(Wxh), vec(x), vec(b))}\n\nWhat is $\\symh_t$? Round to two decimals. Use ${useTanh([...a, decoy])}.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(v, [
          { value: a, why: 'That is the pre-activation. The step ends by squashing it with tanh, entry by entry.' },
          { value: a.map(relu), why: 'That is ReLU. The recurrence squashes with tanh, which keeps $\\symh$ between $-1$ and $1$.' },
        ]),
        solution: [
          STEP(),
          `The memory term: $\\symWhh\\symh_{t-1} = ${vec(mh)}$; the input term: $\\symWxh\\symx_t = ${vec(mx)}$.`,
          `Pre-activation: $${vec(mh)} + ${vec(mx)} + ${vec(b)} = ${vec(a)}$.`,
          `Squash each entry: $\\symh_t = [\\tanh(${num(a[0]!)}),\\ \\tanh(${num(a[1]!)})] \\approx ${vec(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'shapes',
    make(rng, d) {
      const small = d < 0.5;
      const H = small ? int(rng, 2, 8) : pick(rng, [64, 128, 256, 512]);
      let D = small ? int(rng, 2, 9) : pick(rng, [16, 32, 50, 100, 300]);
      if (D === H) D++;
      const V = pick(rng, [65, 1000, 10000]);
      const emb = !small && rng.int(2) === 0;
      const what = d < 0.35 ? pick(rng, ['Whh', 'Wxh'] as const) : pick(rng, ['Whh', 'Wxh', 'b', 'h'] as const);
      const setup = emb
        ? `An RNN with $\\symH = ${H}$ hidden units reads tokens from an embedding table of shape $(V, \\symD) = ${shp([V, D])}$.`
        : `An RNN has $\\symH = ${H}$ hidden units, and each input $\\symx_t$ has $\\symD = ${D}$ numbers.`;
      const W_XH = 'That is $\\symWxh$\'s shape, which multiplies $\\symx_t$. $\\symWhh$ multiplies $\\symh_{t-1}$, $\\symH$ numbers, and gives $\\symH$ numbers.';
      const cases = {
        Whh: {
          tex: '\\symWhh',
          value: [H, H],
          traps: [{ value: [H, D], why: W_XH }, { value: [D, D], why: '$\\symWhh$ never touches $\\symx_t$: it maps the old state, $\\symH$ numbers, to $\\symH$ numbers.' }],
          sol: `$\\symWhh\\symh_{t-1}$ turns $\\symH = ${H}$ numbers into $\\symH = ${H}$: shape $${shp([H, H])}$.`,
        },
        Wxh: {
          tex: '\\symWxh',
          value: [H, D],
          traps: [
            { value: [D, H], why: `That is transposed. $\\symWxh$ multiplies $\\symx_t$, so it has one column per entry of $\\symx_t$ (${D}) and one row per hidden unit (${H}).` },
            { value: [H, H], why: 'That is $\\symWhh$\'s shape. $\\symWxh$ multiplies the input, which has $\\symD$ numbers.' },
            ...(emb ? [{ value: [V, D], why: 'That is the embedding table. $\\symWxh$ maps one embedded token, $\\symD$ numbers, into the hidden state.' }] : []),
          ],
          sol: `$\\symWxh\\symx_t$ turns $\\symD = ${D}$ numbers into $\\symH = ${H}$: shape $${shp([H, D])}$, rows first.`,
        },
        b: {
          tex: '\\symb',
          value: [H],
          traps: [{ value: [D], why: `$\\symb$ is added to the pre-activation, which has one entry per hidden unit: $\\symH = ${H}$.` }, { value: [H, H], why: 'The bias is a vector, one number per hidden unit, not a matrix.' }],
          sol: `$\\symb$ adds one number to each of the $\\symH = ${H}$ pre-activations: shape $${shp([H])}$.`,
        },
        h: {
          tex: '\\symh_t',
          value: [H],
          traps: [{ value: [D], why: `That is the input's size. The state has one entry per hidden unit, $\\symH = ${H}$, whatever the input.` }, { value: [H, H], why: 'That is $\\symWhh$. The state itself is a vector.' }],
          sol: `$\\symh_t = \\tanh(\\cdots)$ has one entry per hidden unit: shape $${shp([H])}$.`,
        },
      }[what];
      return {
        prompt: `${setup} What is the shape of $${cases.tex}$?`,
        answer: { kind: 'shape', value: cases.value },
        traps: cases.traps,
        solution: [STEP(), ...(what === 'Whh' || what === 'Wxh' ? ['A weight matrix that turns $m$ numbers into $n$ has shape $(n, m)$: one row per output.'] : []), cases.sol],
      };
    },
  },
  {
    id: 'sharing',
    make(rng, d) {
      const H = pick(rng, [4, 16, 64, 128, 256]);
      const n = int(rng, 5, 40);
      if (d < 0.5 || rng.int(2) === 0) {
        return {
          prompt: `An RNN with $\\symH = ${H}$ hidden units reads a sequence of ${n} tokens. How many different $\\symWhh$ matrices does it use?`,
          answer: {
            kind: 'choice',
            options: ['One, used again at every step', `${n}, one for each step`, `${n - 1}, one for each step after the first`, `${H}, one for each hidden unit`],
            correct: 0,
            why: [
              null,
              'Every step applies the same $\\symWhh$, $\\symWxh$ and $\\symb$. That is what lets one network read a sequence of any length.',
              'Every step, the first included, applies the same $\\symWhh$; the first just multiplies it by $\\symh_0 = 0$.',
              `$\\symWhh$ is one $(${H}, ${H})$ matrix for all the units together, and it is the same at every step.`,
            ],
          },
          solution: [`Every step computes $\\symh_t = \\tanh(\\symWhh\\symh_{t-1} + \\symWxh\\symx_t + \\symb)$ with the same weights.`, `So ${n} steps use one $\\symWhh$ ${n} times. The parameter count does not grow with the length.`],
        };
      }
      const m = n + int(rng, 5, 60);
      return {
        prompt: `An RNN with $\\symH = ${H}$ hidden units reads a sequence of ${n} tokens. Then, with the same weights, it reads a sequence of ${m} tokens. What changes?`,
        answer: {
          kind: 'choice',
          options: [`Only the number of steps: ${m} instead of ${n}`, `It needs ${m - n} more sets of weights`, `$\\symWhh$ grows to shape $(${m}, ${m})$`, `It can read only the first ${n} tokens`],
          correct: 0,
          why: [
            null,
            'There are no per-step weights to add. One set is applied at every step, however many there are.',
            `$\\symWhh$ maps the state to the state: its shape is $(\\symH, \\symH) = (${H}, ${H})$ whatever the length.`,
            'Nothing in the weights depends on the length: the loop simply keeps going, one step per token.',
          ],
        },
        solution: ['The recurrence is a loop that applies the same weights at every step.', `So a longer sequence is just more steps: ${m} of them, still with one $\\symWhh$, one $\\symWxh$ and one $\\symb$.`],
      };
    },
  },
];
