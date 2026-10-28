import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matmul-grad',
  title: 'Input gradients',
  blurb: 'In z = Wx, each xⱼ feeds every zᵢ, so its gradients add: column j of W dotted with dz, which makes the whole of it Wᵀ dz.',
  prereqs: ['weight-grad'],
  mastery: { streak: 5, seconds: 40 },
};
