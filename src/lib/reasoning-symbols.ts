import type { SymbolMap } from '../core/symbols';

/** Shared by the reasoning chapter and its lecture, so a symbol keeps its color across both. */
export const REASONING_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the question, the prompt the model is answering', code: ['x', 'question'] },
  z: { color: 'purple', name: 'z: the chain of thought, the reasoning tokens written before the answer', code: ['z', 'cot'] },
  a: { color: 'green', name: 'a: the final answer pulled out of a response', code: ['a', 'answer', 'answers'] },
  p: { color: 'gold', name: 'p: per-sample accuracy, the chance that one sampled answer is right', code: ['p'] },
  q: { color: 'red', name: 'q: the share of samples that land on the most common wrong answer', code: ['q'] },
  V: { color: 'teal', name: 'V: a verifier’s score for a response (a reward model, ORM or PRM)', code: ['V', 'scores', 'verifier'] },
  L: { color: 'blue', name: 'L: the number of layers, the serial steps one forward pass can take', code: ['L'] },
  T: { color: 'slate', name: 'T: the thinking budget, how many reasoning tokens the model may write', code: ['T', 'budget'] },
};
