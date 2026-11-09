import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'mkderivation',
  title: 'mkDerivation',
  blurb: 'The standard build: fetch, unpack, configure, build, install.',
  prereqs: ['derivations', 'laziness'],
  mastery: { streak: 4, seconds: 60 },
};
