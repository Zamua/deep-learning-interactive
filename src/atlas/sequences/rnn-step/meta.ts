import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rnn-step',
  title: 'The recurrence',
  blurb: 'h_t = tanh(W_hh h_(t−1) + W_xh x_t + b): the same weights at every step, carrying a memory h.',
  prereqs: ['mlp-forward', 'embeddings'],
  mastery: { streak: 4, seconds: 50 },
};
