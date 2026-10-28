import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chain-rule',
  title: 'Chain rule',
  blurb: 'The derivative of a function inside a function, as a formula: multiply the slopes, then put the inside back.',
  prereqs: ['chain-slopes'],
  mastery: { streak: 5, seconds: 40 },
};
