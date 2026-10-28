import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'mlp-forward',
  title: 'Two-layer forward pass',
  blurb: 'Scores through a hidden layer: h = ReLU(W1 x + b1), then s = W2 h + b2.',
  prereqs: ['activations', 'matvec', 'matmul-shapes'],
  mastery: { streak: 4, seconds: 50 },
};
