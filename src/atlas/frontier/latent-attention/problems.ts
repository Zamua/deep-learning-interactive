import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { pick } from '../../kit';
import { big } from '../../convnets/kit';
import { choice } from '../../inference/kit';
import { straps, traps } from '../../networks/kit';

const H = '\\sym{heads}{h}';
const G = '\\sym{kvheads}{g}';
const DH = '\\sym{dhead}{d_{\\text{head}}}';
const D = '\\sym{d}{d}';
const DC = '\\sym{dc}{d_c}';
const C = '\\sym{latent}{c}';
const WD = '\\sym{Wdkv}{W_{DKV}}';
const WUK = '\\sym{Wuk}{W_{UK}}';
const WUV = '\\sym{Wuv}{W_{UV}}';

const shp = (dims: readonly number[]) => `(${dims.map(big).join(', ')})`;

interface Layer {
  h: number;
  dh: number;
  dc: number;
  g: number;
  dm: number;
}

/** Head counts and widths, small at first, then the sizes real models use. */
function layer(rng: Rng, d: number): Layer {
  if (d < 0.35) {
    const h = pick(rng, [4, 8]);
    const dh = pick(rng, [8, 16, 32]);
    return { h, dh, dc: pick(rng, [16, 32, 64].filter((c) => c <= h * dh)), g: pick(rng, [1, 2]), dm: h * dh };
  }
  const h = pick(rng, [16, 32, 64, 128]);
  const dh = pick(rng, [64, 128]);
  return { h, dh, dc: pick(rng, [256, 512]), g: pick(rng, [2, 4, 8]), dm: pick(rng, [2048, 4096, 5120]) };
}

const heads = (L: Layer) => `$${H} = ${L.h}$ heads, each $${DH} = ${L.dh}$ wide`;

export const generators: Generator[] = [
  {
    id: 'cache',
    make(rng, d) {
      const L = layer(rng, d);
      const scheme = pick(rng, d < 0.35 ? (['mha', 'latent', 'latent'] as const) : d < 0.7 ? (['mha', 'gqa', 'latent', 'latent'] as const) : (['gqa', 'latent', 'pos', 'pos'] as const));
      const layers = d >= 0.5 && rng.next() < 0.5 ? pick(rng, [24, 32, 60]) : 0;
      const pos = 64;
      const mha = 2 * L.h * L.dh;
      const one = scheme === 'mha' ? mha : scheme === 'gqa' ? 2 * L.g * L.dh : scheme === 'latent' ? L.dc : L.dc + pos;
      const n = layers || 1;
      const ans = one * n;
      const what =
        scheme === 'mha'
          ? `An ordinary multi-head attention layer has ${heads(L)}.`
          : scheme === 'gqa'
            ? `A grouped-query attention layer has $${H} = ${L.h}$ query heads and $${G} = ${L.g}$ key-value head${L.g === 1 ? '' : 's'}, each $${DH} = ${L.dh}$ wide.`
            : scheme === 'latent'
              ? `A latent-attention layer has ${heads(L)}, and a latent of size $${DC} = ${L.dc}$.`
              : `A latent-attention layer has ${heads(L)}, a latent of size $${DC} = ${L.dc}$, and one extra key of ${pos} numbers, shared by every head, that carries the token's position.`;
      const ask = layers ? `A model stacks ${layers} such layers. How many numbers does its cache hold per token, across all layers?` : 'How many numbers does it cache per token?';
      const ts: { value: number; why: string }[] = [];
      if (scheme === 'mha') {
        ts.push({ value: L.h * L.dh * n, why: 'That stores only the keys. Every head caches a key and a value.' });
        ts.push({ value: 2 * L.dh * n, why: `That is one head. Each of the ${L.h} heads caches its own key and value.` });
      } else if (scheme === 'gqa') {
        ts.push({ value: mha * n, why: `That gives every query head its own key and value. Only the $${G} = ${L.g}$ key-value heads are cached.` });
        ts.push({ value: L.g * L.dh * n, why: 'That stores only the keys. Each key-value head caches a key and a value.' });
      } else {
        ts.push({ value: mha * n, why: `That caches every head's key and value, as multi-head attention does. Latent attention stores only $${C}$ and rebuilds them.` });
        ts.push({ value: 2 * L.dc * n, why: `That stores one latent for the keys and another for the values. One $${C}$ rebuilds both.` });
        ts.push({ value: L.h * L.dc * n, why: `That gives each head a latent of its own. Every head rebuilds from the same $${C}$.` });
        if (scheme === 'pos') {
          ts.push({ value: L.dc * n, why: `That leaves out the position key. It is cached too: ${pos} more numbers.` });
          ts.push({ value: (L.dc + L.h * pos) * n, why: `That gives every head its own position key. One key of ${pos} numbers is shared by all ${L.h}.` });
        }
      }
      if (layers) ts.push({ value: one, why: `That is one layer. Each of the ${layers} layers keeps its own cache.` });
      const per =
        scheme === 'mha'
          ? [`Every one of the $${H} = ${L.h}$ heads caches a key and a value of $${DH} = ${L.dh}$ numbers.`, `$2 \\times ${L.h} \\times ${L.dh} = ${big(one)}$ numbers per token, per layer.`]
          : scheme === 'gqa'
            ? [`Only the $${G} = ${L.g}$ key-value head${L.g === 1 ? '' : 's'} are cached, each a key and a value of $${DH} = ${L.dh}$ numbers. The query heads add nothing.`, `$2 \\times ${L.g} \\times ${L.dh} = ${big(one)}$ numbers per token, per layer.`]
            : [
                `The cache keeps the latent $${C}$: $${DC} = ${big(L.dc)}$ numbers per token, per layer.`,
                `Each head's key and value are rebuilt from $${C}$ by $${WUK}$ and $${WUV}$, weights stored once, so they add nothing per token.`,
                ...(scheme === 'pos' ? [`Add the one shared position key: $${big(L.dc)} + ${pos} = ${big(one)}$ numbers.`] : []),
              ];
      return {
        prompt: `${what} ${ask}`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, ts),
        solution: [...per, ...(layers ? [`All ${layers} layers: $${layers} \\times ${big(one)} = ${big(ans)}$ numbers per token.`] : [])],
      };
    },
  },
  {
    id: 'ratio',
    make(rng, d) {
      for (;;) {
        const L = layer(rng, d);
        const vsGqa = d >= 0.6 && rng.next() < 0.4;
        const before = vsGqa ? 2 * L.g * L.dh : 2 * L.h * L.dh;
        const r = before / L.dc;
        if (!Number.isInteger(r) || r < 2) continue;
        const prompt = vsGqa
          ? `A grouped-query attention layer has $${H} = ${L.h}$ query heads and $${G} = ${L.g}$ key-value heads, each $${DH} = ${L.dh}$ wide. It is rebuilt as latent attention with a latent of size $${DC} = ${L.dc}$. How many times smaller is its cache per token?`
          : `A layer has ${heads(L)}. How many times smaller is its cache per token with latent attention and a latent of size $${DC} = ${L.dc}$ than with ordinary multi-head attention?`;
        const ts = vsGqa
          ? [
              { value: (2 * L.h * L.dh) / L.dc, why: `That compares with ordinary multi-head attention. Grouped-query attention caches only its $${G} = ${L.g}$ key-value heads.` },
              { value: (L.g * L.dh) / L.dc, why: 'That counts only the keys. Each key-value head caches a key and a value.' },
            ]
          : [
              { value: (L.h * L.dh) / L.dc, why: 'That counts only the keys. Multi-head attention caches a key and a value for every head.' },
              { value: (2 * L.dh) / L.dc, why: `That is one head's key and value. All ${L.h} heads cache their own.` },
              { value: before - L.dc, why: 'That is the difference in numbers. "How many times" asks for the ratio.' },
            ];
        return {
          prompt,
          answer: { kind: 'number', value: r },
          traps: traps(r, ts),
          solution: [
            vsGqa
              ? `Grouped-query: $2 \\times ${G} \\times ${DH} = 2 \\times ${L.g} \\times ${L.dh} = ${big(before)}$ numbers per token.`
              : `Multi-head: $2 \\times ${H} \\times ${DH} = 2 \\times ${L.h} \\times ${L.dh} = ${big(before)}$ numbers per token.`,
            `Latent: only $${C}$, $${DC} = ${big(L.dc)}$ numbers per token.`,
            `$${big(before)} / ${big(L.dc)} = ${r}$ times smaller.`,
          ],
        };
      }
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const L = layer(rng, d);
      const which = pick(rng, d < 0.35 ? (['down', 'head'] as const) : (['down', 'head', 'all'] as const));
      const kv = rng.int(2) === 0;
      const W = kv ? WUK : WUV;
      const part = kv ? 'key' : 'value';
      const givens = `A latent-attention layer has model width $${D} = ${big(L.dm)}$, ${heads(L)}, and a latent of size $${DC} = ${L.dc}$.`;
      if (which === 'down') {
        const ans = [L.dc, L.dm];
        return {
          prompt: `${givens} What is the shape of $${WD}$, the matrix that makes the latent?`,
          answer: { kind: 'shape', value: ans },
          traps: straps(ans, [
            { value: [L.dm, L.dc], why: `That is the transpose. $${WD}$ has a row for each of the $${DC} = ${L.dc}$ numbers it makes and a column for each of the $${D} = ${big(L.dm)}$ entries of the token.` },
            { value: [L.dh, L.dm], why: 'That is one head\'s ordinary key matrix, which makes a key straight from the token. Here one matrix makes the latent.' },
            { value: [L.h * L.dh, L.dc], why: `That is $${WUK}$, which rebuilds the keys from the latent.` },
          ]),
          solution: [
            `$${WD}$ turns a token of $${D} = ${big(L.dm)}$ numbers into the latent $${C}$ of $${DC} = ${L.dc}$.`,
            `One row per number it makes, one column per entry it reads: $${shp(ans)}$.`,
          ],
        };
      }
      if (which === 'head') {
        const ans = [L.dh, L.dc];
        return {
          prompt: `${givens} What is the shape of one head's part of $${W}$?`,
          answer: { kind: 'shape', value: ans },
          traps: straps(ans, [
            { value: [L.dc, L.dh], why: `That is the transpose. It makes $${DH} = ${L.dh}$ numbers from $${DC} = ${L.dc}$: one row per number it makes.` },
            { value: [L.dh, L.dm], why: `That reads the whole token. The up-projection reads the latent $${C}$, $${DC} = ${L.dc}$ numbers.` },
            { value: [L.h * L.dh, L.dc], why: `That is all ${L.h} heads' parts stacked. One head's part makes only its own ${part}.` },
          ]),
          solution: [
            `One head's part rebuilds that head's ${part}, $${DH} = ${L.dh}$ numbers, from $${C}$, $${DC} = ${L.dc}$ numbers.`,
            `One row per number it makes, one column per entry of $${C}$: $${shp(ans)}$.`,
          ],
        };
      }
      const ans = [L.h * L.dh, L.dc];
      return {
        prompt: `${givens} What is the shape of the whole of $${W}$, all heads' parts stacked?`,
        answer: { kind: 'shape', value: ans },
        traps: straps(ans, [
          { value: [L.dh, L.dc], why: `That is one head's part. Stacking all ${L.h} gives $${H} \\times ${DH}$ rows.` },
          { value: [L.dc, L.h * L.dh], why: `That is the transpose. It makes every head's ${part} from $${C}$: one row per number it makes.` },
          { value: [L.h * L.dh, L.dm], why: `That reads the whole token. It reads the latent $${C}$, $${DC} = ${L.dc}$ numbers.` },
        ]),
        solution: [
          `One head's part is $${shp([L.dh, L.dc])}$: it makes $${DH} = ${L.dh}$ numbers from $${DC} = ${L.dc}$.`,
          `Stacking all $${H} = ${L.h}$ parts: $${L.h} \\times ${L.dh} = ${big(L.h * L.dh)}$ rows, so $${shp(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'stored',
    make(rng) {
      const v = rng.int(3);
      const h = pick(rng, [8, 16, 32, 64, 128]);
      const dc = pick(rng, [128, 256, 512]);
      const lead = `A latent-attention layer has $${H} = ${h}$ heads and a latent of size $${DC} = ${dc}$.`;
      if (v === 0) {
        return {
          prompt: `${lead} While generating, what does it keep in its cache for each earlier token?`,
          answer: choice([
            { text: `One latent $${C}$ of ${dc} numbers, for keys and values alike`, why: null },
            { text: `Every head's key and value: ${2 * h} vectors in all`, why: 'That is what multi-head attention caches. Latent attention stores only the latent and rebuilds the keys and values from it.' },
            { text: 'One latent for the keys and a second one for the values', why: `One $${C}$ serves both: $${WUK}$ rebuilds the keys and $${WUV}$ the values from the same latent.` },
            { text: `Its own copy of $${WUK}$ and $${WUV}$, made for that token`, why: 'Those are weights, the same for every token, stored once with the model.' },
          ]),
          solution: [
            `The cache keeps $${C} = ${WD}\\,\\symx$, $${DC} = ${dc}$ numbers per token.`,
            `Each head's key and value are rebuilt from $${C}$ by its part of $${WUK}$ and $${WUV}$, weights stored once.`,
          ],
        };
      }
      if (v === 1) {
        return {
          prompt: `${lead} What is rebuilt from the cache each time attention runs, instead of being stored?`,
          answer: choice([
            { text: `Every head's key and value, by $${WUK}$ and $${WUV}$`, why: null },
            { text: `The latent $${C}$, made again from the token by $${WD}$`, why: `$${C}$ is what the cache stores. It is made once, when its token arrives.` },
            { text: 'One key and one value shared by every head', why: 'That is grouped-query attention with one key-value head. Here each head rebuilds a key and value of its own.' },
            { text: `The matrices $${WUK}$ and $${WUV}$, from $${C}$`, why: 'Those are learned weights, stored once with the model. They do the rebuilding.' },
          ]),
          solution: [
            `Only $${C}$, $${DC} = ${dc}$ numbers per token, is stored.`,
            `Each of the ${h} heads rebuilds its key with its part of $${WUK}$ and its value with its part of $${WUV}$.`,
          ],
        };
      }
      return {
        prompt: `${lead} How does it differ from grouped-query attention with $${G} = 1$?`,
        answer: choice([
          { text: `Each head still gets its own key and value, rebuilt from $${C}$`, why: null },
          { text: 'All its heads also read one shared key and one shared value', why: `That is $${G} = 1$ itself. In latent attention each head has its own part of $${WUK}$ and $${WUV}$, so its own key and value.` },
          { text: 'It keeps no cache, computing every key and value again', why: `It does keep a cache: the latent $${C}$ of every earlier token.` },
          { text: `It caches every head's key and value, ${2 * h} vectors a token`, why: 'That is multi-head attention. Latent attention caches only the latent.' },
        ]),
        solution: [
          `With $${G} = 1$, all ${h} heads read the very same key and value.`,
          `Latent attention caches one latent $${C}$, and each head rebuilds a key and value of its own from it with its part of $${WUK}$ and $${WUV}$.`,
        ],
      };
    },
  },
];
