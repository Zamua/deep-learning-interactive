import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { BETA, choose, clean, LN, minus, PI, REF, SIG, traps, useSig } from '../kit';

const YW = '\\sym{yw}{y_w}';
const YL = '\\sym{yl}{y_l}';
const IMP = (y: string) => `${BETA} \\ln\\dfrac{${PI}(${y})}{${REF}(${y})}`;

/** A whole answer's log-probability: a few tokens' worth, in tenths when harder. */
const logp = (rng: Rng, d: number): number => (d < 0.35 ? -int(rng, 5, 30) : -int(rng, 50, 400) / 10);

/** Log-probabilities of an answer under the policy and the reference, `gap` apart. */
function pair(rng: Rng, d: number, gap: number): [number, number] {
  const ref = logp(rng, d);
  return [clean(ref + gap), ref];
}

const lnSig = (zs: number[]) => [...new Set(zs.map(SIG))].sort((x, y) => y - x).map((p) => `$\\ln ${num(p, 2)} \\approx ${num(LN(p), 2)}$`).join(', ');

export const generators: Generator[] = [
  {
    id: 'implicit',
    make(rng, d) {
      const beta = pick(rng, d < 0.35 ? [0.1, 0.5, 1] : [0.1, 0.2, 0.05, 0.5]);
      const gap = d < 0.35 ? pick(rng, [1, 2, 3, 4, -2, -1]) : pick(rng, [1.5, 2.4, -0.8, 3.2, -2.5, 0.6, 4]);
      const [lp, lr] = pair(rng, d, gap);
      const v = clean(beta * gap);
      return {
        prompt: `An answer $y$ has $\\ln ${PI}(y) = ${num(lp)}$ and $\\ln ${REF}(y) = ${num(lr)}$. With $${BETA} = ${num(beta)}$, what is DPO's implicit reward for it?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: gap, why: `That is the log-ratio without $${BETA}$. The implicit reward scales it by $${BETA} = ${num(beta)}$.` },
          { value: -v, why: `That subtracts the wrong way round: the model being trained goes on top, so the reward is positive when it likes $y$ more than the reference does.` },
          { value: clean(beta * lp), why: `That uses $\\ln ${PI}(y)$ alone. The reward measures it against the reference: subtract $\\ln ${REF}(y)$.` },
        ]),
        solution: [
          `The implicit reward is $${IMP('y')}$, and the log of the ratio is the difference of the logs: $${minus(lp, lr)} = ${num(gap)}$.`,
          `Times $${BETA}$: $${num(beta)} \\times ${gap < 0 ? `(${num(gap)})` : num(gap)} = ${num(v)}$.`,
          v > 0 ? 'Positive: the model now likes this answer more than the reference does.' : 'Negative: the model now likes this answer less than the reference does.',
        ],
      };
    },
  },
  {
    id: 'loss',
    make(rng, d) {
      const beta = pick(rng, d < 0.5 ? [0.1, 0.5] : [0.1, 0.2, 0.5]);
      for (;;) {
        const gw = d < 0.5 ? int(rng, -2, 5) : int(rng, -30, 50) / 10;
        const gl = d < 0.5 ? int(rng, -4, 2) : int(rng, -40, 20) / 10;
        const m = clean(beta * (gw - gl));
        if (Math.abs(m) > 3 || m === 0 || Math.abs(clean(m * 10) % 1) > 1e-9) continue;
        const v = -LN(SIG(m));
        const full = d >= 0.5;
        const [w1, w0] = pair(rng, d, gw);
        const [l1, l0] = pair(rng, d, gl);
        const given = full
          ? `A preference pair has $\\ln ${PI}(${YW}) = ${num(w1)}$, $\\ln ${REF}(${YW}) = ${num(w0)}$, $\\ln ${PI}(${YL}) = ${num(l1)}$ and $\\ln ${REF}(${YL}) = ${num(l0)}$.`
          : `A preference pair has $\\ln\\dfrac{${PI}(${YW})}{${REF}(${YW})} = ${num(gw)}$ and $\\ln\\dfrac{${PI}(${YL})}{${REF}(${YL})} = ${num(gl)}$.`;
        return {
          prompt: `${given} With $${BETA} = ${num(beta)}$, what is the DPO loss on this pair? Round to two decimals.\n\nUse ${useSig([m, -m])}, ${lnSig([m, -m])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(
            v,
            [
              { value: -LN(SIG(-m)), why: 'That swaps the two answers. The chosen answer\'s implicit reward comes first.' },
              { value: m, why: 'That is the margin inside the sigmoid. The loss is $-\\ln\\sigma$ of it.' },
              { value: SIG(m), why: 'That is $\\sigma$ of the margin: the probability the model gives the labeler\'s choice. The loss is minus its log.' },
            ],
            2,
          ),
          solution: [
            `The loss is $-\\ln\\sigma\\big(${IMP(YW)} - ${IMP(YL)}\\big)$.`,
            ...(full ? [`The log-ratios: chosen $${minus(w1, w0)} = ${num(gw)}$, rejected $${minus(l1, l0)} = ${num(gl)}$.`] : []),
            `The margin: $${BETA}$ times their difference, $${num(beta)} \\times (${minus(gw, gl)}) = ${num(m)}$.`,
            `$\\sigma(${num(m)}) \\approx ${num(SIG(m), 2)}$, so the loss is $-\\ln ${num(SIG(m), 2)} \\approx ${num(v, 2)}$.${m < 0 ? ' Large: the model still favors the rejected answer, relative to the reference.' : ''}`,
          ],
        };
      }
    },
  },
  {
    id: 'needs',
    make(rng) {
      const n = pick(rng, [5, 10, 20, 50, 100, 60]);
      const kind = rng.int(3);
      const ctx = `A team has ${n} thousand preference pairs: for each prompt, a chosen answer and a rejected one.`;
      if (kind === 0) {
        return {
          prompt: `${ctx} Besides the pairs and the model being trained, what does DPO need?`,
          answer: choose('A frozen reference model, to measure log-ratios against', [
            ['A trained reward model, to score each answer', 'DPO needs no reward model: the model\'s own log-ratio to the reference plays the reward.'],
            ['Fresh answers sampled from the model during training', 'Every term comes from the fixed answers in the pairs. Nothing is sampled.'],
            ['Nothing else: it fine-tunes on the chosen answers alone', 'The rejected answers matter too, and every term is measured against the reference.'],
          ]),
          solution: [`The loss is $-\\ln\\sigma\\big(${IMP(YW)} - ${IMP(YL)}\\big)$.`, `Each term needs $\\ln ${PI}$ and $\\ln ${REF}$ of a fixed answer from the pairs: the model being trained and a frozen reference, nothing more.`],
        };
      }
      const right = kind === 1 ? 'A reward model trained on the pairs' : 'Answers sampled from the model during training';
      const wrong: [string, string][] = [
        ['A frozen copy of the starting model, as the reference', `Every term divides by $${REF}$: the log-ratios need it.`],
        ['The rejected answer of each pair', 'The loss compares the chosen answer against the rejected one: both are needed.'],
        [`The model's log-probabilities of the fixed answers`, `Those are what the loss is built from: $\\ln ${PI}(${YW})$ and $\\ln ${PI}(${YL})$.`],
      ];
      return {
        prompt: `${ctx} Which of these does DPO not need?`,
        answer: choose(right, wrong),
        solution: [
          `DPO's loss is built from $\\ln ${PI}$ and $\\ln ${REF}$ of the fixed chosen and rejected answers.`,
          kind === 1 ? 'The model\'s own log-ratio to the reference stands in for the reward, so no reward model is trained.' : 'Every answer it reads is already in the pairs, so nothing is sampled during training.',
        ],
      };
    },
  },
  {
    id: 'moves',
    make(rng, d) {
      const beta = pick(rng, [0.1, 0.2, 0.5]);
      const gw = d < 0.5 ? int(rng, -2, 2) : int(rng, -20, 20) / 10;
      const gl = d < 0.5 ? int(rng, -2, 2) : int(rng, -20, 20) / 10;
      return {
        prompt: `On a pair, the chosen answer's log-ratio to the reference is $${num(gw)}$ and the rejected answer's is $${num(gl)}$, with $${BETA} = ${num(beta)}$. What does a small step that lowers the DPO loss do?`,
        answer: choose('Raises the chosen answer\'s log-ratio relative to the rejected one\'s', [
          ['Raises the chosen answer\'s probability and leaves the rejected one alone', `The rejected answer's log-ratio is in the loss too, with a minus sign: the step pushes it down.`],
          ['Raises both answers\' probabilities, the chosen one more', 'The loss depends on the gap between the two log-ratios; widening it lowers the rejected one.'],
          ['Moves the reference model toward the chosen answer', 'The reference is frozen. Only the model being trained changes.'],
        ]),
        solution: [
          `The loss falls as the margin $${BETA}$ times (chosen log-ratio minus rejected log-ratio) grows, here from $${num(clean(beta * (gw - gl)))}$.`,
          'So a step raises the chosen answer\'s probability relative to the reference and lowers the rejected one\'s. The reference does not move.',
        ],
      };
    },
  },
];
