import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sampling',
  title: 'Sampling and temperature',
  blurb: 'Divide the scores by a temperature before softmax: low is near greedy, high is near random.',
  prereqs: ['char-lm'],
  mastery: { streak: 5, seconds: 35 },
  deeper: [{ chapter: 'rnn', section: 'sampling' }],
};
