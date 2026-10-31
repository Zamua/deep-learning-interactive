import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, mat, num, pick, shp, straps, sum, traps, vtraps } from '../../kit';
import { placesFor } from '../../networks/kit';
import { probs } from '../../optimization/kit';
import { A, DK, DV, k, K, q, Q, SENTENCES, T, v, V, vecT } from '../kit';

/** Three different sizes for T, d_k and d_v, growing with difficulty. */
function sizes(rng: Rng, d: number): [number, number, number] {
  for (;;) {
    const t = d < 0.35 ? int(rng, 3, 9) : d < 0.7 ? pick(rng, [10, 12, 16, 20, 32, 50]) : pick(rng, [128, 256, 512, 1024, 2048]);
    const dk = d < 0.35 ? pick(rng, [2, 4, 8]) : d < 0.7 ? pick(rng, [8, 16, 32]) : pick(rng, [32, 64, 128]);
    const dv = d < 0.5 ? dk * pick(rng, [1, 2]) : pick(rng, [16, 32, 64, 96, 128]);
    if (new Set([t, dk, dv]).size === 3) return [t, dk, dv];
  }
}

const SCORE = `${Q}${K}^{\\top}`;
const WEIGHTS = `${A} = \\mathrm{softmax}\\!\\left(${Q}${K}^{\\top} / \\sqrt{${DK}}\\right)`;

/** A T by T matrix of weights whose rows each add up to exactly 1. */
const weights = (rng: Rng, n: number, d: number): number[][] => Array.from({ length: n }, () => probs(rng, n, d));

export const generators: Generator[] = [
  {
    id: 'shapes',
    make(rng, d) {
      const [t, dk, dv] = sizes(rng, d);
      const which = pick(rng, d < 0.35 ? (['Q', 'V', 'S', 'out'] as const) : (['Q', 'K', 'V', 'S', 'A', 'out'] as const));
      const setup = `Self-attention reads $${T} = ${t}$ tokens, with queries and keys of $${DK} = ${dk}$ entries and values of $${DV} = ${dv}$.`;
      const name = { Q: `$${Q}$`, K: `$${K}$`, V: `$${V}$`, S: `$${SCORE}$`, A: `$${A}$`, out: `$${A}${V}$` }[which];
      const ans = { Q: [t, dk], K: [t, dk], V: [t, dv], S: [t, t], A: [t, t], out: [t, dv] }[which];
      const ts: { value: number[]; why: string }[] = [];
      if (which === 'Q' || which === 'K' || which === 'V') {
        ts.push({ value: [ans[1]!, t], why: `That puts one token per column. ${which === 'Q' ? `$${Q}$` : which === 'K' ? `$${K}$` : `$${V}$`} has one row per token.` });
        ts.push({ value: [t, t], why: 'That is the shape of the score matrix, every token against every token.' });
        if (which === 'V') ts.push({ value: [t, dk], why: `The values have their own length, $${DV} = ${dv}$.` });
        else ts.push({ value: [t, dv], why: `That is the values' length. Queries and keys have $${DK} = ${dk}$ entries.` });
      } else if (which === 'S' || which === 'A') {
        ts.push({ value: [dk, dk], why: `That keeps the inner sizes. $(${t}, ${dk})$ times $(${dk}, ${t})$: the inner ${dk}s match and disappear, leaving $(${t}, ${t})$.` });
        ts.push({ value: [t, dk], why: `That is the shape of $${Q}$. Multiplying by $${K}^{\\top}$, which is $(${dk}, ${t})$, gives one score per pair of tokens.` });
        if (which === 'A') ts.push({ value: [t, dv], why: `That is the output's shape. The weights come before the values: one per pair of tokens.` });
      } else {
        ts.push({ value: [t, t], why: `That is the shape of the weights $${A}$. Times $${V}$, which is $(${t}, ${dv})$, gives one value-sized row per token.` });
        ts.push({ value: [t, dk], why: `The output mixes values, so its rows have the values' length, $${DV} = ${dv}$.` });
        ts.push({ value: [dv, t], why: 'That is the transpose: the output has one row per token.' });
      }
      const why = {
        Q: [`Each token's query is one row of $${Q}$: ${t} rows of ${dk}.`],
        K: [`Each token's key is one row of $${K}$: ${t} rows of ${dk}.`],
        V: [`Each token's value is one row of $${V}$: ${t} rows of ${dv}.`],
        S: [`$${Q}$ is $(${t}, ${dk})$ and $${K}^{\\top}$ is $(${dk}, ${t})$.`, `The inner ${dk}s match and disappear: $(${t}, ${t})$, one score for every query against every key.`],
        A: [`The weights are $${WEIGHTS}$.`, `The scores $${SCORE}$ are $(${t}, ${dk}) \\times (${dk}, ${t}) = (${t}, ${t})$.`, `Dividing by $\\sqrt{${DK}}$ and the softmax along each row keep the shape.`],
        out: [`$${A}$ is $(${t}, ${t})$ and $${V}$ is $(${t}, ${dv})$.`, `The inner ${t}s match and disappear: $(${t}, ${dv})$, one row per token.`],
      }[which];
      return {
        prompt: `${setup} What is the shape of ${name}?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, ts),
        solution: [...why, `So ${name} is $${shp(ans)}$.`],
      };
    },
  },
  {
    id: 'row',
    make(rng, d) {
      const n = d < 0.35 ? 2 : 3;
      const W = weights(rng, n, d < 0.7 ? 0 : 1);
      for (;;) {
        const vals = Array.from({ length: n }, () => Array.from({ length: 2 }, () => int(rng, d < 0.35 ? 0 : -2, 4)));
        if (new Set(vals.map(String)).size < n) continue;
        const i = rng.int(n);
        const out = [0, 1].map((c) => clean(W[i]!.reduce((a, w, j) => a + w * vals[j]![c]!, 0)));
        const col = [0, 1].map((c) => clean(W.reduce((a, r, j) => a + r[i]! * vals[j]![c]!, 0)));
        const places = placesFor(...out);
        return {
          prompt: `Self-attention over ${n} tokens has the weights and values\n\n$$${A} = ${mat(W)},\\qquad ${V} = ${mat(vals)}$$\n\nCounting tokens from 0, what is token ${i}'s output?${places ? ' Round to two decimals.' : ''}`,
          answer: { kind: 'vector', value: out, places },
          traps: vtraps(out, [
            { value: col, why: `That uses column ${i} of $${A}$. Token ${i}'s weights are row ${i}: how much it takes from each token.` },
            { value: [0, 1].map((c) => sum(vals.map((r) => r[c]!))), why: 'That adds the values without their weights.' },
            { value: vals[i]!, why: `That is token ${i}'s own value. Its output mixes every token's value, weighted by row ${i} of $${A}$.` },
          ], places),
          solution: [
            `Token ${i}'s weights are row ${i} of $${A}$: $${vecT(W[i]!)}$.`,
            `Weight each row of $${V}$ and add: ${W[i]!.map((w, j) => `$${num(w)} \\times ${vecT(vals[j]!)}$`).join(' $+$ ')}.`,
            `That is $${vecT(out)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'rowsum',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      for (;;) {
        const W = weights(rng, n, d < 0.35 ? 0 : 1);
        const i = rng.int(n);
        const j = rng.int(n);
        const v = W[i]![j]!;
        const rest = clean(sum(W[i]!) - v);
        const colRest = clean(sum(W.map((r) => r[j]!)) - v);
        if (Math.abs(1 - colRest - v) < 0.005 || 1 - colRest < 0) continue;
        const tex = `\\begin{bmatrix} ${W.map((r, a) => r.map((x, b) => (a === i && b === j ? '?' : num(x))).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
        return {
          prompt: `These are self-attention's weights for ${n} tokens, with one entry hidden:\n\n$$${A} = ${tex}$$\n\nWhat is the hidden entry?`,
          answer: { kind: 'number', value: v, places: placesFor(v) },
          traps: traps(v, [
            { value: clean(1 - colRest), why: `That makes column ${j} add up to 1. The softmax runs along each row: row ${i} adds up to 1.` },
            { value: rest, why: `That is what the other entries of row ${i} add up to. The hidden one is 1 minus that.` },
          ], placesFor(v)),
          solution: [`$${WEIGHTS}$, with the softmax along each row, so every row of $${A}$ adds up to 1.`, `Row ${i}'s other entries add up to $${num(rest)}$, so the hidden one is $1 - ${num(rest)} = ${num(v)}$.`],
        };
      }
    },
  },
  {
    id: 'entry',
    make(rng) {
      const ws = pick(rng, SENTENCES);
      const i = rng.int(4);
      const j = (i + 1 + rng.int(3)) % 4;
      const sent = ws.map((w) => `\`${w}\``).join(' ');
      if (rng.int(2) === 0) {
        return {
          prompt: `For the sentence ${sent}, self-attention computes $${SCORE}$. Counting tokens from 0, what is its entry $(${i}, ${j})$?`,
          answer: {
            kind: 'choice',
            options: [
              `Token ${i}'s query dotted with token ${j}'s key: how much \`${ws[i]}\` looks at \`${ws[j]}\``,
              `Token ${j}'s query dotted with token ${i}'s key: how much \`${ws[j]}\` looks at \`${ws[i]}\``,
              `Token ${i}'s query dotted with token ${j}'s value: what \`${ws[j]}\` hands to \`${ws[i]}\``,
              `Token ${i}'s key dotted with token ${j}'s key: how alike the two tokens' keys are`,
            ],
            correct: 0,
            why: [
              null,
              `Row $i$ of $${Q}$ meets column $j$ of $${K}^{\\top}$, which is row $j$ of $${K}$: the query comes from the row index.`,
              `$${V}$ is not in $${SCORE}$; the values are used after the softmax.`,
              `$${SCORE}$ multiplies queries by keys. Row ${i} of $${Q}$ is token ${i}'s query, not its key.`,
            ],
          },
          solution: [`Entry $(${i}, ${j})$ of $${SCORE}$ is row ${i} of $${Q}$ dotted with column ${j} of $${K}^{\\top}$, which is row ${j} of $${K}$.`, `So it is $${q}_{${i}} \\cdot ${k}_{${j}}$: how strongly token ${i}, \`${ws[i]}\`, asks for token ${j}, \`${ws[j]}\`.`],
        };
      }
      return {
        prompt: `For the sentence ${sent}, self-attention computes its weights $${A}$, a $4 \\times 4$ matrix. Which entries add up to 1?`,
        answer: {
          kind: 'choice',
          options: [
            `Each row: row ${i} holds how \`${ws[i]}\` splits its attention over all 4 tokens`,
            `Each column: column ${i} holds how much attention all 4 tokens pay to \`${ws[i]}\``,
            'All 16 entries together: the attention is shared out over the whole matrix',
            `None of them: each entry is a dot product of a query and a key, of any size`,
          ],
          correct: 0,
          why: [
            null,
            `The softmax runs along each row, over the keys. A column can add up to more or less than 1: some tokens get more attention than others.`,
            'The softmax is taken one row at a time, so each row adds up to 1 and the whole matrix adds up to 4.',
            `That is true of the scores $${SCORE}$. The softmax turns each row of them into weights that add up to 1.`,
          ],
        },
        solution: [`$${WEIGHTS}$, with the softmax along each row of the scores: one row per token asking, one entry per token asked.`, `So row ${i} adds up to 1, and token ${i}'s output is a weighted average of the values, with row ${i} as the weights.`],
      };
    },
  },
];
