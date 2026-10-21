import type { SymbolMap } from '../core/symbols';

/** Shared by the decade chapter and its lecture, so a symbol keeps its color across both. */
export const DECADE_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the rows the input is compared with: class weights in 2016, the keys K in 2017',
    code: ['W', 'K'],
    about: 'In 2016 each row of W is one class, and W @ x gives one score per class. In 2017 the rows are keys, one per token, computed from the sentence itself, so the classes change with every input.',
  },
  x: {
    color: 'orange',
    name: 'x: the vector being scored: an image in 2016, a query q in 2017',
    code: ['x', 'q'],
    about: 'In 2016 x is an image, scored against every class row of W. In 2017 the same line scores a query q against every token\'s key.',
  },
  s: {
    color: 'purple',
    name: 's: the scores (logits), one per class, token or answer',
    code: ['s', 'logits'],
    about: 'Raw scores before the softmax, any real numbers. In pretraining they come as logits of shape (T, vocab): a score for every vocabulary token at every position.',
  },
  p: {
    color: 'green',
    name: 'p: the softmax of the scores: probabilities, or attention weights, that sum to 1',
    code: ['p', 'a'],
    about: 'Positive and summing to 1. In a classifier p gives the probability of each class; in attention the same softmax gives weights a that mix the tokens\' values.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, softmax cross-entropy averaged over tokens',
    code: ['loss'],
    about: 'Minus the log probability of each correct next token, averaged: Assignment one\'s loss, with the vocabulary as the classes. Scaling laws track how it falls as models grow.',
  },
  N: {
    color: 'teal',
    name: 'N: the number of parameters (for a mixture of experts, the active ones)',
    code: ['N'],
    about: 'Scaling laws predict the loss from N, and training costs about 6 * N * D operations. GPT-3 had N = 175 billion.',
  },
  D: {
    color: 'gold',
    name: 'D: the number of training tokens',
    code: ['D'],
    about: 'Chinchilla (2022) found about 20 tokens per parameter, D / N near 20, to be the best use of a compute budget. GPT-3 trained on 300 billion tokens, fewer than 2 per parameter.',
  },
};
