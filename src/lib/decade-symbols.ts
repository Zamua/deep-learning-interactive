import type { SymbolMap } from '../core/symbols';

/** Shared by the decade chapter and its lecture, so a symbol keeps its color across both. */
export const DECADE_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the rows the input is compared with: class weights in 2016, the keys K in 2017', code: ['W', 'K'] },
  x: { color: 'orange', name: 'x: the vector being scored: an image in 2016, a query q in 2017', code: ['x', 'q'] },
  s: { color: 'purple', name: 's: the scores (logits), one per class, token or answer', code: ['s', 'logits'] },
  p: { color: 'green', name: 'p: the softmax of the scores: probabilities, or attention weights, that sum to 1', code: ['p', 'a'] },
  L: { color: 'red', name: 'L: the loss, softmax cross-entropy averaged over tokens', code: ['loss'] },
  N: { color: 'teal', name: 'N: the number of parameters (for a mixture of experts, the active ones)', code: ['N'] },
  D: { color: 'gold', name: 'D: the number of training tokens', code: ['D'] },
};
