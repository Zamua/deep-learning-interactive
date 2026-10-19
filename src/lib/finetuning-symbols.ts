import type { SymbolMap } from '../core/symbols';

/** Shared by the fine-tuning chapter and its lecture, so a quantity keeps its color in both. */
export const FINETUNING_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W₀: a pretrained weight matrix, d by k, frozen during LoRA', tex: 'W_0', code: ['W0'] },
  dW: { color: 'teal', name: 'ΔW: the change fine-tuning makes to a weight matrix', tex: '\\Delta W', code: ['dW'] },
  B: { color: 'green', name: 'B: LoRA’s up-projection, d by r, initialized to zero', code: ['B'] },
  A: { color: 'orange', name: 'A: LoRA’s down-projection, r by k, initialized at random', code: ['A'] },
  r: { color: 'slate', name: 'r: the rank of the update, much smaller than d and k', code: ['r'] },
  alpha: { color: 'slate', name: 'α: LoRA’s scale; the update is multiplied by α / r', tex: '\\alpha', code: ['alpha'] },
  m: { color: 'gold', name: 'm: the loss mask, 1 for tokens the model should learn to write, 0 otherwise', code: ['mask'] },
  L: { color: 'red', name: 'L: the loss, average negative log-probability of the masked-in tokens', code: ['loss'] },
};
