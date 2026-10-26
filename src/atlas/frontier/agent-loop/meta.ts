import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'agent-loop',
  title: 'Agent loops',
  blurb: 'Call, read the result, call again: the context grows every turn, and a cached prefix saves reading it all again.',
  prereqs: ['tool-calls', 'prefill-decode'],
  mastery: { streak: 4, seconds: 60 },
};
