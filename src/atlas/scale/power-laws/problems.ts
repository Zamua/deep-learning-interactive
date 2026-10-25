import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { ALPHA, C, clean, ptraps, traps, whys } from '../kit';

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
          `The law is $${LAW}$. Multiplying $${C}$ by ${times.toLocaleString('en-US')} multiplies $${C}^{-${ALPHA}}$ by $${k === 1 ? '' : `(10^{${k}})^{-${num(alpha)}} = `}${pow(k * alpha)} \\approx ${num(f, 2)}$, and $a$ stays the same.`,
          `So the loss is multiplied by ${num(f, 2)}: $${num(L)} \\times ${num(f, 2)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'slope',
    make(rng, d) {
      const alpha = pick(rng, d < 0.35 ? [0.1, 0.2] : [0.05, 0.1, 0.15, 0.2, 0.3]);
      const kmax = Math.max(1, Math.min(d < 0.35 ? 2 : 4, Math.floor(0.6 / alpha + 1e-9)));
      const k = int(rng, 1, kmax);
      const u = int(rng, 17, 22);
      {
        const l1 = clean(int(rng, 0, 20) / 100 + 0.1 + alpha * k);
        const l2 = clean(l1 - alpha * k);
        const L1 = round(10 ** l1, 2);
        const L2 = round(10 ** l2, 2);
        const v = clean(-alpha);
        return {
          prompt: `Two runs on log-log axes: $${C} = 10^{${u}}$ FLOPs ends at loss $\\symL = ${num(L1, 2)}$, and $${C} = 10^{${u + k}}$ FLOPs ends at $\\symL = ${num(L2, 2)}$. What is the slope of the straight line through them? Round to two decimals.\n\nUse $\\log_{10} ${num(L1, 2)} \\approx ${num(l1, 2)}$ and $\\log_{10} ${num(L2, 2)} \\approx ${num(l2, 2)}$.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: ptraps(v, 2, [
            { value: alpha, why: 'The loss falls as compute grows, so the line slopes down: the slope is negative.' },
            { value: l2 - l1, why: `That is the drop in $\\log_{10}\\symL$. The run is ${k} powers of ten, so divide by ${k}.` },
            { value: (L2 - L1) / k, why: 'That uses the losses themselves. On log-log axes both coordinates are logs: use $\\log_{10}\\symL$.' },
          ]),
          solution: [
            `On log-log axes the points are $(\\log_{10}${C}, \\log_{10}\\symL)$: $(${u}, ${num(l1, 2)})$ and $(${u + k}, ${num(l2, 2)})$.`,
            `Rise over run: $\\dfrac{${num(l2, 2)} - ${num(l1, 2)}}{${u + k} - ${u}} = \\dfrac{${num(clean(l2 - l1), 2)}}{${k}} = ${num(v, 2)}$.`,
            `So $${ALPHA} = ${num(alpha, 2)}$: the loss falls by a factor of $10^{-${num(alpha)}}$ for every factor of ten in compute.`,
          ],
        };
      }
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
    id: 'shape',
    make(rng) {
      const a = pick(rng, [5, 8, 10, 12, 20, 30]);
      const alpha = pick(rng, [0.05, 0.07, 0.1, 0.15, 0.3]);
      const loglog = rng.next() < 0.6;
      const law = `$\\symL = ${a}\\,${C}^{-${num(alpha)}}$`;
      if (loglog) {
        const options = [`A straight line with slope $-${num(alpha)}$`, `A straight line with slope $-${a}$`, 'A curve that falls steeply, then flattens out', `A straight line with slope $${num(alpha)}$`];
        return {
          prompt: `Plot ${law} on log-log axes. What does it look like?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [null, `$${a}$ only sets the height: $\\log ${a}$ is where the line sits. The slope is the power, $-${num(alpha)}$.`, 'That is the picture on ordinary axes. Taking logs of both turns the power into a multiple: $\\log \\symL = \\log a - ' + `${ALPHA}\\log ${C}$, a straight line.`, 'More compute means lower loss, so the line slopes down: the slope is minus the power.'],
          },
          solution: [
            `Take $\\log_{10}$ of both sides: $\\log \\symL = \\log ${a} - ${num(alpha)} \\log ${C}$.`,
            `In $\\log ${C}$ that is a straight line, with slope $-${num(alpha)}$ and height set by $\\log ${a}$.`,
          ],
        };
      }
      const options = ['A curve that falls steeply, then ever more slowly', `A straight line with slope $-${num(alpha)}$`, 'A curve that falls faster and faster', 'A curve that reaches zero and stops'];
      return {
        prompt: `Plot ${law} on ordinary axes, with compute running from $10^{18}$ to $10^{22}$ FLOPs. What does it look like?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [null, 'Only on log-log axes. On ordinary axes, each tenfold step takes off the same fraction of a smaller loss, so the drops shrink.', 'It is the other way around: each further cut in the loss costs ten times more compute than the last.', `$${C}^{-${num(alpha)}}$ is never zero: the loss keeps falling, ever more slowly, but never reaches it.`],
        },
        solution: [
          `Each tenfold step in $${C}$ multiplies the loss by the same $10^{-${num(alpha)}} \\approx ${num(tenTo(alpha), 2)}$.`,
          'The first steps happen early, at small compute; later steps need ten times more compute each, so on ordinary axes the curve falls steeply, then flattens out.',
        ],
      };
    },
  },
];
