import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gradient',
  title: 'Gradient',
  blurb: 'One partial derivative per input, gathered into a vector that points uphill.',
  prereqs: ['derivative-rules', 'matrix-shape'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'math-kit', section: 'gradient' }, { chapter: 'optimization', section: 'gradient' }],
};
