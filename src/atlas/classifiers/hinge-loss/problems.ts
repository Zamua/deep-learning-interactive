import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, ints, num, pick, round, vec } from '../../kit';
import { par, sumOf, terms } from '../kit';

/** Scores: whole numbers from 0 at first, then negatives, then halves. */
function scores(rng: Rng, n: number, d: number): number[] {
  if (d < 0.35) return ints(rng, n, 0, 5);
  if (d < 0.8) return ints(rng, n, -3, 6);
  return ints(rng, n, -6, 12).map((v) => v / 2);
}

/** Each wrong class's margin term `s_j - s_y + 1`, and the hinge on it. */
function parts(s: number[], y: number) {
  return s.map((sj, j) => ({ j, t: round(sj - s[y]! + 1, 6) })).filter((p) => p.j !== y).map((p) => ({ ...p, h: Math.max(0, p.t) }));
}

const termStep = (s: number[], y: number, j: number, t: number) =>
  `Class ${j}: $\\max(0,\\ ${num(s[j]!)} - ${par(s[y]!)} + 1) = \\max(0,\\ ${num(t)}) = ${num(Math.max(0, t))}$.`;

const skip = (s: number[], y: number) => `The right class scores $\\syms_{${y}} = ${num(s[y]!)}$. Skip it, and give every other class one term, $\\max(0,\\ \\syms_j - \\syms_{\\symy} + 1)$.`;

export const generators: Generator[] = [
  {
    id: 'loss',
    make(rng, d) {
      const n = d < 0.6 ? 3 : 4;
      for (;;) {
        const s = scores(rng, n, d);
        const y = rng.int(n);
        const ps = parts(s, y);
        const L = sumOf(ps.map((p) => p.h));
        if (L === 0) continue;
        const traps = [
          { value: L + 1, why: 'That includes the right class\'s own term, $\\max(0,\\ \\syms_{\\symy} - \\syms_{\\symy} + 1) = 1$. The sum skips $j = \\symy$.' },
          { value: sumOf(ps.map((p) => p.t)), why: 'That adds the negative terms too. Each term goes through $\\max(0, \\cdot)$, so a class far below the right one adds 0, never less.' },
          { value: sumOf(ps.map((p) => Math.max(0, p.t - 1))), why: 'That leaves out the margin. Each term is $\\syms_j - \\syms_{\\symy} + 1$: a wrong class within 1 of the right one still costs.' },
        ];
        return {
          prompt: `The scores are $\\syms = ${vec(s)}$ and the right class is $\\symy = ${y}$, counting from 0. What is the hinge loss?`,
          answer: { kind: 'number', value: L },
          traps: traps.filter((t, i) => t.value !== L && traps.findIndex((u) => u.value === t.value) === i),
          solution: [skip(s, y), ...ps.map((p) => termStep(s, y, p.j, p.t)), `Add them: $\\symL = ${terms(ps.map((p) => p.h))} = ${num(L)}$.`],
        };
      }
    },
  },
  {
    id: 'count',
    make(rng, d) {
      const n = d < 0.5 ? 3 : d < 0.9 ? 4 : 5;
      for (;;) {
        const s = scores(rng, n, Math.max(d, 0.35));
        const y = rng.int(n);
        const ps = parts(s, y);
        const k = ps.filter((p) => p.t > 0).length;
        const above = ps.filter((p) => s[p.j]! > s[y]!).length;
        // A class inside the margin (not above the right score, yet still costing) is the point of the question.
        if (above === k && (d >= 0.35 || rng.int(3) > 0)) continue;
        const traps = [
          { value: k + 1, why: 'That counts the right class too. The sum skips $j = \\symy$.' },
          { value: above, why: 'That counts only the classes scoring above the right one. A class within 1 of it, even level or just below, also adds to the loss.' },
        ];
        return {
          prompt: `The scores are $\\syms = ${vec(s)}$ and the right class is $\\symy = ${y}$, counting from 0. How many classes add a positive amount to the hinge loss?`,
          answer: { kind: 'number', value: k },
          traps: traps.filter((t) => t.value !== k),
          solution: [
            skip(s, y),
            ...ps.map((p) => `${termStep(s, y, p.j, p.t)} ${p.t > 0 ? 'It adds to the loss.' : 'It adds nothing.'}`),
            `${k === 1 ? '1 class adds' : `${k} classes add`} to the loss: every class scoring more than $${num(s[y]!)} - 1 = ${num(round(s[y]! - 1, 6))}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'zero',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const kind = pick(rng, ['clear', 'close', 'behind'] as const);
      const y = rng.int(n);
      const others = ints(rng, n - 1, -2, 4);
      const top = Math.max(...others);
      const sy = kind === 'clear' ? top + int(rng, 1, 3) : kind === 'close' ? top + 0.5 : top - int(rng, 1, 2);
      const s = [...others.slice(0, y), sy, ...others.slice(y)];
      const ps = parts(s, y);
      const worst = ps.reduce((a, b) => (b.t > a.t ? b : a));
      const j = worst.j;
      const own = 'The sum skips $j = \\symy$: only the other classes add to the loss.';
      const why: (string | null)[] =
        kind === 'clear'
          ? [null, 'It is zero, but not just because the right class wins: it wins by at least 1, as it does here.', 'Every other class is at least 1 below the right one, so every term is $\\max(0, \\cdot) = 0$.', own]
          : kind === 'close'
            ? [`Class ${j} is only $0.5$ below: $${num(s[j]!)} - ${par(sy)} + 1 = ${num(worst.t)} > 0$.`, `Winning is not enough: class ${j} is within 1 of the right class and adds $${num(worst.t)}$.`, null, `${own} Here the loss comes from class ${j}.`]
            : [`Class ${j} scores above the right class, so its term is positive.`, `The top score is class ${j}'s $${num(s[j]!)}$, not the right class's.`, null, `${own} Here the loss comes from class ${j}.`];
      const L = sumOf(ps.map((p) => p.h));
      return {
        prompt: `The scores are $\\syms = ${vec(s)}$ and the right class is $\\symy = ${y}$, counting from 0. Is the hinge loss exactly zero?`,
        answer: {
          kind: 'choice',
          options: [
            'Yes: the right class beats every other class by at least 1',
            'Yes: the right class has the highest score',
            'No: another class scores within 1 of the right class, or above it',
            'No: the right class\'s own term always adds 1',
          ],
          correct: kind === 'clear' ? 0 : 2,
          why,
        },
        solution: [skip(s, y), ...ps.map((p) => termStep(s, y, p.j, p.t)), L === 0 ? 'Every term is 0, so $\\symL = 0$: the right class beats every other by at least the margin.' : `$\\symL = ${num(L)}$, not zero: the right class has to beat every other class by at least 1.`],
      };
    },
  },
  {
    id: 'smallest',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const others = d < 0.35 ? ints(rng, n - 1, 0, 5) : d < 0.8 ? ints(rng, n - 1, -3, 6) : ints(rng, n - 1, -6, 12).map((v) => v / 2);
      const y = rng.int(n);
      const top = Math.max(...others);
      const j = others.indexOf(top) + (others.indexOf(top) >= y ? 1 : 0);
      const v = round(top + 1, 6);
      const shown = [...others.slice(0, y).map((x) => num(x)), '?', ...others.slice(y).map((x) => num(x))];
      return {
        prompt: `The scores are $\\syms = [${shown.join(',\\ ')}]$, and the right class is $\\symy = ${y}$, counting from 0. What is the smallest $\\syms_{${y}}$ that makes the hinge loss zero?`,
        answer: { kind: 'number', value: v },
        traps: [
          { value: top, why: `That only ties class ${j}: its term would be $\\max(0,\\ 0 + 1) = 1$. The right class must beat it by the margin.` },
          { value: round(top - 1, 6), why: `That is 1 below class ${j}, so its term would be $\\max(0,\\ 1 + 1) = 2$. The right class must be at least 1 above every other.` },
        ],
        solution: [
          `The loss is zero when every term $\\max(0,\\ \\syms_j - \\syms_{${y}} + 1)$ is 0, that is, when $\\syms_{${y}}$ is at least $\\syms_j + 1$ for every other class $j$.`,
          `The strictest is the highest other score, class ${j}'s $${num(top)}$: $\\syms_{${y}}$ must be at least $${par(top)} + 1 = ${num(v)}$.`,
        ],
      };
    },
  },
];
