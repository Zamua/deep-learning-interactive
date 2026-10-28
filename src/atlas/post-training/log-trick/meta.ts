import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'log-trick',
  title: 'The log trick',
  blurb: 'The slope of a probability is the probability times the slope of its log.',
  prereqs: ['sampling', 'gradient', 'exp-log'],
  from: 'policy-gradient',
  mastery: { streak: 4, seconds: 40 },
};
