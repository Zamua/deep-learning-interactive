import type { SymbolMap } from '../core/symbols';

/** Shared by the transformer chapter and its lecture, so a symbol keeps its color across both. */
export const TRANSFORMER_SYMBOLS: SymbolMap = {
  X: {
    color: 'orange',
    name: 'X: the token vectors, one row per token (x inside a block)',
    code: ['X', 'x'],
    about: 'A T by d matrix: 6 tokens by 4 numbers in the toy. Every block reads X and returns a matrix of the same shape, which is what lets blocks stack.',
  },
  Q: {
    color: 'teal',
    name: 'Q: the queries, one row per token: what each token is looking for',
    code: ['Q', 'q'],
    about: 'Q = X Wq, shape (T, d_k), here (6, 2). The names query, key and value come from database lookup: a query is matched against keys to retrieve their values.',
  },
  K: {
    color: 'green',
    name: 'K: the keys, one row per token: what each token can be found by',
    code: ['K', 'k'],
    about: 'K = X Wk, shape (T, d_k). The dot product of query i with key j is the score in row i, column j of Q Kᵀ: how well token j matches what token i is looking for.',
  },
  V: {
    color: 'gold',
    name: 'V: the values, one row per token: what each token hands over',
    code: ['V', 'v'],
    about: 'V = X Wv. Each output row is a blend of these rows, mixed in the proportions of its attention weights. Keys decide who gets attention; values decide what is passed on.',
  },
  W: {
    color: 'blue',
    name: 'W: learned weight matrices (W_Q, W_K, W_V, W_O, and the MLP weights W_1, W_2)',
    code: ['Wq', 'Wk', 'Wv', 'Wo', 'W1', 'W2'],
    about: 'Wq, Wk and Wv make the queries, keys and values, Wo mixes the heads, and W1, W2 form the MLP. A block holds about 12 d² weights: a third in attention, two thirds in the MLP.',
  },
  A: {
    color: 'purple',
    name: 'A: the attention weights; row i says how much token i takes from each token',
    code: ['A'],
    about: 'A = softmax(Q Kᵀ / √d_k), a T by T matrix whose rows are positive and sum to one. The causal mask makes it lower triangular, so each token takes only from itself and its past.',
  },
  P: {
    color: 'red',
    name: 'P: the positional encodings, one row per position',
    code: ['P'],
    about: 'Added to the token embeddings so attention can tell positions apart. Each pair of columns is a sine and cosine wave at its own speed, so position p + k is a fixed rotation of position p.',
  },
  dk: {
    color: 'slate',
    name: 'd_k: the length of each query and key vector',
    tex: 'd_k',
    code: ['d_k'],
    about: 'A dot product of d_k random unit-variance terms has variance d_k, so scores are divided by √d_k to keep the softmax soft. 2 in the toy, 64 per head in the 2017 paper.',
  },
  d: {
    color: 'slate',
    name: 'd: the model width, the length of every token vector',
    code: ['d', 'd_model'],
    about: '512 in the 2017 paper, 768 in GPT-2 small, 12,288 in GPT-3. Parameters grow with d², since every matrix in a block is d by d or d by 4d.',
  },
};
