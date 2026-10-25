import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'self-consistency',
  title: 'Self-consistency',
  blurb: 'Sample several reasoning paths and take the answer most of them reach.',
  prereqs: ['chain-of-thought', 'sampling'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'reasoning' }],
};
