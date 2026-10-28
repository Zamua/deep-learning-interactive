import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'training-memory',
  title: 'Training memory',
  blurb: 'Weights, gradients and Adam\'s two moments: about 16 bytes per parameter before any activations.',
  prereqs: ['adam', 'param-count'],
  mastery: { streak: 4, seconds: 45 },
};
