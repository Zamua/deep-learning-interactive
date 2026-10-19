import type { SymbolMap } from '../core/symbols';

/** Shared by the attention chapter and its lecture, so a symbol keeps its color across both. */
export const ATTENTION_SYMBOLS: SymbolMap = {
  v: { color: 'orange', name: 'v_i: the feature vector at location i (what the ConvNet saw there)', code: ['v', 'feats'] },
  h: { color: 'green', name: 'h: the RNN hidden state, which decides where to look', code: ['h'] },
  e: { color: 'purple', name: 'e_i: the attention score of location i', code: ['e', 'scores'] },
  alpha: { color: 'teal', name: 'α_i: attention weights, positive and summing to 1', tex: '\\alpha', code: ['alpha'] },
  z: { color: 'gold', name: 'z: the context vector, the attention-weighted average of features', code: ['z', 'z_soft', 'z_hard'] },
  theta: { color: 'blue', name: 'θ: the transform parameters predicted by the localization net', tex: '\\theta', code: ['theta'] },
  U: { color: 'slate', name: 'U: the input image or feature map being read', code: ['U'] },
  V: { color: 'red', name: "V: the spatial transformer's output", code: ['V'] },
};
