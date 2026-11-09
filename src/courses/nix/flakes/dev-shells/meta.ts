import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'dev-shells',
  title: 'Dev shells',
  blurb: 'A project\'s tools on your PATH, for this shell and no other.',
  prereqs: ['flakes'],
  mastery: { streak: 4, seconds: 60 },
};
