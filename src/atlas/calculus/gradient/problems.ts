import type { Generator } from '../../../mastery/domain/types';
import { int, pick, vec } from '../../kit';
import { cleanTraps, joinSigned, paren } from '../kit';

const P = (v: string) => `\\frac{\\partial \\symf}{\\partial ${v}}`;

/** `3u^2`, `-uv`, `5v`: a coefficient (1 hidden) times a monomial. */
const mono = (c: number, body: string) => ({ neg: c < 0, body: Math.abs(c) === 1 && body ? body : `${Math.abs(c)}${body}` });
/** One signed term as TeX: `-2uv`. */
const term = (c: number, body: string) => joinSigned([mono(c, body)]);

export const generators: Generator[] = [
  {
    id: 'at-point',
    make(rng, d) {
      const sg = () => (d < 0.4 ? 1 : pick(rng, [1, -1]));
      const a = int(rng, 1, 3) * sg();
      const b = int(rng, 1, 4) * sg();
      const c = int(rng, 1, 6) * sg();
      const e = d >= 0.7 ? int(rng, 1, 2) * sg() : 0;
      const u = d < 0.4 ? int(rng, 1, 3) : int(rng, -2, 3);
      const v = d < 0.4 ? int(rng, 1, 3) : int(rng, -2, 3);
      const fu = 2 * a * u + b * v;
      const fv = b * u + c + 2 * e * v;
      const fTex = joinSigned([mono(a, 'u^2'), mono(b, 'uv'), mono(c, 'v'), ...(e ? [mono(e, 'v^2')] : [])]);
      const duTex = joinSigned([mono(2 * a, 'u'), mono(b, 'v')]);
      const dvTex = joinSigned([mono(b, 'u'), { neg: c < 0, body: String(Math.abs(c)) }, ...(e ? [mono(2 * e, 'v')] : [])]);
      const sub = (parts: [number, number | null][]) => parts.map(([k, x], i) => `${i ? (k < 0 ? ' - ' : ' + ') : k < 0 ? '-' : ''}${Math.abs(k)}${x === null ? '' : ` \\cdot ${paren(x)}`}`).join('');
      const noU = e ? `$${term(c, 'v')}$ and $${term(e, 'v^2')}$ have no $u$, so they give 0.` : `$${term(c, 'v')}$ has no $u$, so it gives 0.`;
      const traps = [
        { value: [2 * a * u, fv], why: `That leaves out what $${term(b, 'uv')}$ gives in $u$. With $v$ held, it is $${term(b, 'v')}$ times $u$, so it gives $${term(b, 'v')}$.` },
        { value: [fu, c + 2 * e * v], why: `That leaves out what $${term(b, 'uv')}$ gives in $v$. With $u$ held, it is $${term(b, 'u')}$ times $v$, so it gives $${term(b, 'u')}$.` },
        { value: [fv, fu], why: `That swaps the entries. $\\nabla \\symf$ lists $${P('u')}$ first, then $${P('v')}$.` },
      ];
      return {
        prompt: `For $\\symf(u, v) = ${fTex}$, what is $\\nabla \\symf$ at $(u, v) = (${u}, ${v})$?`,
        answer: { kind: 'vector', value: [fu, fv] },
        traps: traps.filter((t, i) => t.value.join() !== [fu, fv].join() && traps.findIndex((o) => o.value.join() === t.value.join()) === i),
        solution: [
          `For $${P('u')}$, hold $v$ fixed. $${term(a, 'u^2')}$ gives $${term(2 * a, 'u')}$.`,
          `$${term(b, 'uv')}$ is $${term(b, 'v')}$ times $u$, with $v$ held, so it gives $${term(b, 'v')}$.`,
          noU,
          `So $${P('u')} = ${duTex} = ${sub([[2 * a, u], [b, v]])} = ${fu}$.`,
          `For $${P('v')}$, hold $u$ fixed. $${term(a, 'u^2')}$ has no $v$, so it gives 0.`,
          `$${term(b, 'uv')}$ is $${term(b, 'u')}$ times $v$, with $u$ held, so it gives $${term(b, 'u')}$.`,
          `$${term(c, 'v')}$ gives $${c}$.`,
          ...(e ? [`$${term(e, 'v^2')}$ gives $${term(2 * e, 'v')}$.`] : []),
          `So $${P('v')} = ${dvTex} = ${sub([[b, u], [c, null], ...(e ? [[2 * e, v] as [number, number]] : [])])} = ${fv}$.`,
          `Stack them: $\\nabla \\symf = ${vec([fu, fv])}$.`,
        ],
      };
    },
  },
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
      const traps = inU
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
        traps: cleanTraps(traps, want),
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
    id: 'downhill',
    make(rng, d) {
      let gu = int(rng, 1, 5) * pick(rng, [1, -1]);
      let gv = int(rng, 1, 5) * pick(rng, [1, -1]);
      if (Math.abs(gu) === Math.abs(gv)) gv += gv > 0 ? 1 : -1;
      if (d >= 0.6 && rng.int(2) === 0) [gu, gv] = [gu / 2, gv / 2];
      const raise = rng.int(3) === 0;
      const g = [gu, gv];
      const minus = [-gu, -gv];
      const perp = [-gv, gu];
      const big = Math.abs(gu) > Math.abs(gv) ? [-gu, 0] : [0, -gv];
      const options = raise ? [vec(g), vec(minus), vec(perp), vec(big.map((x) => -x))] : [vec(minus), vec(g), vec(perp), vec(big)];
      const why = raise
        ? [
            null,
            'That is against the gradient: the direction in which $\\symf$ falls fastest.',
            'That is at a right angle to the gradient, along a level line, where $\\symf$ barely changes.',
            'That moves only along the larger component. It does raise $\\symf$, but not as fast as the full gradient direction.',
          ]
        : [
            null,
            'That is the gradient itself, which points uphill: a step that way raises $\\symf$.',
            'That is at a right angle to the gradient, along a level line, where $\\symf$ barely changes.',
            'That moves only along the larger component. It does lower $\\symf$, but not as fast as the full direction against the gradient.',
          ];
      return {
        prompt: `At a point, $\\nabla \\symf = ${vec(g)}$. A small step in which direction ${raise ? 'raises' : 'lowers'} $\\symf$ fastest?`,
        answer: { kind: 'choice', options: options.map((o) => `$${o}$`), correct: 0, why },
        solution: [
          'The gradient points in the direction where $\\symf$ rises fastest.',
          raise ? `So to raise $\\symf$, step along it: $${vec(g)}$.` : `So to lower $\\symf$, step against it: $-\\nabla \\symf = ${vec(minus)}$.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const C = pick(rng, [3, 10, 100, 5, 1000]);
      const D = pick(rng, [4, 3072, 784, 512, 20, 64]);
      const flat = d >= 0.4 && rng.int(3) === 0;
      const [sym, shape, what] = flat ? ['\\symw', [C], 'a vector $\\symw$'] : ['\\symW', [C, D], 'a matrix $\\symW$'];
      const tex = shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`;
      return {
        prompt: `$\\symf$ turns ${what} of shape $${tex}$ into a single number. What is the shape of $\\frac{\\partial \\symf}{\\partial ${sym}}$?`,
        answer: { kind: 'shape', value: shape },
        solution: [
          `The gradient holds one partial derivative for every entry of $${sym}$: how $\\symf$ changes when that one entry is nudged.`,
          `So it has exactly the shape of $${sym}$: $${tex}$.`,
          'A step can then subtract it entry by entry.',
        ],
      };
    },
  },
];
