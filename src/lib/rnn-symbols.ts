import type { SymbolMap } from '../core/symbols';

/** Shared by the rnn chapter and its lecture, so a symbol keeps its color across both. */
export const RNN_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the input at one time step (here, a one-hot letter)', code: ['x', 'xs'] },
  h: { color: 'green', name: "h: the hidden state, the network's memory", code: ['h', 'hs', 'hprev', 'prev_h', 'next_h'] },
  Wxh: { color: 'blue', name: 'W_xh: weights from the input into the hidden state', tex: 'W_{xh}', code: ['Wxh', 'Wx'] },
  Whh: { color: 'blue', name: 'W_hh: weights from the old hidden state to the new one', tex: 'W_{hh}', code: ['Whh', 'Wh'] },
  Why: { color: 'blue', name: 'W_hy: weights from the hidden state to the output scores', tex: 'W_{hy}', code: ['Why'] },
  y: { color: 'purple', name: 'y: output scores, one per possible next character or word', code: ['y', 'ys', 'scores'] },
  p: { color: 'teal', name: 'p: probabilities from the softmax', code: ['ps', 'probs'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss'] },
  c: { color: 'gold', name: 'c: the LSTM cell state, a second, private memory', code: ['c', 'prev_c', 'next_c'] },
  T: { color: 'slate', name: 'T: the sampling temperature', code: ['temperature'] },
};
