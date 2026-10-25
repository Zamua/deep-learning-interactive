import type { SymbolMap } from '../core/symbols';

/** One map for the whole course, so a symbol keeps its color from concept to concept. */
export const ATLAS_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input',
    about: 'What goes in: a vector of numbers, such as an image flattened into one column, or the variable of a function. In a classifier it is given; only the parameters change.',
  },
  X: {
    color: 'orange',
    name: 'X: a batch of inputs, one per row',
    code: ['X', 'X_batch'],
    about: 'N examples stacked as the rows of a matrix of shape (N, D). X @ W.T scores the whole batch at once, one row of scores per example.',
  },
  w: {
    color: 'blue',
    name: 'w: a weight vector',
    about: 'One weight per input entry. Its dot product with x weighs each piece of evidence and adds them up; a classifier stacks one w per class as the rows of W.',
  },
  W: {
    color: 'blue',
    name: 'W: the weights, one row per class',
    about: 'A matrix with one row per class and one column per input entry. W times x gives every class its score at once. Learning means choosing W.',
  },
  b: {
    color: 'green',
    name: 'b: the biases, one per class',
    about: 'Added after the multiply: a class\'s built-in lean before any evidence. With an all-zero input the scores are exactly b.',
  },
  s: {
    color: 'purple',
    name: 's: the class scores',
    code: ['s', 'scores'],
    about: 'One number per class, s = Wx + b. The prediction is the class with the largest score; softmax turns the scores into probabilities.',
  },
  y: {
    color: 'gold',
    name: 'y: the index of the correct class',
    about: 'An integer label: which class the example really is. The loss looks at how the model scored that class.',
  },
  p: {
    color: 'teal',
    name: 'p: probabilities from the softmax',
    code: ['p', 'probs'],
    about: 'Positive and summing to 1: exponentiate each score, then divide by the total. p[y] is the probability the model gives the right answer.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['L', 'loss'],
    about: 'One number that says how bad the predictions are; 0 is perfect. Training moves the parameters downhill on L.',
  },
  f: {
    color: 'purple',
    name: 'f: a function of x',
    about: 'Any rule that turns an input into an output. Its derivative says how fast the output changes when x is nudged.',
  },
  g: {
    color: 'red',
    name: 'g: the gradient of the loss',
    code: ['g', 'grad', 'dW', 'ds'],
    about: 'One partial derivative per parameter, the same shape as what it is the gradient of. It points uphill on the loss, so training steps the other way.',
  },
  D: {
    color: 'slate',
    name: 'D: the number of input features',
    about: 'How many numbers describe one example: 3,072 for a 32 by 32 color image. It is the number of columns of W.',
  },
  C: {
    color: 'slate',
    name: 'C: the number of classes',
    about: 'How many answers the classifier chooses between: 10 for CIFAR-10. It is the number of rows of W and the length of s.',
  },
  H: {
    color: 'slate',
    name: 'H: the number of hidden units',
    about: 'The width of a hidden layer: how many numbers the first layer hands to the next. A choice, not something the data fixes.',
  },
  N: {
    color: 'slate',
    name: 'N: the number of training examples',
    about: 'The size of the whole training set. One pass over all N examples is an epoch.',
  },
  B: {
    color: 'slate',
    name: 'B: the batch size',
    code: ['B', 'batch_size'],
    about: 'How many examples go into one gradient estimate. Smaller batches are cheaper and noisier; larger ones are smoother and cost more per step.',
  },
  eta: {
    color: 'slate',
    name: 'η: the learning rate',
    tex: '\\eta',
    code: ['lr'],
    about: 'How far each gradient step goes. Too small and training crawls; too large and the steps overshoot the minimum and can blow up.',
  },
};
