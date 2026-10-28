import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'contrastive-loss',
  title: 'The contrastive loss',
  blurb: 'Two crops of one image are a positive pair: score each view against the batch by similarity over temperature, and take the cross-entropy of a softmax over its row.',
  prereqs: ['cross-entropy', 'dot-product', 'mlp-forward'],
  mastery: { streak: 4, seconds: 45 },
  from: 'contrastive',
};
