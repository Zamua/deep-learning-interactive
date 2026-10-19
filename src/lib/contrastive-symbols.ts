import type { SymbolMap } from '../core/symbols';

/** Shared by the contrastive chapter and its lecture, so a symbol keeps its color across both. */
export const CONTRASTIVE_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: an image, or one augmented view of it', code: ['x', 'x1', 'x2', 'images'] },
  f: { color: 'blue', name: 'f: the encoder network being trained (MoCo: f_q, and its slow copy f_k)', code: ['f', 'f_q', 'f_k', 'encoder'] },
  z: { color: 'purple', name: 'z: an embedding, a unit-length vector from the encoder (MoCo calls them q and k)', code: ['z', 'z1', 'z2', 'q', 'k'] },
  t: { color: 'green', name: "t: a text embedding from CLIP's text encoder, in the same space as z", code: ['t'] },
  S: { color: 'teal', name: 'S: the similarity matrix: every embedding against every candidate partner, divided by τ', code: ['S', 'logits'] },
  tau: { color: 'slate', name: 'τ: the temperature, which sharpens (small) or flattens (large) the softmax', tex: '\\tau', code: ['tau'] },
  y: { color: 'gold', name: "y: the targets, which column holds each row's true partner (the diagonal)", code: ['labels'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss'] },
  m: { color: 'slate', name: "m: the momentum of a moving average (MoCo's key encoder, DINO's teacher)", code: ['m'] },
};
