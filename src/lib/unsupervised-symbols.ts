import type { SymbolMap } from '../core/symbols';

/** Shared by the unsupervised chapter and its lecture, so a symbol keeps its color across both. */
export const UNSUPERVISED_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: a data point (an image, a clip, or here often a 2-D point)', code: ['x', 'X', 'x_real'] },
  z: { color: 'purple', name: 'z: the latent code, a few numbers that summarize x', code: ['z'] },
  mu: { color: 'teal', name: 'μ: the mean the encoder predicts for z', tex: '\\mu', code: ['mu'] },
  sig: { color: 'green', name: 'σ: the spread (standard deviation) the encoder predicts for z', tex: '\\sigma', code: ['sigma'] },
  eps: { color: 'slate', name: 'ε: noise drawn from a standard normal distribution', tex: '\\epsilon', code: ['eps'] },
  G: { color: 'blue', name: 'G: the generator, turning noise into a fake sample', code: ['G'] },
  D: { color: 'gold', name: 'D: the discriminator, giving the probability a sample is real', code: ['D'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss', 'loss_D', 'loss_G'] },
};
