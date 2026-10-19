import type { SymbolMap } from '../core/symbols';

/** Shared by the pretraining chapter and its lecture, so a quantity keeps its color in both. */
export const PRETRAINING_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the tokens of the text; x_t is the token at position t', code: ['x', 'tokens'] },
  p: { color: 'purple', name: 'p_θ: the model’s probability for each possible next token', tex: 'p_\\theta', code: ['probs'] },
  pd: { color: 'gold', name: 'p_data: how often each next token really occurs in the language', tex: 'p_{\\text{data}}', code: ['p_data'] },
  L: { color: 'red', name: 'L: the loss, the average negative log-probability per token', code: ['loss'] },
  PPL: { color: 'green', name: 'PPL: perplexity, the effective number of choices per token', tex: '\\mathrm{PPL}', code: ['ppl'] },
  tau: { color: 'slate', name: 'τ: the sampling temperature', tex: '\\tau', code: ['temperature'] },
  ptop: { color: 'teal', name: 'p_top: the top-p (nucleus) threshold', tex: 'p_{\\text{top}}', code: ['top_p'] },
};
