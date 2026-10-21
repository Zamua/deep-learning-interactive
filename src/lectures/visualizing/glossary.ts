import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  forward: {
    is: 'runs the network, keeping every layer\'s output',
    more: 'It returns the ten class scores and a cache of each block\'s ReLU output (conv1 to conv3) and pooled output (pool1 to pool3), so any layer can be inspected.',
  },
  conv_forward: {
    is: 'one conv layer: slides its filter bank over a',
    more: 'Each filter, plus its bias, paints one feature map: 16 maps in the first block, then 32, then 64.',
  },
  max_pool_2x2: {
    is: 'keeps the max of each 2 × 2 block',
    more: 'It halves the height and width. After three blocks, 32 × 32 becomes 4 × 4, and 64 such maps are the 1,024-number CNN code.',
  },
  backward_to_image: {
    is: 'backpropagates all the way to the pixels',
    more: 'It returns dx, shaped like x: how fast the chosen output changes with each input number. dscores picks the scores to explain, inject starts the gradient at an inner layer instead, and relu sets how it crosses each ReLU.',
  },
  TSNE: {
    is: 'squashes high-dimensional codes down to 2-D',
    more: 'It slides points around until neighbors in the big space are neighbors on the page; gaps between far-apart clusters mean little. The name stands for t-distributed stochastic neighbor embedding.',
  },
  slice: {
    is: 'a range of indices, as an object',
    more: 'slice(a, b) inside [ ] means the same as a:b, so span can hand back a row or column range.',
    eg: 'x[slice(2, 5)]   # same as x[2:5]',
  },
  span: {
    is: 'the p pixels centered on position m',
    more: 'It returns a slice clipped at zero, so near the top or left edge the gray square is cut short; slicing past the far edge is harmless in NumPy.',
    eg: 'span(1, 8)   # slice(0, 5)',
  },
  blur: {
    is: 'a Gaussian blur of the image',
    more: 'Applied every ten steps with sigma 0.5 pixels, it wipes out the high-frequency noise that gradient ascent on raw pixels tends to grow.',
  },
  tv_grad: {
    is: 'the gradient of a smoothness penalty',
    more: 'Total variation adds up the squared differences between neighboring pixels: how much the image varies as you move across it. Its gradient pushes the inverted image toward smooth regions instead of speckle.',
  },
  gram: {
    is: 'the Gram matrix of a layer\'s feature maps',
    more: 'It flattens each of the C maps into a row and dots every pair: a (C, C) matrix of which features fire together, with where forgotten. Named after the mathematician Jørgen Pedersen Gram.',
  },
};
