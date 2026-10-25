import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'superposition',
  title: 'Superposition',
  blurb: 'More features than dimensions, stored as nearly perpendicular directions that interfere a little.',
  prereqs: ['residual-stream', 'dot-product'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'interpretability' }],
};
