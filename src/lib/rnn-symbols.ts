import type { SymbolMap } from '../core/symbols';

/** Shared by the rnn chapter and its lecture, so a symbol keeps its color across both. */
export const RNN_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input at one time step (here, a one-hot letter)',
    code: ['x', 'xs'],
    about: 'In the character model, a one-hot column of length vocab_size: zeros except a one at the character\'s index. In captioning it is a learned word vector, W_embed[word].',
  },
  h: {
    color: 'green',
    name: "h: the hidden state, the network's memory",
    code: ['h', 'hs', 'hprev', 'prev_h', 'next_h'],
    about: 'H numbers, 3 in the hello example and 64 in min-char-rnn, summarizing everything read so far; tanh keeps each between -1 and 1. It is hidden because no target ever says what it should hold: training shapes it only through the outputs read from it.',
  },
  Wxh: {
    color: 'blue',
    name: 'W_xh: weights from the input into the hidden state',
    tex: 'W_{xh}',
    code: ['Wxh', 'Wx'],
    about: 'In the character model it is H × V, for a vocabulary of V characters. Times a one-hot x it just picks out one column: a learned vector for that character.',
  },
  Whh: {
    color: 'blue',
    name: 'W_hh: weights from the old hidden state to the new one',
    tex: 'W_{hh}',
    code: ['Whh', 'Wh'],
    about: 'H × H and shared by every time step. Backprop multiplies the gradient by Whh transposed once per step back, so its largest singular value decides whether gradients explode (above 1) or vanish (below 1).',
  },
  Why: {
    color: 'blue',
    name: 'W_hy: weights from the hidden state to the output scores',
    tex: 'W_{hy}',
    code: ['Why'],
    about: 'V × H, one row per vocabulary entry, so np.dot(Why, h) + by scores every possible next character or word. The only path from the memory to the output.',
  },
  y: {
    color: 'purple',
    name: 'y: output scores, one per possible next character or word',
    code: ['y', 'ys', 'scores'],
    about: 'One score per vocabulary entry, 4 in the hello example, read off h by Why. The softmax turns them into p; when sampling, they are first divided by the temperature T.',
  },
  p: {
    color: 'teal',
    name: 'p: probabilities from the softmax',
    code: ['ps', 'probs'],
    about: 'p = exp(y) / sum(exp(y)): positive, summing to one, one per vocabulary entry. Sampling draws the next character from p, and in backprop the score gradient is p minus the one-hot target.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss'],
    about: 'Summed over time steps: minus the log probability of each true next character. Blind guessing costs log V per step, about 5.5 over the four steps of "hello"; trained, it falls to 0.06.',
  },
  c: {
    color: 'gold',
    name: 'c: the LSTM cell state, a second, private memory',
    code: ['c', 'prev_c', 'next_c'],
    about: 'Updated additively, next_c = f * prev_c + i * g, so on the way back its gradient is only scaled by the forget gate. Hence long short-term memory: a short-term memory, held in activations rather than weights, that can last a long time.',
  },
  T: {
    color: 'slate',
    name: 'T: the sampling temperature',
    code: ['temperature'],
    about: 'Scores are divided by T before the softmax: below 1 the favorite grows likelier, above 1 the odds even out. The name comes from statistical physics, where the same formula, the Boltzmann distribution, spreads out as temperature rises.',
  },
};
