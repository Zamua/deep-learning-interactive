import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matvec',
  title: 'Matrix × vector',
  blurb: 'Each row of the matrix dotted with the vector: a matrix turns one vector into another.',
  prereqs: ['dot-product', 'matrix-shape'],
  mastery: { streak: 5, seconds: 40 },
};
