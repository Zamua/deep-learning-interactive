import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'l2-reg',
  title: 'L2 regularization',
  blurb: 'Add λ times the sum of squared weights to the loss; its gradient pulls every weight toward zero.',
  prereqs: ['gd-step', 'linear-score', 'overfitting'],
  mastery: { streak: 5, seconds: 35 },
  deeper: [{ chapter: 'nn-data-loss', section: 'regularization' }],
};
