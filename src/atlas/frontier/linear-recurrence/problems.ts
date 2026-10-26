import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { bigText } from '../../convnets/kit';
import { choice } from '../../inference/kit';
import { clean, nonzero, paren, traps } from '../../optimization/kit';

/** h_1 .. h_n from h_0, with `a` on the old state and `b` on the input. */
function run(a: number, b: number, h0: number, xs: readonly number[]): number[] {
  const hs = [h0];
  for (const x of xs) hs.push(clean(a * hs[hs.length - 1]! + b * x));
  return hs;
}

const xsTex = (xs: readonly number[]) => xs.map((x, i) => `$\\symx_{${i + 1}} = ${num(x)}$`).join(', ');
const stepTex = (a: number, b: number, prev: number, x: number, t: number, h: number) =>
  `Step ${t}: $\\symh_{${t}} = ${num(a)} \\times ${paren(prev)} + ${paren(b)} \\times ${paren(x)} = ${num(h)}$.`;

/** `|a|^k`, rounded to two places, and how a prompt quotes it. */
const pow2 = (a: number, k: number) => round(Math.abs(a) ** k, 2) + 0;
const powUse = (a: number, ks: number[]) => ks.map((k) => `$${num(a)}^{${k}} \\approx ${num(pow2(a, k), 2)}$`).join(', ');

/** `m^k` for a solution line: exact when four places hold it, else about two places. */
function powLine(m: number, k: number): string {
  const v = m ** k;
  const exact = Math.abs(round(v, 4) - v) < 1e-12;
  return `${num(m)}^{${k}} ${exact ? '=' : '\\approx'} ${exact ? num(round(v, 4) + 0) : num(round(v, 2) + 0, 2)}`;
}

export const generators: Generator[] = [
  {
    id: 'state',
    make(rng, d) {
      const easy = d < 0.35;
      const a = easy ? 0.5 : d < 0.7 ? pick(rng, [0.5, -0.5, 1, 2, 0.1]) : pick(rng, [0.5, -0.5, 0.2, 0.1, 1.5]);
      const b = easy ? int(rng, 1, 4) : pick(rng, [1, 2, 3, -1, -2]);
      const h0 = d < 0.7 ? 0 : nonzero(rng, -2, 4);
      const xs = Array.from({ length: 3 }, () => (easy ? int(rng, 1, 4) : nonzero(rng, -3, 4)));
      const askY = !easy && rng.int(2) === 0;
      const c = askY ? pick(rng, [2, 3, -1, -2]) : 1;
      const hs = run(a, b, h0, xs);
      const h = hs[3]!;
      const ans = clean(c * h);
      const out = (v: number) => clean(c * v);
      const ts = [
        { value: out(run(1, b, h0, xs)[3]!), why: `That adds every input in full, as if $a$ were 1. Each step first multiplies the old state by $a = ${num(a)}$.` },
        { value: out(b * xs[2]!), why: 'That is the last input alone. The state also carries $a$ times everything before it.' },
        { value: out(run(b, a, h0, xs)[3]!), why: 'That swaps the weights: $a$ multiplies the old state, and $b$ the new input.' },
        { value: out(run(a, 1, h0, xs)[3]!), why: 'That leaves out $b$, which scales each input as it comes in.' },
      ];
      if (h0 !== 0) ts.push({ value: out(run(a, b, 0, xs)[3]!), why: `That starts from 0. This recurrence starts at $\\symh_0 = ${num(h0)}$, which step 1 multiplies by $a$.` });
      if (askY) ts.push({ value: h, why: `That is the state $\\symh_3$. The output reads it out: $y_3 = c\\symh_3$.` });
      const given = `$a = ${num(a)}$ and $b = ${num(b)}$${askY ? `, and an output weight $c = ${num(c)}$` : ''}`;
      return {
        prompt: `A one-unit linear recurrence has ${given}. It starts at $\\symh_0 = ${num(h0)}$ and reads ${xsTex(xs)}. What is $${askY ? 'y_3' : '\\symh_3'}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: [
          'Each step computes $\\symh_t = a\\symh_{t-1} + b\\symx_t$: the old state times $a$, plus the input times $b$.',
          ...xs.map((x, i) => stepTex(a, b, hs[i]!, x, i + 1, hs[i + 1]!)),
          ...(askY ? [`The output: $y_3 = c\\symh_3 = ${num(c)} \\times ${paren(h)} = ${num(ans)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'weight',
    make(rng, d) {
      if (d >= 0.7) {
        const a = pick(rng, [0.9, 0.8, 0.95]);
        const k = pick(rng, [5, 10, 20]);
        const b = pick(rng, [1, 2, 3]);
        const c = pick(rng, [1, 2, 4]);
        const p = pow2(a, k);
        const ans = clean(c * p * b);
        return {
          prompt: `A linear recurrence has $a = ${num(a)}$, $b = ${b}$ and $c = ${c}$. What weight does its output $y_t$ give the input $\\symx_{t-${k}}$? Use ${powUse(a, [k - 1, k, k + 1])}.`,
          answer: { kind: 'number', value: ans, places: 2 },
          traps: traps(ans, [
            { value: c * pow2(a, k + 1) * b, why: `That counts one step too many. $\\symx_{t-${k}}$ enters times $b$ at its own step, then is multiplied by $a$ once for each of the ${k} steps after it.` },
            { value: c * pow2(a, k - 1) * b, why: `That counts one step too few. $\\symx_{t-${k}}$ waits ${k} steps, multiplied by $a$ at each: $a^{${k}}$.` },
            { value: p, why: 'That is $a^k$ alone. The input also enters times $b$, and the output reads the state out times $c$.' },
            { value: c * b, why: 'That ignores the decay. Each step the input waits multiplies its weight by $a$.' },
          ]).filter((t) => Math.abs(t.value - ans) >= 0.01),
          solution: [
            `An input $k$ steps back enters times $b$, is multiplied by $a$ at each of the $k$ steps after it, and is read out times $c$: weight $c\\,a^k b$.`,
            `Here $k = ${k}$: $${num(a)}^{${k}} \\approx ${num(p, 2)}$.`,
            `So $${c} \\times ${num(p, 2)} \\times ${b} = ${num(ans)}$.`,
          ],
        };
      }
      const easy = d < 0.35;
      const a = easy ? pick(rng, [0.5, 2]) : pick(rng, [0.5, -0.5, 0.1, 2, -2, 0.2]);
      const k = easy ? int(rng, 0, 2) : int(rng, 1, 4);
      const b = easy ? int(rng, 1, 4) : pick(rng, [1, 2, 3, 4, -1, -2]);
      const c = easy ? int(rng, 1, 4) : pick(rng, [1, 2, 3, -1, -2]);
      const pw = clean(a ** k);
      const ans = clean(c * pw * b);
      const target = k === 0 ? '\\symx_t' : `\\symx_{t-${k}}`;
      return {
        prompt: `A linear recurrence has $a = ${num(a)}$, $b = ${num(b)}$ and $c = ${num(c)}$. What weight does its output $y_t$ give the input $${target}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          k === 0
            ? { value: c * a * b, why: '$\\symx_t$ is the newest input: it has not waited a step yet, so no $a$ has touched it.' }
            : { value: c * a * b, why: `That is the weight one step back. $${target}$ waits ${k} steps, multiplied by $a$ at each: $a^{${k}}$.` },
          { value: c * a ** (k + 1) * b, why: `That counts one step too many. $${target}$ enters times $b$ at its own step, then is multiplied by $a$ once for each step after it.` },
          ...(k >= 2 ? [{ value: c * a ** (k - 1) * b, why: `That counts one step too few. $${target}$ waits ${k} steps, multiplied by $a$ at each: $a^{${k}}$.` }] : []),
          ...(k >= 2 ? [{ value: c * b * a * k, why: `That multiplies by ${k}. Each step back multiplies by $a$ again, so the weight has $a$ to the power ${k}.` }] : []),
          { value: pw, why: 'That is $a^k$ alone. The input also enters times $b$, and the output reads the state out times $c$.' },
          { value: c * b, why: 'That ignores the decay. Each step the input waits multiplies its weight by $a$.' },
        ]),
        solution: [
          `An input $k$ steps back enters times $b$, is multiplied by $a$ at each of the $k$ steps after it, and is read out times $c$: weight $c\\,a^k b$.`,
          k === 0 ? '$\\symx_t$ is the newest input: $k = 0$, so $a^0 = 1$.' : `$${target}$ is ${k} step${k === 1 ? '' : 's'} back: $${paren(a)}^{${k}} = ${num(pw)}$.`,
          `So $${num(c)} \\times ${paren(pw)} \\times ${paren(b)} = ${num(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'fade',
    make(rng, d) {
      const pool = d < 0.35 ? [0.5, 0.9, 0.2, 1, 2, 1.5] : [0.5, 0.9, 0.2, -0.5, -0.8, 1, -1, 1.1, 2, 1.5, -1.2, -2];
      const a = pick(rng, pool);
      const m = Math.abs(a);
      const fate = m < 1 ? 0 : m === 1 ? 1 : 2;
      const k = m < 0.6 || m > 1.4 ? 4 : 10;
      const n = pick(rng, [50, 100, 500, 1000]);
      const prompt =
        rng.int(2) === 0
          ? `A linear recurrence has $a = ${num(a)}$. As an input falls further into the past, what happens to its weight in the output?`
          : `A linear recurrence with $a = ${num(a)}$ reads ${bigText(n)} tokens. What happens to the first token's weight in the output as the tokens go by?`;
      const rate = `Every step back multiplies the weight by $a$, so its size goes as $|a|^k$, with $|a| = ${num(m)}$`;
      const wrong = [
        `$|a| = ${num(m)}$ is below 1, so the weight shrinks at every step back. Old inputs fade.`,
        `$|a| = 1$, so multiplying by $a$ never changes the weight's size. Old inputs are held.`,
        `$|a| = ${num(m)}$ is above 1, so the weight grows at every step back, and the state blows up.`,
      ][fate]!;
      const opts = [
        { text: 'It shrinks toward 0, so the input fades', why: fate === 0 ? null : wrong },
        { text: 'It keeps its size, so the input is held', why: fate === 1 ? null : wrong },
        { text: 'It grows without limit, so the state blows up', why: fate === 2 ? null : wrong },
        { text: 'It depends on the values of the inputs read', why: 'The weight is $c\\,a^k b$: only $a$, $b$ and $c$, never the inputs. It is fixed before any input arrives.' },
      ];
      return {
        prompt,
        answer: choice(opts),
        solution: [
          'An input $k$ steps back has weight $c\\,a^k b$.',
          `${rate}.`,
          `After ${k} steps its size is $${powLine(m, k)}$.`,
          ['So it shrinks toward 0: the memory fades.', 'So it keeps its size: the memory holds.', 'So it grows without limit: the state blows up.'][fate]! + (a < 0 ? ' A negative $a$ also flips its sign at every step.' : ''),
        ],
      };
    },
  },
  {
    id: 'parallel',
    make(rng, d) {
      const n = pick(rng, [100, 200, 500, 1000, 2000, 4000]);
      if (d < 0.5 || rng.int(2) === 0) {
        const a = pick(rng, [0.5, 0.9, 0.8, 0.99, 0.95]);
        return {
          prompt: `A tanh RNN and a one-unit linear recurrence with $a = ${num(a)}$ each read ${bigText(n)} tokens. Why can the linear recurrence compute all ${bigText(n)} outputs at once?`,
          answer: choice([
            { text: 'Without the tanh, each output is a weighted sum of the inputs with fixed weights', why: null },
            { text: 'It carries no state from step to step, so each output needs only its own input', why: 'It does carry a state, $\\symh_t = a\\symh_{t-1} + b\\symx_t$. Unrolled, that state is a weighted sum of every input so far.' },
            { text: 'Each of its steps is cheaper than a tanh step, so the whole run is faster', why: 'Cheaper steps would still run one after another. What frees them is that, without the tanh, the steps unroll into one weighted sum.' },
            { text: 'It learns a separate set of weights for every position in the sequence', why: 'It uses the same $a$, $b$ and $c$ at every step. That is why the weight on an input, $c\\,a^k b$, depends only on how far back it is.' },
          ]),
          solution: [
            'Unrolled, $y_t$ adds up the inputs, the one $k$ steps back weighted by $c\\,a^k b$.',
            'Those weights use only $a$, $b$ and $c$, so they are known before any input arrives.',
            `So each of the ${bigText(n)} outputs is a weighted sum of the inputs, and all of them can be computed side by side.`,
          ],
        };
      }
      return {
        prompt: `A tanh RNN reads ${bigText(n)} tokens. Why must it compute $\\symh_1$, then $\\symh_2$, and so on, one step at a time?`,
        answer: choice([
          { text: 'The tanh between steps keeps $\\symh_t$ from unrolling into a weighted sum of the inputs', why: null },
          { text: 'It uses a different weight matrix at every step, so each step is set up anew', why: 'Every step uses the same $\\symWhh$, $\\symWxh$ and $\\symb$. The order comes from the tanh, not from the weights.' },
          { text: 'Its state is too large to hold several steps of it in memory at the same time', why: 'Size is not what forces the order. Step $t$ feeds $\\symh_{t-1}$ through a tanh, so it cannot start until $\\symh_{t-1}$ exists.' },
          { text: 'A tanh can only be applied to one number at a time, so the steps queue up', why: 'A tanh applies to every entry at once. The trouble is what goes into it: step $t$ needs $\\symh_{t-1}$, which needs its own tanh first.' },
        ]),
        solution: [
          'Each step computes $\\symh_t = \\tanh(\\symWhh\\symh_{t-1} + \\symWxh\\symx_t + \\symb)$.',
          'The tanh bends its input, so $\\symh_t$ cannot be written as a fixed weighted sum of the inputs.',
          `So step $t$ has to wait for $\\symh_{t-1}$: all ${bigText(n)} steps run in order.`,
        ],
      };
    },
  },
];
