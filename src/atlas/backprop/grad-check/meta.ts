import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'grad-check',
  title: 'Gradient checking',
  blurb: 'Compare the analytic gradient with a numerical one from a centered difference, using a relative error.',
  prereqs: ['backprop-graph', 'derivative'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'nn-learning', section: 'gradcheck' }],
};
