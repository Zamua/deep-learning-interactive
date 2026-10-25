import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'swiglu',
  title: 'Gated MLPs',
  blurb: 'SwiGLU multiplies two projections, one passed through a smooth gate, inside the block\'s MLP.',
  prereqs: ['transformer-block', 'activations'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'modern-transformer' }],
};
