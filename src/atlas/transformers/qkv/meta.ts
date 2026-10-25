import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'qkv',
  title: 'Queries, keys and values',
  blurb: 'Three linear maps of each token: a query that asks, keys that answer, and values that get mixed.',
  prereqs: ['rnn-attention', 'matvec'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'seq2seq' }],
};
