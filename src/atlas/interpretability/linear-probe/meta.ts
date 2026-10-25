import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'linear-probe',
  title: 'Linear probes',
  blurb: 'Fit a linear classifier on hidden activations to test what they encode.',
  prereqs: ['residual-stream', 'linear-score'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'interpretability' }],
};
