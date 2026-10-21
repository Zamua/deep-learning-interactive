import type { SymbolMap } from '../core/symbols';

/** Shared by the welcome chapter and its lecture, so a symbol keeps its color across both. */
export const WELCOME_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: an input image (img in code), here a grid of pixel values',
    code: ['img'],
    about: 'What the model reads. A CIFAR-10 image is 32 by 32 pixels with 3 color values each: 3,072 numbers.',
  },
  s: {
    color: 'purple',
    name: 's: the class scores a model gives one image',
    code: ['scores'],
    about: 'Ten numbers for CIFAR-10, one per class; higher means the image looks more like that class. The guess is the class with the highest score, np.argmax(scores).',
  },
  y: {
    color: 'gold',
    name: 'y: the correct label',
    code: ['y'],
    about: 'An integer class index, 0 to 9 for CIFAR-10. Training compares the scores with it: net.loss(X, y) takes one label per image in X.',
  },
  err: {
    color: 'red',
    name: 'err: top-5 error, the fraction of images whose label is not among the five best guesses',
    tex: '\\mathrm{err}',
    code: ['err', 'errors'],
    about: 'ImageNet\'s contest score: a model gets five guesses per photo, and it counts as wrong only if all five miss. It fell from 28.2% in 2010 to 3.6% with ResNet in 2015, below one trained person\'s 5.1%.',
  },
};
