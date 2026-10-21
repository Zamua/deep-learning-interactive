import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  choose_size: {
    is: 'the best parameter count for a compute budget',
    more: 'The lecture\'s open question. Kaplan answered with N growing as C^0.73; Chinchilla with about C^0.5, roughly twenty tokens per parameter.',
  },
  predict: {
    is: 'the loss a model will reach, before training it',
    more: 'A fitted scaling law makes this possible. The GPT-4 report predicted its final loss from runs using up to ten thousand times less compute.',
  },
  run_experiments: {
    is: 'trains one model per size and returns the losses',
    more: 'Here the ten results are synthetic, made up for the lecture: noisy points from a million to a billion parameters.',
  },
  L_ND: {
    is: 'Kaplan\'s fitted loss in both N and D',
    more: 'With the data fixed, the loss follows the parameter line, then bends flat once data is the bottleneck. More data moves the bend out to bigger models.',
  },
};
