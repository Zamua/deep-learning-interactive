import type { SymbolMap } from '../core/symbols';

/** Shared by the grpo chapter and its lecture, so a symbol keeps its color across both. */
export const GRPO_SYMBOLS: SymbolMap = {
  pi: { color: 'blue', name: 'π_θ: the policy being trained, a language model with weights θ', tex: '\\pi_\\theta', code: ['pi', 'logp', 'policy'] },
  piref: { color: 'green', name: 'π_ref: the frozen reference model, a copy of where training started', tex: '\\pi_{\\text{ref}}', code: ['ref', 'ref_logp'] },
  o: { color: 'purple', name: 'o_i: the i-th sampled output (a whole answer) in a group', code: ['o', 'outputs'] },
  r: { color: 'gold', name: 'r_i: the reward the verifier gave output i (1 if accepted, else 0)', code: ['r', 'rewards'] },
  A: { color: 'teal', name: 'Â: the advantage, how much better than its group an output did', tex: '\\hat{A}', code: ['A', 'adv'] },
  rho: { color: 'red', name: 'ρ: the probability ratio π_θ / π_old for one token', tex: '\\rho', code: ['ratio'] },
  eps: { color: 'slate', name: 'ε: the clip range, how far one update may move a ratio', tex: '\\varepsilon', code: ['eps', 'eps_low', 'eps_high'] },
  beta: { color: 'slate', name: 'β: the strength of the KL penalty toward the reference', tex: '\\beta', code: ['beta'] },
};
