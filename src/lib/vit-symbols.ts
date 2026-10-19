import type { SymbolMap } from '../core/symbols';

/** Shared by the vision transformer chapter and its lecture, so a symbol keeps its color across both. */
export const VIT_SYMBOLS: SymbolMap = {
  xp: { color: 'orange', name: 'x_p: the patches, each flattened into one row of P·P·C numbers', tex: 'x_p', code: ['patches', 'x_p'] },
  E: { color: 'blue', name: 'E: the patch embedding, a (P·P·C) by D matrix that turns a patch into a token', code: ['E'] },
  Epos: { color: 'red', name: 'E_pos: the position embeddings, one learned row of D numbers per position', tex: String.raw`E_{\text{pos}}`, code: ['E_pos'] },
  cls: { color: 'gold', name: 'x_cls: the class token, a learned vector placed in front of the patches', tex: String.raw`x_{\text{cls}}`, code: ['cls'] },
  z: { color: 'green', name: 'z: the token vectors, one row per token, as they flow through the encoder', code: ['z', 'z0'] },
  A: { color: 'purple', name: 'A: the attention weights; row i says how much token i takes from each token', code: ['A'] },
  P: { color: 'slate', name: 'P: the patch size; every patch is P by P pixels', code: ['P'] },
  D: { color: 'slate', name: 'D: the model width, the length of every token vector', code: ['D'] },
};
