import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'scaled-attention',
  title: 'Scaled dot-product attention',
  blurb: 'Divide the scores by the square root of d, so longer vectors do not push the softmax to all or nothing.',
  prereqs: ['qkv'],
  mastery: { streak: 4, seconds: 45 },
};
