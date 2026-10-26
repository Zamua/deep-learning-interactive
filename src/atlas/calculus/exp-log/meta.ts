import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'exp-log',
  title: 'Log rules',
  blurb: 'ln turns products into sums, powers into factors and quotients into differences.',
  prereqs: ['e-and-ln'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'math-kit', section: 'exp-log' }],
};
