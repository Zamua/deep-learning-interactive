import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'flakes',
  title: 'Flakes',
  blurb: 'Inputs pinned in a lock file, outputs in a known shape.',
  prereqs: ['mkderivation'],
  mastery: { streak: 4, seconds: 60 },
};
