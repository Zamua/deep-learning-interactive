import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'causal-mask',
  title: 'Causal masking',
  blurb: 'Set the scores for later tokens to minus infinity, so each token sees only itself and the past.',
  prereqs: ['self-attention'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'transformer' }],
};
