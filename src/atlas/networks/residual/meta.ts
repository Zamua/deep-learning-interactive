import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'residual',
  title: 'Residual gradients',
  blurb: 'Backward, the shortcut hands the gradient straight to x, so each block multiplies it by 1 + F′ and deep stacks keep it alive.',
  prereqs: ['res-block', 'backprop-graph', 'gd-step'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'convnets', section: 'case-studies' }],
};
