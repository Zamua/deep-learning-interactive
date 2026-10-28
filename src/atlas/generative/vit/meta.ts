import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'vit',
  title: 'Vision transformers',
  blurb: 'Cut the image into patches, flatten each patch into a token, and run a transformer.',
  prereqs: ['transformer-block', 'convolution', 'positions'],
  mastery: { streak: 4, seconds: 45 },
};
