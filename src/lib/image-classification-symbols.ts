import type { SymbolMap } from '../core/symbols';

/** Shared by the image-classification chapter and its lecture, so a symbol keeps its color across both. */
export const IMAGE_CLASSIFICATION_SYMBOLS: SymbolMap = {
  Ia: { color: 'orange', name: 'I₁: the image we want to label (a test image)', tex: 'I_1', code: ['I1'] },
  Ib: { color: 'blue', name: 'I₂: a training image we compare it against', tex: 'I_2', code: ['I2'] },
  X: { color: 'teal', name: 'X: a stack of examples, one per row (an image flattened to 3,072 numbers, or a 2-D point)', code: ['X', 'Xtr', 'X_train', 'X_test', 'Xval', 'X_folds', 'X_tr', 'X_val'] },
  y: { color: 'gold', name: 'y: labels, a class index from 0 to 9 for each example', code: ['y', 'ytr', 'y_train', 'y_test', 'yval', 'y_pred', 'y_hat', 'y_folds', 'y_tr', 'y_val'] },
  d: { color: 'red', name: 'd: a distance between two examples; 0 means identical', code: ['d', 'd1', 'd2', 'dists'] },
  k: { color: 'slate', name: 'k: how many neighbors get a vote (a hyperparameter)', code: ['k', 'best_k'] },
};
