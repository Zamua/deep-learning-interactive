import type { SymbolMap } from '../core/symbols';

/** Shared by the scaling-laws chapter and its lecture, so a symbol keeps its color across both. */
export const SCALING_LAWS_SYMBOLS: SymbolMap = {
  N: {
    color: 'blue',
    name: 'N: the number of parameters in the model',
    code: ['N', 'N_opt', 'sizes'],
    about: 'It sets the cost per token, about 6N FLOPs to train and 2N to serve, and the capacity penalty A / N^α in the loss. 175 billion for GPT-3, 70 billion for Chinchilla.',
  },
  D: {
    color: 'orange',
    name: 'D: the number of training tokens',
    code: ['D', 'D_opt'],
    about: 'The compute-optimal split is about 20 tokens per parameter: 1.4 trillion for Chinchilla\'s 70 billion. Models served heavily train far longer, like Llama 3 8B on 15 trillion.',
  },
  C: {
    color: 'purple',
    name: 'C: training compute, counted in floating-point operations (FLOPs)',
    code: ['C', 'budgets'],
    about: 'C ≈ 6ND: two FLOPs per parameter per token forward, four backward. GPT-3 used about 3 × 10²³ and Chinchilla about 5.8 × 10²³; the question is how to split a fixed C between N and D.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, next-token cross-entropy in nats',
    code: ['L', 'loss'],
    about: 'What a scaling law predicts. It falls as a power law in N, D and C, a straight line on log-log axes, but never below the floor E.',
  },
  E: {
    color: 'green',
    name: 'E: the irreducible loss, a floor no model can go below',
    code: ['E'],
    about: 'The uncertainty left in text itself, about 1.69 nats in the Chinchilla fit. A straight line that ignores it dives through the floor when extrapolated far.',
  },
  alpha: {
    color: 'teal',
    name: 'α: how fast the loss falls as parameters grow',
    tex: '\\alpha',
    code: ['alpha', 'alpha_N'],
    about: 'The slope of the parameter term on log-log axes: Kaplan\'s alpha_N is 0.076, Chinchilla\'s α about 0.34. Doubling N multiplies that penalty by 2^−α.',
  },
  beta: {
    color: 'gold',
    name: 'β: how fast the loss falls as training tokens grow',
    tex: '\\beta',
    code: ['beta', 'alpha_D'],
    about: 'Kaplan\'s alpha_D is 0.095, Chinchilla\'s β about 0.28. The best model size grows as C^(β/(α+β)), so when α ≈ β, parameters and tokens grow together.',
  },
  Dinf: {
    color: 'slate',
    name: 'D_inf: tokens the model will process at inference over its lifetime',
    tex: 'D_{\\text{inf}}',
    code: ['D_inf'],
    about: 'Serving costs about 2N FLOPs per token, so the lifetime bill is 6ND + 2N·D_inf. The larger D_inf, the smaller the best model, and the more tokens per parameter it should train on.',
  },
};
