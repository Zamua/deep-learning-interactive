import type { SymbolMap } from '../core/symbols';

/** Shared by the math-kit chapter and its lecture, so a symbol keeps its color across both. */
export const MATH_KIT_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: an input (one number, or a vector of numbers)',
    about: 'In this lecture it is one number (f(3) is 7), a 2-vector like [3, 1], or a whole image flattened to 3,072 numbers. Adding, scaling, length and dot products work the same at any size.',
  },
  w: {
    color: 'blue',
    name: 'w: a vector of weights (the blue arrow)',
    about: 'Drawn as the blue arrow. w.dot(x) is large when the arrows point the same way, zero at a right angle and negative when opposite, so with a class\'s weights it scores how well x matches. Each entry is a weight: it sets how much the matching entry of x counts in the sum.',
  },
  W: {
    color: 'blue',
    name: 'W: a matrix, a grid of numbers (in the course: the weights)',
    about: 'Read it as a stack of row vectors: W.dot(x) is one dot product per row, and its shape is (rows, columns). In the course W is 10 by 3,072, one row of weights per class, so W.dot(image) gives ten scores.',
  },
  f: {
    color: 'purple',
    name: 'f: a function, the machine that turns inputs into an output',
    about: 'Same input, same output: that is the whole contract. Here f is 2x + 1, then x squared, then the bowl x² + 3y²; in the course the big functions are the network and the loss.',
  },
  h: {
    color: 'slate',
    name: 'h: a tiny step, used to measure a slope numerically',
    about: 'Rise over run from x to x + h estimates the slope. Shrinking h (1, 0.1, 0.01) swings the secant onto the tangent, and the ratio settles on the derivative: 3 for x squared at 1.5.',
  },
  grad: {
    color: 'teal',
    name: '∇f: the gradient, the vector of all partial derivatives',
    tex: '\\nabla f',
    code: ['grad'],
    about: 'One partial derivative per input, collected into a vector: for x² + 3y² it is [2x, 6y]. It points straight uphill, so gradient descent steps against it. The word means slope, like the gradient of a road.',
  },
  mu: {
    color: 'gold',
    name: 'μ: the mean (the average)',
    tex: '\\mu',
    code: ['mu'],
    about: 'Add up the numbers and divide by how many there are. Adding mu to standard bell-curve samples shifts them so they are centered at mu.',
  },
  sigma: {
    color: 'green',
    name: 'σ: the standard deviation (the typical spread)',
    tex: '\\sigma',
    code: ['sigma'],
    about: 'A typical distance from the mean: about two thirds of a bell curve lies within one sigma, about 95% within two. Multiplying randn by sigma stretches the spread, which is how 0.01 * randn makes small starting weights.',
  },
};
