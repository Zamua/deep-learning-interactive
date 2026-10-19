import type { SymbolMap } from '../core/symbols';

/** Shared by the interpretability chapter and its lecture, so a quantity keeps its color in both. */
export const INTERPRETABILITY_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: an activation vector: the residual stream at one position, or a batch of them (X)', code: ['x', 'x0', 'x1', 'x2', 'X'] },
  U: { color: 'teal', name: 'W_U: the unembedding, d by V: turns a vector into one logit per token', tex: 'W_U', code: ['W_U'] },
  QK: { color: 'blue', name: 'W_QK = W_Q W_Kᵀ: the QK circuit, which decides where a head looks', tex: 'W_{QK}', code: ['W_QK', 'W_QK0', 'W_QK1'] },
  OV: { color: 'gold', name: 'W_OV = W_V W_O: the OV circuit, which decides what a head moves', tex: 'W_{OV}', code: ['W_OV', 'W_OV0', 'W_OV1'] },
  A: { color: 'purple', name: 'A: attention weights; row i says how much position i takes from each earlier position', code: ['A', 'A0', 'A1'] },
  f: { color: 'green', name: 'f: feature activations, one number per feature, mostly zero', code: ['f', 'F'] },
  W: { color: 'blue', name: 'W: feature directions, one column per feature (the toy model’s W, the SAE’s decoder W_dec)', code: ['W', 'W_dec'] },
  S: { color: 'slate', name: 'S: sparsity, the chance that a feature is zero on a given input', code: ['S'] },
  lam: { color: 'slate', name: 'λ: the L1 penalty strength, which trades reconstruction for sparsity', tex: '\\lambda', code: ['lam'] },
  L: { color: 'red', name: 'L: the loss being minimized', code: ['loss'] },
};
