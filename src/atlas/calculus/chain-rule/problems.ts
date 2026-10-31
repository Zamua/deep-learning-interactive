import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, traps } from '../../kit';
import { paren, polyExpr, polyTex } from '../kit';

const D = (top: string, bot: string) => `\\frac{d${top}}{d${bot}}`;
const DZDX = D('z', '\\symx');
/** The inside `ax + b` as TeX and as an answer. */
const inner = (a: number, b: number) => ({ tex: polyTex([{ c: a, n: 1 }, { c: b, n: 0 }]), expr: polyExpr([{ c: a, n: 1 }, { c: b, n: 0 }]) });
/** `base` to the power k, as TeX; the power 1 left unwritten. */
const pow = (base: string, k: number) => (k === 1 ? base : `${base}^{${k}}`);

export const generators: Generator[] = [
  {
    id: 'expr',
    make(rng, d) {
      const form = pick(rng, d < 0.3 ? ['pow', 'ln'] : ['pow', 'exp', 'ln']);
      const a = d < 0.3 ? int(rng, 2, 4) : int(rng, 2, 5) * (d >= 0.65 && rng.int(3) === 0 ? -1 : 1);
      const b = d < 0.3 ? int(rng, 1, 5) : int(rng, 1, 7) * (d >= 0.65 ? pick(rng, [1, -1]) : 1);
      const ins = inner(a, b);
      /** Name the inside, take each slope, multiply, then put the inside back in for u. */
      const steps = (inTex: string, zOfU: string, dIn: string, dOut: string, product: string, back: string) => [
        `Call it $z$ and name the inside $u = ${inTex}$. Then $z = ${zOfU}$.`,
        `The inside's slope: $${D('u', '\\symx')} = ${dIn}$.`,
        `The outside's slope: $${D('z', 'u')} = ${dOut}$.`,
        `Multiply them: $${D('z', '\\symx')} = ${product}$.`,
        `Put the inside back in for $u$: $${D('z', '\\symx')} = ${back}$.`,
      ];
      if (form === 'pow') {
        const n = d < 0.3 ? int(rng, 2, 3) : int(rng, 2, 5);
        const k = n * a;
        const uPow = n - 1 === 1 ? 'u' : `u^{${n - 1}}`;
        const rest = n - 1 === 1 ? `(${ins.tex})` : `(${ins.tex})^{${n - 1}}`;
        const restExpr = n - 1 === 1 ? `(${ins.expr})` : `(${ins.expr})^${n - 1}`;
        return {
          prompt: `What is the derivative of $(${ins.tex})^{${n}}$ with respect to $\\symx$?`,
          answer: { kind: 'expr', value: `${k}${restExpr}`, vars: ['x'] },
          solution: steps(ins.tex, `u^{${n}}`, String(a), `${n}${uPow}`, `${n}${uPow} \\cdot ${paren(a)} = ${k}${uPow}`, `${k}${rest}`),
        };
      }
      if (form === 'exp') {
        const c = d < 0.65 ? int(rng, 1, 3) : pick(rng, [-2, -1, 1, 2, 3]);
        const pw = polyTex([{ c, n: 2 }]);
        const pwE = polyExpr([{ c, n: 2 }]);
        const k = 2 * c;
        const kx = polyTex([{ c: k, n: 1 }]);
        return {
          prompt: `What is the derivative of $e^{${pw}}$ with respect to $\\symx$?`,
          answer: { kind: 'expr', value: `${k}x e^(${pwE})`, vars: ['x'] },
          solution: steps(pw, 'e^{u}', kx, 'e^{u}', `e^{u} \\cdot ${k < 0 ? `(${kx})` : kx}`, `${kx}\\, e^{${pw}}`),
        };
      }
      return {
        prompt: `What is the derivative of $\\ln(${ins.tex})$ with respect to $\\symx$?`,
        answer: { kind: 'expr', value: `${a}/(${ins.expr})`, vars: ['x'] },
        solution: steps(ins.tex, '\\ln u', String(a), '\\dfrac{1}{u}', `\\dfrac{1}{u} \\cdot ${paren(a)} = \\dfrac{${a}}{u}`, `\\dfrac{${a}}{${ins.tex}}`),
      };
    },
  },
  {
    id: 'at-x',
    make(rng, d) {
      const form = pick(rng, d < 0.35 ? ['pow', 'ln'] : d < 0.65 ? ['pow', 'ln', 'powSq', 'lnSq'] : ['pow', 'ln', 'powSq', 'lnSq', 'exp']);
      /** The worked steps: name the inside, take both slopes, multiply, put the inside back, then evaluate. */
      const steps = (inTex: string, zOfU: string, dIn: string, dOut: string, product: string, back: string, at: string) => [
        `Name the inside $u = ${inTex}$. Then $z = ${zOfU}$.`,
        `The inside's slope: $${D('u', '\\symx')} = ${dIn}$.`,
        `The outside's slope: $${D('z', 'u')} = ${dOut}$.`,
        `Multiply them: $${DZDX} = ${product}$.`,
        `Put the inside back in for $u$: $${DZDX} = ${back}$.`,
        at,
      ];
      const ask = (zTex: string, x0: number) => `For $z = ${zTex}$, what is $${DZDX}$ at $\\symx = ${x0}$?`;
      const noInside = { why: "That is the outside's slope alone. It still has to be multiplied by the inside's slope." };
      const xForU = { why: "That puts $\\symx$ into the outside's slope. The outside sees $u$, so its slope is taken at the inside's value." };
      if (form === 'exp') {
        const c = pick(rng, [1, 2, -1]);
        const x0 = pick(rng, [1, -1]);
        const E = c === 1 ? 2.72 : c === 2 ? 7.39 : 0.37;
        const pw = polyTex([{ c, n: 2 }]);
        const k = 2 * c;
        const kx = polyTex([{ c: k, n: 1 }]);
        const want = round(k * x0 * E, 2);
        const eC = c === 1 ? 'e' : `e^{${c}}`;
        return {
          prompt: `${ask(`e^{${pw}}`, x0)} Use $${eC} \\approx ${E}$.`,
          answer: { kind: 'number', value: want, places: 2 },
          traps: traps(want, [
            { value: E, ...noInside },
            { value: k * x0, why: `That is the inside's slope alone. It still has to be multiplied by the outside's slope, $e^{u}$ at $u = ${c}$.` },
          ]),
          solution: steps(pw, 'e^{u}', kx, 'e^{u}', `e^{u} \\cdot ${k < 0 ? `(${kx})` : kx}`, `${kx}\\, e^{${pw}}`, `At $\\symx = ${x0}$, the inside is $${c}$: $${k} \\cdot ${paren(x0)} \\cdot ${eC} \\approx ${k * x0} \\times ${E} = ${num(want)}$.`),
        };
      }
      if (form === 'ln' || form === 'lnSq') {
        if (form === 'ln') {
          const a = int(rng, 2, 4) * (d >= 0.65 && rng.int(3) === 0 ? -1 : 1);
          const u0 = pick(rng, [1, 2, 4, 5, 10]);
          let x0 = d < 0.35 ? int(rng, 0, 2) : int(rng, -2, 2);
          if (u0 === a * x0) x0 -= 1;
          const ins = inner(a, u0 - a * x0).tex;
          const want = a / u0;
          return {
            prompt: ask(`\\ln(${ins})`, x0),
            answer: { kind: 'number', value: want },
            traps: traps(want, [{ value: 1 / u0, ...noInside }, { value: a / x0, ...xForU }]),
            solution: steps(ins, '\\ln u', String(a), '\\dfrac{1}{u}', `\\dfrac{1}{u} \\cdot ${paren(a)} = \\dfrac{${a}}{u}`, `\\dfrac{${a}}{${ins}}`, `At $\\symx = ${x0}$, the inside is $${u0}$: $\\dfrac{${a}}{${u0}} = ${num(want)}$.`),
          };
        }
        const x0 = pick(rng, [1, 2, -1, -2]);
        const u0 = pick(rng, Math.abs(x0) === 1 ? [2, 4, 5, 8, 10] : [5, 8, 10]);
        const ins = polyTex([{ c: 1, n: 2 }, { c: u0 - x0 * x0, n: 0 }]);
        const want = (2 * x0) / u0;
        return {
          prompt: ask(`\\ln(${ins})`, x0),
          answer: { kind: 'number', value: want },
          traps: traps(want, [
            { value: 1 / u0, ...noInside },
            { value: 2 / u0, why: `The inside's slope is $2\\symx$, which is $${2 * x0}$ at $\\symx = ${x0}$, not 2.` },
            { value: 2 / x0, ...xForU },
          ]),
          solution: steps(ins, '\\ln u', '2\\symx', '\\dfrac{1}{u}', '\\dfrac{1}{u} \\cdot 2\\symx = \\dfrac{2\\symx}{u}', `\\dfrac{2\\symx}{${ins}}`, `At $\\symx = ${x0}$, the inside is $${u0}$: $\\dfrac{${2 * x0}}{${u0}} = ${num(want)}$.`),
        };
      }
      if (form === 'pow') {
        const a = int(rng, 2, 4) * (d >= 0.65 && rng.int(3) === 0 ? -1 : 1);
        const n = d < 0.35 ? 2 : pick(rng, [2, 3]);
        const u0 = pick(rng, n === 3 ? [-2, -1, 1, 2, 3] : d < 0.35 ? [1, 2, 3, 4, 5] : [-3, -2, -1, 1, 2, 3, 4, 5]);
        let x0 = d < 0.35 ? int(rng, 0, 2) : int(rng, -2, 2);
        if (u0 === a * x0) x0 -= 1;
        const ins = inner(a, u0 - a * x0).tex;
        const outer = n * u0 ** (n - 1);
        const want = outer * a;
        const uPow = pow('u', n - 1);
        return {
          prompt: ask(`(${ins})^{${n}}`, x0),
          answer: { kind: 'number', value: want },
          traps: traps(want, [{ value: outer, ...noInside }, { value: n * x0 ** (n - 1) * a, ...xForU }]),
          solution: steps(ins, `u^{${n}}`, String(a), `${n}${uPow}`, `${n}${uPow} \\cdot ${paren(a)} = ${n * a}${uPow}`, `${n * a}${pow(`(${ins})`, n - 1)}`, `At $\\symx = ${x0}$, the inside is $${u0}$: $${n * a} \\cdot ${pow(paren(u0), n - 1)} = ${want}$.`),
        };
      }
      const x0 = pick(rng, [-2, -1, 1, 2]);
      const n = Math.abs(x0) === 1 ? pick(rng, [2, 3]) : 2;
      const b = int(rng, 1, 3);
      const u0 = x0 * x0 + b;
      const ins = polyTex([{ c: 1, n: 2 }, { c: b, n: 0 }]);
      const outer = n * u0 ** (n - 1);
      const want = outer * 2 * x0;
      const uPow = pow('u', n - 1);
      return {
        prompt: ask(`(${ins})^{${n}}`, x0),
        answer: { kind: 'number', value: want },
        traps: traps(want, [
          { value: outer, ...noInside },
          { value: outer * 2, why: `The inside's slope is $2\\symx$, which is $${2 * x0}$ at $\\symx = ${x0}$, not 2.` },
          { value: n * x0 ** (n - 1) * 2 * x0, ...xForU },
        ]),
        solution: steps(ins, `u^{${n}}`, '2\\symx', `${n}${uPow}`, `${n}${uPow} \\cdot 2\\symx = ${2 * n}\\symx\\, ${uPow}`, `${2 * n}\\symx${pow(`(${ins})`, n - 1)}`, `At $\\symx = ${x0}$, the inside is $${u0}$: $${2 * n} \\cdot ${paren(x0)} \\cdot ${pow(String(u0), n - 1)} = ${want}$.`),
      };
    },
  },
  {
    id: 'form',
    make(rng, d) {
      const form = pick(rng, ['pow', 'exp', 'ln']);
      const a = int(rng, 2, 5);
      const b = int(rng, 1, 7) * (d >= 0.5 ? pick(rng, [1, -1]) : 1);
      const ins = inner(a, b).tex;
      const noInside = "That leaves out the inside's slope. The chain rule multiplies the outside's slope by it.";
      const xForU = "That puts $\\symx$ back in for $u$. It is the inside that goes back in for $u$.";
      let fTex: string;
      let right: string;
      let wrong: [string, string][];
      let solution: string[];
      if (form === 'pow') {
        const n = int(rng, 2, d < 0.5 ? 3 : 5);
        const p = (k: number) => pow(`(${ins})`, k);
        fTex = p(n);
        right = `${n * a}${p(n - 1)}`;
        wrong = [
          [`${n}${p(n - 1)}`, noInside],
          [`${n * a}${pow('\\symx', n - 1)}`, xForU],
          [`${a}${p(n)}`, `That leaves the outside as it is. Its slope is $${n}${pow('u', n - 1)}$, not $${pow('u', n)}$.`],
        ];
        solution = [
          `Name the inside $u = ${ins}$. Then $z = u^{${n}}$.`,
          `The inside's slope is $${a}$. The outside's slope is $${n}${pow('u', n - 1)}$.`,
          `Multiply: $${n}${pow('u', n - 1)} \\cdot ${a} = ${n * a}${pow('u', n - 1)}$.`,
          `Put the inside back in for $u$: $${right}$.`,
        ];
      } else if (form === 'exp') {
        const c = int(rng, 1, 3) * (d >= 0.65 ? pick(rng, [1, -1]) : 1);
        const pw = polyTex([{ c, n: 2 }]);
        const kx = polyTex([{ c: 2 * c, n: 1 }]);
        fTex = `e^{${pw}}`;
        right = `${kx}\\, e^{${pw}}`;
        wrong = [
          [`e^{${pw}}`, noInside],
          [`${kx}\\, e^{\\symx}`, xForU],
          [`e^{${kx}}`, `That takes the slope of the power and leaves $e$ around it. The outside, $e^{u}$, has slope $e^{u}$, which is then multiplied by $${kx}$.`],
        ];
        solution = [
          `Name the inside $u = ${pw}$. Then $z = e^{u}$.`,
          `The inside's slope is $${kx}$. The outside's slope is $e^{u}$.`,
          `Multiply: $e^{u} \\cdot ${2 * c < 0 ? `(${kx})` : kx}$.`,
          `Put the inside back in for $u$: $${right}$.`,
        ];
      } else {
        fTex = `\\ln(${ins})`;
        right = `\\frac{${a}}{${ins}}`;
        wrong = [
          [`\\frac{1}{${ins}}`, noInside],
          [`\\frac{${a}}{\\symx}`, xForU],
          [`${a}\\ln(${ins})`, "That leaves the outside, $\\ln u$, as it is. Its slope is $\\frac{1}{u}$."],
        ];
        solution = [
          `Name the inside $u = ${ins}$. Then $z = \\ln u$.`,
          `The inside's slope is $${a}$. The outside's slope is $\\frac{1}{u}$.`,
          `Multiply: $\\frac{1}{u} \\cdot ${a} = \\frac{${a}}{u}$.`,
          `Put the inside back in for $u$: $${right}$.`,
        ];
      }
      return {
        prompt: `Which is the derivative of $${fTex}$ with respect to $\\symx$?`,
        answer: { kind: 'choice', options: [right, ...wrong.map(([t]) => t)].map((t) => `$${t}$`), correct: 0, why: [null, ...wrong.map(([, w]) => w)] },
        solution,
      };
    },
  },
];
