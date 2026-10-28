import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'conv-channels',
  title: 'Channels and filters',
  blurb: 'Each filter spans every input channel, and each filter makes one output channel.',
  prereqs: ['convolution'],
  mastery: { streak: 4, seconds: 25 },
};
