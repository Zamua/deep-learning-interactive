import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'param-count',
  title: 'Parameter count',
  blurb: 'How many numbers a layer learns: every weight plus every bias.',
  prereqs: ['linear-score', 'matmul-shapes'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'linear-classification', section: 'score-function' }],
};
