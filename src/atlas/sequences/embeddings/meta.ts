import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'embeddings',
  title: 'Embeddings',
  blurb: 'A table with one vector per token: looking up a row is a one-hot vector times the table.',
  prereqs: ['matvec'],
  mastery: { streak: 4, seconds: 30 },
};
