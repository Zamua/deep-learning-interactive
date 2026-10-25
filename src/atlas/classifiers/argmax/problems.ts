import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, scale, vec } from '../../kit';
import { argmaxOf } from '../kit';

const CAP = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

/** `n` entries with one clear largest: whole numbers from 0 at first, then negatives, then decimals. */
function entries(rng: Rng, n: number, d: number): number[] {
  for (;;) {
    const xs = d < 0.35 ? ints(rng, n, 0, 9) : d < 0.7 ? ints(rng, n, -5, 9) : ints(rng, n, -30, 60).map((v) => round(v / 10, 1));
    if (argmaxOf(xs) >= 0) return xs;
  }
}

const argminOf = (xs: number[]) => xs.indexOf(Math.min(...xs));

export const generators: Generator[] = [
  {
    id: 'index',
    make(rng, d) {
      const n = scale(d, 3, 6);
      const s = entries(rng, n, d);
      const k = argmaxOf(s);
      const v = s[k]!;
      const traps = [
        { value: v, why: 'That is the largest value itself. argmax asks where it is: its position.' },
        { value: k + 1, why: 'That counts positions from 1. They count from 0, as in Python: the first entry is position 0.' },
        { value: argminOf(s), why: 'That is the position of the smallest entry, the argmin.' },
      ];
      const asCode = rng.int(2) === 0;
      return {
        prompt: asCode
          ? `$\\syms = ${vec(s)}$. What is \`np.argmax(s)\`?`
          : `Each of ${n} answers has one score in $\\syms = ${vec(s)}$. Which answer is the top pick, counting from 0?`,
        answer: { kind: 'number', value: k },
        traps: traps.filter((t, i) => t.value !== k && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          `The largest entry is $${num(v)}$.`,
          `Count positions from 0: ${s.map((x, i) => `$${num(x)}$ is at ${i}`).join(', ')}.`,
          `So the argmax is $${k}$${asCode ? '' : `: the top pick is answer ${k}`}.`,
        ],
      };
    },
  },
  {
    id: 'accuracy',
    make(rng, d) {
      const R = d < 0.5 ? 4 : 5;
      const right = int(rng, 1, R - 1);
      const ok = rng.shuffle(Array.from({ length: R }, (_, i) => i < right));
      const rows = ok.map((good) => {
        const s = entries(rng, 3, Math.min(d, 0.5));
        const k = argmaxOf(s);
        const y = good ? k : (k + 1 + rng.int(2)) % 3;
        return { s, k, y };
      });
      const acc = right / R;
      const oneBased = rows.filter((r) => r.k + 1 === r.y).length / R;
      const traps = [
        { value: right, why: `That is how many picks are right. Accuracy is the share: divide by the ${R} questions.` },
        { value: 1 - acc, why: 'That is the share of picks that are wrong, the error rate.' },
        { value: oneBased, why: 'That matches the right answers against positions counted from 1. Answers count from 0: the first score is answer 0.' },
      ];
      const table = `\\begin{array}{ccc|c} \\syms_0 & \\syms_1 & \\syms_2 & \\symy \\\\ \\hline ${rows.map((r) => `${r.s.map((x) => num(x)).join(' & ')} & ${r.y}`).join(' \\\\ ')} \\end{array}`;
      return {
        prompt: `Each row holds one question's scores for its 3 answers, and $\\symy$, its right answer.\n\n$$${table}$$\n\nWhat is the accuracy of picking the top score?`,
        answer: { kind: 'number', value: acc, places: 2 },
        traps: traps.filter((t, i) => t.value > 0 && Math.abs(t.value - acc) >= 0.01 && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          ...rows.map((r, i) => `${CAP[i]} question: the top score $${num(r.s[r.k]!)}$ is answer ${r.k}, the right answer is ${r.y}: ${r.k === r.y ? 'right' : 'wrong'}.`),
          `Accuracy is the share of questions whose top score is at the right answer: $${right}/${R} = ${num(round(acc, 2))}$.`,
        ],
      };
    },
  },
  {
    id: 'max-or-argmax',
    make(rng, d) {
      const askArg = rng.int(2) === 0;
      for (;;) {
        const s = entries(rng, int(rng, 3, d < 0.5 ? 4 : 5), Math.min(d, 0.6));
        const k = argmaxOf(s);
        const v = s[k]!;
        const j = argminOf(s);
        const u = s[j]!;
        const vals = askArg ? [k, v, k + 1, j] : [v, k, k + 1, u];
        if (new Set(vals).size < 4) continue;
        const why = askArg
          ? [null, 'That is `np.max(s)`, the largest value. argmax gives its position.', 'That counts positions from 1. NumPy counts from 0.', 'That is the position of the smallest entry, `np.argmin(s)`.']
          : [null, 'That is `np.argmax(s)`, the position of the largest entry. max gives the value itself.', 'That is a position, counted from 1. max gives the value itself.', 'That is the smallest value, `np.min(s)`.'];
        return {
          prompt: `$\\syms = ${vec(s)}$. What does \`np.${askArg ? 'argmax' : 'max'}(s)\` return?`,
          answer: { kind: 'choice', options: vals.map((x) => `$${num(x)}$`), correct: 0, why },
          solution: [
            `The largest entry is $${num(v)}$, at position $${k}$ counting from 0.`,
            askArg ? `\`np.argmax\` returns the position: $${k}$.` : `\`np.max\` returns the value: $${num(v)}$.`,
          ],
        };
      }
    },
  },
];
