import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'tool-calls',
  title: 'Tool calls',
  blurb: 'The model writes a call, the program around it runs the tool and pastes the result into the context, and generation goes on.',
  prereqs: ['in-context'],
  mastery: { streak: 4, seconds: 40 },
};
