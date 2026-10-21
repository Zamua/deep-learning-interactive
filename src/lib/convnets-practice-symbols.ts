import type { SymbolMap } from '../core/symbols';

/** Shared by the convnets-practice chapter and its lecture, so a symbol keeps its color across both. */
export const CONVNETS_PRACTICE_SYMBOLS: SymbolMap = {
  X: {
    color: 'orange',
    name: 'X: an input image (or the inputs, rearranged)',
    code: ['X', 'img', 'X_col'],
    about: 'One image (img) or a batch (X). Augmentation changes its pixels at random but never its label; im2col rearranges it into X_col, one receptive field per column, about 7 times bigger for AlexNet\'s first layer.',
  },
  W: {
    color: 'blue',
    name: 'W: weights (filters)',
    code: ['W', 'W_row'],
    about: 'The learned filters. im2col stretches each into one row of W_row, so a whole layer is W_row.dot(X_col); in data parallelism every GPU keeps a full copy of W.',
  },
  A: {
    color: 'purple',
    name: 'A: features a layer computes (activations, CNN codes)',
    code: ['A', 'codes'],
    about: 'From a pretrained network with its last layer removed, the 4,096 numbers per image are the CNN codes, shaped (N, 4096): features a linear classifier can use for a new task.',
  },
  p: {
    color: 'teal',
    name: 'p: predicted class probabilities',
    code: ['probs'],
    about: 'One row of class probabilities per image. At test time the rows for the ten crops are averaged, and argmax picks the label.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss'],
    about: 'Computed on augmented images in training. A framework derives its gradients for you: loss.backward(), or T.grad in Theano.',
  },
  lr: {
    color: 'slate',
    name: 'η: the learning rate',
    tex: '\\eta',
    code: ['lr', 'base_lr'],
    about: 'The size of each step, W -= lr * dW. When fine-tuning, a new head gets the full rate, the top layers a tenth, the middle a hundredth, and frozen layers zero, through a per-layer multiplier.',
  },
  C: {
    color: 'slate',
    name: 'C: the number of channels (depth) of a volume',
    code: ['C'],
    about: 'The depth of an H × H × C volume. Conv cost grows with C²: one 7 × 7 layer costs 49 H² C² multiply-adds, three 3 × 3 layers 27 H² C², and a 1 × 1 bottleneck halves C to cut further.',
  },
};
