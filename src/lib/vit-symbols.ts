import type { SymbolMap } from '../core/symbols';

/** Shared by the vision transformer chapter and its lecture, so a symbol keeps its color across both. */
export const VIT_SYMBOLS: SymbolMap = {
  xp: {
    color: 'orange',
    name: 'x_p: the patches, each flattened into one row of P·P·C numbers',
    tex: 'x_p',
    code: ['patches', 'x_p'],
    about: 'Each patch plays the part of a word, hence the paper\'s title, "An Image is Worth 16x16 Words" (2020). A 224 by 224 photo with 16 pixel patches gives 196 rows of 768 numbers; the tiny CIFAR-10 model gets 64 rows of 48.',
  },
  E: {
    color: 'blue',
    name: 'E: the patch embedding, a (P·P·C) by D matrix that turns a patch into a token',
    code: ['E'],
    about: 'Each column holds one weight per number in a patch, so it folds back into a small color picture: a filter. Multiplying every patch by E is a convolution with patch-sized filters and a stride of P, almost all ViT keeps from ConvNets.',
  },
  Epos: {
    color: 'red',
    name: 'E_pos: the position embeddings, one learned row of D numbers per position',
    tex: String.raw`E_{\text{pos}}`,
    code: ['E_pos'],
    about: 'Added to the tokens, it is the only thing that tells the encoder where a patch came from; without it the encoder sees a set. It starts random, and training makes neighboring slots similar; it exists only for the training grid, so bigger images need it interpolated.',
  },
  cls: {
    color: 'gold',
    name: 'x_cls: the class token, a learned vector placed in front of the patches',
    tex: String.raw`x_{\text{cls}}`,
    code: ['cls'],
    about: 'It has no pixels and starts as the same D numbers for every image. Layer by layer it reads what it needs from the patches, and its final state goes to the classifier. The idea comes from BERT\'s [CLS] token.',
  },
  z: {
    color: 'green',
    name: 'z: the token vectors, one row per token, as they flow through the encoder',
    code: ['z', 'z0'],
    about: 'Shape (N + 1, D): 197 by 768 in ViT-B/16, 65 by 64 in the tiny model. z0 enters the encoder, each block adds to it through residual connections, and z[0] is the class token (in DeiT, z[1] is the distillation token).',
  },
  A: {
    color: 'purple',
    name: 'A: the attention weights; row i says how much token i takes from each token',
    code: ['A'],
    about: 'One (N + 1) by (N + 1) table per layer and head: A[l, h] is 65 by 65 in the tiny model, and each row sums to 1. Row 0, the class token\'s, laid back on the grid shows where it looked; rollout chains the tables across layers.',
  },
  P: {
    color: 'slate',
    name: 'P: the patch size; every patch is P by P pixels',
    code: ['P'],
    about: 'A dial between detail and cost: halving P makes four times the patches and sixteen times the attention work. ViT-B/16 uses 16 on 224 pixel photos; the tiny CIFAR-10 model uses 4, a grid of 8 by 8.',
  },
  D: { color: 'slate', name: 'D: the model width, the length of every token vector', code: ['D'] },
};
