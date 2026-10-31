import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, shuffled, traps } from '../../kit';
import { outSize } from '../kit';

interface Setting {
  W: number;
  F: number;
  S: number;
  P: number;
}

/** A setting harder with difficulty, whose division comes out whole or not as asked. */
function setting(rng: Rng, d: number, whole: boolean): Setting {
  for (;;) {
    const st: Setting =
      d < 0.35
        ? { W: int(rng, 5, 12), F: pick(rng, [2, 3, 5]), S: 1, P: 0 }
        : d < 0.7
          ? { W: int(rng, 6, 16), F: pick(rng, [3, 5]), S: whole ? pick(rng, [1, 2]) : 2, P: pick(rng, [0, 1, 2]) }
          : { W: pick(rng, [28, 32, 64, 96, 224, 227]), F: pick(rng, [3, 5, 7, 11]), S: whole ? pick(rng, [1, 2, 4]) : pick(rng, [2, 4]), P: pick(rng, [0, 1, 2, 3]) };
    const o = outSize(st.W, st.F, st.S, st.P);
    if (Number.isInteger(o) === whole && o >= 2 && st.W + 2 * st.P >= st.F) return st;
  }
}

const sym = ({ W, F, S, P }: Setting) => `$W = ${W}$, $\\symF = ${F}$, $\\symS = ${S}$, $\\symP = ${P}$`;

export const generators: Generator[] = [
  {
    id: 'width',
    make(rng, d) {
      const whole = d < 0.35 || rng.int(3) > 0;
      const st = setting(rng, d, whole);
      const { W, F, S, P } = st;
      const o = outSize(W, F, S, P);
      const v = Math.floor(o);
      const top = W - F + 2 * P;
      const text =
        `An input is $W = ${W}$ wide. A filter of size $\\symF = ${F}$ slides over it with stride $\\symS = ${S}$` +
        (P ? ` and padding $\\symP = ${P}$.` : ' and no padding.') +
        ' How wide is the output?';
      const ts = traps(v, [
        ...(whole ? [] : [
          { value: o, why: 'That keeps the fraction. Part of a position would hang over the edge, so a library drops it: round down.' },
          { value: Math.ceil(o), why: 'That rounds up. The last position would hang over the edge, so a library drops it: round down.' },
        ]),
        { value: Math.floor(top / S), why: 'That leaves out the $+1$. The filter fits at its first position too: count the positions, not the steps between them.' },
        ...(P ? [{ value: Math.floor((W - F) / S + 1), why: 'That ignores the padding. Padding adds $\\symP$ zeros on both sides, so the input is $W + 2\\symP$ wide.' }] : []),
        ...(P ? [{ value: Math.floor((W - F + P) / S + 1), why: 'That pads one side only. $\\symP$ zeros go on each side: add $2\\symP$.' }] : []),
        ...(S > 1 ? [{ value: top + 1, why: 'That is the size with stride 1. A stride of $\\symS$ only lands on every $\\symS$-th position: divide by $\\symS$ before adding 1.' }] : []),
      ]).slice(0, 4);
      return {
        prompt: text,
        answer: { kind: 'number', value: v },
        traps: ts,
        solution: [
          `Use $(W - \\symF + 2\\symP) / \\symS + 1$ with ${sym(st)}.`,
          `First the top: $${W} - ${F} + ${2 * P} = ${top}$.`,
          ...(S === 1
            ? [`The stride is 1, so there is nothing to divide: add 1, $${top} + 1 = ${v}$.`]
            : [`Divide by the stride: $${top} / ${S} = ${num(top / S)}$.`, `Add 1: $${num(top / S)} + 1 = ${num(o)}$.`]),
          ...(whole ? [] : [`$${num(o)}$ is not whole: the last position would hang over the edge, so it is dropped. Round down: $${v}$.`]),
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
            prompt: `An input is $W = ${W}$ wide. With stride 1 and a filter of size $\\symF = ${F}$, what padding $\\symP$ makes the output $${o}$ wide?`,
            answer: { kind: 'number', value: P },
            traps: traps(P, [
              { value: 2 * P, why: 'That is the total padding over both sides. $\\symP$ counts the zeros on one side.' },
              { value: (o - W + F) / 2, why: 'That leaves out the $+1$ in the formula: with stride 1 the output is $W - \\symF + 2\\symP + 1$ wide.' },
            ]),
            solution: [
              `With stride 1 the output is $W - \\symF + 2\\symP + 1$ wide.`,
              `Put in the numbers: $${W} - ${F} + 2\\symP + 1 = ${o}$, that is $${W - F + 1} + 2\\symP = ${o}$.`,
              `Take $${W - F + 1}$ from both sides: $2\\symP = ${o} - ${W - F + 1} = ${2 * P}$.`,
              `Halve it: $\\symP = ${P}$.`,
            ],
          };
        }
      }
      const P = (F - 1) / 2;
      return {
        prompt: `An input is $${W} \\times ${W}$. A layer uses $${F} \\times ${F}$ filters with stride 1. What padding $\\symP$ keeps the output $${W} \\times ${W}$?`,
        answer: { kind: 'number', value: P },
        traps: traps(P, [
          { value: F - 1, why: 'That is the total over both sides. $\\symP$ counts one side: half of $\\symF - 1$.' },
          { value: F / 2, why: 'Close: the output loses $\\symF - 1$, not $\\symF$, so half of that is $(\\symF - 1) / 2$.' },
          { value: (F + 1) / 2, why: 'That pads one zero too many on each side: the output would grow. The filter only loses $\\symF - 1$.' },
        ]),
        solution: [
          `With stride 1 the output is $W - \\symF + 2\\symP + 1$ wide: the filter loses $\\symF - 1 = ${F - 1}$ positions.`,
          `Padding gives back $2\\symP$, so set $2\\symP = ${F - 1}$.`,
          `Halve it: $\\symP = (\\symF - 1) / 2 = ${num(P)}$, whatever $W$ is.`,
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
      const top = wrong.W - wrong.F + 2 * wrong.P;
      const q = Math.floor(top / wrong.S);
      return {
        prompt: `An input is $W = ${W}$ wide. Which of these settings does not fit exactly?`,
        answer: shuffled(rng, [
          { text: show(wrong), why: null },
          ...goods.map((c) => ({ text: show(c), why: `That one fits exactly: $(${W} - ${c.F} + ${2 * c.P}) / ${c.S} + 1 = ${over(c)} / ${c.S} + 1 = ${outSize(c.W, c.F, c.S, c.P)}$, a whole number, so no position is dropped.` })),
        ]),
        solution: [
          'A setting fits exactly when $W - \\symF + 2\\symP$ divides evenly by the stride $\\symS$: then no position is dropped.',
          `For ${show(wrong)}: $(${W} - ${wrong.F} + ${2 * wrong.P}) / ${wrong.S} + 1 = ${over(wrong)} / ${wrong.S} + 1$.`,
          `$${over(wrong)}$ does not divide by $${wrong.S}$: $${over(wrong)} / ${wrong.S}$ is $${q}$ with $${top % wrong.S}$ left over.`,
          `So the last position would hang over the edge. A library drops it and rounds down: $${q} + 1 = ${q + 1}$.`,
        ],
      };
    },
  },
];
