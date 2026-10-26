import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { ALPHA, C, clean, ptraps, traps } from '../kit';

/** 10^(-x) to two decimals, as the prompts give it. */
const tenTo = (x: number): number => round(10 ** -x, 2);

export const generators: Generator[] = [
  {
    id: 'slope',
    make(rng, d) {
      const alpha = pick(rng, d < 0.35 ? [0.1, 0.2] : [0.05, 0.1, 0.15, 0.2, 0.3]);
      const kmax = Math.max(1, Math.min(d < 0.35 ? 2 : 4, Math.floor(0.6 / alpha + 1e-9)));
      const k = int(rng, 1, kmax);
      const u = int(rng, 17, 22);
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
          `The rise: $${num(l2, 2)} - ${num(l1, 2)} = ${num(clean(l2 - l1), 2)}$. The run: $${u + k} - ${u} = ${k}$.`,
          `Rise over run: $${num(clean(l2 - l1), 2)} / ${k} = ${num(v, 2)}$.`,
          `So $${ALPHA} = ${num(alpha, 2)}$: the line falls ${num(alpha)} in $\\log_{10}\\symL$ for every power of ten in compute.`,
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
  {
    id: 'line',
    make(rng, d) {
      const alpha = pick(rng, d < 0.35 ? [0.1, 0.2] : [0.05, 0.1, 0.15, 0.2, 0.3]);
      const u = int(rng, 18, 23);
      const v = clean(int(rng, 2, 7) / 10 + (d < 0.35 ? 0 : int(rng, 0, 9) / 100));
      const loga = clean(v + alpha * u);
      const drop = clean(alpha * u);
      return {
        prompt: `A scaling law $\\symL = a\\,${C}^{-${ALPHA}}$ has $${ALPHA} = ${num(alpha)}$ and $\\log_{10} a = ${num(loga)}$. What is $\\log_{10} \\symL$ for a run with $${C} = 10^{${u}}$ FLOPs?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(loga + drop), why: `The power is $-${ALPHA}$, so its log is $-${ALPHA}\\log ${C}$: subtract it.` },
          { value: clean(-drop), why: `That leaves out $\\log_{10} a$, which sets the line's height.` },
          { value: clean(loga - alpha), why: `$\\log_{10} 10^{${u}} = ${u}$, so the power takes off $${num(alpha)} \\times ${u}$, not ${num(alpha)}.` },
        ]),
        solution: [
          `Take logs: $\\log \\symL = \\log a - ${ALPHA} \\log ${C}$.`,
          `$\\log_{10} 10^{${u}} = ${u}$, so $${ALPHA} \\log ${C} = ${num(alpha)} \\times ${u} = ${num(drop)}$.`,
          `$\\log_{10} \\symL = ${num(loga)} - ${num(drop)} = ${num(v)}$.`,
        ],
      };
    },
  },
];
