import type { SymbolMap } from '../core/symbols';

/** Shared by the grpo chapter and its lecture, so a symbol keeps its color across both. */
export const GRPO_SYMBOLS: SymbolMap = {
  pi: {
    color: 'blue',
    name: 'π_θ: the policy being trained, a language model with weights θ',
    tex: '\\pi_\\theta',
    code: ['pi', 'logp', 'policy'],
    about: 'Samples G outputs per question and is updated by the GRPO loss. Unlike in PPO, no critic of the same size trains beside it.',
  },
  piref: {
    color: 'green',
    name: 'π_ref: the frozen reference model, a copy of where training started',
    tex: '\\pi_{\\text{ref}}',
    code: ['ref', 'ref_logp'],
    about: 'The KL estimate x - log x - 1, with x = π_ref / π_θ for the sampled token, keeps the policy near it. DAPO drops this term entirely.',
  },
  o: {
    color: 'purple',
    name: 'o_i: the i-th sampled output (a whole answer) in a group',
    code: ['o', 'outputs'],
    about: 'A complete response, reasoning and boxed answer, one of G drawn for the same question (G = 8 in the toy). Every token of o_i gets the same advantage.',
  },
  r: {
    color: 'gold',
    name: 'r_i: the reward the verifier gave output i (1 if accepted, else 0)',
    code: ['r', 'rewards'],
    about: 'Binary and exact, from a program rather than a network, so it is hard to hack if the checker is strict. A group\'s mean reward is the pass rate a critic would try to learn.',
  },
  A: {
    color: 'teal',
    name: 'Â: the advantage, how much better than its group an output did',
    tex: '\\hat{A}',
    code: ['A', 'adv'],
    about: '(r_i - mean) / std over the group. With two right answers out of eight, the right ones get +1.73 and the wrong ones -0.58; the advantages always sum to zero. Dr. GRPO drops the division.',
  },
  rho: {
    color: 'red',
    name: 'ρ: the probability ratio π_θ / π_old for one token',
    tex: '\\rho',
    code: ['ratio'],
    about: 'Computed as exp(logp - old_logp). 1 means unchanged; 1.3 means the token is 30 percent more likely than when it was sampled. Clipped to [1 - ε, 1 + ε] as in PPO.',
  },
  eps: {
    color: 'slate',
    name: 'ε: the clip range, how far one update may move a ratio',
    tex: '\\varepsilon',
    code: ['eps', 'eps_low', 'eps_high'],
    about: 'Usually 0.2, so ratios stay within [0.8, 1.2] per batch. DAPO\'s clip-higher splits it into eps_low = 0.2 and eps_high = 0.28, giving rare tokens more room to grow.',
  },
  beta: {
    color: 'slate',
    name: 'β: the strength of the KL penalty toward the reference',
    tex: '\\beta',
    code: ['beta'],
    about: 'GRPO puts the β-weighted KL in the loss, not the reward, so the advantage stays a clean function of the rewards. DAPO sets it to zero, letting long reasoning runs move far from the start.',
  },
};
