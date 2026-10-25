import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { argmax, clean, lit, lits, LN2, probs, traps, useLn } from '../kit';

const SHORT = ['cat', 'dog', 'sun', 'code', 'moon', 'tree', 'bird', 'fish', 'rain', 'star'];
const MID = ['hello', 'model', 'token', 'river', 'apple', 'music', 'night', 'learn', 'paper', 'stone', 'water', 'tiger', 'lemon', 'dream'];
const LONG = ['banana', 'letter', 'little', 'coffee', 'pepper', 'summer', 'yellow', 'butter', 'kitten', 'rabbit'];
/** Words with a few distinct letters, so the vocabulary fits in one row. */
const SMALL_VOCAB = ['hello', 'cat', 'dog', 'code', 'moon', 'banana', 'level', 'paper', 'cocoa', 'river', 'apple', 'tiger', 'lemon', 'stone'];
/** Three-letter words with three distinct letters. */
const TRIPLE = ['cat', 'dog', 'sun', 'pig', 'cow', 'art', 'ice', 'owl', 'red', 'sky'];
/** Probabilities whose logs a prompt quotes. */
const PSET = [0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 0.9];

const letters = (w: string): string[] => [...w];
const vocabOf = (w: string): string[] => [...new Set(letters(w))];
const ids = (vocab: readonly string[]): string => vocab.map((c, i) => `${lit(c)} $= ${i}$`).join(', ');

/** A probability row over `m` tokens with `q` at `at`; the rest in multiples of 0.05. */
function row(rng: Rng, m: number, at: number, q: number): number[] {
  const rest = Math.round((1 - q) * 20);
  for (;;) {
    const cuts = Array.from({ length: m - 2 }, () => int(rng, 1, rest - 1)).sort((a, b) => a - b);
    const parts = [...cuts, rest].map((c, i) => c - (i ? cuts[i - 1]! : 0));
    if (parts.every((p) => p >= 1) && !parts.some((p) => p / 20 === q)) {
      const out = parts.map((p) => clean(p / 20));
      out.splice(at, 0, q);
      return out;
    }
  }
}

export const generators: Generator[] = [
  {
    id: 'targets',
    make(rng, d) {
      for (;;) {
        const w = pick(rng, d < 0.35 ? SHORT : d < 0.7 ? MID : LONG);
        const L = letters(w);
        const tgt = L.slice(1);
        const options = [lits(tgt), lits(L.slice(0, -1)), lits(L.slice(2)), lits(tgt.map(() => L[L.length - 1]!))];
        if (new Set(options).size < options.length) continue;
        return {
          prompt: `A character-level language model reads the text ${lit(w)} one character at a time: ${lits(L.slice(0, -1))}. What are its targets, step by step?`,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: [
              null,
              'That is the input again. Copying what it just read is not the task; the target is the character that comes next.',
              'That skips a character. Each step predicts the very next character, not the one after it.',
              'That asks for the last character at every step. Each step predicts the character right after the one it just read.',
            ],
          },
          solution: [`Each step's target is the next character of the text: the input shifted by one.`, `Inputs ${lits(L.slice(0, -1))}; targets ${lits(tgt)}.`],
        };
      }
    },
  },
  {
    id: 'step-loss',
    make(rng, d) {
      const w = pick(rng, SMALL_VOCAB);
      const vocab = vocabOf(w);
      const L = letters(w);
      const t = rng.int(L.length - 1);
      const y = vocab.indexOf(L[t + 1]!);
      const cur = vocab.indexOf(L[t]!);
      const p = probs(rng, vocab.length, d);
      const v = clean(-LN2(p[y]!));
      const top = argmax(p);
      const ts = [
        { value: LN2(p[y]!), why: 'That is $\\ln \\symp$ itself. The loss is minus the log, so it is never negative.' },
        { value: -LN2(p[cur]!), why: `That scores ${lit(L[t])}, the character just read. The target is the next one, ${lit(L[t + 1])}.` },
        ...(top >= 0 ? [{ value: -LN2(p[top]!), why: `That uses the largest probability, for ${lit(vocab[top])}. The loss looks only at the target, ${lit(L[t + 1])}.` }] : []),
      ];
      return {
        prompt: `A character model reads ${lit(w)} with the vocabulary ${ids(vocab)}. After ${lit(w.slice(0, t + 1))} it outputs $\\symp = ${vec(p)}$. What is the loss at this step? Round to two decimals.\n\nUse ${useLn(p)}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, ts).filter((tr) => Math.abs(tr.value - v) >= 0.01),
        solution: [
          `After ${lit(w.slice(0, t + 1))} the next character is ${lit(L[t + 1])}, id ${y}, so the target is $\\symy = ${y}$.`,
          `Its probability is $\\symp_{${y}} = ${num(p[y]!)}$.`,
          `The loss is cross-entropy: $\\symL = -\\ln ${num(p[y]!)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'total-loss',
    make(rng, d) {
      const mean = d >= 0.5 && rng.int(2) === 0;
      const ask = mean ? 'What is the average loss per step' : 'What is the total loss over the text';
      if (d >= 0.75) {
        const w = pick(rng, TRIPLE);
        const L = letters(w);
        const qs = [pick(rng, PSET), pick(rng, PSET)];
        const rows = qs.map((q, t) => row(rng, 3, t + 1, q));
        const losses = qs.map((q) => clean(-LN2(q)));
        const total = clean(losses[0]! + losses[1]!);
        const v = mean ? round(total / 2, 2) : total;
        const wrong = rows.map((r, t) => clean(-LN2(r[t]!)));
        return {
          prompt: `A character model with the vocabulary ${ids(L)} reads ${lit(w)}. After ${lit(L[0])} it outputs $\\symp = ${vec(rows[0]!)}$, and after ${lit(L.slice(0, 2).join(''))} it outputs $\\symp = ${vec(rows[1]!)}$. ${ask}? Round to two decimals.\n\nUse ${useLn(rows.flat())}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: mean ? total : round(total / 2, 2), why: mean ? 'That is the total. The average divides it by the number of steps, 2.' : 'That is the average. The total adds the two steps\' losses.' },
            { value: mean ? round((wrong[0]! + wrong[1]!) / 2, 2) : clean(wrong[0]! + wrong[1]!), why: `That scores the character each step just read. The target is the next one: ${lit(L[1]!)}, then ${lit(L[2]!)}.` },
            { value: clean(qs[0]! + qs[1]!), why: 'That adds the probabilities. Each step\'s loss is minus the log of its target\'s probability.' },
          ]).filter((tr) => Math.abs(tr.value - v) >= 0.01),
          solution: [
            `The targets are the next characters: ${lit(L[1])} (id 1) after ${lit(L[0])}, and ${lit(L[2])} (id 2) after ${lit(L.slice(0, 2).join(''))}.`,
            `Their probabilities: $${num(qs[0]!)}$ and $${num(qs[1]!)}$, so the losses are $${num(losses[0]!, 2)}$ and $${num(losses[1]!, 2)}$.`,
            mean ? `Average: $(${num(losses[0]!, 2)} + ${num(losses[1]!, 2)}) / 2 \\approx ${num(v, 2)}$.` : `Total: $${num(losses[0]!, 2)} + ${num(losses[1]!, 2)} = ${num(v, 2)}$.`,
          ],
        };
      }
      const w = pick(rng, d < 0.35 ? SHORT.filter((x) => x.length === 3) : SHORT);
      const L = letters(w);
      const n = L.length - 1;
      const qs = Array.from({ length: n }, () => pick(rng, PSET));
      const losses = qs.map((q) => clean(-LN2(q)));
      const total = clean(losses.reduce((a, b) => a + b, 0));
      const v = mean ? round(total / n, 2) : total;
      const items = qs.map((q, t) => `$${num(q)}$ to ${lit(L[t + 1])} after ${lit(L.slice(0, t + 1).join(''))}`);
      const list = items.length > 2 ? `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}` : items.join(' and ');
      return {
        prompt: `A character model reading ${lit(w)} gives probability ${list}. ${ask}? Round to two decimals.\n\nUse ${useLn(qs)}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: mean ? total : round(total / n, 2), why: mean ? `That is the total. The average divides it by the number of steps, ${n}.` : 'That is the average. The total adds every step\'s loss.' },
          { value: -v, why: 'That has the wrong sign: each step\'s loss is minus the log, which is positive.' },
          { value: clean(qs.reduce((a, b) => a + b, 0)), why: 'That adds the probabilities. Each step\'s loss is minus the log of its target\'s probability.' },
        ]).filter((tr) => Math.abs(tr.value - v) >= 0.01),
        solution: [
          `Each step's loss is $-\\ln$ of the probability it gave the right next character: ${losses.map((l, t) => `$-\\ln ${num(qs[t]!)} \\approx ${num(l, 2)}$`).join(', ')}.`,
          mean ? `Average over ${n} steps: $(${losses.map((l) => num(l, 2)).join(' + ')}) / ${n} \\approx ${num(v, 2)}$.` : `Add them: $${losses.map((l) => num(l, 2)).join(' + ')} = ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'softmax-over',
    make(rng) {
      for (;;) {
        const V = pick(rng, [27, 65, 96, 128, 256]);
        const H = pick(rng, [64, 100, 128, 256, 512]);
        const n = pick(rng, [25, 50, 100, 200]);
        const t = int(rng, 3, Math.min(n - 1, 40));
        if (new Set([V, H, n, t + 1]).size < 4) continue;
        return {
          prompt: `A character model has a vocabulary of $V = ${V}$ characters and $\\symH = ${H}$ hidden units, and it reads sequences of ${n} characters. At step ${t}, how many probabilities does its softmax output?`,
          answer: {
            kind: 'choice',
            options: [`${V}: one for each character in the vocabulary`, `${n}: one for each position in the sequence`, `${H}: one for each hidden unit`, `${t + 1}: one for each character read so far`],
            correct: 0,
            why: [
              null,
              'Each step makes one prediction, and that prediction is a choice among every possible next character, not among positions.',
              `The hidden state is what the output layer reads: it turns those ${H} numbers into one score per character in the vocabulary.`,
              'The next character can be any character in the vocabulary, not just one already read.',
            ],
          },
          solution: [`The output layer turns $\\symh_t$ into one score per possible next character: $V = ${V}$ scores.`, `Softmax turns them into ${V} probabilities that add up to 1, and the loss reads the target's.`],
        };
      }
    },
  },
];
