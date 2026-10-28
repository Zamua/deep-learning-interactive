import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'moe',
  title: 'Mixture of experts',
  blurb: 'A router sends each token to a few of many MLPs: total parameters grow while the work per token does not.',
  prereqs: ['transformer-block', 'softmax'],
  mastery: { streak: 4, seconds: 55 },
};
