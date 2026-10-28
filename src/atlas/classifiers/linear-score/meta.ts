import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'linear-score',
  title: 'Linear scores',
  blurb: 'Scores for every class at once: s = Wx + b.',
  prereqs: ['matvec'],
  mastery: { streak: 5, seconds: 40 },
};
