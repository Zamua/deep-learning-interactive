import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'contrastive',
  title: 'Contrastive learning',
  blurb: 'Pull matching pairs together and push the rest apart, with a softmax over similarities.',
  prereqs: ['cross-entropy', 'dot-product', 'mlp-forward'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'contrastive' }],
};
