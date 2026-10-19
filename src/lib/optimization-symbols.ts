import type { SymbolMap } from '../core/symbols';

/** Shared by the optimization chapter and its lecture, so a symbol keeps its color across both. */
export const OPTIMIZATION_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the weights, the numbers we are searching for', code: ['W', 'W0', 'W_try', 'best_W'] },
  x: { color: 'orange', name: 'x: an input example (X: all of them, one per row)', code: ['x', 'X', 'X_train', 'X_batch'] },
  y: { color: 'gold', name: 'y: the correct class of an example', code: ['y', 'Y', 'y_train', 'y_batch'] },
  L: { color: 'red', name: 'L: the loss, the single number we want to make small', code: ['L', 'loss', 'best_loss'] },
  dW: { color: 'teal', name: '∇L: the gradient, which way (and how steeply) the loss goes up', tex: '\\nabla_{W} L', code: ['dW', 'grad', 'grad_L'] },
  eta: { color: 'slate', name: 'η: the step size, also called the learning rate', tex: '\\eta', code: ['step_size'] },
  h: { color: 'purple', name: 'h: the small nudge used to measure a slope numerically', code: ['h'] },
  B: { color: 'green', name: 'B: the mini-batch size, how many examples each step looks at', code: ['B', 'batch_size'] },
};
