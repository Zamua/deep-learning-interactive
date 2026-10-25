import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'dpo',
  title: 'Direct preference optimization',
  blurb: 'A classification loss on preference pairs, with no reward model and no sampling loop.',
  prereqs: ['reward-model', 'kl-penalty'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'dpo' }],
};
