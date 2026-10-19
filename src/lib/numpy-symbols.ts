import type { SymbolMap } from '../core/symbols';

/** Shared by the numpy chapter and its lecture, so a symbol keeps its color across both. */
export const NUMPY_SYMBOLS: SymbolMap = {
  X: { color: 'orange', name: 'X: a batch of inputs, one example (image) per row', code: ['X', 'X_train', 'Xtr'] },
  W: { color: 'blue', name: 'W: the weights' },
  b: { color: 'green', name: 'b: the biases, one per class' },
  scores: { color: 'purple', name: 'scores: one row of class scores per example', tex: 's', code: ['scores'] },
  y: { color: 'gold', name: 'y: the correct class index of each example', code: ['y', 'y_train'] },
  dists: { color: 'teal', name: 'dists: the distance from every test image to every training image', tex: 'd', code: ['dists'] },
  mask: { color: 'red', name: 'mask: a boolean array, True where a condition holds', code: ['mask'] },
};
