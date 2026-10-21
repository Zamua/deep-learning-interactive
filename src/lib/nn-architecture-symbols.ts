import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-architecture chapter and its lecture, so a symbol keeps its color across both. */
export const NN_ARCHITECTURE_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the weights of a layer (W1, W2, ... for each layer)',
    code: ['W', 'W1', 'W2', 'W3', 'w'],
    about: 'One matrix per layer: in the image example W1 is (100, 3072), a template per row, and W2 is (10, 100). Each weight sets how much one input counts in a neuron\'s weighted sum; in the brain analogy it is a synapse\'s strength, positive to excite and negative to inhibit.',
  },
  x: {
    color: 'orange',
    name: 'x: the input to the network',
    code: ['x', 'X', 'inputs'],
    about: 'An image flattened to 3,072 numbers, or a 2-D point in the spiral and disc demos (X stacks a batch as rows). The first layer reads it, and it is never counted as a layer.',
  },
  b: {
    color: 'green',
    name: 'b: the biases of a layer',
    code: ['b', 'b1', 'b2', 'b3', 'bias'],
    about: 'One per neuron, so each layer has a bias vector like b1; it shifts where a hidden unit\'s hinge bends. In the classic neuron model the cell fires when its weighted sum beats a threshold; moved to the other side of the inequality the threshold becomes an added constant, so b is minus the threshold.',
  },
  s: {
    color: 'purple',
    name: 's: the output scores (no activation on the last layer)',
    code: ['scores'],
    about: 'Ten class scores for an image, or one number in the three-layer toy. The output layer has no activation, so scores can be any real numbers, ready for a softmax or SVM loss.',
  },
  h: {
    color: 'gold',
    name: 'h: hidden-layer activations, features the network computes for itself',
    code: ['h', 'h1', 'h2', 'hidden'],
    about: 'h = max(0, W1 x): 100 numbers in the two-layer example. Each is a feature the network learns to compute, and W2 combines them into scores; they are called hidden because they are neither input nor output, so the data never says what they should be.',
  },
  f: {
    color: 'red',
    name: 'f: the activation function (the nonlinearity)',
    code: ['f'],
    about: 'Applied entry by entry after each layer\'s weighted sum, except the output layer; without it, stacked layers collapse into one matrix. Choices here: sigmoid, tanh, ReLU (the default), leaky ReLU and maxout. ReLU, the rectified linear unit, is named after a rectifier, which lets current through one way only.',
  },
  g: {
    color: 'teal',
    tex: '\\nabla',
    name: 'gradient: how the loss changes with a value',
    code: ['dz', 'dw', 'db', 'dout', 'dscore'],
    about: 'Written dz, dw, db and dout in code. Through an activation it is multiplied by the local slope: at most 0.25 for the sigmoid, 1 for tanh at zero, 1 or 0 for ReLU, which is why saturated or dead units stop learning.',
  },
  lam: {
    color: 'slate',
    name: 'λ: regularization strength',
    tex: '\\lambda',
    code: ['reg'],
    about: 'reg in code. It adds 0.5 λ times the sum of squared weights to the loss and λ w to each gradient, so every step shrinks each weight a little: gradual forgetting. Raising it from 0.0001 to 0.01 melts the 50-neuron net\'s islands; much higher, and it underfits.',
  },
};
