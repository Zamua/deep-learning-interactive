import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'retrieval',
  title: 'Retrieval',
  blurb: 'Embed the question, find the passages whose embeddings are most similar, and put them in the prompt.',
  prereqs: ['in-context', 'dot-product'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'pretraining' }],
};
