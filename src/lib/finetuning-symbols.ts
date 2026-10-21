import type { SymbolMap } from '../core/symbols';

/** Shared by the fine-tuning chapter and its lecture, so a quantity keeps its color in both. */
export const FINETUNING_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W₀: a pretrained weight matrix, d by k, frozen during LoRA',
    tex: 'W_0',
    code: ['W0'],
    about: 'It gets no gradient and no optimizer state; LoRA only adds a path beside it. A typical size here is 4,096 by 4,096, about sixteen million numbers. The 0 marks the starting point.',
  },
  dW: {
    color: 'teal',
    name: 'ΔW: the change fine-tuning makes to a weight matrix',
    tex: '\\Delta W',
    code: ['dW'],
    about: 'Full fine-tuning learns every one of its d times k entries. LoRA bets it is close to low rank and learns it as (α / r) B A instead.',
  },
  B: {
    color: 'green',
    name: 'B: LoRA’s up-projection, d by r, initialized to zero',
    code: ['B'],
    about: 'Spreads the r-number bottleneck back out to d outputs. Starting at zero makes B A zero, so step zero is exactly the pretrained model; its gradient passes through A, so B moves first.',
  },
  A: {
    color: 'orange',
    name: 'A: LoRA’s down-projection, r by k, initialized at random',
    code: ['A'],
    about: 'Squeezes the k-dimensional input down to r numbers. It must start random: if A and B both started at zero, neither would ever get a gradient.',
  },
  r: {
    color: 'slate',
    name: 'r: the rank of the update, much smaller than d and k',
    code: ['r'],
    about: 'Sets the adapter\'s size: r(d + k) numbers instead of d times k. Typical ranks run from 8 to 64; at rank 8 on a 4,096-wide matrix that is about 0.4 percent of the weights.',
  },
  alpha: {
    color: 'slate',
    name: 'α: LoRA’s scale; the update is multiplied by α / r',
    tex: '\\alpha',
    code: ['alpha'],
    about: 'Dividing by r keeps the update\'s size steady as the rank changes, so r can be tuned without re-tuning everything else. Common choices are α = r or α = 2r.',
  },
  m: {
    color: 'gold',
    name: 'm: the loss mask, 1 for tokens the model should learn to write, 0 otherwise',
    code: ['mask'],
    about: 'Masked-out tokens stay in the context; only their predictions go ungraded. The end-of-turn token gets a 1, which is how the model learns to stop. In the example, 10 of 50 tokens carry loss.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, average negative log-probability of the masked-in tokens',
    code: ['loss'],
    about: 'The pretraining loss restricted to the answer: mask times token log-probability, summed, negated and divided by the number of ones. In distillation it becomes a masked KL divergence to the teacher.',
  },
};
