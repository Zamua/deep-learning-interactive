import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  log_prob: {
    is: 'the log-probability the model gives a text',
    more: 'By the chain rule it is the sum of log p(x_t | x_<t) over every token of the chunk. Pretraining minimizes minus this, averaged per token.',
  },
  tokenize: {
    is: 'text to a list of token ids',
    more: 'In the toy language each of the 36 vocabulary words is one token. Generation appends to the list one token at a time.',
  },
  model: {
    is: 'the language model: context in, next-token prediction out',
    more: 'Given x[:t], it returns the next-word probabilities in most scenes, and the logits, one score per word, in the next, teacher and bert scenes. Given a whole chunk, a transformer predicts every position in one pass.',
  },
  Counter: {
    is: 'counts how often each item occurs',
    more: 'From Python\'s collections module. Counter(zip(x, x[1:], x[2:])) tallies every trigram in the training text, and a missing key counts as 0.',
    eg: 'Counter(["the", "cat", "the"])["the"]   # 2',
  },
  cross_entropy: {
    is: 'the average surprise of the true next tokens',
    more: 'It softmaxes each row of logits and averages −log p of each target: the softmax loss at every position. The name is from information theory, the average code length when data is coded with a code built for another distribution.',
  },
  done: {
    is: 'whether generation should stop',
    more: 'A stopping test on the text so far, such as reaching the end of a sentence. The loop appends one token per pass until it returns True.',
  },
  ce: {
    is: 'short for cross-entropy, the next-token loss',
    more: 'GPT applies it at every position against the text shifted by one; BERT applies it only at the masked positions.',
  },
  p_line: {
    is: 'how likely one example line is under a task',
    more: 'A French list writes "cat => chat" 90% of the time and a random answer otherwise. Multiplying these likelihoods into the prior is Bayes\' rule.',
  },
  normalize: {
    is: 'rescales beliefs so they sum to one',
    more: 'After each example\'s likelihood is multiplied in, dividing by the total turns the scores into a posterior over the four kinds of list.',
  },
  predict: {
    is: 'the answer distribution for a new animal',
    more: 'It averages every task\'s answer for "duck", weighted by how much the posterior now believes in that task. One French example moves most of the weight to canard.',
  },
  sample: {
    is: 'draws the next token from the probabilities',
    more: 'With top_p=0.9 it is nucleus sampling: keep the smallest set of top tokens whose probabilities reach 0.9, renormalize, and draw from those.',
  },
};
