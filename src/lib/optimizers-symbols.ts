import type { SymbolMap } from '../core/symbols';

/** Shared by the optimizers chapter and its lecture, so a symbol keeps its color across both. */
export const OPTIMIZERS_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the weights (a matrix, or any parameter tensor)', code: ['W', 'w'] },
  G: { color: 'teal', name: 'G: the gradient of the loss with respect to the weights', code: ['G', 'g', 'grad'] },
  M: { color: 'gold', name: 'M: momentum, a moving average of recent gradients', code: ['M', 'm'] },
  v: { color: 'orange', name: 'v: a moving average of squared gradients (Adam)', code: ['v'] },
  O: { color: 'purple', name: 'O: the orthogonalized update, U Vᵀ, every singular value set to 1', code: ['O'] },
  sig: { color: 'red', name: 'σᵢ: the singular values, how much a matrix stretches each of its directions', tex: '\\sigma', code: ['S', 'sigma'] },
  lr: { color: 'slate', name: 'η: the learning rate', tex: '\\eta', code: ['lr', 'lr_t', 'peak', 'eta'] },
  lam: { color: 'green', name: 'λ: weight decay strength', tex: '\\lambda', code: ['wd'] },
};
