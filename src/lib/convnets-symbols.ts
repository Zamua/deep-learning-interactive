import type { SymbolMap } from '../core/symbols';

/** Shared by the convnets chapter and its lecture, so a symbol keeps its color across both. */
export const CONVNETS_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the filter weights (each filter is F × F × input depth)',
    code: ['W', 'W0', 'W1'],
    about: 'Stored as (K, F, F, D): K filters, each reaching through the full input depth. One filter is shared by every position of its activation map, so a layer holds thousands of weights instead of millions.',
  },
  X: {
    color: 'orange',
    name: 'X: the input volume (width × height × depth)',
    code: ['X', 'V'],
    about: 'The volume a layer reads: a 32 × 32 × 3 CIFAR-10 image at the start, a 7 × 7 × 512 block of features near the end. Depth means channels, not layers.',
  },
  A: {
    color: 'purple',
    name: 'A: the output volume, a stack of activation maps',
    code: ['A'],
    about: 'One activation map per filter, stacked along depth: 32 × 32 × 12 for twelve filters. The numbers at one position form a depth column, the same patch seen through different filters.',
  },
  N: {
    color: 'gold',
    name: 'N: the input width (and height)',
    code: ['N'],
    about: 'With F, S and P it sets the output width, (N - F + 2P) / S + 1. AlexNet\'s N = 227 gives 55.',
  },
  F: {
    color: 'slate',
    name: 'F: the filter size, F × F pixels',
    code: ['F'],
    about: 'Small in space but always full depth: 3 or 5 is typical, 11 in AlexNet\'s first layer. Three stacked 3 × 3 layers see 7 × 7 pixels with fewer weights than one 7 × 7 filter.',
  },
  S: {
    color: 'slate',
    name: 'S: the stride, how far the filter jumps each step',
    code: ['S'],
    about: 'Like a stride in walking, it is the length of each step. S = 1 visits every position and S = 2 every other one, roughly halving the output; N - F + 2P must divide evenly by S.',
  },
  P: {
    color: 'slate',
    name: 'P: the zero-padding added on every border',
    code: ['P'],
    about: 'Rings of zeros that let the filter sit over the border pixels. Same padding, P = (F - 1) / 2 at stride 1, keeps the output exactly as wide as the input.',
  },
  K: {
    color: 'teal',
    name: 'K: the number of filters, which becomes the output depth',
    code: ['K'],
    about: 'Each filter paints one activation map, so K is the output depth. Thanks to sharing, the layer has K × (F·F·D + 1) parameters, whatever the image size.',
  },
};
