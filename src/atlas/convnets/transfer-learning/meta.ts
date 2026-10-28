import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'transfer-learning',
  title: 'Transfer learning',
  blurb: 'Start from a network trained on a big dataset; retrain only the top with little data, more of it with more.',
  prereqs: ['convnet-arch', 'overfitting'],
  mastery: { streak: 4, seconds: 30 },
};
