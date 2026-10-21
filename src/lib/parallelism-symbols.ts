import type { SymbolMap } from '../core/symbols';

/** Shared by the parallelism chapter and its lecture, so a symbol keeps its color across both. */
export const PARALLELISM_SYMBOLS: SymbolMap = {
  Psi: {
    color: 'slate',
    name: 'Ψ: the number of parameters in the model',
    tex: '\\Psi',
    code: ['n_params'],
    about: 'Memory is counted in multiples of it: 16Ψ bytes of weights, gradients and Adam state in mixed precision. 70 billion in the intro, 7.5 billion in the ZeRO example; the ZeRO paper uses the same letter.',
  },
  W: {
    color: 'blue',
    name: 'W: weight matrices (W1 and W2 are the two matrices of an MLP)',
    code: ['W', 'W1', 'W2', 'W1_0', 'W1_1', 'W2_0', 'W2_1', 'W1_i', 'W2_i'],
    about: 'Tensor parallelism splits W1 by columns and W2 by rows, so each GPU computes its slice of the hidden layer alone and only the partial sums need an all-reduce. W1_i and W2_i are GPU i\'s blocks.',
  },
  X: {
    color: 'orange',
    name: 'X: activations, the values flowing forward through the layers',
    code: ['X', 'x', 'acts'],
    about: 'What the forward pass keeps for backprop: about 34 bytes per token per unit of width, in every layer, so it grows with the tokens on each GPU. Checkpointing keeps only each block\'s input.',
  },
  G: {
    color: 'teal',
    name: 'G: gradients, one per parameter',
    code: ['G', 'grads', 'grad'],
    about: 'The same size as the weights, 2 bytes each in bf16: 14 GB for a 7B model. Data parallelism all-reduces G every step, and ZeRO stage 2 keeps only each GPU\'s slice.',
  },
  N: {
    color: 'green',
    name: 'N: the number of GPUs taking part in one collective (or one kind of parallelism)',
    code: ['N', 'n_gpus'],
    about: 'A ring all-reduce sends 2(N − 1)/N times the gradient per GPU, which levels off near 2 as N grows. ZeRO divides the sharded state by N.',
  },
  p: {
    color: 'purple',
    name: 'p: the number of pipeline stages',
    code: ['p', 'n_stages'],
    about: 'Each stage holds a contiguous slice of the layers on its own GPU. With m micro-batches, the bubble takes (p − 1)/(m + p − 1) of each step.',
  },
  m: {
    color: 'gold',
    name: 'm: the number of micro-batches per step',
    code: ['m', 'n_micro'],
    about: 'Splitting the batch lets different stages work on different micro-batches at once. With 4 stages, 8 micro-batches leave about 27% of the time idle; GPipe introduced the trick in 2018.',
  },
  B: {
    color: 'red',
    name: 'B: link bandwidth, bytes per second each GPU can send',
    code: ['bw'],
    about: 'It decides whether communication hides behind compute: for data parallelism, talk over compute is 2F / (3T·B). NVLink inside a server is much faster than InfiniBand between servers, so tensor parallelism stays inside one.',
  },
};
