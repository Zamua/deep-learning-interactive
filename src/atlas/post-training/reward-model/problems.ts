import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { choose, clean, minus, SIG, traps } from '../kit';

const r = '\\sym{r}{r}';
const wTex = `${r}_w`;
const lTex = `${r}_l`;

/** Scores for two answers to one prompt, never tied; whole at first, halves when harder. */
function scores(rng: Rng, d: number): [number, number] {
  for (;;) {
    const unit = d < 0.6 ? 1 : 2;
    const lo = d < 0.3 ? 0 : -3;
    const a = int(rng, lo * unit, 4 * unit) / unit;
    const b = int(rng, lo * unit, 4 * unit) / unit;
    if (a !== b && Math.abs(a - b) <= 3) return [a, b];
  }
}

/** `\sigma(z) \approx 0.73`, or `=` at 0. */
const sigEq = (z: number): string => `\\sigma(${num(z)}) ${z === 0 ? '=' : '\\approx'} ${num(SIG(z), 2)}`;

export const generators: Generator[] = [
  {
    id: 'push',
    make(rng, d) {
      const z = pick(rng, d < 0.5 ? [0, 1, 2, -1] : [0.5, 1, 1.5, 2, -0.5, -1, -2, 3]);
      const s = SIG(z);
      const winner = rng.int(2) === 0;
      const v = clean(winner ? s - 1 : 1 - s);
      const wrt = winner ? wTex : lTex;
      return {
        prompt: `For a reward model's loss on a pair with $${wTex} - ${lTex} = ${num(z)}$, where $\\sigma(${num(z)}) ${z === 0 ? '=' : '\\approx'} ${num(s, 2)}$, what is $\\dfrac{\\partial \\symL}{\\partial ${wrt}}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(-v), why: winner ? 'That has the wrong sign. Raising the preferred score lowers the loss, so the slope is negative.' : 'That has the wrong sign. Raising the rejected score raises the loss, so the slope is positive.' },
          { value: clean((winner ? -1 : 1) * s * (1 - s)), why: 'That is the slope of $\\sigma$ itself. The loss takes $-\\ln$ of it, and dividing by $\\sigma$ leaves $1 - \\sigma$.' },
          { value: clean((winner ? -1 : 1) * s), why: 'That uses $\\sigma$ where the slope has $1 - \\sigma$.' },
        ]),
        solution: [
          `Call the gap $z = ${wTex} - ${lTex} = ${num(z)}$. The loss $\\symL = -\\ln \\sigma(z)$ is a chain: $z$ feeds $\\sigma$, and $\\sigma$ feeds $-\\ln$.`,
          `Walking back, $-\\ln$ has slope $-\\dfrac{1}{\\sigma}$, and $\\sigma$ has slope $\\sigma(1 - \\sigma)$.`,
          `Multiply them: $-\\dfrac{1}{\\sigma} \\cdot \\sigma(1 - \\sigma) = -(1 - \\sigma) = -(1 - ${num(s, 2)}) = ${num(clean(s - 1))}$. That is the slope on $z$.`,
          winner ? `$z$ rises one for one with $${wTex}$, so multiply by $1$: $\\dfrac{\\partial \\symL}{\\partial ${wTex}} = ${num(clean(s - 1))} \\cdot 1 = ${num(v)}$.` : `$z$ falls one for one as $${lTex}$ rises, so multiply by $-1$: $\\dfrac{\\partial \\symL}{\\partial ${lTex}} = (${num(clean(s - 1))}) \\cdot (-1) = ${num(v)}$.`,
          `Lowering the loss raises the preferred score and lowers the other by the same amount, ${num(clean(1 - s))} here: ${s >= 0.8 ? 'small, since the model already agrees.' : s <= 0.5 ? 'large, since the model gets this pair wrong or is unsure.' : 'smaller the more the model already agrees.'}`,
        ],
      };
    },
  },
  {
    id: 'move',
    make(rng, d) {
      const [a, b] = scores(rng, d);
      const aWins = rng.int(2) === 0;
      const w = aWins ? 'a' : 'b';
      const l = aWins ? 'b' : 'a';
      const sw = aWins ? a : b;
      const sl = aWins ? b : a;
      const z = clean(sw - sl);
      const rw = `${r}_${w}`;
      const rl = `${r}_${l}`;
      const right = z > 0;
      return {
        prompt: `A labeler preferred answer ${w}. The reward model scores $${r}_a = ${num(a)}$ and $${r}_b = ${num(b)}$. After one small step that lowers its loss on this pair, what happens to the two scores?`,
        answer: choose(`$${rw}$ rises and $${rl}$ falls, by the same amount`, [
          [`$${rl}$ rises and $${rw}$ falls, by the same amount`, `That is the step for the opposite choice. Lowering the loss pushes the preferred answer's score up.`],
          [`Only $${rw}$ rises; $${rl}$ stays where it is`, `The loss depends on the gap $${rw} - ${rl}$, so its slope on $${rl}$ is as large as its slope on $${rw}$, with the sign flipped.`],
          right
            ? [`Nothing: the model already scores answer ${w} higher`, `The slope on each score is $1 - \\sigma$ in size, and $\\sigma$ never reaches 1. A pair already ranked right moves less, but it still moves.`]
            : [`Both rise together, keeping their gap`, 'Raising both by the same amount leaves the gap, and so the loss, unchanged. The step widens the gap instead.'],
        ]),
        solution: [
          `The loss is $-\\ln \\sigma(z)$ with $z = ${rw} - ${rl} = ${minus(sw, sl)} = ${num(z)}$, and its slope on $z$ is $-(1 - \\sigma(z))$.`,
          `$z$ rises one for one with $${rw}$ and falls one for one as $${rl}$ rises, so the slope on $${rw}$ is $-(1 - \\sigma)$ and on $${rl}$ it is $1 - \\sigma$.`,
          `Stepping against those slopes raises $${rw}$ and lowers $${rl}$ by the same amount, in proportion to $1 - ${num(SIG(z), 2)} = ${num(clean(1 - SIG(z)))}$: ${right ? 'small, since the model already ranks this pair right' : 'large, since the model ranks this pair wrong'}.`,
        ],
      };
    },
  },
  {
    id: 'agree',
    make(rng, d) {
      const pool = d < 0.5 ? [-2, -1, 1, 2, 3] : [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3];
      const gaps = rng.shuffle(pool.slice()).slice(0, 2) as [number, number];
      const pairs = gaps.map((g) => {
        const lo = int(rng, d < 0.5 ? 0 : -2, 3);
        return g >= 0 ? [clean(lo + g), lo] : [lo, clean(lo - g)];
      });
      const k = gaps[0] < gaps[1] ? 0 : 1;
      const move = (g: number) => num(clean(1 - SIG(g)));
      const mv = (g: number) => `1 - \\sigma ${g === 0 ? '=' : '\\approx'} ${move(g)}`;
      const desc = (i: number) => `pair ${i} has $${wTex} = ${num(pairs[i]![0]!)}$, $${lTex} = ${num(pairs[i]![1]!)}$`;
      const line = (i: number) => `Pair ${i}: the gap is $${minus(pairs[i]![0]!, pairs[i]![1]!)} = ${num(gaps[i]!)}$, $${sigEq(gaps[i]!)}$, so $${mv(gaps[i]!)}$.`;
      const why: (string | null)[] = [0, 1].map((i) => (i === k ? null : `Its gap is $${num(gaps[i]!)}$, so its scores move in proportion to $${mv(gaps[i]!)}$, less than pair ${k}'s $${move(gaps[k]!)}$.`));
      why.push(`The step follows the slopes, $1 - \\sigma$ in size, and $\\sigma$ depends on each pair's gap. Here they are $${move(gaps[0])}$ and $${move(gaps[1])}$.`);
      return {
        prompt: `A reward model takes one small step on each of two preference pairs, separately, where $${wTex}$ is the preferred answer's score and $${lTex}$ the other's: ${desc(0)}, and ${desc(1)}. Which pair's scores move more?`,
        answer: { kind: 'choice', options: ['Pair 0', 'Pair 1', 'Both move by the same amount: the step is the same size'], correct: k, why },
        solution: [
          `One step moves both scores of a pair in proportion to $1 - \\sigma(${wTex} - ${lTex})$: the lower $\\sigma$, the bigger the move.`,
          line(0),
          line(1),
          `Pair ${k} moves more: ${gaps[k]! >= 0 ? 'the model agrees with it less' : gaps[1 - k]! < 0 ? 'the model ranks it wrong by more' : 'the model ranks it wrong'}.`,
        ],
      };
    },
  },
];
