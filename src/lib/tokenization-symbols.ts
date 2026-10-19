import type { SymbolMap } from '../core/symbols';

/** Shared by the tokenization chapter and its lecture, so a symbol keeps its color across both. */
export const TOKENIZATION_SYMBOLS: SymbolMap = {
  t: { color: 'gold', name: 't: a token id, an integer from 0 to V - 1', code: ['ids'] },
  V: { color: 'slate', name: 'V: the vocabulary size, how many different tokens exist', code: ['V'] },
  E: { color: 'blue', name: 'E: the embedding table, V rows of d numbers, one row per token', code: ['E'] },
  x: { color: 'orange', name: "x: a token's embedding vector, the network's input", code: ['x'] },
  h: { color: 'green', name: 'h: the hidden vector the network produces at one position', code: ['h'] },
  U: { color: 'teal', name: 'U: the unembedding, d by V, one output vector per token', code: ['U'] },
  z: { color: 'purple', name: 'z: the logits, one score per vocabulary entry', code: ['logits'] },
  d: { color: 'slate', name: 'd: the model width, numbers per embedding vector', code: ['d'] },
};
