import type { SymbolMap } from '../core/symbols';

/** Shared by the visualizing chapter and its lecture, so a symbol keeps its color across both. */
export const VISUALIZING_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input image, 3 × 32 × 32 numbers (pixel values minus the mean color)',
    about: 'Every tool reads x or changes it: occlusion grays out patches, class visualization and inversion grow it from noise, fooling nudges it invisibly. With the mean color subtracted, zero is average gray.',
  },
  W: {
    color: 'blue',
    name: 'W: weights: the filters of a conv layer, or a linear classifier\'s weights',
    about: 'Unlike activations, weights do not depend on the image. The first layer\'s are (16, 3, 7, 7), so each filter can be drawn as a tiny 7 × 7 color picture; trained ones show oriented edges and color blobs.',
  },
  S: {
    color: 'purple',
    name: 'S: the class scores, one per class (S with subscript c is the score of class c)',
    code: ['scores'],
    about: 'Ten raw numbers, one per CIFAR-10 class, before any softmax. Most tools here explain, climb or attack one score S_c, since a probability can also rise by pushing the other classes down.',
  },
  dx: {
    color: 'teal',
    name: 'the gradient: how fast a class score changes as each input number changes',
    tex: '\\nabla_{\\!x} S_c',
    code: ['dx'],
    about: 'Shaped like x, (3, 32, 32), from one backward pass to the pixels. Its size is a saliency map, steps along it draw class pictures and invert codes, and a step along its sign makes an adversarial example.',
  },
  F: {
    color: 'green',
    name: 'F: the feature maps (activations) of one layer',
    code: ['F', 'F0'],
    about: 'One layer\'s output for one image, one map per filter: (16, 32, 32) for conv1, mostly zeros deeper in. Flattened at pool3 it is the 1,024-number CNN code; F0 is the target code in inversion.',
  },
  G: {
    color: 'gold',
    name: 'G: a Gram matrix: how strongly each pair of feature maps fires together',
    code: ['G', 'G_src'],
    about: 'Shaped (C, C) for a layer with C feature maps: entry (i, j) multiplies maps i and j position by position and sums. It keeps which features fire together and forgets where, so matching it copies texture and style but not layout.',
  },
  lam: {
    color: 'slate',
    name: 'λ: regularization strength',
    tex: '\\lambda',
    code: ['reg'],
    about: 'In class visualization it scales an L2 penalty on the image itself, x += 0.05 * (dx - 2 * reg * x), which keeps pixels from running to garish extremes. Larger λ gives a tamer, grayer picture.',
  },
  eps: {
    color: 'red',
    name: 'ε: the largest change allowed to any single input number',
    tex: '\\epsilon',
    code: ['eps'],
    about: 'The budget of an adversarial nudge: here 2/255, two brightness levels, invisible. In a linear model the score still moves by ε times the total weight size, which grows with the number of inputs.',
  },
};
