import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'delta-rule',
  title: 'The delta rule',
  blurb: 'Read what the state holds for a key, then write only the difference: S ← S + β(v − S k)kᵀ overwrites instead of piling up.',
  prereqs: ['linear-attention'],
  mastery: { streak: 4, seconds: 50 },
};
