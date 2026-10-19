import type { SymbolMap } from '../core/symbols';

/** Shared by the parallelism chapter and its lecture, so a symbol keeps its color across both. */
export const PARALLELISM_SYMBOLS: SymbolMap = {
  Psi: { color: 'slate', name: 'Ψ: the number of parameters in the model', tex: '\\Psi', code: ['n_params'] },
  W: { color: 'blue', name: 'W: weight matrices (W1 and W2 are the two matrices of an MLP)', code: ['W', 'W1', 'W2', 'W1_0', 'W1_1', 'W2_0', 'W2_1', 'W1_i', 'W2_i'] },
  X: { color: 'orange', name: 'X: activations, the values flowing forward through the layers', code: ['X', 'x', 'acts'] },
  G: { color: 'teal', name: 'G: gradients, one per parameter', code: ['G', 'grads', 'grad'] },
  N: { color: 'green', name: 'N: the number of GPUs taking part in one collective (or one kind of parallelism)', code: ['N', 'n_gpus'] },
  p: { color: 'purple', name: 'p: the number of pipeline stages', code: ['p', 'n_stages'] },
  m: { color: 'gold', name: 'm: the number of micro-batches per step', code: ['m', 'n_micro'] },
  B: { color: 'red', name: 'B: link bandwidth, bytes per second each GPU can send', code: ['bw'] },
};
