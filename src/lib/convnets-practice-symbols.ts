import type { SymbolMap } from '../core/symbols';

/** Shared by the convnets-practice chapter and its lecture, so a symbol keeps its color across both. */
export const CONVNETS_PRACTICE_SYMBOLS: SymbolMap = {
  X: { color: 'orange', name: 'X: an input image (or the inputs, rearranged)', code: ['X', 'img', 'X_col'] },
  W: { color: 'blue', name: 'W: weights (filters)', code: ['W', 'W_row'] },
  A: { color: 'purple', name: 'A: features a layer computes (activations, CNN codes)', code: ['A', 'codes'] },
  p: { color: 'teal', name: 'p: predicted class probabilities', code: ['probs'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss'] },
  lr: { color: 'slate', name: 'η: the learning rate', tex: '\\eta', code: ['lr', 'base_lr'] },
  C: { color: 'slate', name: 'C: the number of channels (depth) of a volume', code: ['C'] },
};
