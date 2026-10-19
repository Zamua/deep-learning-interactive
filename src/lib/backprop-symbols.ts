import type { SymbolMap } from '../core/symbols';

/** Every gradient variable used in this chapter's listings; they all render teal. */
const GRADS = [
  'df', 'dq', 'dx', 'dy', 'dz', 'dw', 'dW', 'dX', 'dD', 'dout', 'da', 'db', 'ddot', 'dnum', 'dden', 'dinvden',
  'dsigx', 'dsigy', 'dxpy', 'dxpysqr', 'dw0', 'dw1', 'dw2', 'dx0', 'dx1', 'dp0', 'dp1', 'ds', 'dneg', 'dex',
  'dfdx', 'dfdy', 'dfdz', 'dfdq', 'dm', 'dn', 'num_dW',
];

/** Shared by the backprop chapter and its lecture, so a symbol keeps its color across both. */
export const BACKPROP_SYMBOLS: SymbolMap = {
  f: { color: 'purple', name: 'f: the output of the whole circuit (in a network, the loss)', code: ['f'] },
  x: { color: 'orange', name: 'x, y, z: inputs to the circuit (in a network: data and weights)', code: ['x', 'y', 'z', 'w', 'X', 'x0', 'x1'] },
  W: { color: 'blue', name: 'W: weights, the inputs we will actually update', code: ['W', 'w0', 'w1', 'w2'] },
  g: { color: 'teal', tex: '\\nabla f', name: 'gradient: how much f moves per unit nudge of a value. In code, dx means ∂f/∂x', code: GRADS },
  loc: { color: 'gold', tex: '\\partial', name: 'local gradient: how one gate’s output moves with one of its own inputs', code: ['local'] },
  h: { color: 'slate', name: 'h: a small nudge to one input', code: ['h'] },
};
