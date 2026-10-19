import type { SymbolMap } from '../core/symbols';

/** Shared by the scaling-laws chapter and its lecture, so a symbol keeps its color across both. */
export const SCALING_LAWS_SYMBOLS: SymbolMap = {
  N: { color: 'blue', name: 'N: the number of parameters in the model', code: ['N', 'N_opt', 'sizes'] },
  D: { color: 'orange', name: 'D: the number of training tokens', code: ['D', 'D_opt'] },
  C: { color: 'purple', name: 'C: training compute, counted in floating-point operations (FLOPs)', code: ['C', 'budgets'] },
  L: { color: 'red', name: 'L: the loss, next-token cross-entropy in nats', code: ['L', 'loss'] },
  E: { color: 'green', name: 'E: the irreducible loss, a floor no model can go below', code: ['E'] },
  alpha: { color: 'teal', name: 'α: how fast the loss falls as parameters grow', tex: '\\alpha', code: ['alpha', 'alpha_N'] },
  beta: { color: 'gold', name: 'β: how fast the loss falls as training tokens grow', tex: '\\beta', code: ['beta', 'alpha_D'] },
  Dinf: { color: 'slate', name: 'D_inf: tokens the model will process at inference over its lifetime', tex: 'D_{\\text{inf}}', code: ['D_inf'] },
};
