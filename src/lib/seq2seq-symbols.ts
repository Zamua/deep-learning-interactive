import type { SymbolMap } from '../core/symbols';

/** Shared by the seq2seq chapter and its lecture, so a symbol keeps its color across both. */
export const SEQ2SEQ_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x_j: the j-th source word (the sentence being translated)', code: ['x', 'src'] },
  y: { color: 'slate', name: 'y_t: the t-th target word (the translation being written)', code: ['y', 'tgt'] },
  h: { color: 'green', name: 'h_j: the encoder state after reading source word j', code: ['h', 'hs'] },
  s: { color: 'blue', name: 's_t: the decoder state, its memory of what it has written', code: ['s'] },
  c: { color: 'gold', name: 'c: the context vector the decoder reads (one per sentence, or c_t, one per step)', code: ['c', 'c_hard'] },
  e: { color: 'purple', name: 'e_tj: the score of source word j when writing word t', code: ['e', 'scores'] },
  alpha: { color: 'teal', name: 'α_tj: attention weights, positive and summing to 1', tex: '\\alpha', code: ['alpha'] },
  q: { color: 'blue', name: 'q: a query, what the reader is looking for', code: ['q', 'Q'] },
  k: { color: 'green', name: 'k_i: a key, what entry i is filed under', code: ['keys', 'K'] },
  v: { color: 'red', name: 'v_i: a value, what entry i holds', code: ['values', 'V'] },
};
