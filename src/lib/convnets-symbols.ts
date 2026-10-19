import type { SymbolMap } from '../core/symbols';

/** Shared by the convnets chapter and its lecture, so a symbol keeps its color across both. */
export const CONVNETS_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the filter weights (each filter is F × F × input depth)', code: ['W', 'W0', 'W1'] },
  X: { color: 'orange', name: 'X: the input volume (width × height × depth)', code: ['X', 'V'] },
  A: { color: 'purple', name: 'A: the output volume, a stack of activation maps', code: ['A'] },
  N: { color: 'gold', name: 'N: the input width (and height)', code: ['N'] },
  F: { color: 'slate', name: 'F: the filter size, F × F pixels', code: ['F'] },
  S: { color: 'slate', name: 'S: the stride, how far the filter jumps each step', code: ['S'] },
  P: { color: 'slate', name: 'P: the zero-padding added on every border', code: ['P'] },
  K: { color: 'teal', name: 'K: the number of filters, which becomes the output depth', code: ['K'] },
};
