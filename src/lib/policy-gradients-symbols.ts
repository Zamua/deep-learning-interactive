import type { SymbolMap } from '../core/symbols';

/** Shared by the policy-gradients chapter and its lecture, so a symbol keeps its color across both. */
export const POLICY_GRADIENTS_SYMBOLS: SymbolMap = {
  theta: { color: 'blue', name: 'θ: the policy\'s parameters (here, one logit per answer)', tex: '\\theta', code: ['theta'] },
  pi: { color: 'purple', name: 'π_θ: the policy, a probability for every answer (or next token)', tex: '\\pi_\\theta', code: ['pi', 'probs'] },
  R: { color: 'gold', name: 'R: the reward, a score for a whole answer', code: ['R', 'r', 'rewards'] },
  b: { color: 'green', name: 'b: the baseline, the reward we expected', code: ['b'] },
  A: { color: 'red', name: 'A: the advantage, R minus the baseline', code: ['A'] },
  g: { color: 'teal', name: '∇ log π: the gradient of an answer\'s log-probability', tex: '\\nabla_\\theta \\log \\pi_\\theta', code: ['grad_logp'] },
  piref: { color: 'orange', name: 'π_ref: the frozen reference model', tex: '\\pi_{\\text{ref}}', code: ['pi_ref'] },
  beta: { color: 'slate', name: 'β: strength of the KL penalty', tex: '\\beta', code: ['beta'] },
};
