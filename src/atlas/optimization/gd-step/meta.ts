import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gd-step',
  title: 'Gradient step',
  blurb: 'Move each input a small step against its gradient: the update that walks a function downhill.',
  prereqs: ['gradient'],
  mastery: { streak: 5, seconds: 30 },
};
