import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'positions',
  title: 'Positional information',
  blurb: 'Attention ignores order, so each token gets a vector for its position added to its embedding.',
  prereqs: ['self-attention', 'embeddings'],
  mastery: { streak: 4, seconds: 40 },
};
