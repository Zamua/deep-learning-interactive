import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'transformer-block',
  title: 'The transformer block',
  blurb: 'Attention, then an MLP, each with a layer norm and a residual connection around it.',
  prereqs: ['multi-head', 'layer-norm', 'residual'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'transformer' }],
};
