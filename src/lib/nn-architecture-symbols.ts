import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-architecture chapter and its lecture, so a symbol keeps its color across both. */
export const NN_ARCHITECTURE_SYMBOLS: SymbolMap = {
  W: { color: 'blue', name: 'W: the weights of a layer (W1, W2, ... for each layer)', code: ['W', 'W1', 'W2', 'W3', 'w'] },
  x: { color: 'orange', name: 'x: the input to the network', code: ['x', 'X', 'inputs'] },
  b: { color: 'green', name: 'b: the biases of a layer', code: ['b', 'b1', 'b2', 'b3', 'bias'] },
  s: { color: 'purple', name: 's: the output scores (no activation on the last layer)', code: ['scores'] },
  h: { color: 'gold', name: 'h: hidden-layer activations, features the network computes for itself', code: ['h', 'h1', 'h2', 'hidden'] },
  f: { color: 'red', name: 'f: the activation function (the nonlinearity)', code: ['f'] },
  g: { color: 'teal', tex: '\\nabla', name: 'gradient: how the loss changes with a value', code: ['dz', 'dw', 'db', 'dout', 'dscore'] },
  lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
};
