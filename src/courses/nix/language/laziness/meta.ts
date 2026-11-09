import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'laziness',
  title: 'let and laziness',
  blurb: 'Names in a let are worked out only if something asks for them.',
  prereqs: ['functions'],
  mastery: { streak: 4, seconds: 60 },
};
