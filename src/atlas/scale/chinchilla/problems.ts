import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { C, D, N, big, clean, norm, sci, sciOf, traps, words } from '../kit';

/** Model sizes in billions whose compute-optimal budget, 120 N², has a clean square root. */
const SIZES = [[1, 10, 100], [2, 3, 5, 20, 30, 50], [4, 6, 7, 8, 40, 60, 70]];
const sizes = (d: number) => SIZES[d < 0.35 ? 0 : d < 0.7 ? 1 : 2]!;

/** The budget for an m-billion-parameter model trained on 20 tokens per parameter. */
const budget = (m: number): number => 120 * (m * 1e9) ** 2;

/** C / 120 one part at a time, rewritten in billions squared, then the root of each part. */
const steps = (m: number): string[] => {
  const c = norm(budget(m));
  const q = clean(c.m / 1.2);
  const e = c.e - 2;
  const sq = m * m;
  const k = 10 ** (e - 18);
  return [
    `Compute-optimal means $${D} = 20${N}$, so $${C} = 6${N}${D} = 120${N}^2$, and $${N}^2 = ${C} / 120$.`,
    `Write 120 as $1.2 \\times 10^{2}$. Leading numbers: $${num(c.m)} / 1.2 = ${num(q)}$. Powers: $10^{${c.e}} / 10^{2} = 10^{${e}}$.`,
    ...(e === 18
      ? [`So $${N}^2 = ${sci(q, e)}$, already in billions squared: $10^{9} \\times 10^{9} = 10^{18}$.`]
      : [
          `So $${N}^2 = ${sci(q, e)}$. A billion squared is $10^{18}$, and $10^{${e}} = ${big(k)} \\times 10^{18}$.`,
          `So $${N}^2 = ${q === 1 ? '' : `${num(q)} \\times `}${big(k)} \\times 10^{18}${q === 1 ? '' : ` = ${big(sq)} \\times 10^{18}`}$.`,
        ]),
    sq === 1
      ? `Its root is $10^{9}$: ${words(m * 1e9)} parameters.`
      : `Root of each part: $\\sqrt{${big(sq)}} = ${m}$ and $\\sqrt{10^{18}} = 10^{9}$, a billion. So $${N} = ${m}$ billion parameters.`,
  ];
};

export const generators: Generator[] = [
  {
    id: 'size',
    make(rng, d) {
      const m = pick(rng, sizes(d));
      return {
        prompt: `A training budget is $${C} = ${sciOf(budget(m))}$ FLOPs. How many billion parameters should a compute-optimal model have?`,
        answer: { kind: 'number', value: m },
        traps: traps(m, [{ value: 20 * m, why: `That is $${D}$, the tokens: $20${N}$. The model itself has a twentieth of that.` }]),
        solution: steps(m),
      };
    },
  },
  {
    id: 'tokens',
    make(rng, d) {
      const m = pick(rng, sizes(d));
      const v = 20 * m;
      return {
        prompt: `A training budget is $${C} = ${sciOf(budget(m))}$ FLOPs. How many billion tokens should a compute-optimal model see?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [{ value: m, why: `That is $${N}$, the parameters. The tokens are about 20 times as many: $${D} = 20${N}$.` }]),
        solution: [...steps(m), `Then $${D} = 20${N} = 20 \\times ${m}$ billion $= ${big(v)}$ billion tokens.`],
      };
    },
  },
  {
    id: 'scale-up',
    make(rng, d) {
      const k = pick(rng, d < 0.35 ? [4, 9, 16, 25, 100] : [4, 9, 16, 25, 100, 400, 10000]);
      const r = Math.sqrt(k);
      const what = rng.int(d < 0.35 ? 2 : 3);
      const ask = ['the number of parameters', 'the number of training tokens', 'the number of tokens per parameter'][what]!;
      const v = what === 2 ? 1 : r;
      const kText = k.toLocaleString('en-US');
      const kTex = big(k);
      return {
        prompt: `A compute-optimal model is trained, and then the budget grows ${kText} times. For the new compute-optimal model, by what factor should ${ask} grow?`,
        answer: { kind: 'number', value: v },
        traps: traps(
          v,
          what === 2
            ? [
                { value: r, why: `$${N}$ and $${D}$ each grow by $\\sqrt{${kTex}} = ${num(r)}$, so their ratio does not change: it stays at about 20.` },
                { value: k, why: `That would put all the new compute into tokens, with the model unchanged. $${N}$ and $${D}$ grow together, so their ratio stays at about 20.` },
              ]
            : [{ value: k, why: `That puts all ${kText} times the compute into one of them. Compute is $6${N}${D}$, so $${N}$ and $${D}$ share it: each grows by $\\sqrt{${kTex}}$.` }],
        ),
        solution: [
          `Compute-optimal means $${D} = 20${N}$, so $${C} = 120${N}^2$ and $${N} = \\sqrt{${C}/120}$: $${N}$ grows as the square root of $${C}$.`,
          `${kText} times the compute: $${N}$ grows by $\\sqrt{${kTex}} = ${num(r)}$, and $${D} = 20${N}$ grows by the same ${num(r)}.`,
          what === 2 ? 'Both grow together, so the ratio stays at about 20 tokens per parameter: a factor of 1.' : `So ${ask} grows ${num(r)} times.`,
        ],
      };
    },
  },
  {
    id: 'formula',
    make(rng) {
      const r = pick(rng, [10, 15, 25, 30, 40, 50, 60, 80]);
      const k = 6 * r;
      if (rng.int(2) === 0) {
        const options = [`$${N} = \\sqrt{${C} / ${k}}$`, `$${N} = ${C} / ${k}$`, `$${N} = \\sqrt{${C} / 6}$`, `$${N} = \\sqrt{${C} / ${r}}$`];
        const order = rng.shuffle([0, 1, 2, 3]);
        const why = [
          null,
          `That leaves out the square. $${D}$ grows with $${N}$, so $${C} = ${k}${N}^2$, and $${N}$ is its square root.`,
          `That leaves out the ${r} tokens per parameter: $${D} = ${r}${N}$ puts a factor of ${r} into the compute.`,
          `That leaves out the 6 FLOPs per parameter per token: $${C} = 6${N}${D}$.`,
        ];
        return {
          prompt: `Suppose compute-optimal training read ${r} tokens per parameter. Which gives the compute-optimal $${N}$ for a budget of $${C}$ FLOPs?`,
          answer: { kind: 'choice', options: order.map((i) => options[i]!), correct: order.indexOf(0), why: order.map((i) => why[i]!) },
          solution: [
            `Put $${D} = ${r}${N}$ into $${C} = 6${N}${D}$: $${C} = 6${N} \\times ${r}${N} = ${k}${N}^2$.`,
            `So $${N}^2 = ${C} / ${k}$, and $${N} = \\sqrt{${C} / ${k}}$.`,
          ],
        };
      }
      const options = [`$${C} = ${k}${N}^2$`, `$${C} = ${k}${N}$`, `$${C} = 6${N}^2$`, `$${C} = ${r}${N}^2$`];
      const order = rng.shuffle([0, 1, 2, 3]);
      const why = [
        null,
        `That treats the tokens as fixed. $${D} = ${r}${N}$ grows with $${N}$, so $${N}$ appears twice: $${N}^2$.`,
        `That leaves out the ${r} tokens per parameter: $${D} = ${r}${N}$, not $${N}$.`,
        `That leaves out the 6 FLOPs per parameter per token: $${C} = 6${N}${D}$.`,
      ];
      return {
        prompt: `Suppose compute-optimal training read ${r} tokens per parameter. What budget does a compute-optimal model of $${N}$ parameters take?`,
        answer: { kind: 'choice', options: order.map((i) => options[i]!), correct: order.indexOf(0), why: order.map((i) => why[i]!) },
        solution: [`Compute-optimal means $${D} = ${r}${N}$.`, `$${C} = 6${N}${D} = 6${N} \\times ${r}${N} = ${k}${N}^2$ FLOPs.`],
      };
    },
  },
];
