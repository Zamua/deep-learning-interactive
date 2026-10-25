import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { big, commas, traps } from '../kit';

const LOW = [0.5, 0.25, 0.125];
const PSET = [0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 0.9];
/** Losses in hundredths of a nat, as prompts quote them. */
const loss100 = (p: number) => Math.round(-Math.log(p) * 100);
const e2 = (x: number) => round(Math.exp(x), 2);
const f2 = (x: number) => num(x, 2);
const useE = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b).map((x) => `$e^{${f2(x)}} \\approx ${f2(e2(x))}$`).join(', ');

export const generators: Generator[] = [
  {
    id: 'ppl',
    make(rng, d) {
      const n = d < 0.35 ? 2 : d < 0.7 ? 3 : 4;
      const ps = Array.from({ length: n }, () => pick(rng, d < 0.35 ? LOW : PSET));
      const ls = ps.map(loss100);
      const sum = ls.reduce((a, b) => a + b, 0);
      const mean = Math.round(sum / n) / 100;
      const v = e2(mean);
      const inv = ps.reduce((a, p) => a + 1 / p, 0) / n;
      return {
        prompt: `A language model reads ${n} tokens of text. At each step, the probability it gave the right next token was ${ps.map((p) => `$${num(p)}$`).join(', ')}. What is its perplexity on this text? Round to one decimal.\n\nUse ${[...new Set(ps)].sort((a, b) => b - a).map((p) => `$\\ln ${num(p)} \\approx -${f2(loss100(p) / 100)}$`).join(', ')}, ${useE([mean, sum / 100])}.`,
        answer: { kind: 'number', value: v, places: 1 },
        traps: traps(v, [
          { value: mean, why: 'That is the average loss. Perplexity is $e$ to that power.' },
          { value: e2(sum / 100), why: 'That uses the total loss. Perplexity is $e$ to the average loss, per token.' },
          { value: round(inv, 2), why: 'That averages one over each probability. Perplexity averages the losses, then raises $e$ to the result.' },
        ]).filter((t) => Math.abs(t.value - v) >= 0.1),
        solution: [
          `Each token's loss is minus the log of its probability: ${ls.map((l) => `$${f2(l / 100)}$`).join(', ')}.`,
          `The average loss: $(${ls.map((l) => f2(l / 100)).join(' + ')}) / ${n} \\approx ${f2(mean)}$.`,
          `Perplexity is $e$ to the average loss: $e^{${f2(mean)}} \\approx ${f2(v)}$, about ${num(round(v, 1), 1)} effective choices per token.`,
        ],
      };
    },
  },
  {
    id: 'from-loss',
    make(rng, d) {
      const kind = d < 0.35 ? 0 : rng.int(3);
      if (kind === 0) {
        const L = pick(rng, [0.5, 0.7, 1.1, 1.4, 1.6, 2.0, 2.3, 2.5, 3.0, 3.2]);
        const v = e2(L);
        return {
          prompt: `A language model's average loss on a text is $${num(L, 2)}$ per token. What is its perplexity? Round to one decimal.\n\nUse $e^{${num(L, 2)}} \\approx ${f2(v)}$.`,
          answer: { kind: 'number', value: v, places: 1 },
          traps: traps(v, [{ value: L, why: 'That is the loss itself. Perplexity is $e$ to the power of the average loss.' }]),
          solution: [`Perplexity is $e$ to the average loss: $e^{${num(L, 2)}} \\approx ${f2(v)}$.`, `That is about ${num(round(v, 1), 1)} effective choices per token.`],
        };
      }
      if (kind === 1) {
        const n = int(rng, 2, 5);
        const mean = pick(rng, [0.5, 0.8, 1.2, 1.5, 2.0, 2.5]);
        const total = round(mean * n, 2);
        const v = e2(mean);
        return {
          prompt: `Over a text of ${n} tokens, a language model's losses add up to $${num(total)}$. What is its perplexity? Round to one decimal.\n\nUse ${useE([mean, total])}.`,
          answer: { kind: 'number', value: v, places: 1 },
          traps: traps(v, [
            { value: e2(total), why: `That uses the total loss. Perplexity uses the average per token: divide by ${n} first.` },
            { value: mean, why: 'That is the average loss. Perplexity is $e$ to that power.' },
          ]).filter((t) => Math.abs(t.value - v) >= 0.1),
          solution: [`The average loss is $${num(total)} / ${n} = ${num(mean)}$ per token.`, `Perplexity: $e^{${num(mean)}} \\approx ${f2(v)}$.`],
        };
      }
      const P = pick(rng, [2, 3, 5, 8, 10, 20, 50, 100]);
      const v = round(Math.log(P), 2);
      return {
        prompt: `A language model's perplexity on a text is $${P}$. What is its average loss per token? Round to two decimals.\n\nUse $\\ln ${P} \\approx ${f2(v)}$.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: P, why: 'That is the perplexity itself. The loss is its natural log.' },
          { value: round(1 / P, 2), why: 'That is one over the perplexity. Perplexity is $e^{\\symL}$, so $\\symL$ is its log.' },
        ]),
        solution: [`Perplexity is $e^{\\symL}$, so the average loss is its natural log.`, `$\\symL = \\ln ${P} \\approx ${f2(v)}$ per token.`],
      };
    },
  },
  {
    id: 'uniform',
    make(rng, d) {
      const kind = d < 0.35 ? rng.int(2) : rng.int(3);
      if (kind === 0) {
        const V = pick(rng, d < 0.5 ? [4, 10, 26, 27, 65, 100] : [1000, 32000, 50000, 50257]);
        return {
          prompt: `An untrained language model with a vocabulary of $V = ${big(V)}$ tokens gives every token the same probability, at every step. What is its perplexity on any text?`,
          answer: { kind: 'number', value: V },
          traps: traps(V, [
            { value: round(Math.log(V), 2), why: 'That is its loss, $\\ln V$, on every token. Perplexity is $e$ to that: $V$ itself.' },
            { value: 1 / V, why: 'That is the probability it gives each token. Perplexity is one over it here.' },
          ]),
          solution: [`Every token gets probability $1/${big(V)}$, so every step's loss is $-\\ln(1/${big(V)}) = \\ln ${big(V)}$.`, `The average loss is $\\ln ${big(V)}$ too, and $e^{\\ln ${big(V)}} = ${big(V)}$: as unsure as a uniform pick among all ${commas(V)} tokens.`],
        };
      }
      if (kind === 1) {
        const q = pick(rng, [0.5, 0.25, 0.2, 0.1, 0.05, 0.02, 0.01]);
        const v = round(1 / q, 6);
        return {
          prompt: `A language model happens to give the right next token probability $${num(q)}$ at every step of a text. What is its perplexity on that text?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: q, why: 'That is the probability. Perplexity is $e$ to the average loss, which here is one over the probability.' },
            { value: round(-Math.log(q), 2), why: 'That is the loss on each token. Perplexity is $e$ to that.' },
          ]),
          solution: [`Every step's loss is $-\\ln ${num(q)} = \\ln ${num(v)}$, so that is also the average.`, `$e^{\\ln ${num(v)}} = ${num(v)}$: as unsure as a fair pick among ${num(v)} tokens.`],
        };
      }
      const n = pick(rng, [5, 10, 50, 100, 1000]);
      return {
        prompt: `A language model gives the right next token probability 1 at every one of the ${commas(n)} steps of a text. What is its perplexity on that text?`,
        answer: { kind: 'number', value: 1 },
        traps: traps(1, [
          { value: 0, why: 'That is its loss: $-\\ln 1 = 0$. Perplexity is $e^0 = 1$.' },
          { value: n, why: 'Perplexity does not grow with the length of the text: it is per token.' },
        ]),
        solution: ['Every loss is $-\\ln 1 = 0$, so the average loss is 0.', 'Perplexity is $e^0 = 1$: one effective choice, the right one. No model can do better.'],
      };
    },
  },
  {
    id: 'compare',
    make(rng, d) {
      const kind = d < 0.35 ? rng.int(2) : rng.int(3);
      const flip = rng.int(2) === 0;
      const lossOf = (x: number) => `an average loss of $${num(x, 1)}$ per token`;
      const pplOf = (x: number) => `a perplexity of $${x}$`;
      let A: string;
      let B: string;
      let better: 'A' | 'B';
      let use = '';
      let ask = 'Which model predicts this text better?';
      let step: string;
      if (kind === 0) {
        let [a, b] = pick(rng, [[2.1, 1.7], [3.4, 2.9], [1.2, 0.9], [4.0, 3.1], [2.6, 2.2]] as const) as [number, number];
        if (flip) [a, b] = [b, a];
        [A, B] = [lossOf(a), lossOf(b)];
        better = a < b ? 'A' : 'B';
        ask = 'Which model has the lower perplexity?';
        step = `Model ${better} has the lower loss, so it also has the lower perplexity.`;
      } else if (kind === 1) {
        let [a, b] = pick(rng, [[30, 12], [45, 20], [9, 6], [120, 80], [25, 18]] as const) as [number, number];
        if (flip) [a, b] = [b, a];
        [A, B] = [pplOf(a), pplOf(b)];
        better = a < b ? 'A' : 'B';
        ask = 'Which model has the lower average loss?';
        step = `Model ${better} has the lower perplexity, so it also has the lower loss: the loss is the log of the perplexity.`;
      } else {
        const L = pick(rng, [1.5, 2.0, 2.5, 3.0]);
        const e = e2(L);
        const P = pick(rng, [Math.floor(e) - 1, Math.ceil(e) + 1]);
        [A, B] = flip ? [lossOf(L), pplOf(P)] : [pplOf(P), lossOf(L)];
        const lossWins = e < P;
        better = lossWins === flip ? 'A' : 'B';
        use = `\n\nUse $e^{${num(L, 1)}} \\approx ${f2(e)}$.`;
        step = `A loss of $${num(L, 1)}$ is a perplexity of $e^{${num(L, 1)}} \\approx ${f2(e)}$, against ${P} for the other model.`;
      }
      const worse = better === 'A' ? 'B' : 'A';
      const why: (string | null)[] = [
        null,
        null,
        kind === 2 ? 'Put both in the same units first: perplexity is $e$ to the loss. Then the numbers differ.' : 'Their numbers differ, and perplexity, $e^{\\symL}$, rises whenever the loss does: one is strictly better.',
        'Both models are scored on the same text with the same vocabulary, and perplexity rises with the loss whatever the vocabulary size.',
      ];
      why[better === 'A' ? 1 : 0] = `Model ${worse} has the higher ${kind === 1 ? 'perplexity, so the higher loss' : kind === 0 ? 'loss, so the higher perplexity' : 'perplexity once both are in the same units'}: it is less sure of the right tokens.`;
      return {
        prompt: `Two language models are scored on the same text with the same vocabulary. Model A gets ${A}; model B gets ${B}. ${ask}${use}`,
        answer: { kind: 'choice', options: ['Model A', 'Model B', 'Neither: they do equally well', 'It cannot be told without knowing the vocabulary size'], correct: better === 'A' ? 0 : 1, why },
        solution: [
          'Perplexity is $e^{\\symL}$, which rises whenever the average loss $\\symL$ does, so lower loss and lower perplexity go together.',
          step,
          `Model ${better} is better: on average it is choosing among fewer effective options per token.`,
        ],
      };
    },
  },
];
