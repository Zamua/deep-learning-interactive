import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'learning-rate',
  title: 'Learning rate',
  blurb: 'How big each step is: too small crawls, too large overshoots or blows up.',
  prereqs: ['gd-step'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'optimization', section: 'gradient-descent' }],
};
