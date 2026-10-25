import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'diffusion-noise',
  title: 'Adding noise',
  blurb: 'Blend an image with Gaussian noise; a schedule sets how much of the signal is left at each step.',
  prereqs: ['weight-init'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'diffusion' }],
};
