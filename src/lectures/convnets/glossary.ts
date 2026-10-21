import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  conv: {
    is: 'a conv layer: slides every filter over the input',
    more: 'Each filter spans the full input depth and paints one activation map, so K filters give an output K deep. Sliding one shared filter across the input is a convolution, hence the name.',
  },
  max_pool: {
    is: 'keeps the largest value of each 2 × 2 window',
    more: 'It works on each depth slice separately, halves the width and height, and has no weights. Pooling means merging: each window\'s four numbers are pooled into one.',
  },
  gray: {
    is: 'turns a color image into grayscale',
    more: 'The three color channels collapse into one brightness channel, so the 32 × 32 × 3 truck becomes a single 32 × 32 grid for one hand-made 3 × 3 filter.',
  },
  conv_one: {
    is: 'one output number of a conv layer',
    more: 'It multiplies the F × F × D block of X starting at row i·S, column j·S by filter k, sums, and adds b[k]. That block is the neuron\'s receptive field, a term from neuroscience for the patch of the visual field one neuron responds to.',
  },
  conv_out: {
    is: 'the output width of a conv layer',
    more: 'It computes (N - F + 2P) / S + 1. The assert fails when S does not divide evenly, since the last placement would hang off the edge.',
    eg: 'conv_out(227, 11, 4, 0)   # 55',
  },
  im2col: {
    is: 'copies each receptive field into a column',
    more: 'With every patch as a column and every filter as a row, the layer becomes one matrix multiply, paid for in memory because overlapping patches are copied. The name reads "image to columns".',
  },
  divmod: {
    is: 'the quotient and remainder of a division',
    more: 'Here it turns win.argmax(), a flat index from 0 to 3, into the row and column of the max inside the 2 × 2 window: its switch.',
    eg: 'divmod(3, 2)   # (1, 1)',
  },
  fc: {
    is: 'a fully connected layer: one matrix multiply',
    more: 'Every score reads the whole volume. It equals a conv layer whose filters are as big as its input, which lets it slide over a larger image.',
  },
};
