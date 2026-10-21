import type { SymbolMap } from '../core/symbols';

/** Every gradient variable used in this chapter's listings; they all render teal. */
const GRADS = [
  'df', 'dq', 'dx', 'dy', 'dz', 'dw', 'dW', 'dX', 'dD', 'dout', 'da', 'db', 'ddot', 'dnum', 'dden', 'dinvden',
  'dsigx', 'dsigy', 'dxpy', 'dxpysqr', 'dw0', 'dw1', 'dw2', 'dx0', 'dx1', 'dp0', 'dp1', 'ds', 'dneg', 'dex',
  'dfdx', 'dfdy', 'dfdz', 'dfdq', 'dm', 'dn', 'num_dW',
];

/** Shared by the backprop chapter and its lecture, so a symbol keeps its color across both. */
export const BACKPROP_SYMBOLS: SymbolMap = {
  f: {
    color: 'purple',
    name: 'f: the output of the whole circuit (in a network, the loss)',
    code: ['f'],
    about: 'In the circuits it is the final value, like (x + y) * z = -12; in a network it is the loss, one number. The backward pass seeds it with df = 1.0, since nudging f by one moves f by one.',
  },
  x: {
    color: 'orange',
    name: 'x, y, z: inputs to the circuit (in a network: data and weights)',
    code: ['x', 'y', 'z', 'w', 'X', 'x0', 'x1'],
    about: 'Stands for x, y, z and w here (and X). In the toy circuits they are plain numbers, like x = -2, y = 5, z = -4; in a network the inputs are the data and the weights, and backprop treats both alike.',
  },
  W: {
    color: 'blue',
    name: 'W: weights, the inputs we will actually update',
    code: ['W', 'w0', 'w1', 'w2'],
    about: 'Also w0, w1 and w2 in the neuron. The data is fixed, so dW is the gradient training uses: W -= step_size * dW. In the matrix example W is 5 by 10, and dW has the same shape.',
  },
  g: {
    color: 'teal',
    tex: '\\nabla f',
    name: 'gradient: how much f moves per unit nudge of a value. In code, dx means ∂f/∂x',
    code: GRADS,
    about: 'Written dx in code for ∂f/∂x. It starts at 1.0 on the output and flows backward, each gate multiplying the upstream gradient by its local gradient; where a value feeds several stages, its pieces add up (+=). Every gradient has the shape of its variable.',
  },
  loc: {
    color: 'gold',
    tex: '\\partial',
    name: 'local gradient: how one gate’s output moves with one of its own inputs',
    code: ['local'],
    about: 'Computed from the gate\'s own inputs in the forward pass: the other input for multiply, 1 for add, 1 or 0 for max, (1 - f) * f for sigmoid. Downstream gradient = upstream gradient times local gradient.',
  },
  h: {
    color: 'slate',
    name: 'h: a small nudge to one input',
    code: ['h'],
    about: 'Measures a derivative by nudging: (f(x + h, y) - f(x, y)) / h. As h shrinks the ratio settles on the exact derivative, -3 for x * y at x = 4, y = -3; backprop gets the same number exactly, with no nudge.',
  },
};
