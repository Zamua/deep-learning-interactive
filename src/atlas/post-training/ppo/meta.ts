import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'ppo',
  title: 'PPO\'s clipped objective',
  blurb: 'Clip the probability ratio, so one batch of updates cannot move the model too far.',
  prereqs: ['prob-ratio', 'kl-penalty'],
  mastery: { streak: 4, seconds: 50 },
};
