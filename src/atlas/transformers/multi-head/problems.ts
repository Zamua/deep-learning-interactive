import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, D, DH, H, Q, shp, straps, T, traps, WK, WO, WQ, WV, X } from '../kit';

/** A width and a head count that divides it, larger with difficulty. */
function dims(rng: Rng, d: number): [number, number] {
  if (d < 0.35) return pick(rng, [[8, 2], [12, 3], [16, 4], [16, 2], [24, 4], [32, 4], [32, 8], [48, 6], [64, 8], [64, 4]] as [number, number][]);
  if (d < 0.7) return pick(rng, [[128, 4], [256, 4], [256, 8], [384, 6], [512, 8], [512, 16], [768, 12], [256, 16]] as [number, number][]);
  return pick(rng, [[768, 12], [1024, 16], [1280, 20], [1536, 24], [2048, 16], [2048, 32], [4096, 32], [5120, 40]] as [number, number][]);
}

/** Round widths, so 4d² can be done in the head. */
function round(rng: Rng, d: number): [number, number] {
  if (d < 0.35) return pick(rng, [[8, 2], [12, 3], [16, 4], [20, 4], [24, 4], [30, 3], [32, 8], [40, 4]] as [number, number][]);
  if (d < 0.7) return pick(rng, [[100, 4], [200, 8], [300, 6], [400, 8], [500, 10], [600, 12], [800, 16]] as [number, number][]);
  return pick(rng, [[1000, 8], [1200, 12], [1500, 12], [2000, 16], [3000, 24], [4000, 32], [5000, 40]] as [number, number][]);
}

export const generators: Generator[] = [
  {
    id: 'head-width',
    make(rng, d) {
      const [dm, h] = dims(rng, d);
      const dh = dm / h;
      const kind = d < 0.5 ? 0 : rng.int(3);
      if (kind === 1) {
        return {
          prompt: `Multi-head attention has $${H} = ${h}$ heads, and each head's queries, keys and values have $${DH} = ${dh}$ entries. What is the model width $${D}$?`,
          answer: { kind: 'number', value: dm },
          traps: traps(dm, [
            { value: dh, why: `That is one head's width. The ${h} heads share the width between them: $${D} = ${H} \\times ${DH}$.` },
            { value: dh / h, why: `That divides again. The heads' widths add up to $${D}$: multiply.` },
          ]),
          solution: [`The heads split the width evenly: $${DH} = ${D} / ${H}$.`, `So $${D} = ${H} \\times ${DH} = ${h} \\times ${dh} = ${big(dm)}$.`],
        };
      }
      if (kind === 2) {
        return {
          prompt: `A model of width $${D} = ${big(dm)}$ uses multi-head attention with heads of width $${DH} = ${dh}$. How many heads does it have?`,
          answer: { kind: 'number', value: h },
          traps: traps(h, [{ value: dm * dh, why: `That multiplies. The heads split the width: $${H} = ${D} / ${DH}$.` }]),
          solution: [`Each head gets $${DH} = ${D} / ${H}$ of the width.`, `So $${H} = ${D} / ${DH} = ${big(dm)} / ${dh} = ${h}$.`],
        };
      }
      return {
        prompt: `A model of width $${D} = ${big(dm)}$ uses multi-head attention with $${H} = ${h}$ heads. How many entries does each head's query have?`,
        answer: { kind: 'number', value: dh },
        traps: traps(dh, [
          { value: dm, why: `That gives every head the full width. The heads split it: each gets $${D} / ${H}$.` },
          { value: dm * h, why: `That multiplies. The ${h} heads share the width $${D}$ between them, so divide.` },
        ]),
        solution: [`The heads split the width evenly: $${DH} = ${D} / ${H}$.`, `$${big(dm)} / ${h} = ${dh}$.`],
      };
    },
  },
  {
    id: 'head-shapes',
    make(rng, d) {
      const [dm, h] = dims(rng, Math.min(d, 0.6));
      const dh = dm / h;
      let t = d < 0.5 ? int(rng, 5, 12) : pick(rng, [20, 50, 100, 128, 256]);
      if (t === dh || t === dm || t === h) t += 1;
      const which = pick(rng, d < 0.35 ? (['W', 'Q', 'cat'] as const) : (['W', 'Q', 'A', 'head', 'cat'] as const));
      const setup = `Multi-head attention runs over $${T} = ${t}$ tokens of width $${D} = ${big(dm)}$, with $${H} = ${h}$ heads.`;
      const ask = {
        W: [`one head's $${WQ}$`, [dh, dm]],
        Q: [`one head's $${Q}$`, [t, dh]],
        A: [`one head's attention weights`, [t, t]],
        head: [`one head's output`, [t, dh]],
        cat: [`the heads' outputs concatenated side by side`, [t, dm]],
      }[which] as [string, number[]];
      const ans = ask[1];
      const ts: { value: number[]; why: string }[] = [];
      if (which === 'W') {
        ts.push({ value: [dm, dm], why: `That is the full-width matrix. Each head makes queries of only $${DH} = ${dh}$ entries.` });
        ts.push({ value: [dm, dh], why: `That is the transpose: $${WQ}\\,${X}$ needs one row per query entry and one column per entry of $${X}$.` });
      } else if (which === 'Q' || which === 'head') {
        ts.push({ value: [t, dm], why: `That is the full width. One head works in $${DH} = ${big(dm)} / ${h} = ${dh}$ dimensions.` });
        ts.push({ value: [dh, t], why: 'That is the transpose: one row per token.' });
        if (which === 'head') ts.push({ value: [t, t], why: 'That is the shape of its weights. Times its values, $(' + `${t}, ${dh}` + ')$, it gives one row per token.' });
      } else if (which === 'A') {
        ts.push({ value: [dh, dh], why: `The weights compare tokens with tokens: one per pair, $(${t}, ${t})$, whatever the head's width.` });
        ts.push({ value: [t, dh], why: 'That is the shape of its queries. Queries times keys transposed give one weight per pair of tokens.' });
      } else {
        ts.push({ value: [t, dh], why: `That is one head's output. ${h} of them side by side give ${h} times ${dh} columns.` });
        ts.push({ value: [h * t, dh], why: 'That stacks the heads one under another. They are joined side by side, so the token rows stay.' });
      }
      const sol: Record<typeof which, string[]> = {
        W: [`Each head's queries have $${DH} = ${big(dm)} / ${h} = ${dh}$ entries.`, `Its $${WQ}$ turns a token $${X}$, ${bigText(dm)} numbers, into a query of ${dh}: one row per query entry, one column per entry of $${X}$, $${shp(ans)}$.`],
        Q: [`Each head's queries have $${DH} = ${big(dm)} / ${h} = ${dh}$ entries.`, `$${Q}$ stacks them one row per token: $${shp(ans)}$.`],
        A: ['Every head scores every token against every token, as a single attention does.', `So its weights are $(${T}, ${T}) = ${shp(ans)}$, whatever its width.`],
        head: [`Its weights, $(${t}, ${t})$, times its values, $(${t}, ${dh})$, give $${shp(ans)}$.`],
        cat: [`Each head outputs $(${t}, ${dh})$. Side by side, ${h} of them make $${h} \\times ${dh} = ${big(dm)}$ columns.`, `So the result is $${shp(ans)}$: back to the model width.`],
      };
      return {
        prompt: `${setup} What is the shape of ${ask[0]}?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, ts),
        solution: sol[which],
      };
    },
  },
  {
    id: 'params',
    make(rng, d) {
      const [dm, h] = round(rng, d);
      const dh = dm / h;
      const v = 4 * dm * dm;
      return {
        prompt: `Multi-head attention has width $${D} = ${big(dm)}$ and $${H} = ${h}$ heads. Ignoring biases, how many weights does it hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 3 * dm * dm, why: `That leaves out $${WO}$, the $${D} \\times ${D}$ matrix that mixes the joined heads.` },
          { value: 4 * dm * dm * h, why: `That gives every head full $${D} \\times ${D}$ matrices. Each head's are only $${DH} \\times ${D}$.` },
          { value: 3 * dh * dm + dm * dm, why: `That counts only one head's three matrices, plus $${WO}$. All ${h} heads have their own.` },
        ]),
        solution: [
          `Each head has its own $${WQ}$, $${WK}$ and $${WV}$, each $${DH} \\times ${D}$, with $${DH} = ${big(dm)} / ${h} = ${dh}$.`,
          `One head's $${WQ}$ is $${dh} \\times ${big(dm)}$. Across ${h} heads that is $${h} \\times ${dh} \\times ${big(dm)} = ${big(dm)} \\times ${big(dm)}$, a full $${D}^2$. The same holds for $${WK}$ and $${WV}$.`,
          `$${WO}$, which mixes the joined heads, is $${D} \\times ${D}$: another $${D}^2$. In all, $4${D}^2 = 4 \\times ${big(dm)}^2 = ${big(v)}$.`,
          'It does not depend on the number of heads.',
        ],
      };
    },
  },
  {
    id: 'join',
    make(rng, d) {
      const [dm, h] = dims(rng, d);
      const dh = dm / h;
      const t = int(rng, 6, 40);
      if (rng.int(2) === 0) {
        return {
          prompt: `Multi-head attention over $${T} = ${t}$ tokens has $${H} = ${h}$ heads, each producing a $(${t}, ${dh})$ output. What happens to the ${h} outputs?`,
          answer: {
            kind: 'choice',
            options: [
              `They are joined side by side into $(${t}, ${big(dm)})$, then multiplied by $${WO}$`,
              `They are added up into one $(${t}, ${dh})$ output`,
              `They are averaged into one $(${t}, ${dh})$ output`,
              `Only the head with the largest scores is kept`,
            ],
            correct: 0,
            why: [
              null,
              'Adding would blend what the heads found into one narrow vector. They are kept side by side instead, each in its own columns.',
              'Averaging would blur the heads together and lose the width. They are concatenated, keeping each head\'s findings in its own columns.',
              `Every head is used: each found something different, and $${WO}$ mixes all of them.`,
            ],
          },
          solution: [`The heads' outputs are concatenated along the features: ${h} blocks of ${dh} columns make $${big(dm)}$.`, `Then $${WO}$, $${D} \\times ${D}$, mixes them into one output row per token.`],
        };
      }
      return {
        prompt: `A model of width $${D} = ${big(dm)}$ swaps one attention of width $${big(dm)}$ for $${H} = ${h}$ heads of width ${dh}. What does it gain?`,
        answer: {
          kind: 'choice',
          options: [
            'Each head has its own weights, so different heads can attend to different tokens',
            `More weights: each of the ${h} heads adds a full set of matrices`,
            'Each head sees only its own slice of the sentence, so it is cheaper',
            'The weights no longer need a softmax, since each head is small',
          ],
          correct: 0,
          why: [
            null,
            `The heads split the width, so the total stays $4${D}^2$ whatever $${H}$ is.`,
            'Every head attends over every token. What the heads split is the width of the queries, keys and values.',
            'Each head is an ordinary attention, softmax included.',
          ],
        },
        solution: [
          'One attention gives each token a single blend of the others. Several heads, each with its own queries and keys, can each look for something different at once.',
          `The weights stay $4${D}^2$: ${h} heads of width ${dh} fill the same $${D}$ columns as one head of width $${big(dm)}$.`,
        ],
      };
    },
  },
];
