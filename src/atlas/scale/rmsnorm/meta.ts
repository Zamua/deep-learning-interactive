import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rmsnorm',
  title: 'RMSNorm',
  blurb: 'Layer norm without the mean: divide each token by its root mean square, then scale.',
  prereqs: ['layer-norm', 'embeddings'],
  mastery: { streak: 4, seconds: 40 },
};
