import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { BETA, choose, clean, LN, minus, PI, R, REF, sumTex, traps, useLn } from '../kit';

const WORDS = ['the', 'answer', 'is', 'seven', 'because', 'cats', 'sleep', 'all', 'day', 'great', 'question', 'sure', 'here', 'it', 'goes', 'yes'];
const P = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9];
const KL = `\\ln\\dfrac{${PI}}{${REF}}`;

/** `n` different tokens. */
const words = (rng: Rng, n: number): string[] => rng.shuffle(WORDS.slice()).slice(0, n);

/** Log-probabilities in tenths for the policy and the reference, never equal. */
function logps(rng: Rng, n: number, d: number): [number, number][] {
  return Array.from({ length: n }, () => {
    for (;;) {
      const a = -int(rng, 1, 25) / 10;
      const b = -int(rng, 1, 25) / 10;
      if (a !== b && (d >= 0.7 || a > b)) return [a, b] as [number, number];
    }
  });
}

/** A listing of tokens with both models' log-probabilities. */
function table(toks: string[], lp: [number, number][]): string {
  const w = Math.max(5, ...toks.map((t) => t.length)) + 2;
  const f = (x: number) => num(x).padEnd(8);
  return [`${'token'.padEnd(w)}${'ln pi'.padEnd(8)}ln pi_ref`, ...toks.map((t, i) => `${t.padEnd(w)}${f(lp[i]![0])}${num(lp[i]![1])}`)].join('\n');
}

export const generators: Generator[] = [
  {
    id: 'log-ratio',
    make(rng, d) {
      if (d < 0.35) {
        const [p, q] = rng.shuffle(P.slice()).slice(0, 2) as [number, number];
        const tok = words(rng, 1)[0]!;
        const v = clean(LN(p) - LN(q));
        return {
          prompt: `The token \`${tok}\` has $${PI} = ${num(p)}$ and $${REF} = ${num(q)}$. What is its log-ratio? Round to two decimals.\n\nUse ${useLn([p, q])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(
            v,
            [
              { value: -v, why: `That is $\\ln ${REF} - \\ln ${PI}$, the wrong way round. The model being trained goes on top.` },
              { value: clean(p / q), why: 'That is the ratio itself. The penalty takes its log.' },
              { value: clean(p - q), why: 'That subtracts the probabilities. The penalty subtracts their logs.' },
            ],
            2,
          ),
          solution: [
            `The log of a ratio is a difference of logs: $${KL} = \\ln ${num(p)} - \\ln ${num(q)}$.`,
            `$${minus(LN(p), LN(q), 2)} = ${num(v, 2)}$.`,
            v > 0 ? 'Positive: the model now likes this token more than the reference did, so it is charged.' : 'Negative: the model now likes this token less than the reference did.',
          ],
        };
      }
      const n = d < 0.7 ? 2 : int(rng, 3, 4);
      const toks = words(rng, n);
      const lp = logps(rng, n, d);
      const each = lp.map(([a, b]) => clean(a - b));
      const v = clean(each.reduce((s, x) => s + x, 0));
      return {
        prompt: `The listing gives each token's $\\ln ${PI}$ and $\\ln ${REF}$ for a sampled answer. What is the answer's log-ratio, summed over its ${n} tokens?`,
        code: table(toks, lp),
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: -v, why: `That is $\\ln ${REF} - \\ln ${PI}$, the wrong way round. The model being trained goes first.` },
          { value: clean(v / n), why: `That is the average per token. The answer's log-ratio adds them up.` },
          { value: clean(lp.reduce((s, [a]) => s + a, 0)), why: `That adds only $\\ln ${PI}$. Subtract each token's $\\ln ${REF}$ too.` },
        ]),
        solution: [
          `Each token's log-ratio is $\\ln ${PI} - \\ln ${REF}$: ${lp.map(([a, b], i) => `$${minus(a, b)} = ${num(each[i]!)}$`).join(', ')}.`,
          `Add them: $${sumTex(each)} = ${num(v)}$.`,
          v > 0 ? 'Positive: overall the model likes this answer more than the reference does, so it is charged.' : 'Negative for this sample: the model likes it less than the reference does. Averaged over many samples, the sum is never negative.',
        ],
      };
    },
  },
  {
    id: 'penalized',
    make(rng, d) {
      const beta = pick(rng, d < 0.35 ? [0.1, 0.5, 1] : [0.1, 0.2, 0.05, 0.5]);
      const Rv = d < 0.35 ? pick(rng, [1, 2, 3]) : pick(rng, [1, 0.5, 2, 0.8, 1.5]);
      const per = d >= 0.5;
      const each = per ? Array.from({ length: d < 0.8 ? 3 : 4 }, () => int(rng, d < 0.8 ? 0 : -3, 12) / 10) : [];
      const kl = per ? clean(each.reduce((s, x) => s + x, 0)) : pick(rng, [1, 2, 4, 3, 6]);
      const v = clean(Rv - beta * kl);
      return {
        prompt: per
          ? `A sampled answer gets reward $${R} = ${num(Rv)}$. Its tokens' log-ratios to the reference are $${each.map((x) => num(x)).join(',\\ ')}$. With $${BETA} = ${num(beta)}$, what is the penalized reward the model trains on?`
          : `A sampled answer gets reward $${R} = ${num(Rv)}$, and its log-ratio to the reference, summed over its tokens, is $${num(kl)}$. With $${BETA} = ${num(beta)}$, what is the penalized reward the model trains on?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: clean(Rv + beta * kl), why: 'That adds the penalty. Drifting from the reference costs reward, so subtract it.' },
          { value: clean(Rv - kl), why: `That leaves out $${BETA}$. The penalty is $${BETA}$ times the log-ratio.` },
          { value: clean(beta * (Rv - kl)), why: `That scales the reward by $${BETA}$ too. Only the penalty is multiplied by $${BETA}$.` },
        ]),
        solution: [
          ...(per ? [`Sum the log-ratios over the answer: $${sumTex(each)} = ${num(kl)}$.`] : []),
          `The penalty: $${BETA} \\times ${num(kl)} = ${num(clean(beta * kl))}$.`,
          `The penalized reward: $${R} - ${BETA}\\,${KL} = ${minus(Rv, clean(beta * kl))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'beta',
    make(rng) {
      const base = pick(rng, [0.05, 0.1, 0.2]);
      const big = rng.int(2) === 0;
      const other = big ? pick(rng, [5, 10, 20, 50]) : pick(rng, [0.001, 0.0001, 0.0005]);
      const opts = [
        'The model stays close to the reference, and its reward rises only a little',
        'The model drifts far from the reference, chasing the reward wherever it leads',
        'The model\'s samples get more random, as at a higher temperature',
        `Nothing: $${BETA}$ only rescales every reward by the same factor`,
      ];
      const correct = big ? 0 : 1;
      const why: (string | null)[] = [
        `That is what a large $${BETA}$ does. At $${BETA} = ${num(other)}$ drifting costs almost nothing.`,
        `That is what a tiny $${BETA}$ does. At $${BETA} = ${num(other)}$ even a small drift costs more than the reward can pay for.`,
        `$${BETA}$ does not touch the sampling. It sets the price of drifting from the reference.`,
        `$${BETA}$ multiplies only the penalty, so it changes how drift trades against reward.`,
      ];
      why[correct] = null;
      return {
        prompt: `A model trains on its reward with a KL penalty. Compared with a run at $${BETA} = ${num(base)}$, what happens at $${BETA} = ${num(other)}$?`,
        answer: { kind: 'choice', options: opts, correct, why },
        solution: [
          `The penalized reward is $${R} - ${BETA}\\,${KL}$, so $${BETA}$ is the price of drifting: each unit of log-ratio to the reference costs $${BETA}$ reward.`,
          big
            ? `At $${BETA} = ${num(other)}$ any drift costs far more than the reward gives back, so the model stays near the reference and improves little.`
            : `At $${BETA} = ${num(other)}$ drift is nearly free, so the model follows the reward wherever it leads, even into answers that score well but have stopped making sense.`,
        ],
      };
    },
  },
  {
    id: 'charged',
    make(rng, d) {
      for (;;) {
        const toks = words(rng, 3);
        const pq = toks.map(() => rng.shuffle(P.slice()).slice(0, 2) as [number, number]);
        const lr = pq.map(([p, q]) => round(Math.log(p / q), 2));
        const top = lr.indexOf(Math.max(...lr));
        const ps = pq.map(([p]) => p);
        const maxP = Math.max(...ps);
        if (new Set(lr).size < 3 || (d >= 0.3 && ps[top] === maxP)) continue;
        // The one token with the largest π, if no other ties it.
        const topP = ps.filter((p) => p === maxP).length === 1 ? ps.indexOf(maxP) : -1;
        const opt = (i: number) => `\`${toks[i]}\`: $${PI} = ${num(pq[i]![0])}$, $${REF} = ${num(pq[i]![1])}$`;
        /** `0.5 / 0.3 \approx 1.67`, or `= 2` when exact. */
        const ratio = (i: number) => {
          const [p, q] = pq[i]!;
          const r = round(p / q, 2);
          return `${num(p)} / ${num(q)} ${Math.abs(r - p / q) < 1e-9 ? '=' : '\\approx'} ${num(r)}`;
        };
        const why = lr.map((_, i) => (i === top ? null : `Its ratio is $${ratio(i)}$, below \`${toks[top]}\`'s $${ratio(top)}$, so its log-ratio is smaller.${i === topP ? ` It has the largest $${PI}$, but the charge depends on the ratio to $${REF}$.` : ''}`));
        return {
          prompt: `A sampled answer contains the tokens ${toks.map((t) => `\`${t}\``).join(', ')}. Which token adds the most to the KL penalty?`,
          answer: { kind: 'choice', options: toks.map((_, i) => opt(i)), correct: top, why },
          solution: [
            `Each token is charged $${BETA}$ times its log-ratio $\\ln(${PI} / ${REF})$, and $\\ln$ grows with its input, so the largest ratio $${PI} / ${REF}$ is charged most.`,
            `The ratios: ${toks.map((t, i) => `\`${t}\` $${ratio(i)}$`).join(', ')}.`,
            `The largest is \`${toks[top]}\`'s, so its log-ratio is the largest: ${toks.map((t, i) => `\`${t}\` $\\approx ${num(lr[i]!, 2)}$`).join(', ')}.`,
            `The model has moved furthest from the reference on \`${toks[top]}\`.`,
          ],
        };
      }
    },
  },
];
