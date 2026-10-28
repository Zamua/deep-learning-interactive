import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matmul-shapes',
  title: 'Matmul shapes',
  blurb: '(m, n) times (n, k) gives (m, k): which products work, and what shape comes out.',
  prereqs: ['matvec'],
  mastery: { streak: 5, seconds: 20 },
};
