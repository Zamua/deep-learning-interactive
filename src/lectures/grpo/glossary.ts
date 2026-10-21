import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  reward_model: {
    is: 'a network that guesses the reward',
    more: 'RLHF\'s learned scorer, trained on human comparisons. A policy that optimizes hard against it finds the inputs where its guesses are wrong.',
  },
  extract: {
    is: 'pulls the final answer out of an output',
    more: 'Compared with the stored answer, it turns a whole reasoning trace into a reward of 0 or 1.',
  },
  extract_boxed: {
    is: 'the contents of the answer box, or None',
    more: 'Returns None when the output has no box, so a missing format earns zero reward.',
  },
  equal: {
    is: 'checks a prediction against the stored answer',
    more: 'How strictly it compares matters: the next scene shows loose checkers being gamed.',
  },
  num: {
    is: 'parses an answer string as a number',
    more: 'Comparing numbers instead of text lets 722.0 pass as 722.',
    eg: 'num("722.0") == num("722")   # True',
  },
  gae: {
    is: 'PPO\'s per-token advantages from a critic',
    more: 'Generalized advantage estimation turns rewards and the critic\'s values into an advantage for every token. GRPO replaces it with a group statistic.',
  },
  V: {
    is: 'the critic: predicted reward still to come',
    more: 'A value network as large as the policy, run at every token. GRPO drops it, saving about 112 GB at seven billion parameters.',
  },
  '.sample': {
    is: 'draws one output from the policy',
    more: 'Called G times per question to build a group; sampling is random, so the outputs differ.',
  },
  verify: { is: 'the verifier\'s reward for one output', more: '1.0 if the extracted answer matches the stored one, else 0.0.' },
  sample_groups: { is: 'a group of G outputs for each question', more: 'In the toy: eight problems per batch, eight outputs each.' },
  verify_all: { is: 'rewards for every output in a group', more: 'The verifier applied to each output: an array of zeros and ones.' },
  group_adv: {
    is: 'advantages from the group\'s mean and std',
    more: 'Each output gets (r - mean) / std, so the advantages in a group sum to zero. A group whose rewards are all equal gives no signal.',
  },
  grpo_loss: {
    is: 'clipped surrogate minus a KL penalty, averaged',
    more: 'PPO\'s ratio, clip and min with the group advantage, minus β times a per-token KL estimate; averaged over each output\'s tokens, then over the group, and negated for gradient descent.',
  },
  load: {
    is: 'loads a pretrained model by name',
    more: 'Here the starting checkpoints: DeepSeek-V3-Base, and Qwen2.5-Math-7B as a distillation student.',
  },
  accuracy: { is: 'rule-based reward for a correct answer', more: 'An answer check for math and test cases for code: no reward model.' },
  format_ok: {
    is: 'rule-based reward for the required format',
    more: 'Rewards reasoning inside think tags followed by an answer, as the template asks.',
  },
  grpo: {
    is: 'trains a model with GRPO on given prompts',
    more: 'Group Relative Policy Optimization (DeepSeekMath, 2024): PPO without a critic, each output\'s advantage measured relative to its group. Here on math and code with rule-based rewards.',
  },
  sft: {
    is: 'supervised fine-tuning on a dataset',
    more: 'Plain next-token training on given text. The cold start, the 800k-sample stage and distillation into smaller models all use it.',
  },
  rejection_sample: {
    is: 'samples many answers, keeps only good ones',
    more: 'Leaves about 600k reasoning samples. The name comes from the classic Monte Carlo method that draws candidates and rejects those that fail a test.',
  },
  clipped: {
    is: 'PPO\'s clipped surrogate for ratio and A',
    more: 'Shorthand for the minimum of ratio × A and clip(ratio, 1 - ε, 1 + ε) × A, so one batch cannot move a token far.',
  },
};
