import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { ALPHA, C, clean, ptraps, traps } from '../kit';

/** 10^(-x) to two decimals, as the prompts give it. */
const tenTo = (x: number): number => round(10 ** -x, 2);
const pow = (x: number) => `10^{-${num(clean(x))}}`;
const LAW = `\\symL = a\\,${C}^{-${ALPHA}}`;

export const generators: Generator[] = [
  {
    id: 'tenfold',
    make(rng, d) {
      const alpha = pick(rng, d < 0.35 ? [0.1, 0.2, 0.3] : [0.05, 0.1, 0.15, 0.2, 0.3]);
      const top = d < 0.35 ? 1 : d < 0.7 ? 2 : 3;
      const k = int(rng, 1, top);
      const L = int(rng, 20, 45) / 10;
      const f = tenTo(k * alpha);
      const v = clean(L * f);
      const given = Array.from({ length: top }, (_, i) => `$${pow((i + 1) * alpha)} \\approx ${num(tenTo((i + 1) * alpha), 2)}$`);
      const times = 10 ** k;
      const tr = [
        { value: L * (1 - alpha * k), why: `That takes $${ALPHA}$ as a share of the loss, cutting ${num(alpha * 100)}% per factor of ten. The law multiplies by $10^{-${ALPHA}}$ instead: ${num(f, 2)} here.` },
        { value: L - alpha * k, why: `That subtracts $${ALPHA}$ from the loss itself. The line drops by $${ALPHA}$ in $\\log_{10}$ units, which multiplies the loss by $10^{-${ALPHA}}$.` },
      ];
      if (k > 1) tr.push({ value: L * tenTo(alpha), why: `That is one factor of ten. ${times.toLocaleString('en-US')} times the compute is ${k} factors of ten: use $${pow(k * alpha)}$.` });
      return {
        prompt: `A family of models follows a scaling law with $${ALPHA} = ${num(alpha)}$. One run ends at loss $\\symL = ${num(L)}$. What loss does a run with ${times.toLocaleString('en-US')} times its compute reach? Round to two decimals.\n\nUse ${given.join(top > 2 ? ', ' : ' and ')}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: ptraps(v, 2, tr),
        solution: [
          `In $${LAW}$, each factor of ten in $${C}$ multiplies the loss by $10^{-${ALPHA}} = ${pow(alpha)}$.`,
          k === 1
            ? `${times} times the compute is one factor of ten: the loss is multiplied by $${pow(alpha)} \\approx ${num(f, 2)}$.`
            : `${times.toLocaleString('en-US')} times the compute is ${k} factors of ten. Multiplying adds the powers: $${Array(k).fill(pow(alpha)).join(' \\times ')} = ${pow(k * alpha)} \\approx ${num(f, 2)}$.`,
          `So the loss becomes $${num(L)} \\times ${num(f, 2)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'decades',
    make(rng, d) {
      const f = pick(rng, [0.5, 0.7, 0.8, 0.9]);
      const m = d < 0.35 ? 2 : pick(rng, d < 0.7 ? [2, 3] : [2, 3, 4]);
      const r = clean(f ** m);
      const v = 10 ** m;
      const fromLoss = d >= 0.5;
      const L = int(rng, 2, 5);
      const target = clean(L * r);
      const goal = fromLoss ? `The loss is now $${L}$. How many times more compute brings it to $${num(target)}$?` : `How many times more compute multiplies the loss by $${num(r)}$?`;
      return {
        prompt: `Every time the compute is multiplied by 10, the loss is multiplied by $${num(f)}$. ${goal}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: 10 * m, why: `That adds 10 for each factor of ${num(f)}. Each factor costs another ten times the compute, so they multiply: $10^{${m}}$.` },
          { value: m, why: `${m} is how many factors of ${num(f)} it takes. Each one needs ten times the compute: $10^{${m}}$ in all.` },
        ]),
        solution: [
          ...(fromLoss ? [`The loss has to be multiplied by $${num(target)} / ${L} = ${num(r)}$.`] : []),
          `$${num(r)} = ${Array(m).fill(num(f)).join(' \\times ')}$: ${m} factors of $${num(f)}$.`,
          `Each factor needs ten times the compute, so ${m} of them need $10^{${m}} = ${v.toLocaleString('en-US')}$ times.`,
        ],
      };
    },
  },
  {
    id: 'next-step',
    make(rng, d) {
      for (;;) {
        const f = pick(rng, d < 0.35 ? [0.5, 0.8] : [0.5, 0.6, 0.7, 0.8, 0.9]);
        const L0 = d < 0.35 ? int(rng, 2, 5) : int(rng, 20, 50) / 10;
        const L1 = clean(L0 * f);
        const v = round(L1 * f, 2);
        const same = round(2 * L1 - L0, 2);
        const twice = round(L1 * f * f, 2);
        const vals = [v, same, twice];
        if (new Set(vals).size < 3 || same < 0) continue;
        const order = rng.shuffle([0, 1, 2]);
        const options = order.map((i) => `$${num(vals[i]!)}$`);
        const reasons = [
          null,
          `That takes the same ${num(clean(L0 - L1))} off again. Each tenfold step multiplies the loss by the same ${num(f)}, so the drops shrink.`,
          `That multiplies by ${num(f)} twice. 100 times the original compute is 10 times what took the loss to ${num(L1)}: one more step.`,
        ];
        return {
          prompt: `In a family of models, every tenfold step in compute multiplies the loss by the same factor. Ten times the compute took one run's loss from $${num(L0)}$ to $${num(L1)}$. What loss does 100 times the original compute reach?`,
          answer: { kind: 'choice', options, correct: order.indexOf(0), why: order.map((i) => reasons[i]!) },
          solution: [
            `The factor per tenfold step: $${num(L1)} / ${num(L0)} = ${num(f)}$.`,
            `100 times the original compute is one more tenfold step past $${num(L1)}$.`,
            `$${num(L1)} \\times ${num(f)} = ${num(clean(L1 * f))}$${v === clean(L1 * f) ? '' : `, about $${num(v)}$`}.`,
          ],
        };
      }
    },
  },
];
