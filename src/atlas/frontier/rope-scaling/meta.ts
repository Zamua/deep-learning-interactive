import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rope-scaling',
  title: 'Stretching rotary positions',
  blurb: 'To run past the trained length, divide positions by the stretch factor so every angle stays in the range training saw.',
  prereqs: ['rope'],
  mastery: { streak: 4, seconds: 45 },
};
