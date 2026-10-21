import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  learn: {
    is: 'stands for studying one idea of the kit',
    more: 'Not a real function: the loop is the plan of the lecture, one idea at a time, each pinned to a few lines of NumPy.',
  },
  network: {
    is: 'the classifier as one function: image in, scores out',
    more: 'A stand-in for the network the course builds. It maps an image of 3,072 numbers (32 x 32 pixels, 3 colors) to 10 class scores.',
  },
  L: {
    is: 'the loss: every weight in, one number out',
    more: 'It measures how badly the network is doing. Learning means tweaking its input, the weights W, until this one number is small.',
  },
};
