import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  train: {
    is: 'the one-time training run',
    more: 'Its cost is paid once. Serving costs a forward pass for every token of every answer, for as long as the model is used.',
  },
  generate: {
    is: 'produces an answer one token at a time',
    more: 'A prefill over the prompt, then a decode loop with one model pass per new token. It yields each token as soon as it exists.',
  },
  stream: {
    is: 'sends a token to the user right away',
    more: 'Because tokens go out as they are made, the time per output token is how fast the answer appears on screen.',
  },
  tokenize: { is: 'prompt text to a list of T token ids' },
  model: {
    is: 'one forward pass: logits and the KV cache',
    more: 'model(prompt) is the prefill: every prompt token in one pass, filling the cache. model([tok], cache) is a decode step: one new token, reusing every cached key and value.',
  },
  sample: {
    is: 'draws one token from a distribution',
    more: 'In prefill and decode it takes the last position\'s logits. In speculative decoding it draws a guess from q, the bonus token from p, or a correction from the normalized residual.',
  },
  step_time: {
    is: 'the roofline time of one step',
    more: 'The larger of FLOPs over peak compute and bytes over memory bandwidth. In the distill scene, step_time(B) is the decode step at batch B, which sets the time per output token. The roofline model is from Williams, Waterman and Patterson (2009).',
  },
  tokens_per_s: {
    is: 'decode throughput at batch B and context ctx',
    more: 'Each step reads the weights once plus every sequence\'s KV cache, so throughput grows with B until the caches dominate.',
    eg: 'tokens_per_s(64, 1024)   # 8,700',
  },
  any: {
    is: 'True if any element is truthy',
    more: 'Python\'s built-in. Here any(slots) is True while some slot still holds a sequence.',
    eg: 'any([None, None, 3])   # True',
  },
  decode_step: {
    is: 'one decode pass for every occupied slot',
    more: 'Each running sequence gets one new token. Between steps the scheduler frees finished slots and refills them from the queue: continuous batching.',
  },
  int8_mm: {
    is: 'a matrix multiply in 8-bit integers',
    more: 'The ordinary features are multiplied as int8 and the result scaled back to real numbers, while the few outlier features take the 16-bit path. From LLM.int8(), by Dettmers and colleagues (2022).',
  },
  rand: {
    is: 'a uniform random number in [0, 1)',
    more: 'Comparing it with min(1, p[x] / q[x]) keeps the guess with exactly that probability.',
  },
  expected_tokens: {
    is: 'tokens per target pass, on average',
    more: 'A geometric series, 1 + α + α² + … + α^k: token i + 1 comes only if the first i guesses survive.',
    eg: 'expected_tokens(0.8, 4)   # 3.36',
  },
  speedup: {
    is: 'how much faster speculative decoding is',
    more: 'Expected tokens per pass, divided by the pass\'s cost in target steps, k·c + 1, where a draft step costs c of a target step.',
    eg: 'speedup(0.8, 8, 0.05)   # 3.09',
  },
  distill: {
    is: 'trains a small student to imitate a big teacher',
    more: 'Its loss is the KL divergence from the teacher\'s temperature-softened distribution to the student\'s, scaled by τ² so the gradients keep their size. Hinton, Vinyals and Dean named it distillation in 2015.',
  },
};
