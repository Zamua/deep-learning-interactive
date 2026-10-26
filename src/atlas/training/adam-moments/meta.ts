import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'adam-moments',
  title: 'Adam\'s running averages',
  blurb: 'Adam averages each parameter\'s gradient and its squared gradient, keeping a share β of the old average every step.',
  prereqs: ['momentum'],
  mastery: { streak: 4, seconds: 40 },
  from: 'adam',
  deeper: [{ chapter: 'nn-learning', section: 'updates' }],
};
