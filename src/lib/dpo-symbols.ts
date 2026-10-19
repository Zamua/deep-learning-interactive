import type { SymbolMap } from '../core/symbols';

/** Shared by the DPO chapter and its lecture, so a symbol keeps its color across both. */
export const DPO_SYMBOLS: SymbolMap = {
  pi: { color: 'blue', name: 'π_θ: the policy, the language model being trained', tex: '\\pi_\\theta', code: ['pi', 'policy', 'logp', 'logp_w', 'logp_l', 'theta'] },
  piref: { color: 'orange', name: 'π_ref: the frozen reference model, usually the SFT model', tex: '\\pi_{\\text{ref}}', code: ['pi_ref', 'ref', 'ref_w', 'ref_l', 'logp_ref'] },
  pistar: { color: 'blue', name: 'π*: the best policy for the KL-regularized objective', tex: '\\pi^{*}', code: ['pi_star'] },
  r: { color: 'gold', name: 'r(x, y): the reward for answer y to prompt x', code: ['r', 'reward', 'r_w', 'r_l'] },
  beta: { color: 'slate', name: 'β: the strength of the KL leash, and the scale of the implicit reward', tex: '\\beta', code: ['beta'] },
  Z: { color: 'slate', name: 'Z(x): the normalizer, a sum over every possible answer to x', code: ['Z'] },
  yw: { color: 'green', name: 'y_w: the chosen answer, the one the labeler preferred', tex: 'y_w', code: ['y_w', 'chosen'] },
  yl: { color: 'red', name: 'y_l: the rejected answer', tex: 'y_l', code: ['y_l', 'rejected'] },
  m: { color: 'purple', name: 'm: the implicit reward margin, β times the log-ratio gap', code: ['margin'] },
};
