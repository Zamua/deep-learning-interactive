import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, pick } from '../../kit';
import { shuffled, traps } from '../kit';

interface Layer {
  F: number;
  S: number;
}

const name = (l: Layer) => `a $${l.F} \\times ${l.F}$ conv with stride ${l.S}`;

/** Receptive field after each layer, and the jump (input pixels between neighboring units) before it. */
function fields(ls: Layer[]): { r: number[]; j: number[] } {
  let r = 1;
  let j = 1;
  const rs: number[] = [];
  const js: number[] = [];
  for (const l of ls) {
    r += (l.F - 1) * j;
    js.push(j);
    j *= l.S;
    rs.push(r);
  }
  return { r: rs, j: js };
}

function stridedStack(rng: Rng, d: number): Layer[] {
  const opts: Layer[] = [{ F: 3, S: 1 }, { F: 3, S: 2 }, { F: 2, S: 2 }, { F: 3, S: 1 }, { F: 5, S: 1 }];
  for (;;) {
    const n = d < 0.5 ? 2 : 3;
    const ls = Array.from({ length: n }, () => pick(rng, opts));
    // A stride only matters if some layer comes after it.
    if (ls.slice(0, -1).some((l) => l.S > 1)) return ls;
  }
}

export const generators: Generator[] = [
  {
    id: 'stack',
    make(rng, d) {
      let Fs: number[];
      if (d < 0.35) Fs = Array.from({ length: int(rng, 1, 4) }, () => 3);
      else if (d < 0.7) {
        const F = pick(rng, [3, 5]);
        Fs = Array.from({ length: int(rng, 2, 6) }, () => F);
      } else Fs = Array.from({ length: int(rng, 2, 4) }, () => pick(rng, [3, 5, 7]));
      const v = 1 + Fs.reduce((a, F) => a + F - 1, 0);
      const same = Fs.every((F) => F === Fs[0]);
      const list = same ? `${Fs.length} conv layer${Fs.length > 1 ? 's' : ''}, each $${Fs[0]} \\times ${Fs[0]}$` : `conv layers of size ${Fs.map((F) => `$${F} \\times ${F}$`).join(', then ')}`;
      return {
        prompt: `A network stacks ${list}, all with stride 1. How wide is the receptive field of one unit in the last layer: the side of the input square it can see?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: Fs.reduce((a, F) => a + F, 0), why: 'That adds the filter sizes. Neighboring windows overlap, so each layer adds only $\\symF - 1$.' },
          { value: v - 1, why: 'That leaves out the 1 you start from: before any layer, a unit sees one pixel, itself.' },
          { value: Fs.reduce((a, F) => a * F, 1), why: 'That multiplies the filter sizes. Each stride-1 layer widens the field by $\\symF - 1$; it adds, it does not multiply.' },
        ]),
        solution: [
          'Start at 1: a single pixel. Each stride-1 layer of size $\\symF$ widens what a unit sees by $\\symF - 1$.',
          `So $1 + ${Fs.map((F) => `${F - 1}`).join(' + ')} = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'strided',
    make(rng, d) {
      const ls = stridedStack(rng, d);
      const { r, j } = fields(ls);
      const v = r[r.length - 1]!;
      const flat = 1 + ls.reduce((a, l) => a + l.F - 1, 0);
      let early = 1;
      let jj = 1;
      for (const l of ls) {
        jj *= l.S;
        early += (l.F - 1) * jj;
      }
      return {
        prompt: `Starting from the input, a network applies ${ls.map(name).join(', then ')}. How wide is the receptive field of one unit after the last layer, in input pixels?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: flat, why: 'That treats every layer as stride 1. After a stride-2 layer, neighboring units sit 2 input pixels apart, so the next layer\'s window spans twice as much.' },
          { value: early, why: 'That lets a layer\'s stride stretch its own window. A stride only spreads out the units it produces, so it widens the layers after it.' },
        ]),
        solution: [
          'Track the field $r$ and the jump $j$, the input pixels between neighboring units: start at $r = 1$, $j = 1$.',
          ...ls.map((l, k) => `Layer ${k + 1}, ${name(l)}: $r = ${k ? r[k - 1] : 1} + (${l.F} - 1) \\times ${j[k]} = ${r[k]}$${l.S > 1 ? `, and the jump becomes $${j[k]} \\times ${l.S} = ${j[k]! * l.S}$` : ''}.`),
          `So one unit sees $${v}$ input pixels across.`,
        ],
      };
    },
  },
  {
    id: 'why-small',
    make(rng) {
      const L = pick(rng, [2, 3]);
      const Fb = 2 * L + 1;
      const H = pick(rng, [16, 28, 32, 64, 224]);
      const stack = L * 9;
      return {
        prompt: `On $${H} \\times ${H}$ grayscale images, a network could use one $${Fb} \\times ${Fb}$ filter, or a stack of ${L === 2 ? 'two' : 'three'} $3 \\times 3$ conv layers with one filter each, all with stride 1. Why might it prefer the stack?`,
        answer: shuffled(rng, [
          { text: 'It sees the same region with fewer weights', why: null },
          { text: 'It sees a larger region of the input', why: `Both see $${Fb} \\times ${Fb}$: $1 + ${Array.from({ length: L }, () => '2').join(' + ')} = ${Fb}$.` },
          { text: 'It has more weights, so it can fit more', why: `It has fewer: $${L} \\times 9 = ${stack}$ against $${Fb} \\times ${Fb} = ${Fb * Fb}$.` },
          { text: 'It computes each output from fewer pixels', why: `Each final output still depends on a $${Fb} \\times ${Fb}$ patch: ${Fb * Fb} pixels, through the layers in between.` },
        ]),
        solution: [
          `Field: ${L} stacked $3 \\times 3$ layers see $1 + ${2 * L} = ${Fb}$ pixels across, the same as one $${Fb} \\times ${Fb}$ filter.`,
          `Weights: the stack has $${L} \\times 9 = ${stack}$; the big filter has $${Fb * Fb}$. Same view, fewer numbers to learn.`,
        ],
      };
    },
  },
  {
    id: 'weights',
    make(rng, d) {
      const L = d < 0.5 ? pick(rng, [2, 3]) : pick(rng, [2, 3, 4]);
      const F = d < 0.5 ? 3 : pick(rng, [3, 5]);
      const Fb = 1 + L * (F - 1);
      const stack = L * F * F;
      const single = Fb * Fb;
      const ask = pick(rng, ['stack', 'single', 'diff'] as const);
      const v = ask === 'stack' ? stack : ask === 'single' ? single : single - stack;
      const what = ask === 'stack' ? `does the stack have, all layers together` : ask === 'single' ? `does the single filter that sees the same region have` : `does the stack save, against the single filter that sees the same region`;
      return {
        prompt: `A stack of ${L} conv layers, each one $${F} \\times ${F}$ filter with stride 1, works on a grayscale image. How many weights ${what}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...(ask === 'stack' ? [{ value: F * F, why: `That is one layer. The stack has ${L}, each with its own $${F} \\times ${F}$ filter.` }] : []),
          ...(ask !== 'stack' ? [{ value: ask === 'single' ? L * F * L * F : L * F * L * F - stack, why: `That makes the big filter $${L * F}$ wide, adding the filter sizes. Neighboring windows overlap: it is $1 + ${L} \\times ${F - 1} = ${Fb}$ wide.` }] : []),
          ...(ask === 'diff' ? [{ value: stack, why: 'That is what the stack has. The question asks how many fewer: subtract it from the big filter\'s count.' }] : []),
          ...(ask === 'single' ? [{ value: stack, why: 'That is the stack. The single filter must be as wide as the stack\'s view.' }] : []),
        ]),
        solution: [
          `The stack sees $1 + ${L} \\times ${F - 1} = ${Fb}$ pixels across, so the single filter must be $${Fb} \\times ${Fb}$: $${single}$ weights.`,
          `The stack has $${L} \\times ${F * F} = ${stack}$.`,
          ...(ask === 'diff' ? [`It saves $${single} - ${stack} = ${v}$.`] : []),
        ],
      };
    },
  },
];
