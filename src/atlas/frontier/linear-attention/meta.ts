import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'linear-attention',
  title: 'Linear attention',
  blurb: 'Drop the softmax, and attention becomes a recurrence: one matrix state, S ← S + v kᵀ, read out as S q.',
  prereqs: ['attention-cost', 'linear-recurrence', 'kv-memory'],
  mastery: { streak: 4, seconds: 50 },
};
