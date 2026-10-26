import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'selective-ssm',
  title: 'Selective state spaces',
  blurb: 'Each input sets its own decay, so the model chooses what to keep and what to forget, in a state whose size never grows.',
  prereqs: ['linear-recurrence', 'kv-memory'],
  mastery: { streak: 4, seconds: 50 },
};
