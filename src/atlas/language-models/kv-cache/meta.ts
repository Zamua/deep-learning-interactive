import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'kv-cache',
  title: 'The KV cache',
  blurb: 'While generating, keep every earlier token\'s keys and values instead of computing them again.',
  prereqs: ['gpt'],
  mastery: { streak: 4, seconds: 45 },
};
