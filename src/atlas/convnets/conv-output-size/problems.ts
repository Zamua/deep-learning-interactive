import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick } from '../../kit';
import { outSize, shuffled, traps } from '../kit';

interface Setting {
  W: number;
  F: number;
  S: number;
  P: number;
}

/** A setting whose output size is a whole number, harder with difficulty. */
function fitting(rng: Rng, d: number): Setting {
  for (;;) {
    const st: Setting =
      d < 0.35
        ? { W: int(rng, 5, 12), F: pick(rng, [2, 3, 5]), S: 1, P: 0 }
        : d < 0.7
          ? { W: int(rng, 6, 16), F: pick(rng, [3, 5]), S: pick(rng, [1, 2]), P: pick(rng, [0, 1, 2]) }
          : { W: pick(rng, [28, 32, 64, 96, 224, 227]), F: pick(rng, [3, 5, 7, 11]), S: pick(rng, [1, 2, 4]), P: pick(rng, [0, 1, 2, 3]) };
    const o = outSize(st.W, st.F, st.S, st.P);
    if (Number.isInteger(o) && o >= 2 && st.W + 2 * st.P >= st.F) return st;
  }
}

const sym = ({ W, F, S, P }: Setting) => `$W = ${W}$, $\\symF = ${F}$, $\\symS = ${S}$, $\\symP = ${P}$`;

export const generators: Generator[] = [
  {
    id: 'width',
    make(rng, d) {
      const st = fitting(rng, d);
      const { W, F, S, P } = st;
      const v = outSize(W, F, S, P);
      const text =
        `An input is $W = ${W}$ wide. A filter of size $\\symF = ${F}$ slides over it with stride $\\symS = ${S}$` +
        (P ? ` and $\\symP = ${P}$ zeros of padding on each side.` : ', with no padding.') +
        ' How wide is the output?';
      return {
        prompt: text,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: (W - F + 2 * P) / S, why: 'That leaves out the $+1$. The filter fits at its first position too: count the positions, not the steps between them.' },
          ...(P ? [{ value: (W - F) / S + 1, why: 'That ignores the padding. Padding adds $\\symP$ zeros on both sides, so the input is $W + 2\\symP$ wide.' }] : []),
          ...(P ? [{ value: (W - F + P) / S + 1, why: 'That pads one side only. $\\symP$ zeros go on each side: add $2\\symP$.' }] : []),
          ...(S > 1 ? [{ value: W - F + 2 * P + 1, why: 'That is the size with stride 1. A stride of $\\symS$ only lands on every $\\symS$-th position: divide by $\\symS$ before adding 1.' }] : []),
        ]),
        solution: [
          `Use $(W - \\symF + 2\\symP) / \\symS + 1$ with ${sym(st)}.`,
          `$(${W} - ${F} + ${2 * P}) / ${S} + 1 = ${W - F + 2 * P} / ${S} + 1 = ${v}$.`,
        ],
      };
    },
  },
  {
    id: 'same-pad',
    make(rng, d) {
      const F = d < 0.35 ? pick(rng, [3, 5]) : pick(rng, [1, 3, 5, 7, 9]);
      const W = pick(rng, [8, 16, 28, 32, 64, 224]);
      if (d >= 0.6 && rng.int(2) === 0) {
        const P = int(rng, 0, (F - 1) / 2 + 1);
        const o = W - F + 2 * P + 1;
        if (o !== W) {
          return {
            prompt: `An input is $W = ${W}$ wide. With stride 1 and a filter of size $\\symF = ${F}$, how much padding $\\symP$ on each side makes the output $${o}$ wide?`,
            answer: { kind: 'number', value: P },
            traps: traps(P, [
              { value: 2 * P, why: 'That is the total padding over both sides. $\\symP$ counts the zeros on one side.' },
              { value: (o - W + F) / 2, why: 'That leaves out the $+1$ in the formula: with stride 1 the output is $W - \\symF + 2\\symP + 1$ wide.' },
            ]),
            solution: [
              `With stride 1 the output is $W - \\symF + 2\\symP + 1$ wide.`,
              `So $${W} - ${F} + 2\\symP + 1 = ${o}$, which gives $2\\symP = ${o} - ${W - F + 1} = ${2 * P}$.`,
              `$\\symP = ${P}$.`,
            ],
          };
        }
      }
      const P = (F - 1) / 2;
      return {
        prompt: `An input is $${W} \\times ${W}$. A layer uses $${F} \\times ${F}$ filters with stride 1. How much zero padding $\\symP$ on each side keeps the output $${W} \\times ${W}$?`,
        answer: { kind: 'number', value: P },
        traps: traps(P, [
          { value: F - 1, why: 'That is the total over both sides. $\\symP$ counts one side: half of $\\symF - 1$.' },
          { value: F / 2, why: 'Close: the output loses $\\symF - 1$, not $\\symF$, so half of that is $(\\symF - 1) / 2$.' },
          { value: (F + 1) / 2, why: 'That pads one zero too many on each side: the output would grow. The filter only loses $\\symF - 1$.' },
        ]),
        solution: [
          `With stride 1 the output is $W - \\symF + 2\\symP + 1$ wide: the filter loses $\\symF - 1 = ${F - 1}$ positions.`,
          `Padding gives back $2\\symP$, so set $2\\symP = ${F - 1}$: $\\symP = (\\symF - 1) / 2 = ${num(P)}$, whatever $W$ is.`,
        ],
      };
    },
  },
  {
    id: 'fits',
    make(rng, d) {
      const big = d >= 0.5;
      const W = big ? pick(rng, [28, 32, 64, 224]) : pick(rng, [7, 8, 9, 10, 11, 12]);
      const cands: Setting[] = [];
      for (const F of big ? [3, 5, 7] : [2, 3, 5]) for (const S of [1, 2, 3]) for (const P of [0, 1, 2]) {
        if (F <= W + 2 * P) cands.push({ W, F, S, P });
      }
      const ok = cands.filter((c) => Number.isInteger(outSize(c.W, c.F, c.S, c.P)));
      const bad = cands.filter((c) => !Number.isInteger(outSize(c.W, c.F, c.S, c.P)));
      const wrong = pick(rng, bad);
      // At least two strided settings that fit, so a stride above 1 does not give the answer away.
      const strided = rng.shuffle(ok.filter((c) => c.S > 1)).slice(0, 2);
      const goods = [...strided, ...rng.shuffle(ok.filter((c) => !strided.includes(c))).slice(0, 3 - strided.length)];
      const show = (c: Setting) => `$\\symF = ${c.F}$, $\\symS = ${c.S}$, $\\symP = ${c.P}$`;
      const over = (c: Setting) => `${c.W - c.F + 2 * c.P}`;
      return {
        prompt: `An input is $W = ${W}$ wide. Which of these settings does not fit: the filter cannot tile the padded input exactly, so the output size would not be a whole number?`,
        answer: shuffled(rng, [
          { text: show(wrong), why: null },
          ...goods.map((c) => ({ text: show(c), why: `That one fits: $(${W} - ${c.F} + ${2 * c.P}) / ${c.S} + 1 = ${over(c)} / ${c.S} + 1 = ${outSize(c.W, c.F, c.S, c.P)}$, a whole number.` })),
        ]),
        solution: [
          'Each setting fits when $W - \\symF + 2\\symP$ divides evenly by the stride $\\symS$.',
          `For ${show(wrong)}: $(${W} - ${wrong.F} + ${2 * wrong.P}) / ${wrong.S} + 1 = ${over(wrong)} / ${wrong.S} + 1$, and $${over(wrong)}$ does not divide by $${wrong.S}$.`,
          'The last positions of the filter would hang over the edge: a library would silently drop them, or reject the setting.',
        ],
      };
    },
  },
];
