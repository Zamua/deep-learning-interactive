import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'momentum',
  title: 'Momentum',
  blurb: 'Keep a running velocity of past gradients and step along it, so steps build up in directions that agree.',
  prereqs: ['gd-step', 'learning-rate'],
  mastery: { streak: 5, seconds: 35 },
  deeper: [{ chapter: 'nn-learning', section: 'updates' }],
};
