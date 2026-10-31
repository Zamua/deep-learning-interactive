import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, traps } from '../../kit';
import { paren } from '../kit';

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
    if (r2(c.value) === r2(truth)) out.push({ ...c, value: r2(c.value), traps: traps(r2(c.value), c.traps, 2) });
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
    id: 'which-log',
    make(rng, d) {
      const form = pick(rng, d < 0.35 ? ['prod', 'quot'] : d < 0.7 ? ['prod', 'quot', 'pow', 'recip'] : ['quot', 'pow', 'recip', 'mixed']);
      const [a, b] = rng.shuffle([2, 3, 5, 6, 7, 10, 11]).slice(0, 2) as [number, number];
      let arg: string;
      let opts: [string, string | null][];
      let steps: string[];
      if (form === 'prod') {
        arg = `(${a} \\cdot ${b})`;
        opts = [
          [`$\\ln ${a} + \\ln ${b}$`, null],
          [`$\\ln ${a} \\cdot \\ln ${b}$`, 'That multiplies the logs. The log of a product is the sum of the logs.'],
          [`$\\ln(${a} + ${b})$`, 'That turns the product inside into a sum. The sum belongs outside: one $\\ln$ for each factor.'],
          [`$${a} \\ln ${b}$`, `That treats ${a} as a power. Only a power comes out in front: $\\ln ${b}^{${a}} = ${a} \\ln ${b}$.`],
        ];
        steps = [`The log of a product is the sum of the logs: $\\ln(ab) = \\ln a + \\ln b$.`, `So $\\ln(${a} \\cdot ${b}) = \\ln ${a} + \\ln ${b}$.`];
      } else if (form === 'quot') {
        arg = `\\tfrac{${a}}{${b}}`;
        opts = [
          [`$\\ln ${a} - \\ln ${b}$`, null],
          [`$\\dfrac{\\ln ${a}}{\\ln ${b}}$`, 'That divides the logs. The log of a quotient is the difference of the logs.'],
          [`$\\ln ${b} - \\ln ${a}$`, 'That subtracts the wrong way round: the bottom log is taken from the top one.'],
          [`$\\ln ${a} + \\ln ${b}$`, `That is $\\ln(${a} \\cdot ${b})$. Dividing by ${b} subtracts its log.`],
        ];
        steps = [`Dividing by ${b} is multiplying by $\\tfrac{1}{${b}}$, whose log is $-\\ln ${b}$.`, `So $\\ln \\tfrac{${a}}{${b}} = \\ln ${a} - \\ln ${b}$.`];
      } else if (form === 'pow') {
        const k = int(rng, 2, 4);
        const base = a === k ? b : a;
        arg = `${base}^{${k}}`;
        opts = [
          [`$${k} \\ln ${base}$`, null],
          [`$(\\ln ${base})^{${k}}$`, 'That raises the log to the power. A power inside the log comes out in front as a factor.'],
          [`$${base} \\ln ${k}$`, `That swaps the base and the power. The power ${k} comes out; the base ${base} stays inside.`],
          [`$\\ln ${base} + \\ln ${k}$`, `That is $\\ln(${base} \\cdot ${k})$. $${base}^{${k}}$ is ${k} factors of ${base}, not ${base} times ${k}.`],
        ];
        steps = [`$${base}^{${k}}$ is ${k} equal factors: $\\ln ${base}^{${k}} = ${Array(k).fill(`\\ln ${base}`).join(' + ')}$.`, `That is $${k} \\ln ${base}$: the power comes out in front.`];
      } else if (form === 'recip') {
        arg = `\\tfrac{1}{${a}}`;
        opts = [
          [`$-\\ln ${a}$`, null],
          [`$\\dfrac{1}{\\ln ${a}}$`, 'That flips the log itself. One over a number flips the sign of its log.'],
          [`$\\ln ${a}$`, `That drops the sign. $\\tfrac{1}{${a}}$ is below 1, so its log is negative.`],
          [`$\\ln ${a} - \\ln 1$`, `That subtracts the wrong way round: $\\ln \\tfrac{1}{${a}} = \\ln 1 - \\ln ${a}$.`],
        ];
        steps = [`$${a} \\cdot \\tfrac{1}{${a}} = 1$ and $\\ln 1 = 0$, so $\\ln ${a} + \\ln \\tfrac{1}{${a}} = 0$.`, `So $\\ln \\tfrac{1}{${a}} = -\\ln ${a}$.`];
      } else {
        arg = `\\tfrac{${a}^{2}}{${b}}`;
        opts = [
          [`$2 \\ln ${a} - \\ln ${b}$`, null],
          [`$2(\\ln ${a} - \\ln ${b})$`, `That doubles $\\ln ${b}$ too. Only ${a} is squared, so only its log is doubled.`],
          [`$\\dfrac{2 \\ln ${a}}{\\ln ${b}}$`, 'That divides the logs. The log of a quotient is the difference of the logs.'],
          [`$(\\ln ${a})^{2} - \\ln ${b}$`, 'That squares the log. A power inside the log comes out in front as a factor.'],
        ];
        steps = [
          `The quotient becomes a difference: $\\ln \\tfrac{${a}^{2}}{${b}} = \\ln ${a}^{2} - \\ln ${b}$.`,
          `The power comes out in front: $\\ln ${a}^{2} = 2 \\ln ${a}$.`,
          `So it is $2 \\ln ${a} - \\ln ${b}$.`,
        ];
      }
      return {
        prompt: `Which is equal to $\\ln ${arg}$?`,
        answer: { kind: 'choice', options: opts.map((o) => o[0]), correct: 0, why: opts.map((o) => o[1]) },
        solution: steps,
      };
    },
  },
  {
    id: 'small-p',
    make(rng, d) {
      const pool = d < 0.35 ? [0.9, 0.8, 0.5, 0.3, 0.2, 0.1] : [1, 0.99, 0.9, 0.75, 0.6, 0.5, 0.25, 0.1, 0.05, 0.01];
      const ps = rng.shuffle([...pool]).slice(0, d < 0.5 ? 3 : 4);
      const sorted = [...ps].sort((x, y) => y - x);
      const item = (p: number) => `$-\\ln ${num(p)}$`;
      const val = (p: number) => (p === 1 ? '$-\\ln 1 = 0$' : `$-\\ln ${num(p)} \\approx ${num(round(-Math.log(p), 2), 2)}$`);
      return {
        prompt: `Order from smallest to largest: ${ps.map(item).join(', ')}.`,
        answer: { kind: 'order', items: sorted.map(item) },
        solution: [
          `Every number here is at most 1, so its log is at most 0, and the minus sign in front makes $-\\ln p$ at least 0.`,
          'The smaller $p$ is, the more negative its log, so the bigger $-\\ln p$.',
          `So the order runs from the biggest $p$ to the smallest: ${sorted.map(val).join(', ')}.`,
        ],
      };
    },
  },
];
