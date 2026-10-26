import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick } from '../../kit';
import { cleanTraps, dPoly, evalPoly, paren, polyExpr, polyTex, type Term } from '../kit';

/** A polynomial whose terms have distinct powers, highest first, ending in a constant. */
function poly(rng: Rng, d: number, top = d < 0.65 ? 4 : 5, constant = d >= 0.3): Term[] {
  const nTerms = d < 0.3 ? 1 : d < 0.65 ? 2 : 3;
  const coef = () => (d < 0.3 ? int(rng, 1, 5) : int(rng, 1, 6) * (d < 0.65 && rng.int(3) ? 1 : pick(rng, [1, -1])));
  const powers = [5, 4, 3, 2, 1].filter((n) => n <= top && n >= (nTerms === 1 ? 2 : 1));
  const chosen = rng.shuffle(powers).slice(0, nTerms).sort((a, b) => b - a);
  const ts = chosen.map((n) => ({ c: coef(), n }));
  if (constant) ts.push({ c: int(rng, 1, 9) * (d < 0.65 ? 1 : pick(rng, [1, -1])), n: 0 });
  return ts;
}

/** One sentence per term: what the power rule does to it. */
function termStep(t: Term): string {
  const tex = polyTex([t]);
  if (t.n === 0) return `The constant $${tex}$ is flat: its derivative is $0$.`;
  if (t.n === 1) return `$${tex}$ is a line with slope $${t.c}$.`;
  const dt = { c: t.c * t.n, n: t.n - 1 };
  return `$${tex}$: the ${t.n} comes down and the power drops to ${t.n - 1}: $${t.n} \\times ${paren(t.c)} = ${t.c * t.n}$, so $${polyTex([dt])}$.`;
}

export const generators: Generator[] = [
  {
    id: 'power',
    make(rng, d) {
      const ts = poly(rng, d);
      const dts = dPoly(ts);
      return {
        prompt: `What is the derivative of $\\symf(\\symx) = ${polyTex(ts)}$?`,
        answer: { kind: 'expr', value: polyExpr(dts), vars: ['x'] },
        solution: [...ts.map(termStep), `${ts.length > 1 ? 'Add the pieces: ' : 'So '}$\\symf'(\\symx) = ${polyTex(dts)}$.`],
      };
    },
  },
  {
    id: 'value',
    make(rng, d) {
      const ts = poly(rng, d, 3, true);
      const x = d < 0.5 ? int(rng, 1, 2) : pick(rng, [-2, -1, 1, 2, 3]);
      const dts = dPoly(ts);
      const v = evalPoly(dts, x);
      const c0 = ts.find((t) => t.n === 0)?.c ?? 0;
      const noLower = ts.reduce((a, t) => a + (t.n > 0 ? t.c * t.n * x ** t.n : 0), 0);
      const traps = [
        { value: noLower, why: `That multiplies by the power but keeps it: $n\\symx^{n}$ instead of $n\\symx^{n-1}$. The power drops by one.` },
        { value: v + c0, why: `That keeps the constant ${c0}. A constant is flat, so its derivative is 0.` },
        { value: evalPoly(ts, x), why: `That is $\\symf(${x})$, the value of the function. The question asks for its slope.` },
      ];
      return {
        prompt: `$\\symf(\\symx) = ${polyTex(ts)}$. What is $\\symf'(${x})$?`,
        answer: { kind: 'number', value: v },
        traps: cleanTraps(traps, v),
        solution: [
          ...ts.map(termStep),
          `So $\\symf'(\\symx) = ${polyTex(dts)}$.`,
          `Put in $\\symx = ${x}$: $\\symf'(${x}) = ${dts.map((t) => `${paren(t.c)}${t.n === 0 ? '' : ` \\cdot ${paren(x)}${t.n === 1 ? '' : `^{${t.n}}`}`}`).join(' + ')}$.`,
          `$= ${dts.map((t) => paren(t.c * x ** t.n)).join(' + ')}${dts.length > 1 ? ` = ${num(v)}` : ''}$.`,
        ],
      };
    },
  },
  {
    id: 'power-pick',
    make(rng, d) {
      const kind = pick(rng, ['power', 'power', 'const']);
      const opts: [string, string | null][] = [];
      let fTex: string;
      if (kind === 'power') {
        const c = d < 0.4 ? 1 : int(rng, 2, 5);
        const n0 = int(rng, 3, 7);
        const n = n0 === c ? c + 2 : n0;
        const C = (k: number) => (k === 1 ? '' : String(k));
        fTex = `${C(c)}\\symx^{${n}}`;
        opts.push(
          [`$${c * n}\\symx^{${n - 1}}$`, null],
          [`$${c * n}\\symx^{${n}}$`, 'That brings the power down but keeps it. The power drops by one.'],
          [c === 1 ? `$\\dfrac{\\symx^{${n + 1}}}{${n + 1}}$` : `$${n}\\symx^{${n - 1}}$`, c === 1 ? 'That raises the power and divides: the power rule run backwards.' : `That drops the constant ${c}. A constant factor comes along: $${c} \\times ${n}\\symx^{${n - 1}}$.`],
          [`$${C(c)}\\symx^{${n - 1}}$`, `That lowers the power but forgets to bring the ${n} down in front.`],
        );
      } else {
        const c = int(rng, 2, 12);
        fTex = String(c);
        opts.push(
          ['$0$', null],
          [`$${c}$`, `${c} is the height of a flat line, not its slope.`],
          ['$1$', 'A slope of 1 belongs to $\\symx$ itself, which rises one for every step. A constant does not rise at all.'],
          [`$${c}\\symx$`, `That is the reverse: $${c}\\symx$ is what has slope ${c}.`],
        );
      }
      return {
        prompt: `What is the derivative of $\\symf(\\symx) = ${fTex}$?`,
        answer: { kind: 'choice', options: opts.map((o) => o[0]), correct: 0, why: opts.map((o) => o[1]) },
        solution: [
          kind === 'power' ? 'Power rule: $\\symx^{n}$ becomes $n\\symx^{n-1}$, and a constant factor comes along.' : 'A constant never changes, so its graph is flat and its slope is 0.',
          `So the derivative is ${opts[0]![0]}.`,
        ],
      };
    },
  },
];
