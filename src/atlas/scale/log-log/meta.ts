import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'log-log',
  title: 'Scaling laws',
  blurb: 'Loss falls as a power law in compute, L = aC^−α: a straight line of slope −α on log-log axes.',
  prereqs: ['exp-log', 'loss-curves'],
  mastery: { streak: 4, seconds: 45 },
  from: 'power-laws',
  deeper: [{ chapter: 'scaling-laws' }],
};
