import type { Generator } from '../../../mastery/domain/types';
import { int, pick, traps } from '../../kit';
import { joinSigned, paren } from '../kit';

const P = (v: string) => `\\frac{\\partial \\symf}{\\partial ${v}}`;

/** `3u^2`, `-uv`, `5v`: a coefficient (1 hidden) times a monomial. */
const mono = (c: number, body: string) => ({ neg: c < 0, body: Math.abs(c) === 1 && body ? body : `${Math.abs(c)}${body}` });
/** One signed term as TeX: `-2uv`. */
const term = (c: number, body: string) => joinSigned([mono(c, body)]);
/** The same term in the expression parser's syntax: `(-2)*u*v`. */
const termExpr = (c: number, body: string) => [`(${c})`, ...body.split(' ')].join('*');

export const generators: Generator[] = [
  {
    id: 'partial',
    make(rng, d) {
      const a = int(rng, 1, 3) * (d < 0.4 ? 1 : pick(rng, [1, -1]));
      const c = int(rng, 1, 4);
      const k = int(rng, 2, 6) * (d < 0.4 ? 1 : pick(rng, [1, -1]));
      const u = d < 0.4 ? int(rng, 1, 3) : int(rng, -2, 3);
      const v = d < 0.4 ? int(rng, 1, 3) : int(rng, -2, 3);
      const inU = rng.int(2) === 0;
      const du = 2 * a * u * v + k;
      const dv = a * u * u + 2 * c * v;
      const want = inU ? du : dv;
      const fTex = joinSigned([mono(a, 'u^2 v'), mono(c, 'v^2'), mono(k, 'u')]);
      const cands = inU
        ? [
            { value: dv, why: `That is the partial in $v$. The partial in $u$ holds $v$ fixed and moves only $u$.` },
            { value: 2 * a * u + k, why: `$v$ is held fixed, but it still multiplies: the partial of $${joinSigned([mono(a, 'u^2 v')])}$ in $u$ is $${joinSigned([mono(2 * a, 'uv')])}$.` },
          ]
        : [
            { value: du, why: `That is the partial in $u$. The partial in $v$ holds $u$ fixed and moves only $v$.` },
            { value: dv + k * u, why: `That keeps the $${joinSigned([mono(k, 'u')])}$ term. It does not move when only $v$ moves, so its partial in $v$ is 0.` },
          ];
      return {
        prompt: `$\\symf(u, v) = ${fTex}$. What is $${P(inU ? 'u' : 'v')}$ at $(u, v) = (${u}, ${v})$?`,
        answer: { kind: 'number', value: want },
        traps: traps(want, cands),
        solution: inU
          ? [
              `Hold $v$ fixed. $${term(a, 'u^2 v')}$ is $${term(a, 'v')}$ times $u^2$, so it gives $${term(a, 'v')} \\cdot 2u = ${term(2 * a, 'uv')}$.`,
              `$${term(c, 'v^2')}$ has no $u$, so it gives 0.`,
              `$${term(k, 'u')}$ gives $${k}$.`,
              `So $${P('u')} = ${joinSigned([mono(2 * a, 'uv'), mono(k, '')])}$.`,
              `At $(${u}, ${v})$: $${2 * a} \\cdot ${paren(u)} \\cdot ${paren(v)} ${k < 0 ? '-' : '+'} ${Math.abs(k)} = ${du}$.`,
            ]
          : [
              `Hold $u$ fixed. $${term(a, 'u^2 v')}$ is $${term(a, 'u^2')}$ times $v$, so it gives $${term(a, 'u^2')}$.`,
              `$${term(c, 'v^2')}$ gives $${term(2 * c, 'v')}$.`,
              `$${term(k, 'u')}$ has no $v$, so it gives 0.`,
              `So $${P('v')} = ${joinSigned([mono(a, 'u^2'), mono(2 * c, 'v')])}$.`,
              `At $(${u}, ${v})$: $${a} \\cdot ${paren(u)}^{2} + ${2 * c} \\cdot ${paren(v)} = ${dv}$.`,
            ],
      };
    },
  },
  {
    id: 'term',
    make(rng, d) {
      const w = pick(rng, ['u', 'v']);
      const o = w === 'u' ? 'v' : 'u';
      const k = int(rng, 2, 5) * (d < 0.4 ? 1 : pick(rng, [1, -1]));
      const kind = pick(rng, d < 0.3 ? ['uv', 'other'] : ['uv', 'u2v', 'other']);
      const n = pick(rng, [1, 2]);
      const pw = (x: string) => (n === 2 ? `${x}^2` : x);
      const body = kind === 'uv' ? 'uv' : kind === 'u2v' ? 'u^2 v' : pw(o);
      const T = term(k, body);
      const itself = { tex: T, why: `That is the term itself, not how fast it changes as $${w}$ moves.` };
      const zero = { tex: '0', why: `Only a term with no $${w}$ in it gives 0. This one changes as $${w}$ moves.` };
      let right: string;
      let wrong: { tex: string; why: string }[];
      let solution: string[];
      if (kind === 'uv') {
        right = term(k, o);
        wrong = [
          { tex: term(k, w), why: `That is what it gives in $${o}$. Here $${o}$ is held, a number multiplying $${w}$, so the term gives $${right}$.` },
          { tex: String(k), why: `That drops the held $${o}$. Held fixed, it is still a number multiplying $${w}$, so it stays: $${right}$.` },
          zero,
          itself,
        ];
        solution = [
          `For $${P(w)}$, hold $${o}$ fixed: it acts as a number.`,
          `So $${T}$ is $${right}$ times $${w}$.`,
          `A number times $${w}$ gives that number: $${right}$.`,
        ];
      } else if (kind === 'u2v' && w === 'u') {
        right = term(2 * k, 'uv');
        wrong = [
          { tex: term(2 * k, 'u'), why: `That drops the held $v$. It still multiplies, so the term gives $${term(k, 'v')} \\cdot 2u = ${right}$.` },
          { tex: term(k, 'u^2'), why: `That is what it gives in $v$. In $u$, it is $${term(k, 'v')}$ times $u^2$, so it gives $${right}$.` },
          zero,
          itself,
        ];
        solution = [
          `For $${P('u')}$, hold $v$ fixed: it acts as a number.`,
          `So $${T}$ is $${term(k, 'v')}$ times $u^2$.`,
          `$u^2$ gives $2u$, so the term gives $${term(k, 'v')} \\cdot 2u = ${right}$.`,
        ];
      } else if (kind === 'u2v') {
        right = term(k, 'u^2');
        wrong = [
          { tex: term(2 * k, 'uv'), why: `That is what it gives in $u$. In $v$, $${right}$ is held, a number multiplying $v$, so the term gives $${right}$.` },
          { tex: String(k), why: `That drops the held $u^2$. Held fixed, it is still a number multiplying $v$, so it stays: $${right}$.` },
          zero,
          itself,
        ];
        solution = [
          `For $${P('v')}$, hold $u$ fixed: $${right}$ acts as a number.`,
          `So $${T}$ is $${right}$ times $v$.`,
          `A number times $v$ gives that number: $${right}$.`,
        ];
      } else {
        right = '0';
        const slope = n === 2 ? term(2 * k, o) : String(k);
        wrong = [
          { tex: slope, why: `That is its slope in $${o}$. In $${P(w)}$, $${o}$ is held, so the term does not change: it gives 0.` },
          { tex: T, why: `That keeps the term. With $${o}$ held it is a constant, and a constant gives 0.` },
          { tex: n === 2 ? term(2 * k, w) : term(k, w), why: `That treats the term as if it were in $${w}$. It has no $${w}$, so it gives 0.` },
        ];
        solution = [
          `For $${P(w)}$, hold $${o}$ fixed. $${T}$ has no $${w}$ in it.`,
          `So it does not change as $${w}$ moves: it is a constant.`,
          'A constant gives 0.',
        ];
      }
      const picked = rng.shuffle(wrong).slice(0, 3);
      // The rest of f: terms of other shapes, so the asked-about term is the only one of its kind.
      const others = rng.shuffle(['u^2', 'v^2', 'u', 'v', 'uv', 'u^2 v'].filter((b) => b !== body)).slice(0, 2);
      const parts = rng.shuffle([body, ...others]).map((b) => (b === body ? mono(k, b) : mono(int(rng, 1, 4) * (d < 0.4 ? 1 : pick(rng, [1, -1])), b)));
      return {
        prompt: `$\\symf(u, v) = ${joinSigned(parts)}$. In $${P(w)}$, what does the term $${T}$ give?`,
        answer: {
          kind: 'choice',
          options: [right, ...picked.map((x) => x.tex)].map((x) => `$${x}$`),
          correct: 0,
          why: [null, ...picked.map((x) => x.why)],
        },
        solution,
      };
    },
  },
  {
    id: 'formula',
    make(rng, d) {
      const sg = () => (d < 0.4 ? 1 : pick(rng, [1, -1]));
      const a = int(rng, 1, 4) * sg();
      const b = int(rng, 1, 5) * sg();
      const c = int(rng, 1, 6) * sg();
      const e = d >= 0.6 && rng.int(2) === 0 ? int(rng, 1, 3) * sg() : 0;
      const inU = rng.int(2) === 0;
      const fTex = joinSigned([mono(a, 'u^2'), mono(b, 'uv'), mono(c, 'v'), ...(e ? [mono(e, 'v^2')] : [])]);
      const ans = inU ? [mono(2 * a, 'u'), mono(b, 'v')] : [mono(b, 'u'), mono(c, ''), ...(e ? [mono(2 * e, 'v')] : [])];
      const expr = inU ? [termExpr(2 * a, 'u'), termExpr(b, 'v')] : [termExpr(b, 'u'), `(${c})`, ...(e ? [termExpr(2 * e, 'v')] : [])];
      const solution = inU
        ? [
            'Hold $v$ fixed and take $\\symf$ one term at a time.',
            `$${term(a, 'u^2')}$ gives $${term(2 * a, 'u')}$.`,
            `$${term(b, 'uv')}$ is $${term(b, 'v')}$ times $u$, so it gives $${term(b, 'v')}$.`,
            e ? `$${term(c, 'v')}$ and $${term(e, 'v^2')}$ have no $u$, so they give 0.` : `$${term(c, 'v')}$ has no $u$, so it gives 0.`,
            `So $${P('u')} = ${joinSigned(ans)}$.`,
          ]
        : [
            'Hold $u$ fixed and take $\\symf$ one term at a time.',
            `$${term(a, 'u^2')}$ has no $v$, so it gives 0.`,
            `$${term(b, 'uv')}$ is $${term(b, 'u')}$ times $v$, so it gives $${term(b, 'u')}$.`,
            `$${term(c, 'v')}$ gives $${c}$.`,
            ...(e ? [`$${term(e, 'v^2')}$ gives $${term(2 * e, 'v')}$.`] : []),
            `So $${P('v')} = ${joinSigned(ans)}$.`,
          ];
      return {
        prompt: `$\\symf(u, v) = ${fTex}$. What is $${P(inU ? 'u' : 'v')}$?`,
        answer: { kind: 'expr', value: expr.join(' + '), vars: ['u', 'v'] },
        solution,
      };
    },
  },
];
