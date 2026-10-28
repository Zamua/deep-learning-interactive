import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'preference-loss',
  title: 'Scores from comparisons',
  blurb: 'A reward model scores answers; the one people preferred should win a sigmoid of the score gap.',
  prereqs: ['cross-entropy', 'sigmoid-grad'],
  from: 'reward-model',
  mastery: { streak: 4, seconds: 45 },
};
