import type { SymbolMap } from '../core/symbols';

/** Shared by the transformer chapter and its lecture, so a symbol keeps its color across both. */
export const TRANSFORMER_SYMBOLS: SymbolMap = {
  X: { color: 'orange', name: 'X: the token vectors, one row per token (x inside a block)', code: ['X', 'x'] },
  Q: { color: 'teal', name: 'Q: the queries, one row per token: what each token is looking for', code: ['Q', 'q'] },
  K: { color: 'green', name: 'K: the keys, one row per token: what each token can be found by', code: ['K', 'k'] },
  V: { color: 'gold', name: 'V: the values, one row per token: what each token hands over', code: ['V', 'v'] },
  W: { color: 'blue', name: 'W: learned weight matrices (W_Q, W_K, W_V, W_O, and the MLP weights W_1, W_2)', code: ['Wq', 'Wk', 'Wv', 'Wo', 'W1', 'W2'] },
  A: { color: 'purple', name: 'A: the attention weights; row i says how much token i takes from each token', code: ['A'] },
  P: { color: 'red', name: 'P: the positional encodings, one row per position', code: ['P'] },
  dk: { color: 'slate', name: 'd_k: the length of each query and key vector', tex: 'd_k', code: ['d_k'] },
  d: { color: 'slate', name: 'd: the model width, the length of every token vector', code: ['d', 'd_model'] },
};
