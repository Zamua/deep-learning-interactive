import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'autoencoder',
  title: 'Autoencoders',
  blurb: 'Squeeze the input through a narrow middle and train the network to give it back unchanged.',
  prereqs: ['mlp-forward', 'gd-step'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'unsupervised' }],
};
