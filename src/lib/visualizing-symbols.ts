import type { SymbolMap } from '../core/symbols';

/** Shared by the visualizing chapter and its lecture, so a symbol keeps its color across both. */
export const VISUALIZING_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the input image, 3 × 32 × 32 numbers (pixel values minus the mean color)' },
  W: { color: 'blue', name: 'W: weights: the filters of a conv layer, or a linear classifier\'s weights' },
  S: { color: 'purple', name: 'S: the class scores, one per class (S with subscript c is the score of class c)', code: ['scores'] },
  dx: { color: 'teal', name: 'the gradient: how fast a class score changes as each input number changes', tex: '\\nabla_{\\!x} S_c', code: ['dx'] },
  F: { color: 'green', name: 'F: the feature maps (activations) of one layer', code: ['F', 'F0'] },
  G: { color: 'gold', name: 'G: a Gram matrix: how strongly each pair of feature maps fires together', code: ['G', 'G_src'] },
  lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
  eps: { color: 'red', name: 'ε: the largest change allowed to any single input number', tex: '\\epsilon', code: ['eps'] },
};
