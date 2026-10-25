import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'vae',
  title: 'Variational autoencoders',
  blurb: 'The encoder gives a mean and a spread; sample a code with noise, decode it, and keep codes near a standard normal.',
  prereqs: ['autoencoder', 'weight-init'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'unsupervised' }],
};
