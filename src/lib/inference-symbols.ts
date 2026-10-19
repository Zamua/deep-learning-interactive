import type { SymbolMap } from '../core/symbols';

/** Shared by the inference chapter and its lecture, so a symbol keeps its color across both. */
export const INFERENCE_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: a weight matrix; all of them together are the N parameters', code: ['W', 'w', 'W_hat'] },
  B: { color: 'slate', name: 'B: the batch size, how many sequences share one decode step', code: ['B'] },
  I: { color: 'red', name: 'I: arithmetic intensity, floating-point operations per byte moved', code: ['intensity'] },
  s: { color: 'teal', name: 's: the quantization scale, the real-number size of one integer step', code: ['s'] },
  z: { color: 'green', name: 'z: the zero point, the integer that stands for the real number 0', code: ['z'] },
  p: { color: 'purple', name: "p: the target (big) model's next-token distribution", code: ['p'] },
  q: { color: 'gold', name: "q: the draft (small) model's next-token distribution", code: ['q'] },
  alpha: { color: 'orange', name: 'α: the acceptance rate, the chance a draft token is kept', tex: '\\alpha', code: ['alpha'] },
  k: { color: 'slate', name: 'k: how many tokens the draft proposes per pass', code: ['k'] },
};
