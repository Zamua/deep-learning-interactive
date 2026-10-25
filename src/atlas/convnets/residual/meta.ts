import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'residual',
  title: 'Residual connections',
  blurb: 'y = x + F(x): the block learns a change, and the gradient gets a direct path back.',
  prereqs: ['convnet-arch', 'backprop-graph', 'gd-step'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'convnets', section: 'case-studies' }],
};
