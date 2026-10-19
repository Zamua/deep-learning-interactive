import type { SymbolMap } from '../core/symbols';

/** Shared by the welcome chapter and its lecture, so a symbol keeps its color across both. */
export const WELCOME_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: an input image (img in code), here a grid of pixel values', code: ['img'] },
  s: { color: 'purple', name: 's: the class scores a model gives one image', code: ['scores'] },
  y: { color: 'gold', name: 'y: the correct label', code: ['y'] },
  err: { color: 'red', name: 'err: top-5 error, the fraction of images whose label is not among the five best guesses', tex: '\\mathrm{err}', code: ['err', 'errors'] },
};
