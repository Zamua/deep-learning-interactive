import type { SymbolMap } from '../core/symbols';

/** Shared by the numpy chapter and its lecture, so a symbol keeps its color across both. */
export const NUMPY_SYMBOLS: SymbolMap = {
  X: {
    color: 'orange',
    name: 'X: a batch of inputs, one example (image) per row',
    code: ['X', 'X_train', 'Xtr'],
    about: 'Shape (N, D): N examples, each flattened to D numbers (3,072 for a CIFAR-10 image); Xtr is the training set, (M, D). Reductions with axis=0 run down the examples, so X.mean(axis=0) is the mean image.',
  },
  W: {
    color: 'blue',
    name: 'W: the weights',
    about: 'In scores = X.dot(W) + b it has shape (D, C), one column per class. Each entry is a weight: it sets how much one input value counts toward one class score.',
  },
  b: {
    color: 'green',
    name: 'b: the biases, one per class',
    about: 'Shape (C,), one number per class, and broadcasting adds the same b to every row of the (N, C) scores. With an all-zero input the score is just b: the class\'s built-in lean before any evidence.',
  },
  scores: {
    color: 'purple',
    name: 'scores: one row of class scores per example',
    tex: 's',
    code: ['scores'],
    about: 'Shape (N, C): a row per example, a column per class. scores[np.arange(N), y] picks each row\'s correct-class score, and argmax(axis=1) picks each row\'s predicted class.',
  },
  y: {
    color: 'gold',
    name: 'y: the correct class index of each example',
    code: ['y', 'y_train'],
    about: 'Shape (N,), integers from 0 to C - 1. Paired with np.arange(N), it picks one column per row; compared with predictions, np.mean(y_pred == y) is the accuracy.',
  },
  dists: {
    color: 'teal',
    name: 'dists: the distance from every test image to every training image',
    tex: 'd',
    code: ['dists'],
    about: 'Shape (N, M): dists[i, j] is the L2 distance from test image i to training image j. The distance trick builds it with one matrix product and broadcasting instead of two loops.',
  },
  mask: {
    color: 'red',
    name: 'mask: a boolean array, True where a condition holds',
    code: ['mask'],
    about: 'Same shape as the array it came from, e.g. a > 15. Indexing with it returns the True entries as a flat copy, and assigning through it changes only those positions: hidden[hidden < 0] = 0 is a ReLU.',
  },
};
