import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'reward-model',
  title: 'Reward models',
  blurb: 'Learn a score from human comparisons: the preferred answer should win a sigmoid of the score difference.',
  prereqs: ['cross-entropy', 'sigmoid-grad'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'rlhf' }],
};
