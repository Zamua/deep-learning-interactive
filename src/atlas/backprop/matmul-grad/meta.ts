import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matmul-grad',
  title: 'Matrix gradients',
  blurb: 'In z = Wx, weight (i, j) gets the gradient on zᵢ times xⱼ, a grid that is dz xᵀ, while x gets Wᵀ dz.',
  prereqs: ['backprop-graph', 'matmul-shapes'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'backprop', section: 'vectorized' }],
};
