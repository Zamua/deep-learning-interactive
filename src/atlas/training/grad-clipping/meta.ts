import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'grad-clipping',
  title: 'Gradient clipping',
  blurb: 'When the gradient is longer than a threshold, scale it down to that length and keep its direction.',
  prereqs: ['bptt', 'dot-product', 'gd-step'],
  mastery: { streak: 4, seconds: 40 },
};
