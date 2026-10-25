import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'adam',
  title: 'Adam',
  blurb: 'Momentum, plus a step size per parameter from the running size of its gradients, with a bias correction.',
  prereqs: ['momentum'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'nn-learning', section: 'updates' }],
};
