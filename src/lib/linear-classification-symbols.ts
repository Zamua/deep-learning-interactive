import type { SymbolMap } from '../core/symbols';

/** Shared by the linear-classification chapter and its lecture, so a symbol keeps its color across both. */
export const LINEAR_CLASSIFICATION_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the weights, one row per class' },
  x: { color: 'orange', name: 'x: the input image as one column of numbers', code: ['x', 'X', 'X_batch'] },
  b: { color: 'green', name: 'b: the biases, one per class' },
  s: { color: 'purple', name: 's: the class scores', code: ['scores'] },
  y: { color: 'gold', name: 'y: the index of the correct class', code: ['y', 'y_batch'] },
  L: { color: 'red', name: 'L: the loss, how unhappy we are with the scores', code: ['loss', 'data_loss'] },
  p: { color: 'teal', name: 'p: probabilities from the softmax', code: ['probs'] },
  lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
};
