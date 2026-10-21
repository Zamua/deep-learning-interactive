import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-data-loss chapter and its lecture, so a symbol keeps its color across both. */
export const NN_DATA_LOSS_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the data, or the activations coming into a layer',
    code: ['x', 'X'],
    about: 'Shape (N, D): one row per example, one column per feature, like a pixel value. Preprocessing centers it with the training mean (and divides by σ if features differ in scale); inside the network, x is the batch of activations entering a layer.',
  },
  W: {
    color: 'blue',
    name: 'W: the weights',
    code: ['W', 'w', 'W1', 'W2', 'W3'],
    about: 'Random at the start, to break the symmetry: equal weights make every neuron a clone. The scale matters, since Var(s) = n Var(w) Var(x): tanh layers use variance 1/n (Xavier), ReLU layers 2/n (He), as in randn(n, H) * sqrt(2.0 / n).',
  },
  mu: {
    color: 'teal',
    name: 'μ: a mean (average), per feature',
    tex: '\\mu',
    code: ['mu'],
    about: 'Shape (D,), one per feature: np.mean(X, axis=0). Compute it on the training set only and subtract the same μ from validation and test data; batch norm recomputes μ per batch and keeps a running average for test time.',
  },
  gamma: {
    color: 'purple',
    name: 'γ: batch norm scale, learned',
    tex: '\\gamma',
    code: ['gamma'],
    about: 'One per feature, learned with the weights, starting at 1. Batch norm outputs gamma * x_hat + beta, so the network can rescale the normalized values, or undo the normalization entirely.',
  },
  beta: {
    color: 'green',
    name: 'β: batch norm shift, learned',
    tex: '\\beta',
    code: ['beta'],
    about: 'One per feature, learned, starting at 0. It shifts the normalized values; with beta equal to the batch mean and gamma equal to its spread, the original values come back.',
  },
  p: {
    color: 'gold',
    name: 'p: dropout keep probability',
    code: ['p'],
    about: 'Each unit survives a training forward pass with probability p, about 0.5, and is zeroed otherwise. Inverted dropout divides survivors by p so the expected value matches test time, when nothing is dropped. Here p is the keep probability; PyTorch\'s nn.Dropout(p) takes the drop probability.',
  },
  lam: {
    color: 'slate',
    name: 'λ: regularization strength',
    tex: '\\lambda',
    code: ['reg'],
    about: 'reg in code: loss = data_loss + reg * r2. With L2 its gradient adds reg * W, shrinking each weight every step (weight decay); with L1, reg * sign(W) snaps useless weights to exactly zero. One global value, tuned on validation data; biases usually go unregularized.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss', 'data_loss'],
    about: 'L = data loss + λ R(W). The data loss should match the question: softmax or SVM for one correct class, independent sigmoids for many yes-or-no labels, and L2 or L1 distance for real values, where L1 shrugs off outliers.',
  },
};
