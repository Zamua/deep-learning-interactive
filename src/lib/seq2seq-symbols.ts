import type { SymbolMap } from '../core/symbols';

/** Shared by the seq2seq chapter and its lecture, so a symbol keeps its color across both. */
export const SEQ2SEQ_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x_j: the j-th source word (the sentence being translated)',
    code: ['x', 'src'],
    about: 'The encoder reads the source one word at a time, each as its learned embedding. The toy test sentences run from 5 to 40 words.',
  },
  y: {
    color: 'slate',
    name: 'y_t: the t-th target word (the translation being written)',
    code: ['y', 'tgt'],
    about: 'The decoder writes one y_t per step and feeds it back in as its next input. It starts from <bos> and stops when it writes <eos>, so it chooses the length itself.',
  },
  h: {
    color: 'green',
    name: 'h_j: the encoder state after reading source word j',
    code: ['h', 'hs'],
    about: 'In the plain model each h is 32 numbers, and only the last one survives, as c. Attention keeps every h_j and scores them all, so they serve as both keys and values.',
  },
  s: {
    color: 'blue',
    name: 's_t: the decoder state, its memory of what it has written',
    code: ['s'],
    about: 'It starts from c and is updated once per written word; it is 32 numbers here too. With attention, s is the query, scored against every encoder state before each word.',
  },
  c: {
    color: 'gold',
    name: 'c: the context vector the decoder reads (one per sentence, or c_t, one per step)',
    code: ['c', 'c_hard'],
    about: 'Without attention, c is the encoder\'s last state: the whole sentence squeezed into 32 numbers, the bottleneck. With attention, c_t = alpha @ hs is rebuilt for every word, a blend of the encoder states.',
  },
  e: {
    color: 'purple',
    name: 'e_tj: the score of source word j when writing word t',
    code: ['e', 'scores'],
    about: 'High means "useful for the word I am about to write". Bahdanau\'s score is a small tanh network (additive attention); the dot product score is just keys @ q.',
  },
  alpha: {
    color: 'teal',
    name: 'α_tj: attention weights, positive and summing to 1',
    tex: '\\alpha',
    code: ['alpha'],
    about: 'The softmax of the scores: a budget of attention spread over the source words, one row per written word, which together form the alignment matrix. Bahdanau et al. (2014) described it as attention: the decoder learns which source words to pay attention to.',
  },
  q: {
    color: 'blue',
    name: 'q: a query, what the reader is looking for',
    code: ['q', 'Q'],
    about: 'In Bahdanau\'s model the query is the decoder state s; the Transformer computes it with a learned projection. Query, key and value are borrowed from database and dictionary lookup.',
  },
  k: {
    color: 'green',
    name: 'k_i: a key, what entry i is filed under',
    code: ['keys', 'K'],
    about: 'Every key is scored against the query, and a key that matches it well gets a large weight. Stacked into K, one matrix multiply Q @ K.T gives every score at once.',
  },
  v: {
    color: 'red',
    name: 'v_i: a value, what entry i holds',
    code: ['values', 'V'],
    about: 'The answer is a blend of the values, weighted by alpha, so the values are what reaches the output. In Bahdanau\'s model keys and values are both the encoder states, but nothing forces them to be the same.',
  },
};
