import type { SymbolMap } from '../core/symbols';

/** Shared by the case-study chapter and its lecture, so a symbol keeps its color across both. */
export const CASE_STUDY_SYMBOLS: SymbolMap = {
  X: {
    color: 'orange',
    name: 'X: the data, one row per point (N·K rows, D = 2 columns)',
    code: ['X'],
    about: 'Shaped (300, 2): N = 100 points for each of the K = 3 arms of the spiral. The coordinates already lie between -1 and 1, and two dimensions let every decision boundary be drawn.',
  },
  y: {
    color: 'gold',
    name: 'y: the correct class of each point',
    code: ['y'],
    about: 'One integer per row of X, 0, 1 or 2: the arm the point belongs to. The loss uses it as an index, probs[range(num_examples), y], to pick each correct-class probability.',
  },
  W: {
    color: 'blue',
    name: 'W, W2: weights (first and second layer)',
    code: ['W', 'W2'],
    about: 'The linear classifier\'s W is (2, 3), one column per class. The network\'s W is (2, 100), from the two inputs to the hidden units, and W2 is (100, 3); all start as 0.01 times random normals.',
  },
  b: {
    color: 'green',
    name: 'b, b2: biases',
    code: ['b', 'b2'],
    about: 'One row added to every point by broadcasting: (1, 3) in the linear classifier, (1, 100) for b and (1, 3) for b2 in the network. They start at zero.',
  },
  s: {
    color: 'purple',
    name: 's: class scores, one row per point',
    code: ['scores'],
    about: 'Shaped (300, 3): one number per point and class. A softmax turns each row into probabilities, and np.argmax picks the predicted class.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss', 'data_loss', 'reg_loss'],
    about: 'data_loss, the average of minus the log of each correct-class probability, plus reg_loss, 0.5 * reg * np.sum(W * W). It starts near log 3 ≈ 1.099 and ends near 0.77 for the linear classifier, 0.24 for the network.',
  },
  g: {
    color: 'teal',
    tex: '\\nabla',
    name: 'gradients of the loss (dscores, dW, db, ...)',
    code: ['dscores', 'dW', 'db', 'dW2', 'db2', 'dhidden'],
    about: 'Each has the shape of what it belongs to: dW like W, db like b. Backprop starts at dscores, the probabilities minus one at the correct class, over the number of examples. The d prefix is shorthand: dW is the derivative of the loss with respect to W.',
  },
  hp: {
    color: 'slate',
    tex: '\\lambda',
    name: 'hyperparameters: reg (λ) and step_size, chosen by us',
    code: ['reg', 'step_size'],
    about: 'Set by hand, not learned: reg (λ) scales the weight penalty, and step_size, 1 for both models here, sets how far each update moves. The prefix hyper marks that they sit above the parameters, deciding how those are learned.',
  },
};
