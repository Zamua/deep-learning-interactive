import type { SymbolMap } from '../core/symbols';

/** Shared by the pretraining chapter and its lecture, so a quantity keeps its color in both. */
export const PRETRAINING_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the tokens of the text; x_t is the token at position t',
    code: ['x', 'tokens'],
    about: 'A list of ids from the 36-word toy vocabulary: x[:t] is the context, and x[t] the word to predict. Generation appends to it one token at a time.',
  },
  p: {
    color: 'purple',
    name: 'p_θ: the model’s probability for each possible next token',
    tex: 'p_\\theta',
    code: ['probs'],
    about: 'A softmax over the vocabulary: 36 numbers that sum to one, given the text so far. The chain rule multiplies the p of each actual next word into the probability of a whole text.',
  },
  pd: {
    color: 'gold',
    name: 'p_data: how often each next token really occurs in the language',
    tex: 'p_{\\text{data}}',
    code: ['p_data'],
    about: 'Known exactly only for the toy grammar. Its entropy is the floor no model can beat, and a model\'s loss above that floor is the KL divergence between p_data and p_θ.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, the average negative log-probability per token',
    code: ['loss'],
    about: 'Cross-entropy in nats per token: about 1 on the toy sentence, while a uniform guess pays ln 36 ≈ 3.6. Measured in bits, it is the size of the text compressed with the model.',
  },
  PPL: {
    color: 'green',
    name: 'PPL: perplexity, the effective number of choices per token',
    tex: '\\mathrm{PPL}',
    code: ['ppl'],
    about: 'PPL = e^L: a perplexity of 5 is as unsure as a fair five-sided die at every token. Uniform guessing gives 36 here, the toy floor about 3.6. Jelinek and colleagues introduced it in 1977 to rate speech recognition tasks.',
  },
  tau: {
    color: 'slate',
    name: 'τ: the sampling temperature',
    tex: '\\tau',
    code: ['temperature'],
    about: 'Logits are divided by τ before the softmax: below 1 the favorite grows, near 0 sampling turns greedy, above 1 everything flattens. The name is from statistical physics, where a hotter system spreads its probability over more states.',
  },
  ptop: {
    color: 'teal',
    name: 'p_top: the top-p (nucleus) threshold',
    tex: 'p_{\\text{top}}',
    code: ['top_p'],
    about: 'Keep the smallest set of top tokens whose probabilities reach p_top (0.9 in the recap), then renormalize. Holtzman and colleagues called that set the nucleus: one word where the model is sure, many where many fit.',
  },
};
