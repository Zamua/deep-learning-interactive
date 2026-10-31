import type { Generator } from '../../../mastery/domain/types';
import { big, clean, num, pick, traps } from '../../kit';
import { whys } from '../../training/kit';
import { C, D, N, norm, sci, sciOf, words } from '../kit';

/** The power of ten that brings a positive mantissa into [1, 10). */
const shiftOf = (x: number): number => (x >= 100 ? 2 : x >= 10 ? 1 : 0);

/** Whole, at least 1, at most 100,000, with no more than two significant digits. */
function nice(v: number): boolean {
  const x = clean(v);
  if (!Number.isInteger(x) || x < 1 || x > 100000) return false;
  let m = x;
  while (m % 10 === 0) m /= 10;
  return m < 100;
}

export const generators: Generator[] = [
  {
    id: 'six-nd',
    make(rng, d) {
      const a = pick(rng, d < 0.35 ? [1, 2, 3] : [1, 2, 3, 4, 5, 7, 8]);
      const b = pick(rng, d < 0.35 ? [1, 2, 5] : [1, 2, 3, 4, 5, 6, 8]);
      const p = pick(rng, [8, 9, 10]);
      const q = pick(rng, [10, 11, 12]);
      const prod = 6 * a * b;
      const shift = d < 0.35 ? 0 : shiftOf(prod);
      const k = p + q + shift;
      const c = clean(prod / 10 ** shift);
      const say = d >= 0.7;
      const counts = say
        ? `A model with ${words(a * 10 ** p)} parameters trains on ${words(b * 10 ** q)} tokens.`
        : `A model with $${N} = ${sci(a, p)}$ parameters trains on $${D} = ${sci(b, q)}$ tokens.`;
      return {
        prompt: `${counts} Its training compute is about $${C} = c \\times 10^{${k}}$ FLOPs. What is $c$?`,
        answer: { kind: 'number', value: c },
        traps: traps(c, [
          { value: (2 * a * b) / 10 ** shift, why: 'That counts only the forward pass, 2 FLOPs per parameter per token. The backward pass adds 4 more: $6ND$ in all.' },
          { value: (a * b) / 10 ** shift, why: 'That is $ND$ without the 6. Each parameter costs about 6 FLOPs for every token: 2 forward and 4 backward.' },
          ...(shift ? [{ value: prod, why: `That is $${prod} \\times 10^{${p + q}}$, the right amount, but the question writes it with $10^{${k}}$: move the decimal point ${shift} place${shift > 1 ? 's' : ''} left.` }] : []),
        ]),
        solution: [
          `Training costs about $${C} \\approx 6${N}${D}$: 2 FLOPs per parameter per token forward, 4 backward.`,
          ...(say ? [`In powers of ten: $${N} = ${sci(a, p)}$ and $${D} = ${sci(b, q)}$.`] : []),
          `Multiply the leading numbers, $6 \\times ${a} \\times ${b} = ${prod}$, and add the powers: $10^{${p}} \\times 10^{${q}} = 10^{${p + q}}$.`,
          shift ? `So $${C} \\approx ${prod} \\times 10^{${p + q}} = ${num(c)} \\times 10^{${k}}$: $c = ${num(c)}$.` : `So $${C} \\approx ${prod} \\times 10^{${k}}$: $c = ${prod}$.`,
        ],
      };
    },
  },
  {
    id: 'gpu-time',
    make(rng, d) {
      const hours = d >= 0.6;
      for (let tries = 0; ; tries++) {
        const a = pick(rng, [1, 2, 3, 4, 5, 6, 8]);
        const p = pick(rng, [8, 9, 10]);
        const b = pick(rng, [1, 2, 3, 4, 5, 6, 8, 9]);
        const q = pick(rng, [10, 11, 12]);
        const g = pick(rng, d < 0.3 ? [1, 10, 100, 1000] : [8, 10, 16, 64, 100, 256, 1000]);
        const r = d < 0.3 ? 1 : pick(rng, [1, 2, 3, 5]);
        const flops = 6 * a * b;
        const sec = clean((flops * 10 ** (p + q - 14)) / (g * r));
        const inHours = hours && tries < 4000;
        const v = inHours ? clean(sec / 3600) : sec;
        if (!nice(v)) continue;
        const unit = inHours ? 'hours' : 'seconds';
        const rate = clean(g * r);
        const cluster = g === 1 ? `One GPU sustains $${sci(r, 14)}$ FLOPs per second.` : `The run uses ${words(g)} GPUs, each sustaining $${sci(r, 14)}$ FLOPs per second.`;
        const totalTex = `${flops} \\times 10^{${p + q}}`;
        const rn = norm(rate * 1e14);
        const lead = clean(flops / rn.m);
        return {
          prompt: `A model with $${N} = ${sci(a, p)}$ parameters trains on $${D} = ${sci(b, q)}$ tokens. ${cluster} How many ${unit} does training take?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: v / 3, why: 'That counts only the forward pass, $2ND$. Training also runs the backward pass, which costs twice as much: $6ND$.' },
            ...(g > 1 ? [{ value: v * g, why: `That is how long one GPU would take alone. The ${words(g)} GPUs share the work, so divide by ${words(g)} too.` }] : []),
            inHours ? { value: sec, why: 'That is the time in seconds. Divide by 3,600 for hours.' } : { value: v / 6, why: 'That leaves out the 6: training costs 6 FLOPs per parameter per token, not 1.' },
          ]),
          solution: [
            `Compute: $${C} \\approx 6${N}${D} = 6 \\times ${sci(a, p)} \\times ${sci(b, q)}$.`,
            `Multiply the leading numbers, $6 \\times ${a} \\times ${b} = ${flops}$, and add the powers, $${p} + ${q} = ${p + q}$: $${totalTex}$ FLOPs.`,
            g === 1 ? `The GPU does $${sci(r, 14)}$ FLOPs per second.` : `Together the GPUs do $${big(g)} \\times ${sci(r, 14)} = ${sciOf(rate * 1e14)}$ FLOPs per second.`,
            `Divide the leading numbers: $${flops} / ${num(rn.m)} = ${num(lead)}$.`,
            `Subtract the powers: $10^{${p + q}} / 10^{${rn.e}} = 10^{${p + q - rn.e}}$.`,
            `So $${num(lead)} \\times 10^{${p + q - rn.e}} = ${big(sec)}$ seconds.`,
            ...(inHours ? [`An hour is $3{,}600$ seconds: $${big(sec)} / 3{,}600 = ${big(v)}$ hours.`] : []),
          ],
        };
      }
    },
  },
  {
    id: 'forward',
    make(rng, d) {
      const a = pick(rng, [1, 2, 3, 4, 5, 7, 8]);
      const p = pick(rng, [8, 9, 10, 11]);
      const one = d < 0.35 || rng.next() < 0.3;
      const b = one ? 1 : pick(rng, [1, 2, 3, 5]);
      const q = one ? 0 : pick(rng, [4, 5, 6, 7]);
      const prod = 2 * a * b;
      const shift = shiftOf(prod);
      const k = p + q + shift;
      const c = clean(prod / 10 ** shift);
      const scaled = (x: number) => x / 10 ** shift;
      const ask = one
        ? `A trained model has $${N} = ${sci(a, p)}$ parameters. Running it forward on one token costs about $c \\times 10^{${k}}$ FLOPs. What is $c$?`
        : `A trained model has $${N} = ${sci(a, p)}$ parameters. Scoring $${sci(b, q)}$ tokens with it runs only the forward pass. That costs about $c \\times 10^{${k}}$ FLOPs. What is $c$?`;
      return {
        prompt: ask,
        answer: { kind: 'number', value: c },
        traps: traps(c, [
          { value: scaled(6 * a * b), why: 'That is what training costs, 6 FLOPs per parameter per token. With no backward pass, only the forward 2 remain.' },
          { value: scaled(a * b), why: 'Each weight does two operations per token, a multiply and an add: 2 FLOPs, not 1.' },
          { value: scaled(4 * a * b), why: 'That is the backward pass\'s share, 4 per parameter per token. The forward pass alone costs 2.' },
        ]),
        solution: [
          'Forward only: each weight multiplies one number and adds the product into a sum, 2 FLOPs per parameter per token.',
          one
            ? `One token: $2${N} = 2 \\times ${sci(a, p)}${a === 1 ? '' : ` = ${prod} \\times 10^{${p}}`}$ FLOPs.`
            : `$${sci(b, q)}$ tokens: $2 \\times ${sci(a, p)} \\times ${sci(b, q)} = ${prod} \\times 10^{${p + q}}$ FLOPs.`,
          shift ? `That is $${num(c)} \\times 10^{${k}}$: $c = ${num(c)}$.` : `So $c = ${prod}$.`,
        ],
      };
    },
  },
  {
    id: 'compare',
    make(rng, d) {
      const nA = pick(rng, [1, 2, 3, 5, 7, 10, 20]) * 1e9;
      const dA = pick(rng, [20, 50, 100, 200, 300, 500]) * 1e9;
      const k = pick(rng, d < 0.5 ? [2, 10] : [2, 4, 5, 10]);
      const kind = rng.int(3);
      // The run with more parameters is not always the costlier one.
      const j = pick(rng, [2, 4, 5]);
      const nB = nA * k;
      const dB = kind === 0 ? dA / k : kind === 1 ? dA / (k * j) : (dA * j) / k;
      const flip = rng.next() < 0.5;
      const runs = flip ? [[nB, dB], [nA, dA]] : [[nA, dA], [nB, dB]];
      const [[n0, d0], [n1, d1]] = runs as [[number, number], [number, number]];
      const p0 = n0 * d0;
      const p1 = n1 * d1;
      const correct = Math.abs(p0 - p1) < 1e-6 * p0 ? 2 : p0 > p1 ? 0 : 1;
      const show = (n: number, t: number) => `a ${words(n).replace(' ', '-')}-parameter model on ${words(t)} tokens`;
      const nd = (n: number, t: number) => `${sciOf(n)} \\times ${sciOf(t)} = ${sciOf(n * t)}`;
      const ratio = clean(Math.max(p0, p1) / Math.min(p0, p1));
      const facts = correct === 2 ? `$${nd(n0, d0)}$ and $${nd(n1, d1)}$ are the same product` : `run ${correct === 0 ? 'A' : 'B'}'s $${N}${D}$ is ${num(ratio)} times run ${correct === 0 ? 'B' : 'A'}'s`;
      return {
        prompt: `Run A trains ${show(n0, d0)}. Run B trains ${show(n1, d1)}. Which needs more training compute?`,
        answer: {
          kind: 'choice',
          options: ['Run A', 'Run B', 'They need the same compute'],
          correct,
          why: whys(3, correct, (i) =>
            i === 2
              ? `Compute is $6${N}${D}$, so compare $${N} \\times ${D}$: ${facts}.`
              : `${(i === 0 ? n0 > n1 : n1 > n0) ? 'More parameters alone does not decide it' : 'More tokens alone does not decide it'}: compute is $6${N}${D}$, and ${facts}.`,
          ),
        },
        solution: [
          `Training compute is $6${N}${D}$, so compare the products $${N} \\times ${D}$.`,
          `Run A: $${nd(n0, d0)}$. Run B: $${nd(n1, d1)}$.`,
          correct === 2 ? 'The products are equal: what one run gains in parameters, the other gains in tokens.' : `Run ${correct === 0 ? 'A' : 'B'}'s product is ${num(ratio)} times larger, so it needs ${num(ratio)} times the compute.`,
        ],
      };
    },
  },
];
