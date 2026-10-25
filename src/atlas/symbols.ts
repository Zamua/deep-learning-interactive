import type { SymbolMap } from '../core/symbols';

/** One map for the whole course, so a symbol keeps its color from concept to concept. */
export const ATLAS_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input',
    about: 'What goes in: a vector of numbers, or the variable of a function.',
  },
  X: {
    color: 'orange',
    name: 'X: a batch of inputs, one per row',
    code: ['X', 'X_batch'],
    about: 'N examples stacked as the rows of a matrix of shape (N, D). X @ W.T scores the whole batch at once, one row of scores per example.',
  },
  w: {
    color: 'blue',
    name: 'w: a vector of weights',
    about: 'One weight per entry of x. Its dot product with x multiplies each entry by its weight and adds them up.',
  },
  W: {
    color: 'blue',
    name: 'W: a matrix of weights',
    about: 'A grid of numbers in rows and columns. W times x takes one dot product per row, so it has one column per entry of x.',
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
  h: {
    color: 'gold',
    name: 'h: the hidden layer\'s activations',
    code: ['h', 'hidden'],
    about: 'What the first layer hands to the second: h = ReLU(W1 x + b1). Each entry is one hidden unit, and the second layer scores h exactly as a linear classifier scores an image.',
  },
  W1: {
    color: 'blue',
    name: 'W1: the first layer\'s weights',
    tex: 'W_1',
    about: 'Shape (H, D): one row per hidden unit, each a template over the input. Its output, through the activation, is h.',
  },
  W2: {
    color: 'blue',
    name: 'W2: the second layer\'s weights',
    tex: 'W_2',
    about: 'Shape (C, H): one row per class, scoring the hidden activations h instead of the raw input.',
  },
  b1: {
    color: 'green',
    name: 'b1: the first layer\'s biases',
    tex: 'b_1',
    about: 'One per hidden unit, added before the activation, so a unit can fire even when its weighted sum is small.',
  },
  b2: {
    color: 'green',
    name: 'b2: the second layer\'s biases',
    tex: 'b_2',
    about: 'One per class, added to the scores, as in a linear classifier.',
  },
  lam: {
    color: 'slate',
    name: 'λ: the regularization strength',
    tex: '\\lambda',
    code: ['lam', 'reg'],
    about: 'How much the penalty on large weights counts against fitting the data. A hyperparameter: chosen on validation data, never learned.',
  },
  v: {
    color: 'orange',
    name: 'v: the velocity',
    about: 'A running blend of past gradients. Momentum steps along v instead of the latest gradient, so consistent directions build speed and noise cancels out.',
  },
  gamma: {
    color: 'purple',
    name: 'γ: the learned scale',
    tex: '\\gamma',
    about: 'Batch norm multiplies each normalized feature by γ, learned like any weight, so the network can undo the normalization where it helps.',
  },
  beta: {
    color: 'green',
    name: 'β: the learned shift',
    tex: '\\beta',
    about: 'Batch norm adds β after scaling by γ: a learned offset per feature, playing the role a bias would.',
  },
  F: {
    color: 'slate',
    name: 'F: the filter size',
    about: 'A filter covers F × F positions of the input, through every channel. 3 is the usual choice; stacking small filters sees as far as one big one.',
  },
  S: {
    color: 'slate',
    name: 'S: the stride',
    about: 'How far the filter moves between positions. Stride 2 halves the output\'s width and height.',
  },
  P: {
    color: 'slate',
    name: 'P: the padding',
    about: 'Zeros added around the border. With stride 1, P = (F − 1) / 2 keeps the output the same size as the input.',
  },
  K: {
    color: 'slate',
    name: 'K: the number of filters',
    about: 'Each filter makes one output channel, so a layer with K filters outputs K channels.',
  },
  Whh: {
    color: 'blue',
    name: 'W_hh: the hidden-to-hidden weights',
    tex: 'W_{hh}',
    code: ['Whh', 'W_hh'],
    about: 'Carries the memory from one step to the next. The same matrix is used at every step, so backprop through time multiplies by it again and again.',
  },
  Wxh: {
    color: 'blue',
    name: 'W_xh: the input-to-hidden weights',
    tex: 'W_{xh}',
    code: ['Wxh', 'W_xh'],
    about: 'Mixes the current input into the hidden state. Shared across every step of the sequence.',
  },
  T: {
    color: 'slate',
    name: 'T: the temperature',
    about: 'Scores are divided by T before the softmax. Below 1 sharpens the choice toward the top token; above 1 flattens it toward random.',
  },
  eta: {
    color: 'slate',
    name: 'η: the learning rate',
    tex: '\\eta',
    code: ['lr'],
    about: 'How far each gradient step goes. Too small and training crawls; too large and the steps overshoot the minimum and can blow up.',
  },
};
