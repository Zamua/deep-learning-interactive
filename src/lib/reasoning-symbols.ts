import type { SymbolMap } from '../core/symbols';

/** Shared by the reasoning chapter and its lecture, so a symbol keeps its color across both. */
export const REASONING_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the question, the prompt the model is answering',
    code: ['x', 'question'],
    about: 'Held fixed while everything else varies: test-time methods draw many chains, answers and scores for the same x. The lecture\'s examples are mostly grade-school math word problems.',
  },
  z: {
    color: 'purple',
    name: 'z: the chain of thought, the reasoning tokens written before the answer',
    code: ['z', 'cot'],
    about: 'Each token costs a full forward pass and is read back at the bottom of the next one, which buys serial depth. It reads like an explanation but is not always the real reason. The term comes from Wei and colleagues\' chain-of-thought prompting (2022).',
  },
  a: {
    color: 'green',
    name: 'a: the final answer pulled out of a response',
    code: ['a', 'answer', 'answers'],
    about: 'What votes, checks and pass@k compare. Many different chains of thought lead to the same a, so an answer\'s probability is a sum over every chain that reaches it.',
  },
  p: {
    color: 'gold',
    name: 'p: per-sample accuracy, the chance that one sampled answer is right',
    code: ['p'],
    about: 'Against a single wrong alternative, voting helps when p > 0.5 (0.6 becomes 0.98 with 101 samples) and hurts below it: Condorcet\'s jury theorem of 1785. It also sets coverage, pass@k = 1 - (1 - p)^k.',
  },
  q: {
    color: 'red',
    name: 'q: the share of samples that land on the most common wrong answer',
    code: ['q'],
    about: 'The danger for voting: once q exceeds p, more samples make that shared mistake win more reliably. Scattered wrong answers, each with a small share, rarely win.',
  },
  V: {
    color: 'teal',
    name: 'V: a verifier’s score for a response (a reward model, ORM or PRM)',
    code: ['V', 'scores', 'verifier'],
    about: 'Picks among samples in best-of-n. In the toy, right answers score around two and wrong ones around zero, with noise; with 256 samples a high-scoring exploit is almost surely in the pile.',
  },
  L: {
    color: 'blue',
    name: 'L: the number of layers, the serial steps one forward pass can take',
    code: ['L'],
    about: 'Fixed by the architecture, so one pass can follow a chain of at most about L dependent steps. In the cups toy, L = 3: one swap per layer.',
  },
  T: {
    color: 'slate',
    name: 'T: the thinking budget, how many reasoning tokens the model may write',
    code: ['T', 'budget'],
    about: 'T tokens give about L × T serial steps instead of L. Too small cuts reasoning off before an answer; too large pays for overthinking, like hundreds of tokens on two plus three.',
  },
};
