import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'derivative-rules',
  title: 'Derivatives of e and ln',
  blurb: 'eᵃˣ becomes a eᵃˣ and ln x becomes 1/x, so mixed functions differentiate one term at a time.',
  prereqs: ['power-rule', 'exp-log'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'math-kit', section: 'derivatives' }],
};
