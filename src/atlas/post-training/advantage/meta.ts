import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'advantage',
  title: 'Baselines and advantages',
  blurb: 'Subtract the reward you expected, so only better-than-usual answers get pushed up.',
  prereqs: ['policy-gradient'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'policy-gradients' }],
};
