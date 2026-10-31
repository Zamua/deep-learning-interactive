import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, traps } from '../../kit';
import { dPoly, evalPoly, joinSigned, paren, polyExpr, polyTex, type Term } from '../kit';

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
        solution: [...parts.map((p) => p.step + (p.sub ? ' It is subtracted, so its derivative is too.' : '')), `${parts.length > 1 ? 'Together' : 'So'}: $\\symf'(\\symx) = ${dTex}$.`],
      };
    },
  },
  {
    id: 'which-rule',
    make(rng, d) {
      const kind = pick(rng, d < 0.4 ? ['exp', 'ln'] : ['exp', 'ln', 'power']);
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
      } else {
        const c = int(rng, 2, 9);
        fTex = `${c}\\ln \\symx`;
        opts.push(
          [`$\\dfrac{${c}}{\\symx}$`, null],
          [`$${c}$`, 'That treats $\\ln \\symx$ like $\\symx$, whose slope is 1. The slope of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$.'],
          [`$${c}e^{\\symx}$`, '$e^{\\symx}$ is the inverse of $\\ln \\symx$, which undoes it. The derivative is $\\dfrac{1}{\\symx}$.'],
          [`$\\dfrac{1}{${c}\\symx}$`, `That divides by ${c} instead of multiplying. A constant factor comes along unchanged: $${c} \\cdot \\dfrac{1}{\\symx}$.`],
        );
      }
      return {
        prompt: `What is the derivative of $\\symf(\\symx) = ${fTex}$?`,
        answer: { kind: 'choice', options: opts.map((o) => o[0]), correct: 0, why: opts.map((o) => o[1]) },
        solution: [
          kind === 'power' ? 'Power rule: $\\symx^{n}$ becomes $n\\symx^{n-1}$, and a constant factor comes along.'
            : kind === 'exp' ? 'The number multiplying $\\symx$ in the power comes out in front: $e^{a\\symx}$ becomes $ae^{a\\symx}$.'
            : 'The derivative of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$, and a constant factor comes along.',
          `So the derivative is ${opts[0]![0]}.`,
        ],
      };
    },
  },
  {
    id: 'slope-at',
    make(rng, d) {
      const sign = () => (d >= 0.7 ? pick(rng, [1, -1]) : 1);
      const pow: Term | null = d >= 0.35 ? { c: int(rng, 1, 4) * sign(), n: int(rng, 1, 2) } : null;
      const C = (k: number) => (Math.abs(k) === 1 ? '' : String(Math.abs(k)));
      if (rng.int(2) === 0) {
        const x = int(rng, 1, d < 0.35 ? 3 : 4);
        const k = int(rng, 1, 4) * sign();
        const c = k * x;
        const dPow = pow ? evalPoly(dPoly([pow]), x) : 0;
        const v = dPow + k;
        const lnPart = { neg: c < 0, body: `${C(c)}\\ln \\symx` };
        const fTex = joinSigned([...(pow ? [{ neg: pow.c < 0, body: polyTex([{ ...pow, c: Math.abs(pow.c) }]) }] : []), lnPart]);
        const dTex = joinSigned([...(pow ? [{ neg: pow.c < 0, body: polyTex(dPoly([{ ...pow, c: Math.abs(pow.c) }])) }] : []), { neg: c < 0, body: `\\dfrac{${Math.abs(c)}}{\\symx}` }]);
        const cands = [
          { value: dPow + c, why: `That treats $\\ln \\symx$ like $\\symx$, whose slope is 1. The slope of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$.` },
          { value: dPow + c * x, why: `That multiplies by $\\symx$. The slope of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$, so divide by ${x}.` },
        ];
        return {
          prompt: `$\\symf(\\symx) = ${fTex}$. What is $\\symf'(${x})$?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, cands),
          solution: [
            ...(pow ? [termStep(pow)] : []),
            `$${c < 0 ? '-' : ''}${C(c)}\\ln \\symx$: the derivative of $\\ln \\symx$ is $\\dfrac{1}{\\symx}$, so this is $${c < 0 ? '-' : ''}\\dfrac{${Math.abs(c)}}{\\symx}$.`,
            `So $\\symf'(\\symx) = ${dTex}$.`,
            `Put in $\\symx = ${x}$: ${pow ? `$${num(dPow)}$ from the first term, and ` : ''}$\\dfrac{${c}}{${x}} = ${k}$${pow ? `, so $\\symf'(${x}) = ${num(dPow)} + ${paren(k)} = ${num(v)}$` : `, so $\\symf'(${x}) = ${num(v)}$`}.`,
          ],
        };
      }
      const a = d < 0.35 ? int(rng, 2, 5) : pick(rng, d < 0.7 ? [2, 3, 4, 5] : [-3, -2, 2, 3, 4]);
      const c = d < 0.35 ? int(rng, 1, 3) : int(rng, 1, 4) * sign();
      const ca = c * a;
      // At 0 a linear term keeps its slope and x² contributes nothing.
      const dPow = pow && pow.n === 1 ? pow.c : 0;
      const v = ca + dPow;
      const body = `e^{${a}\\symx}`;
      const fTex = joinSigned([{ neg: c < 0, body: `${C(c)}${body}` }, ...(pow ? [{ neg: pow.c < 0, body: polyTex([{ ...pow, c: Math.abs(pow.c) }]) }] : [])]);
      const dTex = joinSigned([{ neg: ca < 0, body: `${Math.abs(ca)}${body}` }, ...(pow ? dPoly([pow]).map((t) => ({ neg: t.c < 0, body: polyTex([{ ...t, c: Math.abs(t.c) }]) })) : [])]);
      const cands = [
        { value: c + dPow, why: `That leaves the ${a} where it was. The number multiplying $\\symx$ in the power comes out in front: $${body}$ becomes $${a}${body}$.` },
        { value: c, why: `That is $\\symf(0)$, the height at 0. The question asks for the slope.` },
      ];
      return {
        prompt: `$\\symf(\\symx) = ${fTex}$. What is $\\symf'(0)$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, cands),
        solution: [
          `$${c < 0 ? '-' : ''}${C(c)}${body}$: the ${a} in the power comes out in front: $${paren(c)} \\times ${paren(a)} = ${ca}$, so $${ca}${body}$.`,
          ...(pow ? [termStep(pow)] : []),
          `So $\\symf'(\\symx) = ${dTex}$.`,
          `Put in $\\symx = 0$: $e^{0} = 1$, so $\\symf'(0) = ${ca}${pow ? ` + ${paren(dPow)}` : ''}${pow ? ` = ${v}` : ''}$.`,
        ],
      };
    },
  },
];
