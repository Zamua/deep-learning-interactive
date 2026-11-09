import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'store-paths',
  title: 'Store paths',
  blurb: 'Every build gets its own read-only folder, named by a hash.',
  prereqs: ['attrsets'],
  mastery: { streak: 4, seconds: 60 },
};
