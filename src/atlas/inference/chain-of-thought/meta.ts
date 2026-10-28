import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chain-of-thought',
  title: 'Chain of thought',
  blurb: 'Let the model write out its steps before the answer, at the price of more tokens.',
  prereqs: ['gpt'],
  mastery: { streak: 4, seconds: 40 },
};
