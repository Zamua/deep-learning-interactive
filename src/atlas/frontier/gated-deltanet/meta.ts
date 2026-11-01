import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gated-deltanet',
  title: 'Gated DeltaNet',
  blurb: 'A gate α fades the whole memory at once, and the delta rule edits one key: S ← αS + β(v − αS k)kᵀ.',
  prereqs: ['delta-rule', 'selective-ssm'],
  mastery: { streak: 4, seconds: 50 },
};
