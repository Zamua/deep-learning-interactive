import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'pooling',
  title: 'Pooling',
  blurb: 'Downsample each channel by taking the max or average over small windows; no parameters.',
  prereqs: ['conv-output-size', 'conv-channels'],
  mastery: { streak: 4, seconds: 25 },
};
