import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'linear-recurrence',
  title: 'Linear recurrences',
  blurb: 'h_t = a·h_(t−1) + b·x_t: without the tanh, the state is a sum of past inputs, each faded by a power of a.',
  prereqs: ['rnn-step'],
  mastery: { streak: 4, seconds: 50 },
};
