import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'ddpm-sampling',
  title: 'Sampling by denoising',
  blurb: 'Start from pure noise and walk back: estimate the clean image, blend it back one step less noisy, and add a little fresh noise.',
  prereqs: ['diffusion-loss'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'diffusion' }],
};
