import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  '.generate': {
    is: 'writes a full response, reasoning first',
    more: 'In the intro it returns the chain of thought z. The distillation teacher returns the chain and its final answer, z and a.',
  },
  '.sample': {
    is: 'draws one random response',
    more: 'At a nonzero temperature, such as temp=0.7, each call follows a different chain of thought: the raw material for voting and best-of-n.',
  },
  vote: {
    is: 'the most common final answer',
    more: 'Majority voting over sampled answers, which Wang and colleagues (2022) named self-consistency.',
  },
  beam_search: {
    is: 'keeps the best partial solutions, step by step',
    more: 'Extends each kept partial solution with sampled next steps, scores them all with a PRM, and keeps the top few. The beam is that small set of survivors.',
  },
  forward: {
    is: 'one forward pass of the cartoon network',
    more: 'Each of the L layers performs one swap, so a pass handles at most L swaps. It returns where the ball is and the swaps still left.',
  },
  extract: {
    is: 'pulls the final answer out of a response',
    more: 'Votes and checks compare these answers, not the full text: many different chains reach the same answer.',
  },
  Counter: {
    is: 'counts how often each item appears',
    more: 'Python\'s collections.Counter. Its most_common(1) then returns the winning answer with its count.',
    eg: 'Counter([14, 14, 9])   # Counter({14: 2, 9: 1})',
  },
  comb: {
    is: 'the number of ways to choose k of n',
    more: 'Python\'s math.comb, the binomial coefficient "n choose k". Here it counts the ways k of n samples can be the right ones.',
    eg: 'comb(5, 2)   # 10',
  },
  orm_model: {
    is: 'outcome reward model: one score per solution',
    more: 'Trained on whether the final answer was right. It can say a solution is wrong but not where, and can learn to like slips that cancel out.',
  },
  prm_model: {
    is: 'process reward model: a score for each step',
    more: 'Returns the probability that each step is correct. Their product scores the whole solution, and the first step below 0.5 marks where it went wrong.',
  },
  sample_steps: {
    is: 'samples a few possible next steps',
    more: 'Each candidate extends a partial solution by one reasoning step, for the PRM to score.',
  },
  best_of: {
    is: 'the response the verifier scores highest',
    more: 'Best-of-n: score every sample and keep the top one. With an imperfect verifier, too many samples let an exploit win.',
  },
  '.think': {
    is: 'writes a chain of thought within a budget',
    more: 'The reasoning model thinks for up to T tokens, then answers. Most APIs expose the budget as a token cap or an effort level.',
  },
  wants_to_stop: {
    is: 'whether the model is about to stop thinking',
    more: 'True when it would write the end-of-thinking marker. Budget forcing holds the marker back and appends "Wait", so the model checks its work again.',
  },
  check: {
    is: 'whether an answer is right',
    more: 'Filters the teacher\'s traces, so the student learns only from chains that reach a correct answer.',
  },
  '.log_probs': {
    is: 'the student\'s log-probability of each token',
    more: 'Per-token log-probabilities of the teacher\'s text y given x. The loss is their negated mean: plain next-token prediction.',
  },
};
