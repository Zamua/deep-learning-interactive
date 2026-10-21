import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  sample: {
    is: 'draws an answer from the policy',
    more: 'Generation is random, so each call can return a different answer. The policy gradient is estimated from these samples.',
  },
  grade: {
    is: 'scores a finished answer with one number',
    more: 'Any scorer works, a program, a reward model or a person, and it needs no gradient. The toy\'s grader: 1 for a right answer with a reason, 0.5 for a bare right answer, 0 for a wrong one.',
  },
  model: {
    is: 'the policy: next-token probabilities for a state',
    more: 'Given the prompt plus every token written so far, its softmax returns a probability for each of the toy\'s five tokens.',
  },
  grad_log_pi: {
    is: 'gradient of log π(y) with respect to the logits',
    more: 'For a softmax policy: the one-hot vector for y minus the probabilities. It raises the sampled answer\'s logit and lowers the rest; it is minus the cross-entropy gradient for label y.',
    eg: 'grad_log_pi(np.zeros(2), 0)   # [0.5, -0.5]',
  },
  token_logprobs: {
    is: 'the log-probability of each token of y',
    more: 'One entry per token, given the prompt and the tokens before it. They sum to the answer\'s log-probability, so the policy gradient gets one term per token.',
  },
  kl: {
    is: 'the KL penalty for one sampled answer',
    more: 'log(π(y) / π_ref(y)): how much likelier the policy finds y than the reference does. Averaged over samples, it is the KL divergence of Kullback and Leibler (1951).',
  },
  baseline: {
    is: 'the reward expected for this prompt',
    more: 'Subtracting it turns rewards into advantages and removes noise without changing the average gradient. A running mean, GRPO\'s group mean and PPO\'s value function all estimate it.',
  },
  logp: {
    is: 'the log-probability of an answer under the policy',
    more: 'The sum of its tokens\' log-probabilities. In the surrogate loss A is a constant, so autograd differentiates only this.',
  },
};
