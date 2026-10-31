import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, ints, num, pick, shp, shuffled, traps, vec, vtraps } from '../../kit';
import { outSize } from '../kit';

/** Output width of a transposed convolution: S(W - 1) + F - 2P. */
const upSize = (W: number, F: number, S: number, P: number): number => S * (W - 1) + F - 2 * P;

/** Stamps of `w`, scaled by each entry of `x`, `S` apart; `combine` merges a stamp into what is there. */
function stamp(x: number[], w: number[], S: number, combine: (old: number, v: number) => number = (o, v) => o + v): number[] {
  const out = Array.from({ length: S * (x.length - 1) + w.length }, () => 0);
  const set = Array.from({ length: out.length }, () => false);
  x.forEach((xi, i) =>
    w.forEach((wk, k) => {
      const j = S * i + k;
      out[j] = set[j] ? combine(out[j]!, xi * wk) : xi * wk;
      set[j] = true;
    }),
  );
  return out;
}

const formula = '$\\symS(W - 1) + \\symF - 2\\symP$';

export const generators: Generator[] = [
  {
    id: 'out-size',
    make(rng, d) {
      for (;;) {
        const [W, F, S, P] =
          d < 0.35
            ? [int(rng, 2, 8), pick(rng, [2, 3, 4]), pick(rng, [1, 2]), 0]
            : d < 0.7
              ? [int(rng, 3, 16), pick(rng, [2, 3, 4, 5]), pick(rng, [1, 2, 3]), pick(rng, [0, 1])]
              : [pick(rng, [7, 8, 14, 16, 28, 32, 56]), pick(rng, [2, 3, 4, 5, 7]), pick(rng, [2, 4]), pick(rng, [0, 1, 2, 3])];
        const v = upSize(W, F, S, P);
        if (v < W || 2 * P >= F) continue;
        const conv = outSize(W, F, S, P);
        return {
          prompt: `A transposed convolution with filter size $\\symF = ${F}$, stride $\\symS = ${S}$ and padding $\\symP = ${P}$ takes an input $W = ${W}$ wide. How wide is its output?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            ...(Number.isInteger(conv) && conv > 0 ? [{ value: conv, why: 'That is the size formula for an ordinary convolution, which shrinks. A transposed one grows: $\\symS(W - 1) + \\symF - 2\\symP$.' }] : []),
            { value: S * W + F - 2 * P, why: `That puts $W$ gaps between the stamps. $W$ stamps have $W - 1$ gaps of $\\symS$ between their starts.` },
            { value: S * W, why: 'That only multiplies by the stride. The last stamp starts at $\\symS(W - 1)$ and is $\\symF$ wide.' },
            ...(P ? [{ value: S * (W - 1) + F + 2 * P, why: 'That adds the padding. In a transposed convolution, $\\symP$ trims the output: subtract $2\\symP$.' }] : []),
            ...(P ? [{ value: S * (W - 1) + F, why: `That leaves out the padding, which trims $${P}$ from each end: subtract $2\\symP = ${2 * P}$.` }] : []),
          ]),
          solution: [
            `The output is ${formula} wide: the last of the $W$ stamps starts at $\\symS(W - 1)$, is $\\symF$ wide, and padding trims $\\symP$ from each end.`,
            `$${S}(${W} - 1) + ${F} - ${2 * P} = ${S * (W - 1)} + ${F} - ${2 * P} = ${v}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'stamp',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const F = d < 0.35 ? pick(rng, [2, 3]) : 3;
      const S = d < 0.35 ? (F === 2 ? 1 : pick(rng, [1, 2])) : pick(rng, [1, 2]);
      const [lo, hi] = d < 0.35 ? [1, 3] : d < 0.7 ? [-1, 3] : [-2, 3];
      const x = ints(rng, n, Math.max(1, lo), hi);
      const w = ints(rng, F, lo, hi);
      const v = stamp(x, w, S);
      const W = n;
      const other = S === 1 ? 2 : 1;
      return {
        prompt: `A transposed convolution has filter $\\symw = ${vec(w)}$, stride $\\symS = ${S}$ and no padding. What does it output for the input $\\symx = ${vec(x)}$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: stamp(x, w, S, (_, nv) => nv), why: 'That lets a later stamp replace an earlier one. Where stamps overlap, they add.' },
          { value: stamp(x, w, other), why: `That spaces the stamps ${other} apart. Each stamp starts $\\symS = ${S}$ after the one before.` },
          { value: stamp(x.map(() => 1), w, S), why: 'That stamps the filter as it is. Each stamp is the filter times its input value.' },
        ]),
        solution: [
          `The output is $\\symS(W - 1) + \\symF = ${S}(${W} - 1) + ${F} = ${v.length}$ long.`,
          ...x.map((xi, i) => `Input ${i}, $${num(xi)}$, stamps $${num(xi)} \\times ${vec(w)} = ${vec(w.map((wk) => xi * wk))}$ at positions ${S * i} to ${S * i + F - 1}.`),
          `Add where the stamps overlap: $${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'restore',
    make(rng, d) {
      const W = d < 0.35 ? pick(rng, [4, 7, 8, 14, 16]) : pick(rng, [7, 8, 14, 16, 28, 32, 56]);
      const k = d < 0.6 ? 2 : pick(rng, [2, 4]);
      const target = k * W;
      const all: { F: number; S: number; P: number; out: number }[] = [];
      for (let F = 2; F <= 8; F++) for (let S = 1; S <= 4; S++) for (let P = 0; P <= 3; P++) if (2 * P < F) all.push({ F, S, P, out: upSize(W, F, S, P) });
      const right = pick(rng, all.filter((c) => c.out === target));
      // Near misses with the right stride, so the stride alone does not give the answer away.
      const near = rng.shuffle(all.filter((c) => c.S === k && c.out !== target && Math.abs(c.out - target) <= 3));
      const far = rng.shuffle(all.filter((c) => c.S !== k && c.out !== target && Math.abs(c.out - target) <= Math.max(6, target / 4)));
      const wrong: typeof all = [];
      for (const c of [...near.slice(0, 2), ...far, ...near.slice(2)]) if (wrong.length < 3 && !wrong.some((o) => o.out === c.out)) wrong.push(c);
      const show = (c: { F: number; S: number; P: number }) => `$\\symF = ${c.F}$, $\\symS = ${c.S}$, $\\symP = ${c.P}$`;
      const calc = (c: { F: number; S: number; P: number; out: number }) => `$${c.S}(${W} - 1) + ${c.F} - ${2 * c.P} = ${c.out}$`;
      return {
        prompt: `A segmentation network has shrunk its feature maps to $${W} \\times ${W}$, and needs them back at $${target} \\times ${target}$. Which transposed convolution does that in one layer?`,
        answer: shuffled(rng, [
          { text: show(right), why: null },
          ...wrong.map((c) => ({ text: show(c), why: `That gives ${calc(c)}, not $${target}$.` })),
        ]),
        solution: [
          `A transposed convolution outputs ${formula}, here with $W = ${W}$.`,
          `For ${show(right)}: ${calc(right)}.`,
          ...wrong.map((c) => `For ${show(c)}: ${calc(c)}.`),
        ],
      };
    },
  },
  {
    id: 'seg-shape',
    make(rng, d) {
      const C = pick(rng, [2, 3, 5, 10, 21]);
      const [H, Wd] = d < 0.5 ? (() => { const v = pick(rng, [32, 64, 128, 256]); return [v, v]; })() : pick(rng, [[64, 96], [96, 128], [128, 192], [240, 320], [256, 512]] as const);
      const f = pick(rng, [4, 8, 16, 32].filter((q) => H % q === 0 && Wd % q === 0 && H / q >= 2));
      const deep = pick(rng, [128, 256, 512]);
      const v = [C, H, Wd];
      const mid = d >= 0.35;
      return {
        prompt:
          `A segmentation network with $\\symC = ${C}$ classes takes color images of shape $${shp([3, H, Wd])}$.` +
          (mid ? ` Its convolutions shrink an image to $${shp([deep, H / f, Wd / f])}$, then transposed convolutions grow it back.` : '') +
          ' What is the shape of its output scores?',
        answer: { kind: 'shape', value: v },
        traps: vtraps(v, [
          { value: [C], why: 'That is one score per class for the whole image, as a classifier gives. Segmentation scores every pixel.' },
          { value: [3, H, Wd], why: 'That is the input\'s shape. The output has one channel per class, not one per color.' },
          { value: [H, Wd], why: 'That is the label map, one class per pixel. The scores have one channel per class.' },
          ...(mid ? [{ value: [C, H / f, Wd / f], why: 'That is the shrunken size. The network grows back so that every pixel of the image gets its scores.' }] : []),
          ...(mid ? [{ value: [deep, H, Wd], why: `That keeps $${deep}$ channels. The last layer makes one channel per class.` }] : []),
          { value: [H, Wd, C], why: 'Right numbers, channels last. Keep it channels first.' },
        ]),
        solution: [
          'Segmentation gives every pixel its own scores, one per class, so the output is as tall and wide as the image.',
          `With $\\symC = ${C}$ classes that is $${shp(v)}$; the highest score at each pixel is its label.`,
        ],
      };
    },
  },
];
