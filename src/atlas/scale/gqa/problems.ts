import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { num, pick } from '../../kit';
import { D, big, straps, traps, whys } from '../modern-kit';

const DH = '\\sym{dhead}{d_{\\text{head}}}';
const kv = (g: number) => `$\\sym{kvheads}{g} = ${g}$ key-value head${g === 1 ? '' : 's'}`;

/** Query heads, and a smaller number of key-value heads that divides it. */
function heads(rng: Rng): { h: number; g: number } {
  const h = pick(rng, [8, 16, 32, 64]);
  const g = pick(rng, [1, 2, 4, 8].filter((x) => x < h));
  return { h, g };
}

export const generators: Generator[] = [
  {
    id: 'cache',
    make(rng, d) {
      const { h, g } = heads(rng);
      const dh = pick(rng, [64, 128]);
      const one = 2 * g * dh;
      if (d < 0.35) {
        return {
          prompt: `An attention layer has $\\sym{heads}{h} = ${h}$ query heads and ${kv(g)}, each head $${DH} = ${dh}$ wide. How many numbers does its KV cache store for each token?`,
          answer: { kind: 'number', value: one },
          traps: traps(one, [
            { value: 2 * h * dh, why: 'That gives every query head its own key and value. Only the $\\sym{kvheads}{g}$ key-value heads are cached.' },
            { value: g * dh, why: 'That stores only the keys. The cache holds a key and a value for every key-value head.' },
            { value: 3 * g * dh, why: 'That caches queries too. A query is used once, by its own token, and then thrown away.' },
          ]),
          solution: [
            `${g === 1 ? 'The one key-value head' : `Each of the $\\sym{kvheads}{g} = ${g}$ key-value heads`} stores one key and one value of $${DH} = ${dh}$ numbers.`,
            `$2 \\times ${g} \\times ${dh} = ${big(one)}$ numbers per token. The ${h} query heads add nothing to the cache.`,
          ],
        };
      }
      const L = pick(rng, [12, 16, 24, 32, 48]);
      const kb = d >= 0.7;
      const nums = L * one;
      const ans = kb ? (nums * 2) / 1024 : nums;
      const unit = (x: number) => (kb ? (x * 2) / 1024 : x);
      return {
        prompt: `A model has ${L} layers, each with $\\sym{heads}{h} = ${h}$ query heads and ${kv(g)} of width $${DH} = ${dh}$. ${kb ? 'Stored at 2 bytes per number, how many KB (1 KB = 1,024 bytes) does its KV cache take per token?' : 'How many numbers does its KV cache store per token, across all layers?'}`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: unit(L * 2 * h * dh), why: 'That caches a key and value for every query head. Only the $\\sym{kvheads}{g}$ key-value heads are stored.' },
          { value: unit(one), why: `That is one layer. Every one of the ${L} layers keeps its own keys and values.` },
          { value: unit(L * g * dh), why: 'That stores only the keys. Each key-value head has a key and a value.' },
          ...(kb ? [{ value: nums / 1024, why: 'That counts one byte per number. Each takes 2.' }] : []),
        ]),
        solution: [
          `One layer: $2 \\times \\sym{kvheads}{g} \\times ${DH} = 2 \\times ${g} \\times ${dh} = ${big(one)}$ numbers per token.`,
          `All ${L} layers: $${L} \\times ${big(one)} = ${big(nums)}$ numbers.`,
          ...(kb ? [`At 2 bytes each: $${big(nums * 2)}$ bytes, and $${big(nums * 2)} / 1{,}024 = ${num(ans)}$ KB.`] : []),
        ],
      };
    },
  },
  {
    id: 'shrink',
    make(rng, d) {
      const { h, g } = heads(rng);
      const factor = h / g;
      if (d < 0.35) {
        return {
          prompt: `A layer with $\\sym{heads}{h} = ${h}$ heads is changed from ordinary multi-head attention to grouped-query attention with ${kv(g)}, keeping all ${h} query heads. How many times smaller is its KV cache?`,
          answer: { kind: 'number', value: factor },
          traps: traps(factor, [
            { value: g, why: 'That is the number of key-value heads. The cache shrinks by how many query heads share each one, $\\sym{heads}{h}/\\sym{kvheads}{g}$.' },
            { value: 1, why: 'The queries are not cached, so the cache shrinks with the number of key-value heads.' },
          ]),
          solution: [`The cache holds one key and one value per key-value head: ${h} before, ${g} after.`, `So it is $\\sym{heads}{h}/\\sym{kvheads}{g} = ${h}/${g} = ${factor}$ times smaller.`],
        };
      }
      const size = pick(rng, [8, 16, 32, 48, 64, 128]);
      const ans = (size * g) / h;
      return {
        prompt: `With ordinary multi-head attention ($\\sym{heads}{h} = ${h}$ heads, each with its own key and value), a batch's KV cache takes ${size} GB. The model is rebuilt with ${kv(g)}, keeping $\\sym{heads}{h} = ${h}$ query heads and everything else. How many GB does the cache take now?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: (size * h) / g, why: 'That multiplies by $\\sym{heads}{h}/\\sym{kvheads}{g}$. Fewer key-value heads mean a smaller cache: multiply by $\\sym{kvheads}{g}/\\sym{heads}{h}$.' },
          { value: size / g, why: `That divides by $\\sym{kvheads}{g}$. The cache is proportional to the number of key-value heads, ${h} before and ${g} after.` },
          { value: size, why: 'The queries are not cached, so the cache shrinks with the number of key-value heads.' },
        ]),
        solution: [
          `The cache is proportional to the number of key-value heads: ${h} before, ${g} after.`,
          `$${size} \\times ${g}/${h} = ${num(ans)}$ GB, $${h}/${g} = ${factor}$ times smaller.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const { h, g } = heads(rng);
      const dh = pick(rng, [64, 128]);
      const dim = h * dh;
      const T = pick(rng, [10, 16, 50, 100, 512, 1000]);
      const q = d >= 0.5 && rng.next() < 0.4;
      const ans = q ? [h, T, dh] : [g, T, dh];
      return {
        prompt: `A grouped-query attention layer has width $${D} = ${big(dim)}$, $\\sym{heads}{h} = ${h}$ query heads and ${kv(g)}${d < 0.5 ? `, each head $${DH} = ${dh}$ wide` : ''}. For a sequence of ${T} tokens, what is the shape of its ${q ? 'queries' : 'keys'} as (heads, tokens, head width)?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          q ? { value: [g, T, dh], why: 'That is the keys\' shape. Every query head keeps its own query.' } : { value: [h, T, dh], why: 'That gives every query head its own key head: ordinary multi-head attention. Here only $\\sym{kvheads}{g}$ are kept.' },
          { value: [q ? h : g, T, dim], why: `Each head is $${D}/\\sym{heads}{h} = ${dh}$ wide, not the full $${D}$.` },
          { value: [h / g, T, dh], why: 'That is how many query heads share each key-value head, not how many heads there are.' },
        ]),
        solution: [
          `Each head is $${DH} = ${D}/\\sym{heads}{h} = ${big(dim)}/${h} = ${dh}$ wide${d < 0.5 ? '' : ', for queries, keys and values alike'}.`,
          q ? `There are $\\sym{heads}{h} = ${h}$ query heads, so the queries are $(${h}, ${T}, ${dh})$.` : `Only $\\sym{kvheads}{g} = ${g}$ key head${g === 1 ? '' : 's'} ${g === 1 ? 'exists' : 'exist'}, each shared by $\\sym{heads}{h}/\\sym{kvheads}{g} = ${h / g}$ query heads: $(${g}, ${T}, ${dh})$.`,
        ],
      };
    },
  },
  {
    id: 'extremes',
    make(rng) {
      const h = pick(rng, [8, 12, 16, 24, 32, 40, 48, 64]);
      if (rng.next() < 0.5) {
        const options = [
          `Every query head shares one key head and one value head: the cache is ${h} times smaller`,
          'There is a single query head, so it is single-head attention',
          'Each query head keeps its own key and value head, so nothing is saved',
          'The cache stays the same size; only the queries are shared',
        ];
        const reasons = [
          '',
          `The query heads stay at $\\sym{heads}{h} = ${h}$; only the keys and values are shared.`,
          `That is $\\sym{kvheads}{g} = \\sym{heads}{h}$, ordinary multi-head attention. With $\\sym{kvheads}{g} = 1$ all ${h} query heads share one.`,
          'Queries are never cached. Sharing the keys and values is what shrinks the cache.',
        ];
        return {
          prompt: `A layer has $\\sym{heads}{h} = ${h}$ query heads. What does $\\sym{kvheads}{g} = 1$ key-value head give?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            `With $\\sym{kvheads}{g} = 1$, all ${h} query heads attend over the same keys and values: multi-query attention.`,
            `The cache keeps one key and one value per token and layer instead of ${h}: ${h} times smaller.`,
          ],
        };
      }
      const options = [
        'Ordinary multi-head attention: every query head has its own key and value head',
        'Multi-query attention: all the query heads share one key and value head',
        `A KV cache ${h} times smaller than multi-head attention's`,
        `Each key-value head serves all ${h} query heads`,
      ];
      const reasons = [
        '',
        'That is $\\sym{kvheads}{g} = 1$. With $\\sym{kvheads}{g} = \\sym{heads}{h}$ there is one key-value head per query head.',
        'With $\\sym{kvheads}{g} = \\sym{heads}{h}$ nothing is shared, so the cache is as large as multi-head attention\'s.',
        'That is $\\sym{kvheads}{g} = 1$. With $\\sym{kvheads}{g} = \\sym{heads}{h}$, each key-value head serves exactly one query head.',
      ];
      return {
        prompt: `A layer has $\\sym{heads}{h} = ${h}$ query heads and $\\sym{kvheads}{g} = ${h}$ key-value heads. What is it?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `With $\\sym{kvheads}{g} = \\sym{heads}{h} = ${h}$, each group holds a single query head, so each query head has its own key and value head.`,
          'That is ordinary multi-head attention, the largest cache. Grouped-query attention sits between it and $\\sym{kvheads}{g} = 1$.',
        ],
      };
    },
  },
];
