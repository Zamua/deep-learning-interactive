import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'power-rule',
  title: 'The power rule',
  blurb: 'xⁿ becomes n xⁿ⁻¹: derivatives of polynomials, one term at a time, with no limit to take.',
  prereqs: ['derivative'],
  from: 'derivative-rules',
  mastery: { streak: 5, seconds: 30 },
};
