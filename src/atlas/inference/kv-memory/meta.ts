import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'kv-memory',
  title: 'KV cache memory',
  blurb: 'Two vectors per token per layer: 2 × layers × tokens × d × bytes per number.',
  prereqs: ['kv-cache', 'training-memory'],
  mastery: { streak: 4, seconds: 50 },
};
