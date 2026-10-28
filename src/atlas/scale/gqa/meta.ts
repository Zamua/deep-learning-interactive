import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gqa',
  title: 'Grouped-query attention',
  blurb: 'Several query heads share one key and value head, which shrinks the KV cache.',
  prereqs: ['multi-head', 'kv-cache'],
  mastery: { streak: 4, seconds: 45 },
};
