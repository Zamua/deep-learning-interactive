import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sgd-linear',
  title: 'SGD step',
  blurb: 'One full update of a linear classifier: scores, probabilities, gradient, step.',
  prereqs: ['softmax-grad', 'linear-score', 'gd-step'],
  mastery: { streak: 4, seconds: 60 },
  deeper: [{ chapter: 'optimization', section: 'summary' }],
};
