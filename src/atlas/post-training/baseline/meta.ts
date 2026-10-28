import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'baseline',
  title: 'Baselines and advantages',
  blurb: 'Subtract the reward you expected, so only better-than-usual answers get pushed up.',
  prereqs: ['policy-gradient'],
  from: 'advantage',
  mastery: { streak: 4, seconds: 45 },
};
