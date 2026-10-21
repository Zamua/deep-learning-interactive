import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  finetune: {
    is: 'supervised fine-tuning on demonstrations',
    more: 'RLHF\'s first stage, which DPO keeps: its result is both the starting policy and the frozen reference.',
  },
  train_reward: {
    is: 'fits a reward model to preference pairs',
    more: 'RLHF\'s second stage, which DPO removes: the policy itself turns out to be the reward model.',
  },
  ppo: {
    is: 'RL against the reward model, on a KL leash',
    more: 'RLHF\'s third stage: sample, score, estimate values and pay the KL at every step, with four networks in memory. DPO replaces it with one loss on fixed pairs.',
  },
  '.copy': { is: 'an independent copy of the SFT model', more: 'The copy trains as the policy; the original stays frozen as the reference.' },
  dpo_loss: {
    is: 'minus log sigmoid of the implicit reward margin',
    more: 'The margin is β times how much more the policy raised the chosen answer than the rejected one, relative to the reference. Direct preference optimization: Rafailov and colleagues, 2023.',
  },
  kl: {
    is: 'the KL divergence between two policies',
    more: 'kl(pi, pi_star) sums π log(π / π*): zero only when the two match, positive otherwise, which is why nothing beats π*. Named for Kullback and Leibler, 1951.',
  },
  log_ratio: {
    is: 'log of π* over π_ref for one answer',
    more: 'How much more likely the answer became than under the reference. β times it is the implicit reward; the β log Z beside it cancels in a Bradley-Terry difference.',
  },
  log_sigmoid: {
    is: 'the log of the sigmoid, computed stably',
    more: 'Equal to minus log(1 + e^(-z)). Negated, it is the logistic loss: near zero for a large positive margin, rising in a straight line for a negative one.',
    eg: 'log_sigmoid(0.0)   # -0.693, i.e. -log 2',
  },
  load_pairs: {
    is: 'loads the fixed preference dataset',
    more: 'In the toy: a thousand pairs sampled once from the reference and labeled by a noisy labeler that follows the hidden rewards. Nothing is sampled during training.',
  },
  adam: { is: 'one Adam step on the logits θ', more: 'Adam is short for adaptive moment estimation (Kingma and Ba, 2014).' },
  grad: {
    is: 'the gradient of the loss with respect to θ',
    more: 'It raises the chosen answer\'s log-probability and lowers the rejected one\'s, each pair weighted by the sigmoid of minus its margin.',
  },
  seq_logp: {
    is: 'the log-probability of a whole answer',
    more: 'The sum of its tokens\' log-probabilities given the prompt, from one forward pass with the prompt tokens masked out. Run on the frozen reference without gradients, and on the policy with them.',
  },
};
