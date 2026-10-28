import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'flow-matching',
  title: 'Flow matching',
  blurb: 'Blend image and noise along a straight line, train the network to predict the velocity along it, and sample with a few Euler steps.',
  prereqs: ['diffusion-loss'],
  mastery: { streak: 4, seconds: 45 },
};
