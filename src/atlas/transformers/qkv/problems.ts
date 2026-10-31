import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { big, commas, dot, mat, pick, prods, shp, straps, traps, vtraps } from '../../kit';
import { matvec } from '../../networks/kit';
import { D, DK, k, q, SENTENCES, someInts, v, vecT, WK, WQ, WV, X } from '../kit';

type Role = 'q' | 'k' | 'v';
const NAME: Record<Role, string> = { q: 'query', k: 'key', v: 'value' };
const VEC: Record<Role, string> = { q, k, v };
const MAT: Record<Role, string> = { q: WQ, k: WK, v: WV };

/** An `m` by `n` matrix of integers in [lo, hi] with no all-zero row and no two rows equal. */
function weights(rng: Rng, m: number, n: number, lo: number, hi: number): number[][] {
  for (;;) {
    const W = Array.from({ length: m }, () => someInts(rng, n, lo, hi));
    if (new Set(W.map(String)).size === m) return W;
  }
}

export const generators: Generator[] = [
  {
    id: 'project',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const m = d < 0.75 ? 2 : pick(rng, [2, 3]);
      const [lo, hi] = d < 0.35 ? [0, 2] : [-2, 3];
      const role = pick(rng, ['q', 'k', 'v'] as const);
      for (;;) {
        const Ws = { q: weights(rng, m, n, lo, hi), k: weights(rng, m, n, lo, hi), v: weights(rng, m, n, lo, hi) };
        const x = someInts(rng, n, d < 0.35 ? 0 : -2, 3);
        const outs = { q: matvec(Ws.q, x), k: matvec(Ws.k, x), v: matvec(Ws.v, x) };
        const ans = outs[role];
        if (new Set(Object.values(outs).map(String)).size < 3) continue;
        const all = d >= 0.35;
        const others = (['q', 'k', 'v'] as const).filter((r) => r !== role);
        const ts = all ? others.map((r) => ({ value: outs[r], why: `That is $${MAT[r]}\\,${X}$, the ${NAME[r]}. The ${NAME[role]} comes from $${MAT[role]}$.` })) : [];
        if (m === n) {
          const Wt = Ws[role][0]!.map((_, j) => Ws[role].map((r) => r[j]!));
          ts.push({ value: matvec(Wt, x), why: `That dots $${X}$ with the columns of $${MAT[role]}$. Each entry of $${VEC[role]}$ is one row of $${MAT[role]}$ dotted with $${X}$.` });
        }
        const given = all
          ? `$$${WQ} = ${mat(Ws.q)},\\quad ${WK} = ${mat(Ws.k)},\\quad ${WV} = ${mat(Ws.v)}$$`
          : `$$${MAT[role]} = ${mat(Ws[role])}$$`;
        return {
          prompt: `A token is $${X} = ${vecT(x)}$, and\n\n${given}\n\nWhat is its ${NAME[role]}?`,
          answer: { kind: 'vector', value: ans },
          traps: vtraps(ans, ts),
          solution: [
            `The ${NAME[role]} is $${VEC[role]} = ${MAT[role]}\\,${X}$: one dot product per row of $${MAT[role]}$.`,
            ...Ws[role].map((r, i) => `Row ${i}: $${prods(r, x)} = ${ans[i]}$.`),
            `So $${VEC[role]} = ${vecT(ans)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const [dm, dk] = d < 0.35
        ? pick(rng, [[4, 2], [6, 2], [6, 3], [8, 2], [8, 4], [10, 5], [12, 3], [12, 4]])
        : d < 0.7
          ? [pick(rng, [32, 64, 128, 256]), pick(rng, [8, 16])]
          : [pick(rng, [512, 768, 1024]), pick(rng, [32, 64, 128])];
      const role = pick(rng, ['q', 'k', 'v'] as const);
      const ans = [dk, dm];
      return {
        prompt: `Each token $${X}$ has $${D} = ${big(dm)}$ entries, and its ${NAME[role]} has ${role === 'v' ? dk : `$${DK} = ${dk}$`}. What is the shape of $${MAT[role]}$?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          { value: [dm, dk], why: `That is the transpose. $${MAT[role]}\\,${X}$ takes one dot product per row, so it needs one row per entry of $${VEC[role]}$ and one column per entry of $${X}$.` },
          { value: [dm, dm], why: `That would keep all ${commas(dm)} numbers. The ${NAME[role]} has only ${dk}, so $${MAT[role]}$ has ${dk} rows.` },
          { value: [dk, dk], why: `$${MAT[role]}$ multiplies $${X}$, which has ${commas(dm)} entries, so it needs ${commas(dm)} columns.` },
        ]),
        solution: [
          `The ${NAME[role]} is $${VEC[role]} = ${MAT[role]}\\,${X}$, a matrix times a vector: each row of $${MAT[role]}$ is dotted with $${X}$ and gives one entry of $${VEC[role]}$.`,
          `So $${MAT[role]}$ has ${dk} rows, one per entry of $${VEC[role]}$, and ${commas(dm)} columns, one per entry of $${X}$: $${shp(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'score',
    make(rng, d) {
      const i = rng.int(4);
      const j = (i + 1 + rng.int(3)) % 4;
      const lo = d < 0.25 ? 0 : -2;
      if (d < 0.5) {
        const n = d < 0.25 ? 2 : 3;
        const qi = someInts(rng, n, lo, 3);
        const kj = someInts(rng, n, lo, 3);
        const s = dot(qi, kj);
        return {
            prompt: `Token ${i}'s query is $${q}_{${i}} = ${vecT(qi)}$ and token ${j}'s key is $${k}_{${j}} = ${vecT(kj)}$. What score does token ${i} give token ${j}?`,
            answer: { kind: 'number', value: s },
            traps: traps(s, [
              { value: qi.reduce((a, b) => a + b, 0) + kj.reduce((a, b) => a + b, 0), why: 'That adds every entry of both vectors. A dot product multiplies matching entries, then adds the products.' },
              { value: qi[0]! * kj[0]!, why: 'That is only the first product. Add the products of every matching pair.' },
            ]),
          solution: [`The score is the dot product of the query and the key: $${prods(qi, kj)} = ${s}$.`],
        };
      }
      for (;;) {
        const qi = someInts(rng, 2, lo, 3);
        const W = weights(rng, 2, 2, d < 0.75 ? 0 : -1, 2);
        const xj = someInts(rng, 2, lo, 3);
        const kj = matvec(W, xj);
        const s = dot(qi, kj);
        if (s === dot(qi, xj)) continue;
        return {
          prompt: `Token ${i}'s query is $${q}_{${i}} = ${vecT(qi)}$. Token ${j} is $${X}_{${j}} = ${vecT(xj)}$, and $${WK} = ${mat(W)}$. What score does token ${i} give token ${j}?`,
          answer: { kind: 'number', value: s },
          traps: traps(s, [{ value: dot(qi, xj), why: `That scores the query against $${X}_{${j}}$ itself. First make the key, $${k}_{${j}} = ${WK}\\,${X}_{${j}}$.` }]),
          solution: [
            `Token ${j}'s key: $${k}_{${j}} = ${WK}\\,${X}_{${j}} = [${prods(W[0]!, xj)},\\ ${prods(W[1]!, xj)}] = ${vecT(kj)}$.`,
            `The score is the query dotted with the key: $${prods(qi, kj)} = ${s}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'roles',
    make(rng) {
      const ws = pick(rng, SENTENCES);
      const i = rng.int(4);
      const j = (i + 1 + rng.int(3)) % 4;
      const kind = rng.int(3);
      const tok = `In the sentence ${ws.map((w) => `\`${w}\``).join(' ')}, token ${i}, \`${ws[i]}\`, attends to every token.`;
      if (kind === 0) {
        return {
          prompt: `${tok} Which vectors are weighted and added up to make its output?`,
          answer: {
            kind: 'choice',
            options: [`The values, $${v}_0$ to $${v}_3$`, `The keys, $${k}_0$ to $${k}_3$`, `The queries, $${q}_0$ to $${q}_3$`, `The tokens themselves, $${X}_0$ to $${X}_3$`],
            correct: 0,
            why: [
              null,
              `The keys are only compared with token ${i}'s query to make the scores. What gets mixed is the values.`,
              `A token's query is only used for its own scores; token ${i} uses $${q}_{${i}}$ and no other query.`,
              `The tokens go through $${WV}$ first: the output mixes their values, $${v}_j = ${WV}\\,${X}_j$.`,
            ],
          },
          solution: [`Token ${i}'s output is $\\sum_j \\alpha_j\\, ${v}_j$: a weighted sum of the values.`, `The keys and token ${i}'s query only set the weights $\\alpha_j$.`],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${tok} What decides how much of token ${j}, \`${ws[j]}\`, goes into its output?`,
          answer: {
            kind: 'choice',
            options: [
              `Token ${i}'s query dotted with token ${j}'s key, compared through a softmax with its other scores`,
              `Token ${j}'s query dotted with token ${i}'s key, compared through a softmax with its other scores`,
              `Token ${i}'s value dotted with token ${j}'s value, compared through a softmax with its other scores`,
              `Token ${j}'s value on its own: the larger its entries, the more it counts`,
            ],
            correct: 0,
            why: [
              null,
              `That is the score for the other direction, token ${j} looking at token ${i}. The one asking is token ${i}, so it brings the query.`,
              'Values are not scored; they are what gets mixed once the weights are known.',
              'The value is what gets mixed, not how much. The weight comes from the query and the key.',
            ],
          },
          solution: [`Token ${i} asks with its query $${q}_{${i}}$; token ${j} answers with its key $${k}_{${j}}$. Their dot product is the score.`, `Softmax over token ${i}'s scores for every token gives the weight on $${v}_{${j}}$.`],
        };
      }
      return {
        prompt: `${tok} Which of token ${i}'s own vectors is compared against every token's key?`,
        answer: {
          kind: 'choice',
          options: [`Its query, $${q}_{${i}}$`, `Its key, $${k}_{${i}}$`, `Its value, $${v}_{${i}}$`, `The token itself, $${X}_{${i}}$`],
          correct: 0,
          why: [
            null,
            `Its key is what other tokens' queries are compared against. To ask, a token uses its query.`,
            'Its value is what it hands over when another token attends to it; values are never compared.',
            `The token goes through $${WQ}$ first: the query $${WQ}\\,${X}_{${i}}$ is what asks.`,
          ],
        },
        solution: [`A token asks with its query: score $j$ is $${q}_{${i}} \\cdot ${k}_j$, for every token $j$.`, `Its key answers other tokens' queries, and its value is what they mix in. Every token does the same with its own three vectors.`],
      };
    },
  },
];
