import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'diffusion-loss',
  title: 'Learning to denoise',
  blurb: 'Show the network a noised image and train it to predict the noise that was added.',
  prereqs: ['diffusion-noise', 'minibatch'],
  mastery: { streak: 4, seconds: 45 },
};
