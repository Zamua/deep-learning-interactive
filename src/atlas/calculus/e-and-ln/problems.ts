import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { cleanTraps, paren } from '../kit';

export const generators: Generator[] = [
  {
    id: 'undo',
    make(rng, d) {
      const forms = d < 0.35 ? ['lnexp', 'explni', 'const'] : d < 0.7 ? ['lnexp', 'neglog', 'lnprod', 'expsum'] : ['lnexp', 'neglog', 'lnprod', 'expsum'];
      const form = pick(rng, forms);
      const a = d < 0.35 ? int(rng, 1, 6) : d < 0.7 ? int(rng, -5, 6) || 2 : round(int(rng, -40, 40) / 10, 1) || 1.5;
      if (form === 'const') {
        const which = rng.int(3);
        if (which === 0) {
          return {
            prompt: 'What is $\\ln 1$?',
            answer: { kind: 'number', value: 0 },
            traps: [{ value: 1, why: '$\\ln 1$ asks which power of $e$ gives 1. That is 0, since $e^{0} = 1$.' }],
            solution: ['$\\ln 1$ asks: $e$ to what power gives 1?', '$e^{0} = 1$, so $\\ln 1 = 0$.'],
          };
        }
        if (which === 1) {
          return {
            prompt: 'What is $e^{0}$?',
            answer: { kind: 'number', value: 1 },
            traps: [{ value: 0, why: 'Any number to the power 0 is 1, not 0.' }],
            solution: ['Any nonzero number to the power 0 is 1.', 'So $e^{0} = 1$, which is also why $\\ln 1 = 0$.'],
          };
        }
        return {
          prompt: 'What is $\\ln e$?',
          answer: { kind: 'number', value: 1 },
          traps: [{ value: 0, why: 'That is $\\ln 1$. $\\ln e$ asks which power of $e$ gives $e$: the first.' }],
          solution: ['$\\ln e$ asks: $e$ to what power gives $e$?', '$e^{1} = e$, so $\\ln e = 1$.'],
        };
      }
      if (form === 'lnexp') {
        const v = a;
        return {
          prompt: `What is $\\ln(e^{${num(a)}})$?`,
          answer: { kind: 'number', value: v },
          traps: Math.abs(a) <= 4 ? [{ value: round(Math.exp(a), 2), why: `That is $e^{${num(a)}}$ itself. The log undoes the exponential and leaves the power.` }] : [],
          solution: [`$\\ln$ asks: $e$ to what power gives $e^{${num(a)}}$?`, `The power ${num(a)}, so $\\ln(e^{${num(a)}}) = ${num(a)}$.`],
        };
      }
      if (form === 'explni') {
        const b = int(rng, 2, 12);
        return {
          prompt: `What is $e^{\\ln ${b}}$?`,
          answer: { kind: 'number', value: b },
          traps: [{ value: round(Math.log(b), 2), why: `That is $\\ln ${b}$ alone. Raising $e$ to it gives back ${b}.` }],
          solution: [`$\\ln ${b}$ is the power of $e$ that gives ${b}.`, `Raise $e$ to that power and you get ${b} back: $e^{\\ln ${b}} = ${b}$.`],
        };
      }
      if (form === 'neglog') {
        const k = Math.abs(a);
        return {
          prompt: `Let $p = e^{-${num(k)}}$. What is $-\\ln p$?`,
          answer: { kind: 'number', value: k },
          traps: [{ value: -k, why: `That is $\\ln p$. The minus sign in front flips it: $-(-${num(k)}) = ${num(k)}$.` }],
          solution: [`$\\ln p = \\ln(e^{-${num(k)}}) = -${num(k)}$.`, `So $-\\ln p = ${num(k)}$.`],
        };
      }
      if (form === 'lnprod') {
        const b = d < 0.7 ? int(rng, 1, 5) : round(int(rng, 1, 30) / 10, 1);
        const v = round(a + b, 1);
        const traps = [{ value: round(a * b, 2), why: 'That multiplies the powers. Multiplying exponentials adds their powers.' }];
        return {
          prompt: `What is $\\ln(e^{${num(a)}} \\cdot e^{${num(b)}})$?`,
          answer: { kind: 'number', value: v },
          traps: cleanTraps(traps, v),
          solution: [`Multiplying exponentials adds the powers: $e^{${num(a)}} \\cdot e^{${num(b)}} = e^{${num(a)} + ${num(b)}} = e^{${num(v)}}$.`, `$\\ln$ undoes the exponential: $\\ln(e^{${num(v)}}) = ${num(v)}$.`],
        };
      }
      const p = int(rng, 2, 5);
      const q = int(rng, 2, 6);
      const v = p * q;
      return {
        prompt: `What is $e^{\\ln ${p} + \\ln ${q}}$?`,
        answer: { kind: 'number', value: v },
        traps: p + q !== v ? [{ value: p + q, why: `That adds ${p} and ${q}. A sum in the power is a product of exponentials, so the logs undo into $${p} \\times ${q}$.` }] : [],
        solution: [`A sum in the power is a product: $e^{\\ln ${p} + \\ln ${q}} = e^{\\ln ${p}} \\cdot e^{\\ln ${q}}$.`, `Each factor undoes its log: $${p} \\times ${q} = ${v}$.`],
      };
    },
  },
  {
    id: 'exp-power',
    make(rng, d) {
      const form = d < 0.35 ? 'prod' : pick(rng, d < 0.7 ? ['prod', 'quot', 'pow'] : ['quot', 'pow', 'triple']);
      const n = (lo: number, hi: number) => (d < 0.7 ? int(rng, lo, hi) : round(int(rng, lo * 2, hi * 2) / 2, 1));
      const a = d < 0.35 ? int(rng, 1, 6) : n(-4, 6) || 3;
      const b = d < 0.35 ? int(rng, 1, 6) : n(-4, 6) || -2;
      const E = (v: number) => `e^{${num(v)}}`;
      if (form === 'prod' || form === 'triple') {
        const c = form === 'triple' ? n(-3, 4) || 1 : 0;
        const v = round(a + b + c, 1);
        const shown = form === 'triple' ? `${E(a)} \\cdot ${E(b)} \\cdot ${E(c)}` : `${E(a)} \\cdot ${E(b)}`;
        const sum = (form === 'triple' ? [a, b, c] : [a, b]).map((x, i) => (i ? paren(num(x)) : num(x))).join(' + ');
        const traps = [{ value: round(form === 'triple' ? a * b * c : a * b, 2), why: 'That multiplies the powers. Multiplying exponentials adds their powers.' }];
        return {
          prompt: `What number goes in the box: $${shown} = e^{\\square}$?`,
          answer: { kind: 'number', value: v },
          traps: cleanTraps(traps, v),
          solution: [
            `Multiplying exponentials adds their powers: $${shown} = e^{${sum}}$.`,
            `$${sum} = ${num(v)}$.`,
          ],
        };
      }
      if (form === 'quot') {
        const v = round(a - b, 1);
        const traps = [{ value: round(b - a, 1), why: 'That subtracts the wrong way round: the bottom power is taken away from the top one.' }];
        if (b !== 0 && Number.isInteger(a / b)) traps.push({ value: round(a / b, 2), why: 'That divides the powers. Dividing exponentials subtracts their powers.' });
        return {
          prompt: `What number goes in the box: $\\dfrac{${E(a)}}{${E(b)}} = e^{\\square}$?`,
          answer: { kind: 'number', value: v },
          traps: cleanTraps(traps, v),
          solution: [
            `Dividing exponentials subtracts the bottom power from the top one: $\\dfrac{${E(a)}}{${E(b)}} = e^{${num(a)} - ${paren(num(b))}}$.`,
            `$${num(a)} - ${paren(num(b))} = ${num(v)}$.`,
          ],
        };
      }
      const k = int(rng, 2, 4);
      const v = round(a * k, 1);
      return {
        prompt: `What number goes in the box: $(${E(a)})^{${k}} = e^{\\square}$?`,
        answer: { kind: 'number', value: v },
        traps: [{ value: round(a + k, 1), why: `That adds ${k} to the power. Raising to the power ${k} multiplies ${k} copies together, so the power is multiplied by ${k}.` }].filter((t) => t.value !== v),
        solution: [
          `$(${E(a)})^{${k}}$ is ${k} copies of $${E(a)}$ multiplied together: $${Array(k).fill(E(a)).join(' \\cdot ')}$.`,
          `Multiplying adds the powers: $e^{${Array(k).fill(paren(num(a))).join(' + ')}}$.`,
          `Adding the same power ${k} times is multiplying it by ${k}: $${k} \\times ${paren(num(a))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'meaning',
    make(rng, d) {
      if (rng.int(2) === 0) {
        const a = pick(rng, [-1, 2, 3, 4]);
        const down = a > 0 && rng.int(2) === 1;
        const from = down ? a + 1 : a;
        const to = down ? a : a + 1;
        const E = (x: number) => round(Math.exp(x), 2);
        const v = E(from);
        const e = 2.72;
        const opts = down
          ? [E(to), round(v - e, 2), round(v - 1, 2), round(v / 2, 2)]
          : [E(to), round(v + e, 2), round(v + 1, 2), round(v * 2, 2)];
        return {
          prompt: `$e^{${from}} \\approx ${num(v, 2)}$. About what is $e^{${to}}$?`,
          answer: {
            kind: 'choice',
            options: opts.map((x) => `About $${num(x, 2)}$`),
            correct: 0,
            why: [
              null,
              down ? 'That subtracts $e$. Each step down in the power divides by $e$, about 2.72.' : 'That adds $e$. Each step up in the power multiplies by $e$, about 2.72.',
              down ? 'That treats $e^{x}$ like $x$: one less in, one less out. The exponential divides by $e$ instead.' : 'That treats $e^{x}$ like $x$: one more in, one more out. The exponential multiplies by $e$ instead.',
              down ? 'That halves, which is how $2^{x}$ shrinks. $e^{x}$ divides by $e$, about 2.72, per step.' : 'That doubles, which is how $2^{x}$ grows. $e^{x}$ multiplies by $e$, about 2.72, per step.',
            ],
          },
          solution: [
            `Going from $e^{${from}}$ to $e^{${to}}$ ${down ? 'removes' : 'adds'} one factor of $e \\approx 2.72$.`,
            `$${num(v, 2)} ${down ? '\\div' : '\\times'} 2.72 \\approx ${num(E(to), 2)}$.`,
          ],
        };
      }
      const p = pick(rng, d < 0.5 ? [0.5, 0.3, 0.2, 0.1, 0.9, 1] : [0.75, 0.05, 0.01, 0.99, 0.4, 1, 0.25]);
      const neg = rng.int(2) === 1;
      const lnp = Math.log(p);
      const v = neg ? -lnp : lnp;
      const correct = v < 0 ? 0 : v === 0 ? 2 : 1;
      const q = neg ? `-\\ln p` : `\\ln p`;
      const why = (i: number): string | null => {
        if (i === correct) return null;
        if (i === 3) return '$\\ln$ is defined for every positive number; only 0 and below have no log.';
        if (p === 1) return `$\\ln 1 = 0$, since $e^{0} = 1$, so $${q} = 0$.`;
        return neg
          ? `$\\ln ${num(p)}$ is negative, because $${num(p)}$ is below 1, and the minus sign in front makes it positive.`
          : `$${num(p)}$ is below 1, and only a negative power of $e$ gives a number below 1, so its log is negative.`;
      };
      return {
        prompt: `Let $p = ${num(p)}$. What is the sign of $${q}$?`,
        answer: { kind: 'choice', options: ['Negative', 'Positive', 'Zero', 'Undefined'], correct, why: [0, 1, 2, 3].map(why) },
        solution: [
          p === 1 ? '$e^{0} = 1$, so $\\ln 1 = 0$.' : `$${num(p)}$ is below 1, and $e$ to a negative power is below 1, so $\\ln ${num(p)} \\approx ${num(round(lnp, 2), 2)}$ is negative.`,
          neg ? `The minus sign flips it: $-\\ln p ${p === 1 ? '= 0' : `\\approx ${num(round(-lnp, 2), 2)}`}$${p === 1 ? '' : ', which is positive'}.` : 'Any number above 0 and at most 1 has a log that is never positive.',
        ],
      };
    },
  },
];
