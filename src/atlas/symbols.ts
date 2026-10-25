import type { SymbolDef, SymbolMap } from '../core/symbols';
import type { Glossary } from '../lecture/glossary';

/**
 * One map for the whole course, so a symbol keeps its color from concept to concept. A key with a
 * digit (W1) has no `\symW1` shorthand, since TeX command names are letters: write `\sym{W1}{W_1}`.
 */
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
    code: ['g', 'grad', 'dW', 'ds', 'dh', 'dz', 'dW1', 'dW2', 'db1', 'db2'],
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
    name: 'v: a vector',
    about: 'A list of numbers in a fixed order, like [3, -1, 2].',
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
    about: 'Carries the memory from one step to the next. The same matrix is used at every step.',
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

const step: SymbolDef = { color: 'gold', name: 'h: the step', code: ['h'], about: 'How far x moves: the run in rise over run.' };
const scores: SymbolDef = { color: 'purple', name: 's: the scores', code: ['s', 'scores'], about: 'One number per option. A bigger score is a stronger vote for that option.' };
const answer: SymbolDef = { color: 'gold', name: 'y: the right answer', about: 'The position of the correct option, counting from 0.' };
const probs: SymbolDef = { color: 'teal', name: 'p: the probabilities', code: ['p', 'probs'], about: 'One per option, each positive, together summing to 1.' };
const loss: SymbolDef = { color: 'red', name: 'L: the loss', code: ['L', 'loss'], about: 'One number that says how wrong the scores are: 0 is perfect, bigger is worse.' };
const grad: SymbolDef = { ...ATLAS_SYMBOLS.g!, name: 'g: the gradient', about: 'One partial derivative per input, in the input\'s shape. It points uphill, so a step against it goes down.' };

/**
 * Where a concept needs a symbol to mean something else, or to say only what its prerequisites
 * teach. Keys missing from ATLAS_SYMBOLS work too, through \sym{key}{tex}.
 */
export const SCOPED: Record<string, SymbolMap> = {
  derivative: { h: step },
  'derivative-rules': { h: step },
  'grad-check': { h: { ...step, about: 'The small nudge for the numerical slope: (f(x + h) - f(x - h)) / 2h.' } },
  'chain-rule': { v: { color: 'orange', name: 'v: a value in the middle', about: 'The output of one function and the input of the next.' } },
  gradient: {
    W: { color: 'blue', name: 'W: a grid of numbers', about: 'Numbers in rows and columns, all of them inputs to f.' },
    w: { color: 'blue', name: 'w: a vector of inputs', about: 'Several numbers fed to f at once.' },
  },
  'matmul-shapes': { B: { color: 'blue', name: 'B: a matrix', about: 'A second grid of numbers. The product AB needs A\'s columns to match B\'s rows.' } },
  argmax: { s: scores, y: answer },
  softmax: { s: scores, p: probs },
  'cross-entropy': { s: scores, y: answer, p: probs, L: loss },
  'softmax-grad': { s: scores, y: answer, p: probs, L: loss, g: { ...grad, about: 'One partial derivative per score: how fast L changes as that score is nudged.' } },
  'hinge-loss': { L: loss },
  'gd-step': { g: grad, eta: { ...ATLAS_SYMBOLS.eta!, name: 'η: the step size', about: 'How far each step goes, as a multiple of the gradient.' } },
  'learning-rate': { g: grad, eta: { ...ATLAS_SYMBOLS.eta!, about: 'The step size: each step moves η times the gradient. Too small crawls; too large overshoots.' } },
  minibatch: { g: grad, N: { color: 'slate', name: 'N: the number of examples', about: 'How many examples the function averages over. One pass through all N is an epoch.' } },
  'param-count': {
    D: { color: 'slate', name: 'D: the number of input features', about: 'How many numbers make up one input: 3,072 for a 32 by 32 color image. It is the number of columns of W.' },
    H: { color: 'slate', name: 'H: the size of the middle', about: 'How many numbers the first map hands to the second: a choice, not fixed by the data.' },
    W1: { color: 'blue', name: 'W1: the first map\'s weights', tex: 'W_1', about: 'Shape (H, D): one row per number in the middle.' },
    b1: { color: 'green', name: 'b1: the first map\'s biases', tex: 'b_1', about: 'One per number in the middle.' },
    W2: { color: 'blue', name: 'W2: the second map\'s weights', tex: 'W_2', about: 'Shape (C, H): one row per class.' },
    b2: { color: 'green', name: 'b2: the second map\'s biases', tex: 'b_2', about: 'One per class.' },
  },
  'weight-init': { v: { color: 'orange', name: 'v: the variance of one term', about: 'How spread out each product w x is. A sum of n such terms has variance n v.' } },
  momentum: {
    v: { color: 'orange', name: 'v: the velocity', about: 'A running blend of past gradients. Momentum steps along v instead of the latest gradient, so steady directions build speed and noise cancels out.' },
    mu: { color: 'orange', name: 'μ: the momentum coefficient', tex: '\\mu', about: 'The share of the velocity that survives each step, often 0.9: one minus friction.' },
  },
  adam: {
    m: { color: 'orange', name: 'm: the first moment', about: 'A running average of the gradient, as momentum keeps: it points where the gradients have been pointing lately.' },
    v: { color: 'teal', name: 'v: the second moment', about: 'A running average of the squared gradient: how large this parameter\'s gradients usually are.' },
    beta1: { color: 'slate', name: 'β₁: the first moment\'s decay', tex: '\\beta_1', about: 'The share of m kept each step, usually 0.9.' },
    beta2: { color: 'slate', name: 'β₂: the second moment\'s decay', tex: '\\beta_2', about: 'The share of v kept each step, usually 0.999: a longer memory than m\'s.' },
  },
};

/** Library notes that would name later topics, said only in general terms. */
export const ATLAS_GLOSSARY: Glossary = {
  'np.argmax': { is: 'the index of the largest value', more: 'With no axis it searches the flattened array; with axis=1 it returns one index per row. Ties go to the first.', eg: 'np.argmax([2.1, -0.4, 5.7])   # 2' },
  'np.exp': { is: 'e to the power of every element', more: 'Every result is positive. It overflows to inf past about 709.', eg: 'np.exp(0.0)   # 1.0' },
  'np.log': { is: 'the natural logarithm of every element', more: 'Base e, the inverse of np.exp. np.log(0) is -inf.', eg: 'np.log(np.e)   # 1.0' },
  'np.ones': { is: 'an array of ones of a given shape', more: 'The shape is one number or a tuple; the default dtype is float64.', eg: 'np.ones((2, 3)).shape   # (2, 3)' },
  'np.outer': { is: 'every product a[i] * b[j], as a matrix', more: 'The result has shape (len(a), len(b)).', eg: 'np.outer([1, 2], [3, 4])   # [[3 4] [6 8]]' },
  'np.random.choice': { is: 'random picks from a range or an array', more: 'np.random.choice(N, B) picks B integers below N, with replacement unless replace=False. p gives each option\'s probability.', eg: 'np.random.choice(3, p=[0, 0, 1])   # 2' },
  'np.random.randn': { is: 'samples from the standard normal distribution', more: 'Mean 0, standard deviation 1, with the arguments giving the shape. The n stands for normal.', eg: 'np.random.randn(10, 3072).shape  # (10, 3072)' },
  'np.zeros_like': { is: 'zeros with the same shape and dtype as x', eg: 'np.zeros_like(np.ones(3))   # [0. 0. 0.]' },
  'np.random.permutation': { is: 'the numbers 0 to n - 1 in a random order', more: 'Slicing the result splits a dataset at random with no example in two parts.', eg: 'np.random.permutation(4)   # e.g. [2 0 3 1]' },

  // PyTorch, as the ConvNet listings use it.
  'torch.tensor': { is: 'an array, as PyTorch stores it', eg: 'torch.tensor([1., 2.]).shape   # torch.Size([2])' },
  'torch.randn': { is: 'standard normal random numbers of a given shape', eg: 'torch.randn(3, 32, 32).shape   # (3, 32, 32)' },
  'nn.Conv2d': { is: 'a convolution layer: in channels, out channels, filter size', more: 'Optional stride and padding arguments; it holds one bias per output channel.', eg: 'nn.Conv2d(3, 8, 3)   # 8 filters of shape (3, 3, 3)' },
  'nn.Linear': { is: 'a fully connected layer: inputs, outputs', more: 'A weight matrix of shape (outputs, inputs) and one bias per output.', eg: 'nn.Linear(512, 10)   # 5,130 parameters' },
  'nn.MaxPool2d': { is: 'max pooling over square windows', more: 'With one argument, the window size is also the stride.', eg: 'nn.MaxPool2d(2)   # halves height and width' },
  'nn.AvgPool2d': { is: 'average pooling over square windows', eg: 'nn.AvgPool2d(2)' },
  'nn.ReLU': { is: 'the ReLU activation as a layer', eg: 'nn.ReLU()' },
  'nn.Flatten': { is: 'lays each example out as one long vector', eg: '(32, 8, 8) -> 2048' },
  'nn.Sequential': { is: 'layers applied one after another', eg: 'nn.Sequential(nn.Linear(4, 3), nn.ReLU())' },
  '.numel': { is: 'how many numbers a tensor holds', eg: 'torch.zeros(8, 3, 3, 3).numel()   # 216' },
  '.Compose': { is: 'chains image transforms into one', eg: 'transforms.Compose([crop, flip])' },
  '.RandomCrop': { is: 'cuts a random square of the given size', eg: 'transforms.RandomCrop(28)' },
  '.RandomHorizontalFlip': { is: 'mirrors the image left to right half the time', eg: 'transforms.RandomHorizontalFlip()' },
  '.ColorJitter': { is: 'shifts brightness, contrast and color at random', eg: 'transforms.ColorJitter(0.2, 0.2)' },
  '.CenterCrop': { is: 'cuts the middle square of the given size', eg: 'transforms.CenterCrop(28)' },
  SGD: { is: 'a plain gradient descent optimizer over the parameters it is given', eg: 'SGD(params, lr=1e-3)' },

  // Functions and layers the listings define or name for the example.
  out_size: { is: 'the output width for a given input width, filter, stride and padding' },
  conv: { is: 'the convolution layer defined just above' },
  conv1: { is: 'the block\'s first convolution layer' },
  conv2: { is: 'the block\'s second convolution layer' },
  pool: { is: 'the max pooling layer defined just above' },
  avg: { is: 'the average pooling layer defined just above' },
  encoder: { is: 'runs the encoder over the input words and returns its last state' },
  decoder_step: { is: 'one decoder step: the next state and the next word\'s probabilities' },
  load_pretrained: { is: 'loads a network already trained on a large dataset' },
  train_one_epoch: { is: 'one pass of gradient steps over the training split' },
  train: { is: 'trains a model with the given settings and returns it' },
  run: { is: 'one training run with the given settings' },
};

/** Every key any concept uses, for page-wide `\sym` macros and colors. */
export const ALL_SYMBOLS: SymbolMap = Object.assign({}, ...Object.values(SCOPED), ATLAS_SYMBOLS);

/** The symbols and library notes an explainer shows, from its script id, atlas-<concept>. */
export function lookupFor(scriptId: string): { symbols: SymbolMap; glossary: Glossary } {
  return { symbols: { ...ATLAS_SYMBOLS, ...SCOPED[scriptId.replace(/^atlas-/, '')] }, glossary: ATLAS_GLOSSARY };
}
