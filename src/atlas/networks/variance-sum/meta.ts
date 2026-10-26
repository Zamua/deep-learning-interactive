import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'variance-sum',
  title: 'Variance of a sum',
  blurb: 'Variance measures spread. Independent terms add their variances, so a sum of n terms spreads √n times as wide as one.',
  prereqs: ['mlp-forward'],
  mastery: { streak: 4, seconds: 30 },
  from: 'weight-init',
  deeper: [{ chapter: 'nn-data-loss', section: 'init' }],
};
