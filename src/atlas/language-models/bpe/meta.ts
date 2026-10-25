import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'bpe',
  title: 'Byte-pair encoding',
  blurb: 'Start from bytes and keep merging the most frequent neighboring pair into a new token.',
  prereqs: ['embeddings'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'tokenization' }],
};
