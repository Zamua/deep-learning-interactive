import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'multi-head',
  title: 'Multi-head attention',
  blurb: 'Several smaller attentions side by side, each free to look for something different, then joined back together.',
  prereqs: ['self-attention'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'transformer' }],
};
