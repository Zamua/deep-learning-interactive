import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gd-step',
  title: 'Gradient step',
  blurb: 'Move each parameter a small step against its gradient: the update that does all the learning.',
  prereqs: ['gradient'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'optimization', section: 'gradient-descent' }],
};
