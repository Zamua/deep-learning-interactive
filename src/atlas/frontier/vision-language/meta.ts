import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'vision-language',
  title: 'Vision-language models',
  blurb: 'A vision transformer turns the image into patch vectors, a projection maps them to the language model\'s width, and they sit in the prompt like words.',
  prereqs: ['vit', 'gpt'],
  mastery: { streak: 4, seconds: 45 },
};
