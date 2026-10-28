import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'param-count',
  title: 'Parameter count',
  blurb: 'How many numbers make up a linear classifier: every weight plus every bias.',
  prereqs: ['linear-score', 'matmul-shapes'],
  mastery: { streak: 4, seconds: 30 },
};
