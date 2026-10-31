import type { Generator } from '../../../mastery/domain/types';
import { clean, dot, E2, int, num, pick, prods, round, traps, vtraps } from '../../kit';
import { placesFor } from '../../networks/kit';
import { useExp } from '../../sequences/kit';
import { DK, k, q, softmax2, vecT } from '../kit';

/** Lengths with whole square roots. */
const ROOTS = [4, 9, 16, 25, 36, 64, 100, 144];
const sumOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export const generators: Generator[] = [
  {
    id: 'scaled-score',
    make(rng, d) {
      if (d < 0.7) {
        const dk = d < 0.35 ? 4 : pick(rng, [4, 9]);
        const [lo, hi] = dk === 9 ? [-1, 1] : d < 0.35 ? [0, 2] : [-2, 2];
        for (;;) {
          const qv = Array.from({ length: dk }, () => int(rng, lo, hi));
          const kv = Array.from({ length: dk }, () => int(rng, lo, hi));
          const raw = dot(qv, kv);
          if (raw === 0) continue;
          const r = Math.sqrt(dk);
          const s = clean(raw / r);
          const places = placesFor(s);
          return {
            prompt: `A query is $${q} = ${vecT(qv)}$ and a key is $${k} = ${vecT(kv)}$. What is their scaled attention score?${places ? ' Round to two decimals.' : ''}`,
            answer: { kind: 'number', value: s, places },
            traps: traps(s, [
              { value: raw, why: `That is the dot product before scaling. Divide it by $\\sqrt{${dk}} = ${r}$.` },
              { value: raw / dk, why: `That divides by $${DK} = ${dk}$ itself. The scale is its square root, $${r}$.` },
            ], places),
            solution: [`The score is $${q} \\cdot ${k} / \\sqrt{${DK}}$, with $${DK} = ${dk}$ entries in each vector.`, `The dot product: $${prods(qv, kv)} = ${raw}$.`, `Divide by $\\sqrt{${dk}} = ${r}$: $${raw} / ${r} = ${num(round(s, 2))}$.`],
          };
        }
      }
      const dk = pick(rng, ROOTS.slice(2));
      const r = Math.sqrt(dk);
      const raw = int(rng, -3 * r, 3 * r) || r;
      const s = clean(raw / r);
      const places = placesFor(s);
      return {
        prompt: `A query and a key of length $${DK} = ${dk}$ have dot product $${q} \\cdot ${k} = ${raw}$. What score goes into the softmax?${places ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'number', value: s, places },
        traps: traps(s, [
          { value: raw, why: `That is the dot product before scaling. Divide it by $\\sqrt{${dk}} = ${r}$.` },
          { value: raw / dk, why: `That divides by $${DK} = ${dk}$ itself. The scale is its square root, $${r}$.` },
        ], places),
        solution: [`The score is the dot product divided by $\\sqrt{${DK}}$.`, `$\\sqrt{${dk}} = ${r}$, so $${raw} / ${r} = ${num(round(s, 2))}$.`],
      };
    },
  },
  {
    id: 'weights',
    make(rng, d) {
      const dk = pick(rng, d < 0.35 ? [4, 9] : [4, 9, 16]);
      const r = Math.sqrt(dk);
      const n = d < 0.7 ? 3 : 4;
      for (;;) {
        const sc = Array.from({ length: n }, () => int(rng, d < 0.35 ? 0 : -1, 2));
        if (new Set(sc).size < 2) continue;
        const raw = sc.map((x) => x * r);
        const w = softmax2(sc);
        const naive = sumOf(raw) > 0 && raw.every((x) => x >= 0) ? raw.map((x) => x / sumOf(raw)) : null;
        const unscaled = (() => {
          const e = raw.map(Math.exp);
          const t = sumOf(e);
          return e.map((x) => x / t);
        })();
        const lead = `A query of length $${DK} = ${dk}$ has dot products $${vecT(raw)}$ with ${n} keys.`;
        const use = `Use ${useExp(sc)}.`;
        const steps = [
          `Scale each dot product by $1 / \\sqrt{${dk}} = 1/${r}$: the scores are $${vecT(sc)}$.`,
          `Exponentiate: ${sc.map((x) => `$e^{${x}} \\approx ${num(E2(x), 2)}$`).join(', ')}; they add up to $${num(sumOf(sc.map(E2)), 2)}$.`,
        ];
        if (d < 0.5) {
          const j = rng.int(n);
          const v = w[j]!;
          return {
            prompt: `${lead} What attention weight does key ${j} get, counting from 0? Round to two decimals.\n\n${use}`,
            answer: { kind: 'number', value: v, places: 2 },
            traps: traps(v, [
              { value: unscaled[j]!, why: `That is the softmax of the raw dot products. Divide them by $\\sqrt{${DK}}$ first.` },
              { value: naive ? naive[j]! : NaN, why: 'That divides the dot product by their sum. Scale them, then use softmax.' },
            ], 2),
            solution: [...steps, `Key ${j}: $${num(E2(sc[j]!), 2)} / ${num(sumOf(sc.map(E2)), 2)} \\approx ${num(v, 2)}$.`],
          };
        }
        return {
          prompt: `${lead} What are the ${n} attention weights? Round to two decimals.\n\n${use}`,
          answer: { kind: 'vector', value: w, places: 2 },
          traps: vtraps(w, [
            { value: unscaled, why: `That is the softmax of the raw dot products. Divide them by $\\sqrt{${DK}}$ first.` },
            ...(naive ? [{ value: naive, why: 'That divides the dot products by their sum. Scale them, then use softmax.' }] : []),
          ], 2),
          solution: [...steps, `Divide each by the total: $${vecT(w, 2)}$.`],
        };
      }
    },
  },
  {
    id: 'spread',
    make(rng, d) {
      const coin = `The entries of a query and a key are random, each $+1$ or $-1$.`;
      if (d < 0.5) {
        const dk = pick(rng, ROOTS);
        const r = Math.sqrt(dk);
        return {
          prompt: `${coin} With $${DK} = ${dk}$, about how far from 0 is a typical unscaled score $${q} \\cdot ${k}$?`,
          answer: { kind: 'number', value: r },
          traps: traps(r, [
            { value: dk, why: `That is the number of terms. They partly cancel, so the total is typically only $\\sqrt{${dk}}$ from 0.` },
            { value: 0, why: `That is the average over many draws. One score is a sum of coin flips that rarely cancel exactly: typically $\\sqrt{${DK}}$ from 0.` },
            { value: 1, why: `That is the typical size after dividing by $\\sqrt{${DK}}$. Unscaled, it is $\\sqrt{${DK}}$.` },
          ]),
          solution: [
            `$${q} \\cdot ${k}$ adds up ${dk} products, each $+1$ or $-1$ at random; they partly cancel.`,
            `Square the sum and average over every way the signs can land: the average square is $${DK} = ${dk}$.`,
            `A typical size is the square root of that average square: $\\sqrt{${dk}} = ${r}$.`,
          ],
        };
      }
      const a = pick(rng, [4, 9, 16, 25]);
      const f = pick(rng, [4, 9, 16, 25, 36].filter((x) => x * a <= 1024));
      const ratio = Math.sqrt(f);
      return {
        prompt: `${coin} The vectors grow from $${DK} = ${a}$ to $${DK} = ${a * f}$. By what factor does the typical size of an unscaled score grow?`,
        answer: { kind: 'number', value: ratio },
        traps: traps(ratio, [
          { value: f, why: `That is how much $${DK}$ grows. The typical size grows like $\\sqrt{${DK}}$: $\\sqrt{${f}} = ${ratio}$.` },
          { value: 1, why: `The entries keep their size, but more of them are added up: the sum spreads out like $\\sqrt{${DK}}$.` },
        ]),
        solution: [
          `A sum of $${DK}$ products, each $+1$ or $-1$ at random, has average square $${DK}$, so its typical size is $\\sqrt{${DK}}$.`,
          `Before: $\\sqrt{${a}} = ${Math.sqrt(a)}$. After: $\\sqrt{${a * f}} = ${Math.sqrt(a * f)}$.`,
          `Divide: $${Math.sqrt(a * f)} / ${Math.sqrt(a)} = ${ratio}$ times larger.`,
        ],
      };
    },
  },
  {
    id: 'saturate',
    make(rng) {
      const a = pick(rng, [4, 9, 16]);
      const b = pick(rng, [256, 576, 1024, 4096]);
      const n = int(rng, 3, 8);
      return {
        prompt: `A model compares each query with ${n} keys. Its queries and keys have entries of typical size 1, and it does not divide the scores by $\\sqrt{${DK}}$. As $${DK}$ grows from $${a}$ to $${b}$, what happens to the softmax weights?`,
        answer: {
          kind: 'choice',
          options: [
            'One weight heads toward 1 and the rest toward 0',
            `Every weight heads toward an equal share, $1/${n}$`,
            'The weights grow, and no longer add up to 1',
            'Nothing: softmax only sees the gaps between scores',
          ],
          correct: 0,
          why: [
            null,
            'Equal shares need scores close together. Longer vectors spread the scores further apart.',
            'Softmax always divides by the total, so the weights add up to 1 at any scale.',
            `The gaps are what grow: scores spread out like $\\sqrt{${DK}}$, so the top score pulls far ahead.`,
          ],
        },
        solution: [
          `Unscaled scores are typically about $\\sqrt{${DK}}$ from 0, so they spread from about $${Math.sqrt(a)}$ to about $${Math.sqrt(b)}$.`,
          'Wide gaps make softmax all or nothing, and then nudging a score barely changes the weights, so the queries and keys get almost no gradient.',
          `Dividing by $\\sqrt{${DK}}$ keeps a typical score near 1 at any length.`,
        ],
      };
    },
  },
];
