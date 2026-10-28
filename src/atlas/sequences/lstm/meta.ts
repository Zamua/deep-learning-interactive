import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'lstm',
  title: 'LSTM',
  blurb: 'Forget, input and output gates around a cell state that updates by addition, so memories last.',
  prereqs: ['bptt', 'sigmoid-grad'],
  mastery: { streak: 4, seconds: 45 },
};
