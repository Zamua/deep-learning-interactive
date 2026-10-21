import type { SymbolMap } from '../core/symbols';

/** Shared by the inference chapter and its lecture, so a symbol keeps its color across both. */
export const INFERENCE_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: a weight matrix; all of them together are the N parameters',
    code: ['W', 'w', 'W_hat'],
    about: 'In bf16 each weight is 2 bytes: 16 GB for the 8B model, read in full at every decode step. Quantization stores it as integers plus scales, and W_hat is the dequantized copy.',
  },
  B: {
    color: 'slate',
    name: 'B: the batch size, how many sequences share one decode step',
    code: ['B'],
    about: 'Every weight fetched serves B tokens, so throughput grows almost B-fold until the step turns compute-bound: 207 tokens per second at B = 1, about 8,700 at 64. Each sequence\'s KV cache does not batch, which caps B at long contexts.',
  },
  I: {
    color: 'red',
    name: 'I: arithmetic intensity, floating-point operations per byte moved',
    code: ['intensity'],
    about: 'A decode step at batch 1 has I ≈ 1, far below the H100\'s ridge of about 295; batching B sequences raises it to about B. Below the ridge the time is set by memory bandwidth, above it by compute.',
  },
  s: {
    color: 'teal',
    name: 's: the quantization scale, the real-number size of one integer step',
    code: ['s'],
    about: 'For absmax int8, s = max|w| / 127 (or / 7 at 4 bits), and rounding errs by at most s / 2. One large weight inflates s for everything sharing it, which is why scales are kept per channel or per group.',
  },
  z: {
    color: 'green',
    name: 'z: the zero point, the integer that stands for the real number 0',
    code: ['z'],
    about: 'Zero-point quantization uses it to map the actual range, min to max, onto all 256 codes; dequantize with s · (w_int − z). Absmax is the special case z = 0.',
  },
  p: {
    color: 'purple',
    name: "p: the target (big) model's next-token distribution",
    code: ['p'],
    about: 'What the output must match exactly. One target pass over the k guesses gives p at every guessed position, and one more after them. In distillation, p is the teacher\'s softened distribution.',
  },
  q: {
    color: 'gold',
    name: "q: the draft (small) model's next-token distribution",
    code: ['q'],
    about: 'Cheap to sample from, so it proposes the k guesses; the closer q is to p, the more survive. The name speculative comes from speculative execution in processors: do work early, keep it if the guess was right. In distillation, q is the student\'s.',
  },
  alpha: {
    color: 'orange',
    name: 'α: the acceptance rate, the chance a draft token is kept',
    tex: '\\alpha',
    code: ['alpha'],
    about: 'α = Σ min(p, q), the overlap of the two distributions. Expected tokens per pass are (1 − α^(k+1)) / (1 − α): 3.36 at α = 0.8 with k = 4.',
  },
  k: {
    color: 'slate',
    name: 'k: how many tokens the draft proposes per pass',
    code: ['k'],
    about: 'A pass yields between 1 and k + 1 tokens. Each guess costs a draft step, so a larger k pays only while guesses keep surviving: 4 in the example, 8 at the best speedup.',
  },
};
