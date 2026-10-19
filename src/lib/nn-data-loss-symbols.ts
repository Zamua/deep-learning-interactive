import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-data-loss chapter and its lecture, so a symbol keeps its color across both. */
export const NN_DATA_LOSS_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the data, or the activations coming into a layer', code: ['x', 'X'] },
  W: { color: 'blue', name: 'W: the weights', code: ['W', 'w', 'W1', 'W2', 'W3'] },
  mu: { color: 'teal', name: 'μ: a mean (average), per feature', tex: '\\mu', code: ['mu'] },
  gamma: { color: 'purple', name: 'γ: batch norm scale, learned', tex: '\\gamma', code: ['gamma'] },
  beta: { color: 'green', name: 'β: batch norm shift, learned', tex: '\\beta', code: ['beta'] },
  p: { color: 'gold', name: 'p: dropout keep probability', code: ['p'] },
  lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss', 'data_loss'] },
};
