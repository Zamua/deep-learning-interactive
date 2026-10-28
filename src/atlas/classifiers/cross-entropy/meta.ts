import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'cross-entropy',
  title: 'Cross-entropy',
  blurb: 'Minus the log of the probability given to the right answer: a loss that punishes confident mistakes.',
  prereqs: ['softmax'],
  mastery: { streak: 5, seconds: 30 },
};
