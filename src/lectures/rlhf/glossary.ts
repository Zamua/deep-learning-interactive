import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  humans_compare: {
    is: 'people pick the better of two answers',
    more: 'Returns preference pairs: a prompt, a chosen answer and a rejected one. Judging answers is far easier than writing them.',
  },
  fit_reward_model: {
    is: 'trains a network to score answers like people',
    more: 'Fit to comparisons with the Bradley-Terry loss, it reads a prompt and an answer and outputs one number: a language model whose vocabulary output is swapped for a single score.',
  },
  ppo: {
    is: 'optimizes the policy against the reward model',
    more: 'Proximal policy optimization (Schulman and colleagues, 2017): "proximal" because each update keeps the policy close to the one that sampled the data. ref=sft supplies the KL leash.',
  },
  '.logprobs': {
    is: 'the log-probability of each token of an answer',
    more: 'model.logprobs(x, y) returns one number per token of y, shape (T,), each given the prompt and the tokens before it. Their sum is the answer\'s log-probability.',
  },
  labelers_write: { is: 'people write ideal answers to prompts', more: 'InstructGPT\'s stage one: written demonstrations for about thirteen thousand prompts.' },
  finetune: {
    is: 'supervised fine-tuning on demonstrations',
    more: 'The pretrained model imitates the labelers\' answers with the ordinary next-token loss. The result is called the SFT model.',
  },
  '.sample': {
    is: 'draws answers from the model',
    more: 'sft.sample(x, n=4) writes several answers to one prompt for labelers to rank; policy.sample(x) writes the answer the reward model will score.',
  },
  labelers_rank: {
    is: 'people order answers from best to worst',
    more: 'A ranking of n answers holds n(n - 1) / 2 comparison pairs: nine answers give thirty-six. Ranking is far quicker than writing.',
  },
  copy: { is: 'an independent copy of the SFT model', more: 'The copy becomes the policy and trains; a frozen copy of the same SFT model serves as the reference.' },
  ppo_update: {
    is: 'one round of PPO on the scored answers',
    more: 'Turns the rewards into per-token advantages and runs several clipped gradient epochs over the batch. The later scenes open it up.',
  },
  logprobs: {
    is: 'per-token log-probabilities of y under the policy',
    more: 'Called once before the loop and kept fixed as logp_old, then again every epoch as the policy changes. Their difference sets the ratio ρ.',
  },
  step: { is: 'one gradient step on the loss', more: 'Each step changes the policy, so every further step on the same batch uses samples from an older policy.' },
  gae: {
    is: 'per-token advantages from rewards and values',
    more: 'Generalized advantage estimation (Schulman and colleagues, 2015) adds up the surprises δ after each token, weighted by λ to the power of the distance. It also returns the regression targets for the value head.',
  },
  '.generate': {
    is: 'samples an answer and its log-probabilities',
    more: 'policy.generate(x) returns the tokens y and, for each, logp_old: its log-probability at sampling time, the denominator of every later ratio.',
  },
  ppo_step: {
    is: 'one clipped epoch for policy and critic',
    more: 'Updates the policy with the clipped surrogate loss and the value head by regression onto the returns. Here it runs four times on each batch.',
  },
  fit_bradley_terry: {
    is: 'fits a reward model to preference pairs',
    more: 'Minimizes minus the log of the sigmoid of the score margin, chosen minus rejected. Named for Ralph Bradley and Milton Terry\'s 1952 model of paired comparisons.',
  },
  clip: {
    is: 'clamps the ratio into [1 - ε, 1 + ε]',
    more: 'Shorthand for np.clip(ratio, 1 - eps, 1 + eps). Inside the minimum it removes the incentive to move a token beyond the band in one batch.',
    eg: 'clip(1.5)   # 1.2, with eps = 0.2',
  },
};
