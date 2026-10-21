import type { SymbolMap } from '../core/symbols';

/** Shared by the policy-gradients chapter and its lecture, so a symbol keeps its color across both. */
export const POLICY_GRADIENTS_SYMBOLS: SymbolMap = {
  theta: {
    color: 'blue',
    name: 'θ: the policy\'s parameters (here, one logit per answer)',
    tex: '\\theta',
    code: ['theta'],
    about: 'REINFORCE starts θ at the log of the base model\'s probabilities, so softmax(θ) begins at [0.4, 0.1, 0.3, 0.2]. Every update moves θ along reward (or advantage) times ∇ log π.',
  },
  pi: {
    color: 'purple',
    name: 'π_θ: the policy, a probability for every answer (or next token)',
    tex: '\\pi_\\theta',
    code: ['pi', 'probs'],
    about: 'In the bandit scenes, four probabilities, one per complete answer; for a language model, the softmax over the next token. "Policy" is the reinforcement learning word for the rule that picks an action in each state.',
  },
  R: {
    color: 'gold',
    name: 'R: the reward, a score for a whole answer',
    code: ['R', 'r', 'rewards'],
    about: 'Arrives once, at the end of an answer, and needs no gradient. In the toy it is 1, 0.5 or 0; training raises its expected value, the average of R weighted by π (0.35 at the start).',
  },
  b: {
    color: 'green',
    name: 'b: the baseline, the reward we expected',
    code: ['b'],
    about: 'Best when close to the average reward; here a running mean, b = 0.9 b + 0.1 r. Since ∇ log π averages to zero, subtracting b leaves the expected gradient unchanged and only removes noise.',
  },
  A: {
    color: 'red',
    name: 'A: the advantage, R minus the baseline',
    code: ['A'],
    about: 'Positive when an answer beat expectations, negative when it fell short, so even a wrong answer now teaches something. With one reward per answer, every token of the answer shares the same A.',
  },
  g: {
    color: 'teal',
    name: '∇ log π: the gradient of an answer\'s log-probability',
    tex: '\\nabla_\\theta \\log \\pi_\\theta',
    code: ['grad_logp'],
    about: 'For a softmax policy, the one-hot vector of the sampled answer minus π; its entries sum to zero. Statisticians call the gradient of a log-likelihood the score, so this estimator is also called the score-function estimator.',
  },
  piref: {
    color: 'orange',
    name: 'π_ref: the frozen reference model',
    tex: '\\pi_{\\text{ref}}',
    code: ['pi_ref'],
    about: 'A frozen copy of the starting model. Each answer is charged β log(π(y) / π_ref(y)), so answers the reference almost never writes, like the reward model\'s shouted blind spot, cost a lot.',
  },
  beta: {
    color: 'slate',
    name: 'β: strength of the KL penalty',
    tex: '\\beta',
    code: ['beta'],
    about: 'The price of drifting from the reference. A tiny β lets the policy abandon everything for a reward hack, a large one keeps it at the reference; in the toy, about 0.2 gives the most true quality.',
  },
};
