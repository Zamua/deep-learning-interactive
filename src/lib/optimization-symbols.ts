import type { SymbolMap } from '../core/symbols';

/** Shared by the optimization chapter and its lecture, so a symbol keeps its color across both. */
export const OPTIMIZATION_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the weights, the numbers we are searching for',
    code: ['W', 'W0', 'W_try', 'best_W'],
    about: 'For CIFAR-10 it is 10 by 3,073 with the bias folded in: 30,730 dials. Every setting is one location in the loss landscape, and each update moves it a small step downhill.',
  },
  x: {
    color: 'orange',
    name: 'x: an input example (X: all of them, one per row)',
    code: ['x', 'X', 'X_train', 'X_batch'],
    about: 'One CIFAR-10 image as 3,073 numbers (the pixels plus a constant 1), or a 2-D point in the toy problems. The data stays fixed while W changes; X_batch is a random sample of rows.',
  },
  y: {
    color: 'gold',
    name: 'y: the correct class of an example',
    code: ['y', 'Y', 'y_train', 'y_batch'],
    about: 'An integer from 0 to C - 1 per example; scores[np.arange(N), y] picks out the correct scores. Like X, it is fixed data that optimization never changes.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, the single number we want to make small',
    code: ['L', 'loss', 'best_loss'],
    about: 'An average data loss over all N examples plus reg times the sum of squared weights. With X and y fixed it is a function of W alone, a landscape whose altitude is the loss; the SVM version is convex, one bowl with no misleading dips.',
  },
  dW: {
    color: 'teal',
    name: '∇L: the gradient, which way (and how steeply) the loss goes up',
    tex: '\\nabla_{W} L',
    code: ['dW', 'grad', 'grad_L'],
    about: 'Same shape as W: dW[k, l] is how fast the loss grows if W[k, l] alone grows. It points uphill, so W += -step_size * dW goes downhill; it is computed analytically for speed and numerically to check. The word means slope, like the gradient of a road.',
  },
  eta: {
    color: 'slate',
    name: 'η: the step size, also called the learning rate',
    tex: '\\eta',
    code: ['step_size'],
    about: 'Scales every step: W += -step_size * dW. Too small and the path crawls, too large and it zig-zags or diverges (past 0.1 and 0.2 on the valley here); no formula gives it, so it is found by experiment. The name learning rate says what it sets: how far each update moves the weights.',
  },
  h: {
    color: 'purple',
    name: 'h: the small nudge used to measure a slope numerically',
    code: ['h'],
    about: 'Too large and the estimate leans (error like h one-sided, h² centered); too small and the two losses agree in almost every digit, so their difference is rounding noise. In double precision the centered difference does best near 1e-5.',
  },
  B: {
    color: 'green',
    name: 'B: the mini-batch size, how many examples each step looks at',
    code: ['B', 'batch_size'],
    about: 'Usually a power of two like 32, 64, 128 or 256, set mostly by what fits in memory. A smaller batch gives a noisier but far cheaper gradient estimate; with B = 1 it is stochastic gradient descent, stochastic being a formal word for random.',
  },
};
