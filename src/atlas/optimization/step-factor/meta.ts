import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'step-factor',
  title: 'The step factor',
  blurb: 'On a bowl a x², every gradient step multiplies x by the same factor, 1 − 2aη, and that factor decides whether x creeps, slides, zigzags or blows up.',
  prereqs: ['gd-step'],
  mastery: { streak: 4, seconds: 35 },
  from: 'learning-rate',
};
