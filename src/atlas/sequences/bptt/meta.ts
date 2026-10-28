import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'bptt',
  title: 'Backprop through time',
  blurb: 'Unroll the recurrence and backprop through every step; long products of factors make gradients vanish or explode.',
  prereqs: ['rnn-step', 'backprop-graph'],
  mastery: { streak: 4, seconds: 40 },
};
