import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'kl-penalty',
  title: 'The KL penalty',
  blurb: 'Charge the model for drifting from where it started: the log-ratio of the two models\' probabilities.',
  prereqs: ['policy-gradient', 'cross-entropy'],
  mastery: { streak: 4, seconds: 45 },
};
