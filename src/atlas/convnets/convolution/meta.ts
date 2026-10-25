import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'convolution',
  title: 'Convolution',
  blurb: 'Slide a small filter across the input and take a dot product at every position.',
  prereqs: ['dot-product', 'matrix-shape'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'convnets', section: 'conv-layer' }],
};
