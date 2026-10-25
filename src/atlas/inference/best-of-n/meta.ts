import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'best-of-n',
  title: 'Best-of-n with a verifier',
  blurb: 'Draw n answers and keep one a checker accepts: the chance of a hit is 1 − (1 − p)ⁿ.',
  prereqs: ['self-consistency'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'reasoning' }],
};
