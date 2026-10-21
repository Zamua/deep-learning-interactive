import type { SymbolMap } from '../core/symbols';

/** Shared by the DPO chapter and its lecture, so a symbol keeps its color across both. */
export const DPO_SYMBOLS: SymbolMap = {
  pi: {
    color: 'blue',
    name: 'π_θ: the policy, the language model being trained',
    tex: '\\pi_\\theta',
    code: ['pi', 'policy', 'logp', 'logp_w', 'logp_l', 'theta'],
    about: 'Starts as an exact copy of the reference. The loss needs only its log-probabilities of the chosen and rejected answers; in the toy, θ is one logit per answer, so π = softmax(θ).',
  },
  piref: {
    color: 'orange',
    name: 'π_ref: the frozen reference model, usually the SFT model',
    tex: '\\pi_{\\text{ref}}',
    code: ['pi_ref', 'ref', 'ref_w', 'ref_l', 'logp_ref'],
    about: 'Everything in DPO is measured against it: the implicit reward is β times the log ratio of policy to reference. It never changes, so its log-probabilities can be computed once. In the toy it prefers the rambling answer B.',
  },
  pistar: {
    color: 'blue',
    name: 'π*: the best policy for the KL-regularized objective',
    tex: '\\pi^{*}',
    code: ['pi_star'],
    about: 'π_ref times e^(r / β), divided by Z. With β = 1 in the toy, A rises to 0.37 while B stays on top at 0.55. The star is the usual mark for "optimal".',
  },
  r: {
    color: 'gold',
    name: 'r(x, y): the reward for answer y to prompt x',
    code: ['r', 'reward', 'r_w', 'r_l'],
    about: 'Hidden from DPO: its training loop never sees a reward. Only differences between answers to the same prompt matter, so r is defined only up to a constant per prompt. The toy\'s rewards for A to D are 1.6, 0.9, -0.8 and -1.4.',
  },
  beta: {
    color: 'slate',
    name: 'β: the strength of the KL leash, and the scale of the implicit reward',
    tex: '\\beta',
    code: ['beta'],
    about: 'One meaning in two places: the price of drifting from the reference, and the exchange rate between log ratios and reward. A small β is a loose leash; most runs use 0.1, the DPO paper\'s default.',
  },
  Z: {
    color: 'slate',
    name: 'Z(x): the normalizer, a sum over every possible answer to x',
    code: ['Z'],
    about: 'Makes π* sum to one. Impossible to compute for a language model, but one number per prompt, so it cancels in the Bradley-Terry difference. Physicists call it the partition function, Z for the German Zustandssumme, "sum over states".',
  },
  yw: {
    color: 'green',
    name: 'y_w: the chosen answer, the one the labeler preferred',
    tex: 'y_w',
    code: ['y_w', 'chosen'],
    about: 'The w stands for winner. The loss raises its log-probability relative to the reference, logp_w - ref_w.',
  },
  yl: {
    color: 'red',
    name: 'y_l: the rejected answer',
    tex: 'y_l',
    code: ['y_l', 'rejected'],
    about: 'The l stands for loser. The loss lowers its log-probability relative to the reference; often both answers lose probability, the rejected one just faster.',
  },
  m: {
    color: 'purple',
    name: 'm: the implicit reward margin, β times the log-ratio gap',
    code: ['margin'],
    about: 'β times ((logp_w - ref_w) - (logp_l - ref_l)), the score the logistic loss grades. It is zero at the start, so the first loss is log 2 ≈ 0.693; a margin of a few units mostly satisfies the loss.',
  },
};
