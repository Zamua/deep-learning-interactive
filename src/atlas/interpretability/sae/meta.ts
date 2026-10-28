import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sae',
  title: 'Sparse autoencoders',
  blurb: 'Expand activations into many features, few active at once, and reconstruct them: a dictionary of what the model represents.',
  prereqs: ['superposition', 'autoencoder', 'l2-reg'],
  mastery: { streak: 4, seconds: 50 },
};
