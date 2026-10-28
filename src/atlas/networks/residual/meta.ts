import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'residual',
  title: 'Residual connections',
  blurb: 'y = x + F(x): a shortcut adds the input back, so backward each block multiplies the gradient by 1 + F′ and deep stacks keep it alive.',
  prereqs: ['mlp-forward', 'backprop-graph', 'gd-step'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'convnets', section: 'case-studies' }],
};
