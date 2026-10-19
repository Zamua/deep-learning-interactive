import type { SymbolMap } from '../core/symbols';

/** Shared by the modern-transformer chapter and its lecture, so a symbol keeps its color across both. */
export const MODERN_TRANSFORMER_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: "x: a token's vector in the residual stream", code: ['x'] },
  q: { color: 'teal', name: 'q: a query vector, what a token is looking for', code: ['q', 'Q', 'q_m'] },
  k: { color: 'green', name: 'k: a key vector, what a token can be found by', code: ['k', 'K', 'k_n'] },
  v: { color: 'gold', name: 'v: a value vector, what a token hands over', code: ['v', 'V'] },
  W: { color: 'blue', name: 'W: learned weight matrices (Wq, Wk, Wv, Wo, and the MLP weights W1, W2, W3)', code: ['Wq', 'Wk', 'Wv', 'Wo', 'W1', 'W2', 'W3'] },
  g: { color: 'blue', name: 'g: the learned gain of a norm, one number per channel', code: ['g', 'g_q', 'g_k'] },
  theta: { color: 'red', name: 'θ: the rotation speeds of RoPE, one per pair of dimensions', tex: '\\theta', code: ['theta'] },
  S: { color: 'purple', name: 'S: attention scores (logits), one per query and key pair', code: ['S', 'scores'] },
  d: { color: 'slate', name: 'd: a vector length (the model width, or one head\'s width)', code: ['d', 'd_head'] },
};
