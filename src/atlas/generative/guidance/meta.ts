import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'guidance',
  title: 'Classifier-free guidance',
  blurb: 'Run the denoiser with and without the prompt, and step further in the direction the prompt points.',
  prereqs: ['diffusion-loss'],
  mastery: { streak: 4, seconds: 40 },
};
