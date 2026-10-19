import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-learning chapter and its lecture, so a symbol keeps its color across both. */
export const NN_LEARNING_SYMBOLS: SymbolMap = {
  w: { color: 'blue', name: 'w: the parameters (weights) being trained', code: ['w', 'W', 'W1'] },
  dw: { color: 'teal', name: '∇L: the gradient of the loss with respect to w', tex: '\\nabla L', code: ['dw', 'dW'] },
  lr: { color: 'slate', name: 'η: the learning rate (step size)', tex: '\\eta', code: ['learning_rate', 'lr', 'lr0'] },
  mu: { color: 'gold', name: 'μ: the momentum coefficient, often 0.9', tex: '\\mu', code: ['mu'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss'] },
  lam: { color: 'purple', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
  h: { color: 'orange', name: 'h: the small step used for a numerical gradient', code: ['h'] },
};
