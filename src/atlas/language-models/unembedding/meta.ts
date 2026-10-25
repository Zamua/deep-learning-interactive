import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'unembedding',
  title: 'From vectors back to tokens',
  blurb: 'A last matrix scores every token in the vocabulary; often it is the embedding table itself.',
  prereqs: ['embeddings', 'linear-score'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'tokenization' }],
};
