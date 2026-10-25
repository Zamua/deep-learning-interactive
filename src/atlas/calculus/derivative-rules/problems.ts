import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick } from '../../kit';
import { cleanTraps, dPoly, evalPoly, joinSigned, paren, polyExpr, polyTex, type Term } from '../kit';

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
    id: 'exp-log',
    make(rng, d) {
      type Piece = { tex: string; expr: string; dTex: string; dExpr: string; step: string; neg: boolean };
      const exp = (): Piece => {
        const c = d < 0.3 ? 1 : int(rng, 1, 4);
        const a = d < 0.65 ? int(rng, 2, 5) : pick(rng, [-3, -2, -1, 2, 3, 4]);
        const ca = c * a;
        const power = a === -1 ? '-x' : `${a}x`;
        const powerTex = a === -1 ? '-\\symx' : `${a}\\symx`;
        const body = `e^{${powerTex}}`;
        return {
          tex: c === 1 ? body : `${c}${body}`, expr: `${c === 1 ? '' : c}e^(${power})`,
          dTex: `${Math.abs(ca) === 1 ? '' : Math.abs(ca)}${body}`, dExpr: `${Math.abs(ca) === 1 ? '' : Math.abs(ca)}e^(${power})`,
          step: c === 1
            ? `$${body}$: the ${a} in the power comes out in front, giving $${a === -1 ? '-' : a}${body}$.`
            : `$${c}${body}$: the ${a} in the power comes out in front, so $${c} \\times ${paren(a)}${body} = ${ca}${body}$.`,
          neg: ca < 0,
        };
      };
      const log = (): Piece => {
        const c = d < 0.3 ? int(rng, 1, 3) : int(rng, 2, 9);
        return {
          tex: `${c === 1 ? '' : c}\\ln \\symx`, expr: `${c === 1 ? '' : c}ln(x)`,
          dTex: `\\dfrac{${c}}{\\symx}`, dExpr: `${c}/x`,
          step: `$${c === 1 ? '' : c}\\ln \\symx$: the derivative of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$, so this is $\\dfrac{${c}}{\\symx}$.`,
          neg: false,
        };
      };
      const pow = (): Piece => {
        const n = int(rng, 2, 4);
        const c = int(rng, 1, 5);
        const t = { c, n };
        const dt = { c: c * n, n: n - 1 };
        return { tex: polyTex([t]), expr: polyExpr([t]), dTex: polyTex([dt]), dExpr: polyExpr([dt]), step: termStep(t), neg: false };
      };
      const pieces = d < 0.3 ? [pick(rng, [exp, log])()] : d < 0.65 ? rng.shuffle([pick(rng, [exp, log]), pow]).map((f) => f()) : rng.shuffle([exp, log, pow]).map((f) => f());
      const minus = d >= 0.65 && rng.int(2) === 0 ? rng.int(pieces.length) : -1;
      const parts = pieces.map((p, i) => ({ ...p, sub: i === minus && i > 0 }));
      const tex = parts.map((p, i) => (i === 0 ? p.tex : `${p.sub ? '-' : '+'} ${p.tex}`)).join(' ');
      const dTex = joinSigned(parts.map((p) => ({ neg: p.neg !== p.sub, body: p.dTex })));
      const dExpr = joinSigned(parts.map((p) => ({ neg: p.neg !== p.sub, body: p.dExpr })));
      return {
        prompt: `What is the derivative of $\\symf(\\symx) = ${tex}$?`,
        answer: { kind: 'expr', value: dExpr, vars: ['x'] },
        solution: [...parts.map((p) => p.step + (p.sub ? ' It is subtracted, so its derivative is too.' : '')), `Together: $\\symf'(\\symx) = ${dTex}$.`],
      };
    },
  },
  {
    id: 'value',
    make(rng, d) {
      const ts = poly(rng, d, 3, true);
      const x = d < 0.5 ? int(rng, 1, 2) : pick(rng, [-2, -1, 1, 2, 3]);
      const withLn = d >= 0.6 && x > 0 && rng.int(2) === 0;
      const lnC = withLn ? x * int(rng, 1, 4) : 0;
      const dts = dPoly(ts);
      const v = evalPoly(dts, x) + (withLn ? lnC / x : 0);
      const c0 = ts.find((t) => t.n === 0)?.c ?? 0;
      const fTex = polyTex(ts) + (withLn ? ` + ${lnC}\\ln \\symx` : '');
      const noLower = ts.reduce((a, t) => a + (t.n > 0 ? t.c * t.n * x ** t.n : 0), 0) + (withLn ? lnC / x : 0);
      const fx = withLn ? null : evalPoly(ts, x);
      const traps = [
        { value: noLower, why: `That multiplies by the power but keeps it: $n\\symx^{n}$ instead of $n\\symx^{n-1}$. The power drops by one.` },
        { value: v + c0, why: `That keeps the constant ${c0}. A constant is flat, so its derivative is 0.` },
        ...(fx === null ? [] : [{ value: fx, why: `That is $\\symf(${x})$, the value of the function. The question asks for its slope.` }]),
      ];
      const dTex = polyTex(dts) + (withLn ? ` + \\dfrac{${lnC}}{\\symx}` : '');
      return {
        prompt: `$\\symf(\\symx) = ${fTex}$. What is $\\symf'(${x})$?`,
        answer: { kind: 'number', value: v },
        traps: cleanTraps(traps, v),
        solution: [
          `Differentiate term by term: $\\symf'(\\symx) = ${dTex}$.`,
          `Put in $\\symx = ${x}$: $\\symf'(${x}) = ${dts.map((t) => `${paren(t.c)}${t.n === 0 ? '' : ` \\cdot ${paren(x)}${t.n === 1 ? '' : `^{${t.n}}`}`}`).join(' + ')}${withLn ? ` + \\dfrac{${lnC}}{${x}}` : ''} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'which-rule',
    make(rng, d) {
      const kind = pick(rng, d < 0.4 ? ['power', 'exp', 'const'] : ['power', 'exp', 'ln', 'const']);
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
      } else if (kind === 'exp') {
        const a = int(rng, 2, 6);
        fTex = `e^{${a}\\symx}`;
        opts.push(
          [`$${a}e^{${a}\\symx}$`, null],
          [`$e^{${a}\\symx}$`, `$e^{\\symx}$ is its own derivative, but here the ${a} in the power comes out in front.`],
          [`$${a}\\symx\\, e^{${a}\\symx - 1}$`, 'That treats the exponential like a power of $\\symx$. The power rule needs $\\symx$ in the base, not in the exponent.'],
          [`$\\dfrac{e^{${a}\\symx}}{${a}}$`, `That divides by ${a}, which runs the rule backwards. The number in the power comes out in front as a factor.`],
        );
      } else if (kind === 'ln') {
        const c = int(rng, 2, 9);
        fTex = `${c}\\ln \\symx`;
        opts.push(
          [`$\\dfrac{${c}}{\\symx}$`, null],
          [`$${c}$`, 'That treats $\\ln \\symx$ like $\\symx$, whose slope is 1. The slope of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$.'],
          [`$${c}e^{\\symx}$`, '$e^{\\symx}$ is the inverse of $\\ln \\symx$, which undoes it. The derivative is $\\dfrac{1}{\\symx}$.'],
          [`$\\dfrac{1}{${c}\\symx}$`, `That divides by ${c} instead of multiplying. A constant factor comes along unchanged: $${c} \\cdot \\dfrac{1}{\\symx}$.`],
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
          kind === 'power' ? 'Power rule: $\\symx^{n}$ becomes $n\\symx^{n-1}$, and a constant factor comes along.'
            : kind === 'exp' ? 'The number multiplying $\\symx$ in the power comes out in front: $e^{a\\symx}$ becomes $ae^{a\\symx}$.'
            : kind === 'ln' ? 'The derivative of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$, and a constant factor comes along.'
            : 'A constant never changes, so its graph is flat and its slope is 0.',
          `So the derivative is ${opts[0]![0]}.`,
        ],
      };
    },
  },
];
