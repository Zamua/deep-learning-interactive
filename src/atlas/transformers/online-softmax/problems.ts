import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { big, clean, commas, int, num, pick, round, traps, vtraps } from '../../kit';
import { DV, vecT } from '../kit';

const M = '\\sym{m}{m}';
const L = '\\sym{l}{\\ell}';
const T = '\\sym{T}{T}';

const r2 = (x: number) => round(x + 1e-12, 2);
/** e^x as the prompts quote it, to two decimals. */
const ex = (x: number) => r2(Math.exp(x));
const f2 = (x: number) => num(r2(x));
/** "$e^{-1} \approx 0.37$, ..." for each distinct exponent, largest first. */
const useExp = (xs: readonly number[]) =>
  [...new Set(xs.map(clean))].filter((x) => x !== 0).sort((a, b) => b - a).map((x) => `$e^{${num(x)}} \\approx ${num(ex(x), 2)}$`).join(', ');

/** One pass over `s`: each step's (m, l), with l rounded to two places after every step. */
function pass(s: readonly number[]): { m: number; l: number; steps: string[]; exps: number[]; noRescale: number } {
  let m = s[0]!;
  let l = 1;
  let bad = 1;
  const exps: number[] = [];
  const steps = [`Score 0 is $${num(m)}$: $${M} = ${num(m)}$ and $${L} = e^{0} = 1$.`];
  s.slice(1).forEach((x, i) => {
    if (x > m) {
      const f = ex(m - x);
      exps.push(m - x);
      const nl = r2(l * f + 1);
      steps.push(`Score ${i + 1} is $${num(x)}$, a new max. Rescale: $${f2(l)} \\times e^{${num(clean(m - x))}} \\approx ${f2(l * f)}$, then add $e^{0} = 1$: $${L} \\approx ${f2(nl)}$, $${M} = ${num(x)}$.`);
      l = nl;
      bad = r2(bad + 1);
      m = x;
    } else {
      const t = ex(x - m);
      exps.push(x - m);
      const nl = r2(l + t);
      steps.push(`Score ${i + 1} is $${num(x)}$, ${x === m ? 'equal to' : 'below'} the max: add $e^{${num(clean(x - m))}} \\approx ${f2(t)}$, so $${L} \\approx ${f2(nl)}$.`);
      l = nl;
      bad = r2(bad + t);
    }
  });
  return { m, l, steps, exps, noRescale: bad };
}

/** Scores whose one-pass sum gives the same two decimals however the steps are rounded. */
function row(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const s = Array.from({ length: n }, () => int(rng, lo, hi));
    const top = Math.max(...s);
    if (s[0] === top || s.filter((x) => x === top).length > 1) continue;
    const p = pass(s);
    const direct = r2(s.reduce((a, x) => a + ex(x - top), 0));
    let m = s[0]!;
    let exact = 1;
    for (const x of s.slice(1)) {
      if (x > m) {
        exact = exact * ex(m - x) + 1;
        m = x;
      } else exact += ex(x - m);
    }
    if (p.l === direct && r2(exact) === direct) return s;
  }
}

export const generators: Generator[] = [
  {
    id: 'running',
    make(rng, d) {
      const s = d < 0.35 ? row(rng, 3, 0, 3) : d < 0.7 ? row(rng, 4, 0, 4) : row(rng, 4, -2, 3);
      const p = pass(s);
      const top = Math.max(...s);
      const v = [p.m, p.l];
      const last = s[s.length - 1]!;
      return {
        prompt: `One-pass softmax reads the scores $\\syms = ${vecT(s)}$ in order. What is $[${M},\\ ${L}]$ after the last score? Round to two decimals.\n\nUse ${useExp([...p.exps, ...s.map((x) => x - top)])}.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(v, [
          { value: [p.m, p.noRescale], why: `That never rescales $${L}$. Terms added before the max grew were measured against the old max, so they must shrink by $e^{\\text{old } ${M} - \\text{new } ${M}}$.` },
          { value: [last, p.l], why: `$${M}$ is the largest score so far, not the last one read.` },
        ], 2),
        solution: [`$${M}$ is the largest score so far and $${L}$ the sum of $e^{\\syms - ${M}}$ over the scores read so far, rescaled whenever $${M}$ grows.`, ...p.steps, `So $[${M},\\ ${L}] \\approx [${num(p.m)},\\ ${f2(p.l)}]$: the same as $\\sum e^{\\syms - ${num(top)}}$ over every score.`],
      };
    },
  },
  {
    id: 'rescale',
    make(rng, d) {
      const m = int(rng, 0, 3);
      const l = pick(rng, [1.37, 1.5, 2.14, 1.05, 2.5, 1.74, 3.2, 1.9]);
      if (d < 0.5) {
        const g = int(rng, 1, 3);
        const s = m + g;
        const v = ex(-g);
        return {
          prompt: `One-pass softmax has $${M} = ${m}$ and $${L} = ${num(l)}$, and the next score is $${s}$. By what factor must $${L}$ be multiplied before the new score's term is added?\n\nUse $e^{${g}} \\approx ${num(ex(g), 2)}$, $e^{-${g}} \\approx ${num(v, 2)}$.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: ex(g), why: `That is $e^{\\text{new} - \\text{old}}$: it would grow the old terms. They were measured against ${m} and must now be measured against ${s}, so they shrink by $e^{${m} - ${s}}$.` },
            { value: 1, why: `The max grew, so $${L}$ must be rescaled: its terms were measured against the old max.` },
            { value: r2(l * v), why: `That is $${L}$ after the rescale. The question asks for the factor itself.` },
          ], 2),
          solution: [
            `The new score ${s} is above the max ${m}, so every term in $${L}$, $e^{\\syms - ${m}}$, must become $e^{\\syms - ${s}}$.`,
            `$e^{\\syms - ${s}} = e^{\\syms - ${m}} \\times e^{${m} - ${s}}$, so the factor is $e^{-${g}} \\approx ${num(v, 2)}$.`,
          ],
        };
      }
      const up = rng.int(2) === 0;
      const g = d < 0.75 ? int(rng, 1, 3) : pick(rng, [0.5, 1, 1.5, 2]);
      const s = clean(up ? m + g : m - g);
      const use = `Use $e^{${num(g)}} \\approx ${num(ex(g), 2)}$, $e^{-${num(g)}} \\approx ${num(ex(-g), 2)}$.`;
      const prompt = `One-pass softmax has $${M} = ${m}$ and $${L} = ${num(l)}$, and the next score is $${num(s)}$. What is $${L}$ after it? Round to two decimals.\n\n${use}`;
      if (up) {
        const v = clean(l * ex(-g) + 1);
        return {
          prompt,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: l + 1, why: `That adds the new term without rescaling. The max grew from ${m} to ${num(s)}, so the old terms first shrink by $e^{-${num(g)}}$.` },
            { value: l * ex(g) + 1, why: `That rescales the wrong way. Old terms shrink when the max grows: multiply by $e^{\\text{old} - \\text{new}} = e^{-${num(g)}}$.` },
            { value: l * ex(-g), why: 'That rescales but leaves out the new score\'s own term, $e^{0} = 1$.' },
          ], 2),
          solution: [
            `$${L}$ is the sum of $e^{\\syms - ${M}}$ over the scores read so far.`,
            `$${num(s)}$ is a new max. Rescale: $${num(l)} \\times e^{-${num(g)}} \\approx ${num(l)} \\times ${num(ex(-g), 2)} \\approx ${f2(l * ex(-g))}$.`,
            `Add the new score's term, $e^{${num(s)} - ${num(s)}} = 1$: $${L} \\approx ${f2(v)}$, and $${M} = ${num(s)}$.`,
          ],
        };
      }
      const v = clean(l + ex(-g));
      return {
        prompt,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: l + 1, why: `That adds $e^{0} = 1$, as if the new score were the max. It is below ${m}, so its term is $e^{${num(s)} - ${m}}$.` },
          { value: l * ex(-g) + 1, why: 'That treats the score as a new max. Only a score above the running max calls for a rescale.' },
          { value: l + ex(g), why: `That flips the exponent. The term is $e^{\\syms - ${M}} = e^{${num(s)} - ${m}}$, below 1.` },
        ], 2),
        solution: [
          `$${L}$ is the sum of $e^{\\syms - ${M}}$ over the scores read so far.`,
          `$${num(s)}$ is below the max ${m}, so nothing is rescaled.`,
          `Add its term, $e^{${num(s)} - ${m}} \\approx ${num(ex(-g), 2)}$: $${L} \\approx ${num(l)} + ${num(ex(-g), 2)} = ${f2(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'weight',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const s = d < 0.35 ? row(rng, n, 0, 3) : row(rng, n, -1, 4);
      const top = Math.max(...s);
      const l = r2(s.reduce((a, x) => a + ex(x - top), 0));
      const i = d < 0.25 ? s.indexOf(top) : rng.int(n);
      const t = ex(s[i]! - top);
      const v = t / l;
      const isTop = s[i] === top;
      return {
        prompt: `One-pass softmax has read the scores $\\syms = ${vecT(s)}$ and ends with $${M} = ${top}$ and $${L} = ${num(l)}$. What softmax weight does score ${i} get, counting from 0? Round to two decimals.${isTop ? '' : `\n\nUse $e^{${num(s[i]! - top)}} \\approx ${num(t, 2)}$.`}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: t, why: `That is the score's term, $e^{\\syms - ${M}}$, before dividing by $${L}$.` },
          ...(isTop ? [] : [{ value: 1 / l, why: `That is the weight of the max, whose term is $e^{0} = 1$. Score ${i} is $${num(s[i]!)}$.` }]),
          ...(s.every((x) => x >= 0) ? [{ value: s[i]! / s.reduce((a, x) => a + x, 0), why: 'That divides the score by the sum of the scores. Softmax exponentiates first.' }] : []),
        ], 2),
        solution: [
          `Each weight is $e^{\\syms_i - ${M}} / ${L}$: the term the pass added, over the final sum.`,
          `Score ${i}: $e^{${num(s[i]!)} - ${top}} ${isTop ? '=' : '\\approx'} ${num(t, isTop ? undefined : 2)}$, and $${num(t, isTop ? undefined : 2)} / ${num(l)} \\approx ${f2(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'keep',
    make(rng) {
      const t = pick(rng, [1024, 2048, 4096, 8192, 16384]);
      const b = pick(rng, [64, 128, 256]);
      const dv = pick(rng, [32, 64, 128]);
      const kind = rng.int(3);
      if (kind === 0) {
        return {
          prompt: `FlashAttention reads one query's $${T} = ${big(t)}$ scores in tiles of ${b} keys at a time. What does it keep for that query from one tile to the next?`,
          answer: {
            kind: 'choice',
            options: ['The running max, the running sum and the running output', 'Every score seen so far, to take the softmax at the end', `Only the running sum of $e^{\\syms}$`, 'Only the running output, with the weights fixed at the end'],
            correct: 0,
            why: [
              null,
              `That is the row of ${commas(t)} scores, and over every query, the $${T} \\times ${T}$ matrix it is built never to store.`,
              'Without a running max there is nothing to subtract, so large scores overflow; and the output has to be built as it goes too.',
              `Each weight needs the final sum $${L}$, known only after the last tile, so $${L}$ and $${M}$ must be carried along.`,
            ],
          },
          solution: [
            `Each tile's scores are folded into a running max $${M}$, a running sum $${L}$, and a running output, then dropped.`,
            `When $${M}$ grows, $${L}$ and the output are both rescaled by $e^{\\text{old } ${M} - \\text{new } ${M}}$; at the end the output is divided by $${L}$.`,
          ],
        };
      }
      if (kind === 1) {
        return {
          prompt: `A head reads $${T} = ${big(t)}$ tokens with values of $${DV} = ${dv}$ numbers. While FlashAttention runs, how much does it keep for each query row?`,
          answer: {
            kind: 'choice',
            options: [`A max, a sum and an output of ${dv} numbers, however long the input`, `All ${commas(t)} scores of the row`, `A matrix of ${commas(t)} by ${commas(t)} scores`, 'A max and a sum: 2 numbers'],
            correct: 0,
            why: [
              null,
              'One-pass softmax makes that unnecessary: a tile\'s scores are dropped once they are folded into the running max, sum and output.',
              'That is the whole score matrix, for every query at once: the memory one-pass softmax avoids.',
              `The output, a weighted sum of values, is built as it goes too: ${dv} more numbers.`,
            ],
          },
          solution: [`Per query row: a running max $${M}$, a running sum $${L}$, and a running output of $${DV} = ${dv}$ numbers.`, `None of it grows with $${T}$: the $${T} \\times ${T}$ scores never exist all at once.`],
        };
      }
      const a = int(rng, 0, 3);
      const c = a + int(rng, 1, 3);
      return {
        prompt: `A tile raises one query's running max from $${M} = ${a}$ to $${c}$. What happens to that query's running output?`,
        answer: {
          kind: 'choice',
          options: [`It is multiplied by $e^{${a} - ${c}}$, like $${L}$`, `Nothing: only $${L}$ needs rescaling`, `It is multiplied by $e^{${c} - ${a}}$`, 'It is recomputed from the stored scores'],
          correct: 0,
          why: [
            null,
            `The output adds up values weighted by $e^{\\syms - ${M}}$. The old weights were measured against ${a}, so they shrink by the same factor as $${L}$.`,
            `That grows the old terms. The max went up, so the old terms shrink: $e^{\\text{old} - \\text{new}}$.`,
            'No scores are stored: each tile\'s scores are dropped once they are folded in.',
          ],
        },
        solution: [
          `The output is a running sum of values weighted by $e^{\\syms - ${M}}$, just like $${L}$ is a running sum of the weights.`,
          `When $${M}$ goes from ${a} to ${c}, every old weight becomes $e^{\\syms - ${c}} = e^{\\syms - ${a}} \\times e^{${a} - ${c}}$: multiply the output by $e^{${a} - ${c}}$.`,
        ],
      };
    },
  },
];
