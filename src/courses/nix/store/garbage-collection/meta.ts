import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'garbage-collection',
  title: 'Garbage collection',
  blurb: 'Roots keep what they reach, and everything else can go.',
  prereqs: ['closures'],
  mastery: { streak: 4, seconds: 60 },
};
