import type { SymbolMap } from '../core/symbols';

/** Shared by the mixture-of-experts chapter and its lecture, so a symbol keeps its color across both. */
export const MOE_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: "x: one token's vector, the input to the layer", code: ['x'] },
  Wr: { color: 'blue', name: 'W_r: the router weights, one column per expert', tex: 'W_r', code: ['W_r'] },
  p: { color: 'purple', name: 'p: the router probabilities, a softmax over the experts', code: ['probs'] },
  g: { color: 'gold', name: 'g: the gate weights, how much each chosen expert counts', code: ['gates'] },
  E: { color: 'slate', name: 'E: the number of experts in a layer', code: ['E'] },
  k: { color: 'slate', name: 'k: how many experts each token uses (top-k)', code: ['k'] },
  f: { color: 'teal', name: 'f_i: the share of tokens sent to expert i', code: ['f'] },
  P: { color: 'purple', name: 'P_i: the average router probability given to expert i', code: ['P'] },
  L: { color: 'red', name: 'L_aux: the load-balancing loss', tex: '\\mathcal{L}_{\\text{aux}}', code: ['aux_loss'] },
};
