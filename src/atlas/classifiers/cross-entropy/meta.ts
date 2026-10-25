import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'cross-entropy',
  title: 'Cross-entropy',
  blurb: 'Minus the log of the probability given to the right class: the softmax classifier\'s loss.',
  prereqs: ['softmax'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'linear-classification', section: 'softmax' }],
};
