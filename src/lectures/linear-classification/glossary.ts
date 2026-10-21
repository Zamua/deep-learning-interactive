import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  loss_fn: {
    is: 'grades the scores: one number, lower is better',
    more: 'A stand-in for either classic loss of this chapter, the multiclass SVM or the softmax cross-entropy. It takes the scores and the correct class y, and is high when the scores are bad.',
  },
};
