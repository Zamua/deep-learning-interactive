import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'grpo',
  title: 'GRPO',
  blurb: 'Sample a group of answers to one prompt and use the group\'s mean and spread as the baseline.',
  prereqs: ['advantage'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'grpo' }],
};
