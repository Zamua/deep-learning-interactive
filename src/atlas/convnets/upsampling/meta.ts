import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'upsampling',
  title: 'Upsampling for segmentation',
  blurb: 'To label every pixel, shrink with strided convolutions, then grow back with transposed ones: S(W − 1) + F − 2P.',
  prereqs: ['conv-output-size', 'convnet-arch'],
  mastery: { streak: 4, seconds: 40 },
};
