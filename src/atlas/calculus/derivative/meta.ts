import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'derivative',
  title: 'Reading a derivative',
  blurb: 'The slope at a point as a rate: about how far the output moves for a small nudge, and which way.',
  prereqs: ['slope'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'math-kit', section: 'derivatives' }],
};
