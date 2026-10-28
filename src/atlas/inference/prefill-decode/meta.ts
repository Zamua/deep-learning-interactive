import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'prefill-decode',
  title: 'Prefill and decode',
  blurb: 'The prompt runs as one parallel pass; after that, each new token takes a pass of its own.',
  prereqs: ['kv-cache'],
  mastery: { streak: 4, seconds: 40 },
};
