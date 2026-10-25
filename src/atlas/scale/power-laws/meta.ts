import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'power-laws',
  title: 'Scaling laws',
  blurb: 'Loss falls as a power law in compute: a straight line on log-log axes.',
  prereqs: ['exp-log', 'loss-curves'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'scaling-laws' }],
};
