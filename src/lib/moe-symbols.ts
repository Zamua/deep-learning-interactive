import type { SymbolMap } from '../core/symbols';

/** Shared by the mixture-of-experts chapter and its lecture, so a symbol keeps its color across both. */
export const MOE_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: "x: one token's vector, the input to the layer",
    code: ['x'],
    about: 'd numbers, 4,096 in Mixtral, read by the router and by every chosen expert. The layer\'s output is added back to x through the residual, and a dropped token passes through unchanged.',
  },
  Wr: {
    color: 'blue',
    name: 'W_r: the router weights, one column per expert',
    tex: 'W_r',
    code: ['W_r'],
    about: 'A d by E matrix: a linear classifier with experts in place of classes. Each column is an arrow in token space, so the router carves the space into regions with straight borders.',
  },
  p: {
    color: 'purple',
    name: 'p: the router probabilities, a softmax over the experts',
    code: ['probs'],
    about: 'p = softmax(x W_r), E numbers that sum to one. Top-k keeps the largest; averaged over a batch, p gives P_i, the smooth half of the balance loss.',
  },
  g: {
    color: 'gold',
    name: 'g: the gate weights, how much each chosen expert counts',
    code: ['gates'],
    about: 'The kept probabilities, often renormalized to sum to one, which equals a softmax over the kept logits. They are the router\'s only path to a gradient. The name follows the gating network of the original 1991 mixture of experts.',
  },
  E: {
    color: 'slate',
    name: 'E: the number of experts in a layer',
    code: ['E'],
    about: 'Total parameters grow with E, but compute per token depends only on k. 8 in Mixtral, 256 routed experts in DeepSeek-V3, 4 in the toy.',
  },
  k: {
    color: 'slate',
    name: 'k: how many experts each token uses (top-k)',
    code: ['k'],
    about: 'Sets the compute per token: Mixtral runs 2 of 8, DeepSeek-V3 8 of 256. With k = 1, the Switch Transformer keeps the raw probability as the gate, so the router still gets a signal.',
  },
  f: {
    color: 'teal',
    name: 'f_i: the share of tokens sent to expert i',
    code: ['f'],
    about: 'A count from an argmax, so it has no gradient; the balance loss uses it only as a weight. Balanced, every f_i is 1/E.',
  },
  P: {
    color: 'purple',
    name: 'P_i: the average router probability given to expert i',
    code: ['P'],
    about: 'Smooth in the router weights, so the balance loss can push on it. Its gradient is proportional to f_i, so the busiest expert is pushed down hardest.',
  },
  L: {
    color: 'red',
    name: 'L_aux: the load-balancing loss',
    tex: '\\mathcal{L}_{\\text{aux}}',
    code: ['aux_loss'],
    about: 'L_aux = E · Σ f_i P_i: exactly 1 when the load is even, E when every token goes to one expert. It joins the task loss with a small weight alpha, 0.01 in the Switch Transformer.',
  },
};
