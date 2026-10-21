import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  embed: {
    is: 'turns token ids into vectors by table lookup',
    more: 'Each id selects one row of the embedding table E, so embed(tokens) is E[ids]. The table gives a token the same row wherever it sits, which is why positions are added on top.',
  },
  attention: {
    is: 'lets each token gather information from the others',
    more: 'Each query is scored against every key, a softmax turns the scores into weights, and the output is that blend of the values. With no positions added, shuffling the input rows only shuffles the output rows.',
  },
  mlp: {
    is: 'a small two-layer network applied to each token',
    more: 'It widens each vector to 4d, applies a ReLU, and projects back to d, with the same weights at every position. MLP stands for multilayer perceptron, after Rosenblatt\'s single-layer perceptron of 1958.',
  },
  unembed: {
    is: 'turns each final vector into next-token scores',
    more: 'A d by V matrix gives one logit per vocabulary word. In the recap it reuses the embedding table: x @ E.T.',
  },
  rnn_step: {
    is: 'folds one token into the RNN hidden state',
    more: 'Each call needs the previous h, so T tokens take T steps in a row. Attention removes this loop over time.',
  },
  multi_head: {
    is: 'several attention heads run side by side',
    more: 'Each head has its own Wq, Wk and Wv; their narrow outputs are concatenated back to width d and mixed by Wo. The mask argument in the recap makes it causal.',
  },
};
