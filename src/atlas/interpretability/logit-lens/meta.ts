import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'logit-lens',
  title: 'The logit lens',
  blurb: 'Unembed the residual stream partway through to see what the model would predict so far.',
  prereqs: ['residual-stream', 'unembedding'],
  mastery: { streak: 4, seconds: 40 },
};
