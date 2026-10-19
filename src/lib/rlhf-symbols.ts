import type { SymbolMap } from '../core/symbols';

/** Shared by the RLHF chapter and its lecture, so a symbol keeps its color across both. */
export const RLHF_SYMBOLS: SymbolMap = {
  pi: { color: 'blue', name: 'π_θ: the policy, the language model being trained', tex: '\\pi_\\theta', code: ['policy', 'logp', 'logp_old', 'logits', 'logits_old'] },
  piref: { color: 'orange', name: 'π_ref: the frozen reference model, a copy of the SFT model', tex: '\\pi_{\\text{ref}}', code: ['ref', 'logp_ref'] },
  r: { color: 'gold', name: 'r_φ: the reward model’s score for a whole answer', tex: 'r', code: ['reward', 'r_chosen', 'r_rejected', 'rm'] },
  rho: { color: 'purple', name: 'ρ_t: the importance ratio, new probability over old', tex: '\\rho', code: ['ratio'] },
  A: { color: 'green', name: 'Â_t: the advantage, how much better this token turned out than expected', tex: '\\hat{A}', code: ['adv'] },
  V: { color: 'teal', name: 'V: the value head, its guess of the reward still to come from here', code: ['values', 'critic'] },
  kl: { color: 'red', name: 'KL: how far the policy has drifted from the reference', tex: '\\mathrm{KL}', code: ['kl'] },
  eps: { color: 'slate', name: 'ε: the clip range, usually 0.2', tex: '\\epsilon', code: ['eps'] },
  beta: { color: 'slate', name: 'β: the strength of the KL penalty', tex: '\\beta', code: ['beta'] },
  lam: { color: 'slate', name: 'λ: the GAE knob between bias and variance', tex: '\\lambda', code: ['lam'] },
};
