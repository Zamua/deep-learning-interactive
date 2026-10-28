import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'top-p',
  title: 'Top-k and top-p sampling',
  blurb: 'Cut off the unlikely tail before sampling: keep the k likeliest tokens, or the fewest that hold p of the probability.',
  prereqs: ['sampling'],
  mastery: { streak: 4, seconds: 45 },
};
