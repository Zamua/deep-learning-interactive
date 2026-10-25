import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'policy-gradient',
  title: 'Policy gradients',
  blurb: 'Raise the log-probability of each sampled answer in proportion to its reward.',
  prereqs: ['sampling', 'gradient', 'exp-log'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'policy-gradients' }],
};
