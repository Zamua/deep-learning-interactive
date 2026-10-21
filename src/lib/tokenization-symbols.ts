import type { SymbolMap } from '../core/symbols';

/** Shared by the tokenization chapter and its lecture, so a symbol keeps its color across both. */
export const TOKENIZATION_SYMBOLS: SymbolMap = {
  t: {
    color: 'gold',
    name: 't: a token id, an integer from 0 to V - 1',
    code: ['ids'],
    about: 'Its only meaning is a row of E and a column of U: neighboring ids are unrelated tokens, so the integer is never fed to the network as a number. The word token comes from linguistics and compilers, where text is cut into tokens before anything else reads it.',
  },
  V: {
    color: 'slate',
    name: 'V: the vocabulary size, how many different tokens exist',
    code: ['V'],
    about: 'The tokenizer\'s one dial: 256 byte tokens plus one per merge. 427 for the lighthouse story, 50,257 for GPT-2, around 200,000 today. A bigger V means shorter sequences but bigger E and U tables.',
  },
  E: {
    color: 'blue',
    name: 'E: the embedding table, V rows of d numbers, one row per token',
    code: ['E'],
    about: 'Looking up row t is the same as multiplying a one-hot vector by E, so it trains like any linear layer, but only rows of tokens in the batch move. The name is geometric: each token is embedded as a point in a d-dimensional space.',
  },
  x: {
    color: 'orange',
    name: "x: a token's embedding vector, the network's input",
    code: ['x'],
    about: 'x = E[t], d numbers per token, shape (n, d) for a whole sequence. It knows which token it is but not where it sits; order is added separately.',
  },
  h: {
    color: 'green',
    name: 'h: the hidden vector the network produces at one position',
    code: ['h'],
    about: 'A vector of d numbers. Its dot product with each column of U is that token\'s score, so every layer below exists to steer h toward the output vectors of likely next tokens.',
  },
  U: {
    color: 'teal',
    name: 'U: the unembedding, d by V, one output vector per token',
    code: ['U'],
    about: 'Column j is token j\'s output vector. With weight tying U is simply Eᵀ, which saves V × d parameters: 38.6 million in GPT-2 small.',
  },
  z: {
    color: 'purple',
    name: 'z: the logits, one score per vocabulary entry',
    code: ['logits'],
    about: 'z = h U, a vector of V scores, turned into next-token probabilities by a softmax. The name comes from statistics, where a logit is the log-odds a logistic regression outputs (Berkson, 1944).',
  },
  d: {
    color: 'slate',
    name: 'd: the model width, numbers per embedding vector',
    code: ['d'],
    about: '8 in the embedding scene, 2 in the toy model, 768 in GPT-2 small. E and U each hold V × d numbers while a block holds about 12 d², so the vocabulary\'s share shrinks as d grows.',
  },
};
