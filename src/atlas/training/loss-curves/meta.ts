import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'loss-curves',
  title: 'Reading loss curves',
  blurb: 'A learning rate too high or too low, a batch too small, or overfitting: each leaves its own shape in the curve.',
  prereqs: ['overfitting', 'learning-rate'],
  mastery: { streak: 4, seconds: 25 },
  deeper: [{ chapter: 'nn-learning', section: 'babysitting' }],
};
