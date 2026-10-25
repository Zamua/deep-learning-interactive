import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'dropout',
  title: 'Dropout',
  blurb: 'Zero each unit at random during training and scale up the rest, so no unit can lean on another.',
  prereqs: ['mlp-forward', 'gd-step'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'nn-data-loss', section: 'dropout' }],
};
