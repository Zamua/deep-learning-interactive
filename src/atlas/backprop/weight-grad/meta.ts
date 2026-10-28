import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'weight-grad',
  title: 'Weight gradients',
  blurb: 'In z = Wx, weight (i, j) gets the gradient on zᵢ times xⱼ: the whole grid is the outer product dz xᵀ.',
  prereqs: ['backprop-graph', 'matmul-shapes'],
  from: 'matmul-grad',
  mastery: { streak: 5, seconds: 35 },
};
