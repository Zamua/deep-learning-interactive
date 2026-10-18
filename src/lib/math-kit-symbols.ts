import type { SymbolMap } from '../core/symbols';

/** Shared by the math-kit chapter and its lecture, so a symbol keeps its color across both. */
export const MATH_KIT_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: an input (one number, or a vector of numbers)' },
  w: { color: 'blue', name: 'w: a vector of weights (the blue arrow)' },
  W: { color: 'blue', name: 'W: a matrix, a grid of numbers (in the course: the weights)' },
  f: { color: 'purple', name: 'f: a function, the machine that turns inputs into an output' },
  h: { color: 'slate', name: 'h: a tiny step, used to measure a slope numerically' },
  grad: { color: 'teal', name: '∇f: the gradient, the vector of all partial derivatives', tex: '\\nabla f', code: ['grad'] },
  mu: { color: 'gold', name: 'μ: the mean (the average)', tex: '\\mu', code: ['mu'] },
  sigma: { color: 'green', name: 'σ: the standard deviation (the typical spread)', tex: '\\sigma', code: ['sigma'] },
};
