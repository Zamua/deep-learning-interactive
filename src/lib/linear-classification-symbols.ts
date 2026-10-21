import type { SymbolMap } from '../core/symbols';

/** Shared by the linear-classification chapter and its lecture, so a symbol keeps its color across both. */
export const LINEAR_CLASSIFICATION_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the weights, one row per class',
    about: 'Shape (10, 3072): row c dotted with x is class c\'s score. Each row is both an arrow perpendicular to that class\'s boundary and a template image of the class. Each weight sets how much its pixel value counts toward the score, like weighing evidence: positive for the class, negative against.',
  },
  x: {
    color: 'orange',
    name: 'x: the input image as one column of numbers',
    code: ['x', 'X', 'X_batch'],
    about: 'Shape (3072,): the 32 x 32 x 3 pixel values flattened into one column, usually centered by subtracting the mean training image. The bias trick appends a constant 1, making 3,073; X stacks many examples as rows.',
  },
  b: {
    color: 'green',
    name: 'b: the biases, one per class',
    about: 'Shape (10,), added after the multiply: it slides a class\'s boundary without turning it, and is not regularized. With an all-zero image the score is just b, the class\'s built-in lean before any evidence. The 1958 perceptron compared the weighted sum with a threshold; moved to the other side of the inequality it becomes an added constant, so b is minus the threshold.',
  },
  s: {
    color: 'purple',
    name: 's: the class scores',
    code: ['scores'],
    about: 'Shape (10,): s = Wx + b, one per class, and the prediction is its argmax. The SVM reads scores as raw numbers where only margins matter; the softmax reads them as unnormalized log probabilities.',
  },
  y: {
    color: 'gold',
    name: 'y: the index of the correct class',
    code: ['y', 'y_batch'],
    about: 'One integer per image, here 0 for cat. The SVM compares every other score with s[y] minus a margin of 1; the softmax loss looks only at p[y].',
  },
  L: {
    color: 'red',
    name: 'L: the loss, how unhappy we are with the scores',
    code: ['loss', 'data_loss'],
    about: 'The full loss is the average data loss over the training images plus λ times the sum of squared weights; learning means choosing W and b to make it small. The word comes from decision theory: a loss is the price paid for a bad decision, so lower is better.',
  },
  p: {
    color: 'teal',
    name: 'p: probabilities from the softmax',
    code: ['probs'],
    about: 'p = softmax(s): exponentiate each score, then divide by the total, so every entry is positive and they sum to 1. The cross-entropy loss is -log p[y]: 0 at 1, about 0.69 at 0.5, 4.6 at 0.01. Softmax is a soft maximum: the top score gets most of the probability, but every class keeps some.',
  },
  lam: {
    color: 'slate',
    name: 'λ: regularization strength',
    tex: '\\lambda',
    code: ['reg'],
    about: 'Multiplies the L2 penalty np.sum(W * W) (reg in code). Larger λ prefers small, spread-out weights over fitting the training data; it is a hyperparameter, and it applies to W, never b. The name comes from the math of ill-posed problems (Tikhonov regularization), where a penalty picks one answer among many that fit equally well, as it breaks the tie between W and 2W here.',
  },
};
