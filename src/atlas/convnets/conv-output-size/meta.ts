import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'conv-output-size',
  title: 'Conv output size',
  blurb: '(W − F + 2P) / S + 1: how the input size, filter, padding and stride set the output size.',
  prereqs: ['convolution'],
  mastery: { streak: 5, seconds: 25 },
  deeper: [{ chapter: 'convnets', section: 'arrangement' }],
};
