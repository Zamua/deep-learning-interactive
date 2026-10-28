import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'mlp-backprop',
  title: 'Two-layer backward pass',
  blurb: 'The gradient flows back from the scores through W2, the ReLU\'s on-off mask, and W1.',
  prereqs: ['mlp-forward', 'matmul-grad', 'softmax-grad'],
  mastery: { streak: 4, seconds: 60 },
};
