import type { SymbolMap } from '../core/symbols';

/** Shared by the case-study chapter and its lecture, so a symbol keeps its color across both. */
export const CASE_STUDY_SYMBOLS: SymbolMap = {
  X: { color: 'orange', name: 'X: the data, one row per point (N·K rows, D = 2 columns)', code: ['X'] },
  y: { color: 'gold', name: 'y: the correct class of each point', code: ['y'] },
  W: { color: 'blue', name: 'W, W2: weights (first and second layer)', code: ['W', 'W2'] },
  b: { color: 'green', name: 'b, b2: biases', code: ['b', 'b2'] },
  s: { color: 'purple', name: 's: class scores, one row per point', code: ['scores'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss', 'data_loss', 'reg_loss'] },
  g: { color: 'teal', tex: '\\nabla', name: 'gradients of the loss (dscores, dW, db, ...)', code: ['dscores', 'dW', 'db', 'dW2', 'db2', 'dhidden'] },
  hp: { color: 'slate', tex: '\\lambda', name: 'hyperparameters: reg (λ) and step_size, chosen by us', code: ['reg', 'step_size'] },
};
