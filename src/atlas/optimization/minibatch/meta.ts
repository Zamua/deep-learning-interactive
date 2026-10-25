import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'minibatch',
  title: 'Minibatches',
  blurb: 'Estimate the gradient from a small random batch instead of the whole dataset.',
  prereqs: ['sgd-linear'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'optimization', section: 'mini-batch' }],
};
