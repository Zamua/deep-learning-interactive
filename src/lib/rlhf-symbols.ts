import type { SymbolMap } from '../core/symbols';

/** Shared by the RLHF chapter and its lecture, so a symbol keeps its color across both. */
export const RLHF_SYMBOLS: SymbolMap = {
  pi: {
    color: 'blue',
    name: 'π_θ: the policy, the language model being trained',
    tex: '\\pi_\\theta',
    code: ['policy', 'logp', 'logp_old', 'logits', 'logits_old'],
    about: 'Starts as a copy of the SFT model and is the only network PPO changes besides the value head. "Policy" is the reinforcement learning word for the rule that picks an action in each state: here, the next token.',
  },
  piref: {
    color: 'orange',
    name: 'π_ref: the frozen reference model, a copy of the SFT model',
    tex: '\\pi_{\\text{ref}}',
    code: ['ref', 'logp_ref'],
    about: 'Never trains. Its log-probabilities measure how far the policy has drifted, so the KL penalty can hold the policy where the reward model is still accurate.',
  },
  r: {
    color: 'gold',
    name: 'r_φ: the reward model’s score for a whole answer',
    tex: 'r',
    code: ['reward', 'r_chosen', 'r_rejected', 'rm'],
    about: 'One number per finished answer, arriving on the last token only. Only differences between scores matter, so adding a constant to every score changes nothing. It is a proxy for the labelers, trustworthy only near the SFT answers it was fit on.',
  },
  rho: {
    color: 'purple',
    name: 'ρ_t: the importance ratio, new probability over old',
    tex: '\\rho',
    code: ['ratio'],
    about: 'Computed as exp(logp - logp_old). Exactly 1 on the first step over a batch; after that it reweights stale samples, as in importance sampling, and PPO clips it into [1 - ε, 1 + ε].',
  },
  A: {
    color: 'green',
    name: 'Â_t: the advantage, how much better this token turned out than expected',
    tex: '\\hat{A}',
    code: ['adv'],
    about: 'Positive makes the token more likely next time, negative less likely. Here it comes per token from GAE; the hat marks it as an estimate, built from the value head\'s guesses.',
  },
  V: {
    color: 'teal',
    name: 'V: the value head, its guess of the reward still to come from here',
    code: ['values', 'critic'],
    about: 'One prediction per position, trained by regression onto the returns. Also called the critic: in actor-critic methods the policy acts and the critic judges how well things are going.',
  },
  kl: {
    color: 'red',
    name: 'KL: how far the policy has drifted from the reference',
    tex: '\\mathrm{KL}',
    code: ['kl'],
    about: 'Estimated per token as logp_old - logp_ref. One token\'s estimate can be negative, but the average over samples never is. Named for Solomon Kullback and Richard Leibler, who defined it in 1951.',
  },
  eps: {
    color: 'slate',
    name: 'ε: the clip range, usually 0.2',
    tex: '\\epsilon',
    code: ['eps'],
    about: 'With ε = 0.2 the ratio is held between 0.8 and 1.2, so once a token is 20 percent more (or less) likely, the batch stops pushing it further.',
  },
  beta: {
    color: 'slate',
    name: 'β: the strength of the KL penalty',
    tex: '\\beta',
    code: ['beta'],
    about: 'Every token pays β times its log ratio out of the reward. Too small and the policy hacks the reward model; in the toy, β near 0.3 stops close to the true peak, which a real run cannot see.',
  },
  lam: {
    color: 'slate',
    name: 'λ: the GAE knob between bias and variance',
    tex: '\\lambda',
    code: ['lam'],
    about: 'λ = 0 trusts the value head fully (low noise, biased); λ = 1 uses all the remaining reward (unbiased, noisy). Language models usually take about 0.95. It plays the same role as the λ in TD(λ).',
  },
};
