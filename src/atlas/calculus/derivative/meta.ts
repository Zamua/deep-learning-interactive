import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'derivative',
  title: 'Derivatives',
  blurb: 'The slope of a function at a point: how fast the output moves when the input is nudged.',
  prereqs: [],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'math-kit', section: 'derivatives' }],
};
