import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'power-laws',
  title: 'Ten times the compute',
  blurb: 'Each tenfold step in compute multiplies the loss by the same factor, 10^−α.',
  prereqs: ['log-log'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'scaling-laws' }],
};
