import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'conv-params',
  title: 'Conv parameters',
  blurb: 'A layer of K filters of size F × F over C channels learns K(F·F·C + 1) numbers, wherever it slides.',
  prereqs: ['conv-channels', 'param-count'],
  mastery: { streak: 5, seconds: 30 },
};
