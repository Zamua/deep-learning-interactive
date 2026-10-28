import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'reward-model',
  title: 'Training a reward model',
  blurb: 'Each preference raises the chosen answer\'s score and lowers the other\'s, by 1 − σ of their gap.',
  prereqs: ['preference-loss'],
  mastery: { streak: 4, seconds: 45 },
};
