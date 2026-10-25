import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matmul-grad',
  title: 'Matrix gradients',
  blurb: 'For z = Wx, the gradient on W is the gradient from above times x transposed: the shapes decide it.',
  prereqs: ['backprop-graph', 'matmul-shapes'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'backprop', section: 'vectorized' }],
};
