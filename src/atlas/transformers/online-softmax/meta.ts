import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'online-softmax',
  title: 'Softmax in one pass',
  blurb: 'Keep a running max and sum, rescaling the sum whenever the max grows: how FlashAttention avoids storing the scores.',
  prereqs: ['softmax', 'attention-cost'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'modern-transformer' }],
};
