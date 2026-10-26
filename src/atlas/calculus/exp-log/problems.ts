import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { cleanTraps, paren } from '../kit';

/** The logs a prompt hands out, to two decimals. */
const LN: Record<number, number> = { 2: 0.69, 3: 1.1, 5: 1.61, 7: 1.95 };
const r2 = (x: number) => Math.round(x * 100) / 100;
const ln2 = (k: number) => num(LN[k]!, 2);

interface LogCase {
  form: 'prod' | 'quot' | 'pow' | 'recip' | 'triple';
  /** TeX for the argument of ln. */
  arg: string;
  /** The given logs used, by prime. */
  uses: number[];
  value: number;
  steps: string[];
  traps: { value: number; why: string }[];
}

const PRIMES = [2, 3, 5, 7];
const sumOf = (ks: number[]) => r2(ks.reduce((a, k) => a + LN[k]!, 0));

/** Every case whose answer from the given two-decimal logs matches the true log to two decimals. */
const CASES: LogCase[] = (() => {
  const out: LogCase[] = [];
  const keep = (c: LogCase, truth: number) => {
    if (r2(c.value) === r2(truth)) out.push({ ...c, value: r2(c.value), traps: cleanTraps(c.traps, r2(c.value), 2) });
  };
  for (const a of PRIMES) {
    for (const b of PRIMES) {
      if (a < b) {
        const v = sumOf([a, b]);
        keep({
          form: 'prod', arg: String(a * b), uses: [a, b], value: v,
          steps: [`Split $${a * b} = ${a} \\times ${b}$.`, `The log of a product is the sum of the logs: $\\ln ${a * b} = \\ln ${a} + \\ln ${b}$.`, `$\\approx ${ln2(a)} + ${ln2(b)} = ${num(v, 2)}$.`],
          traps: [{ value: LN[a]! * LN[b]!, why: 'That multiplies the logs. The log of a product is the sum of the logs.' }],
        }, Math.log(a * b));
        const v6 = sumOf([2, a, b]);
        if (a !== 2 && b !== 2) {
          keep({
            form: 'triple', arg: String(2 * a * b), uses: [2, a, b], value: v6,
            steps: [`Split $${2 * a * b} = 2 \\times ${a} \\times ${b}$.`, `The log of a product is the sum of the logs: $\\ln ${2 * a * b} = \\ln 2 + \\ln ${a} + \\ln ${b}$.`, `$\\approx ${ln2(2)} + ${ln2(a)} + ${ln2(b)} = ${num(v6, 2)}$.`],
            traps: [{ value: LN[2]! * LN[a]! * LN[b]!, why: 'That multiplies the logs. The log of a product is the sum of the logs.' }],
          }, Math.log(2 * a * b));
        }
        const pv = sumOf([a, b]);
        keep({
          form: 'recip', arg: `\\tfrac{1}{${a * b}}`, uses: [a, b], value: pv,
          steps: [
            `One over a number flips the sign of its log: $\\ln \\tfrac{1}{${a * b}} = -\\ln ${a * b}$.`,
            `So $-\\ln p = -(-\\ln ${a * b}) = \\ln ${a * b}$.`,
            `Split $${a * b} = ${a} \\times ${b}$: $\\ln ${a * b} = \\ln ${a} + \\ln ${b}$.`,
            `$\\approx ${ln2(a)} + ${ln2(b)} = ${num(pv, 2)}$.`,
          ],
          traps: [
            { value: -pv, why: `That is $\\ln p$ itself. A number below 1 has a negative log, and the minus sign in front makes $-\\ln p$ positive.` },
            { value: LN[a]! * LN[b]!, why: 'That multiplies the logs. The log of a product is the sum of the logs.' },
          ],
        }, Math.log(a * b));
      }
      if (a !== b) {
        const v = r2(LN[a]! - LN[b]!);
        keep({
          form: 'quot', arg: `\\tfrac{${a}}{${b}}`, uses: [a, b], value: v,
          steps: [
            `Dividing by ${b} is multiplying by $\\tfrac{1}{${b}}$: $\\ln \\tfrac{${a}}{${b}} = \\ln ${a} + \\ln \\tfrac{1}{${b}}$.`,
            `One over a number flips the sign of its log: $\\ln \\tfrac{1}{${b}} = -\\ln ${b}$.`,
            `So $\\ln \\tfrac{${a}}{${b}} = \\ln ${a} - \\ln ${b}$.`,
            `$\\approx ${ln2(a)} - ${ln2(b)} = ${num(v, 2)}$.`,
          ],
          traps: [
            { value: LN[a]! / LN[b]!, why: 'That divides the logs. The log of a quotient is the difference of the logs.' },
            { value: -v, why: `That subtracts the wrong way round: $\\ln \\tfrac{a}{b} = \\ln a - \\ln b$.` },
          ],
        }, Math.log(a / b));
      }
    }
    for (const k of [2, 3]) {
      const v = r2(k * LN[a]!);
      keep({
        form: 'pow', arg: String(a ** k), uses: [a], value: v,
        steps: [
          `Split $${a ** k}$ into ${k} equal factors: $${a ** k} = ${Array(k).fill(a).join(' \\times ')} = ${a}^{${k}}$.`,
          `So $\\ln ${a ** k} = ${Array(k).fill(`\\ln ${a}`).join(' + ')} = ${k} \\ln ${a}$: the power comes out in front.`,
          `$\\approx ${k} \\times ${ln2(a)} = ${num(v, 2)}$.`,
        ],
        traps: [{ value: LN[a]! ** k, why: `That raises the log to the power. A power inside the log comes out as a factor: $\\ln a^{${k}} = ${k} \\ln a$.` }],
      }, Math.log(a ** k));
    }
  }
  return out;
})();

const ORD = (d: number): LogCase['form'][] => (d < 0.3 ? ['prod'] : d < 0.6 ? ['prod', 'quot', 'pow'] : ['quot', 'pow', 'recip', 'triple']);

export const generators: Generator[] = [
  {
    id: 'log-rules',
    make(rng, d) {
      const pool = CASES.filter((c) => ORD(d).includes(c.form));
      const c = pick(rng, pool);
      const logs = [...new Set(c.uses)].map((k) => `$\\ln ${k} \\approx ${ln2(k)}$`);
      const given = logs.length > 2 ? `${logs.slice(0, -1).join(', ')} and ${logs[logs.length - 1]}` : logs.join(' and ');
      const ask = c.form === 'recip'
        ? `Let $p = ${c.arg}$. What is $-\\ln p$?`
        : `What is $\\ln ${c.arg}$?`;
      return {
        prompt: `Use ${given}. ${ask} Round to two decimals.`,
        answer: { kind: 'number', value: c.value, places: 2 },
        traps: c.traps,
        solution: c.steps,
      };
    },
  },
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
          neg ? `The minus sign flips it: $-\\ln p ${p === 1 ? '= 0' : `\\approx ${num(round(-lnp, 2), 2)}`}$. So $-\\ln p$ is 0 at $p = 1$ and grows as $p$ shrinks toward 0.` : 'Any number above 0 and at most 1 has a log that is never positive.',
        ],
      };
    },
  },
];
