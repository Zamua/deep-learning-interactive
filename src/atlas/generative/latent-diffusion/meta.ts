import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'latent-diffusion',
  title: 'Latent diffusion',
  blurb: 'Run diffusion on an autoencoder\'s small latent instead of on pixels, then decode: far fewer numbers per step.',
  prereqs: ['autoencoder', 'ddpm-sampling'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'diffusion' }],
};
