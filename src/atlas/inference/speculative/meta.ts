import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'speculative',
  title: 'Speculative decoding',
  blurb: 'A small model drafts several tokens and the large one checks them all in one pass.',
  prereqs: ['prefill-decode', 'sampling'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'inference' }],
};
