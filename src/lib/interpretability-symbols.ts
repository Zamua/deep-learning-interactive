import type { SymbolMap } from '../core/symbols';

/** Shared by the interpretability chapter and its lecture, so a quantity keeps its color in both. */
export const INTERPRETABILITY_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: an activation vector: the residual stream at one position, or a batch of them (X)',
    code: ['x', 'x0', 'x1', 'x2', 'X'],
    about: 'In the toy transformer, 32 numbers per position: x0 is the embedding, x1 adds head zero\'s write, x2 adds head one\'s. In the superposition toy it is 2 numbers, and for the SAE, 8 neuron activations. Residual stream is the name Elhage et al. (2021) gave the sum that residual connections build.',
  },
  U: {
    color: 'teal',
    name: 'W_U: the unembedding, d by V: turns a vector into one logit per token',
    tex: 'W_U',
    code: ['W_U'],
    about: '32 by 20 in the toy. Because the stream is a sum, multiplying any part of it by W_U shows that part\'s direct effect on the output; applied to the middle of the stream, it is the logit lens (nostalgebraist, 2020).',
  },
  QK: {
    color: 'blue',
    name: 'W_QK = W_Q W_Kᵀ: the QK circuit, which decides where a head looks',
    tex: 'W_{QK}',
    code: ['W_QK', 'W_QK0', 'W_QK1'],
    about: 'Queries and keys meet only in this product, so it alone sets the attention scores, x W_QK xᵀ / 4; it is 32 by 32, squeezed through the head width of 16. Read on positions alone, head zero\'s shows a stripe one step back: a previous-token head.',
  },
  OV: {
    color: 'gold',
    name: 'W_OV = W_V W_O: the OV circuit, which decides what a head moves',
    tex: 'W_{OV}',
    code: ['W_OV', 'W_OV0', 'W_OV1'],
    about: 'Values and output act only together, so this one matrix says what a head writes for what it reads; it is independent of where the head looks. E W_OV1 W_U has a bright diagonal: head one copies the letter it attends to.',
  },
  A: {
    color: 'purple',
    name: 'A: attention weights; row i says how much position i takes from each earlier position',
    code: ['A', 'A0', 'A1'],
    about: '24 by 24 for twelve letters given twice, zero above the diagonal, rows summing to 1. A0 puts its weight one step back; A1 puts it on the letter after the earlier copy, A1[i, i − 11], whose mean is the induction score (0.87 after training).',
  },
  f: {
    color: 'green',
    name: 'f: feature activations, one number per feature, mostly zero',
    code: ['f', 'F'],
    about: 'In the superposition toy, five features, each zero with probability S. From a sparse autoencoder\'s encoder, a relu of W_enc times x: much wider than x, kept sparse by the L1 penalty. The hope is monosemantic features, one meaning each, unlike polysemantic neurons.',
  },
  W: {
    color: 'blue',
    name: 'W: feature directions, one column per feature (the toy model’s W, the SAE’s decoder W_dec)',
    code: ['W', 'W_dec'],
    about: 'The toy\'s W is 2 by 5, five directions in a plane; sparse features end up as a pentagon, while the SAE\'s W_dec keeps its columns at length 1. x = W f is a superposition, a sum of many directions at once, as in the superposition principle of physics.',
  },
  S: {
    color: 'slate',
    name: 'S: sparsity, the chance that a feature is zero on a given input',
    code: ['S'],
    about: 'At S = 0 (dense) the toy keeps only the two most important features, at right angles. Toward 0.95, two features are rarely on together, so interference is rare and all five fit.',
  },
  lam: {
    color: 'slate',
    name: 'λ: the L1 penalty strength, which trades reconstruction for sparsity',
    tex: '\\lambda',
    code: ['lam'],
    about: 'loss = mse + λ · f.sum(): every unit of activation costs the same, so weak features are pushed to zero. Too low and the features blur; too high and the reconstruction suffers. The same penalty drives the lasso (Tibshirani, 1996).',
  },
  L: {
    color: 'red',
    name: 'L: the loss being minimized',
    code: ['loss'],
    about: 'In training, next-letter cross-entropy, whose repeat half drops from 2.6 to below 1 as the induction head forms. In the superposition toy, importance-weighted squared error; for the SAE, reconstruction error plus λ times the L1 norm of f.',
  },
};
