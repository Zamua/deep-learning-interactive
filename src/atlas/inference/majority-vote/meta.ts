import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'majority-vote',
  title: 'Self-consistency\'s vote',
  blurb: 'Sample several reasoning paths and return the final answer most of them reach.',
  prereqs: ['chain-of-thought', 'sampling'],
  mastery: { streak: 4, seconds: 35 },
  from: 'self-consistency',
};
