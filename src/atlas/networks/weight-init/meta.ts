import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'weight-init',
  title: 'Weight initialization',
  blurb: 'Start weights small and random, scaled to the layer\'s fan-in, so signals neither die out nor blow up.',
  prereqs: ['mlp-forward', 'gd-step'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'nn-data-loss', section: 'init' }],
};
