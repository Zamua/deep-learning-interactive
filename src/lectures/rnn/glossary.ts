import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  net: { is: 'a feedforward network with a fixed shape', more: 'One image in, one set of class scores out: the shape of every network before this chapter.' },
  step: {
    is: 'folds one input into the hidden state',
    more: 'The recurrence, with the same weights at every step, so a sequence of any length can be read. Its input can be an image, a word, a video frame or a glimpse.',
  },
  out: {
    is: 'reads output scores off the hidden state',
    more: 'Called once at the end for many to one, or at every step for one to many and many to many. In the vanilla RNN it is np.dot(Why, h) + by.',
  },
  look: {
    is: 'a small glimpse of the image, chosen by the memory',
    more: 'Where to look depends on h, so a fixed-size image is read in pieces, as in the model that reads house numbers.',
  },
  f: {
    is: 'turns the old memory and new input into new memory',
    more: 'A small layer with learned weights W, the same at every step. Unrolled, its copies form a deep network, and the shared W adds up a gradient from each copy.',
  },
  lossFun: {
    is: 'forward and backward over one chunk of text',
    more: 'From min-char-rnn: it runs 25 characters forward, sums the loss, backpropagates through time, and returns the loss, the gradients, and the last hidden state, which seeds the next chunk.',
  },
  sample: {
    is: 'draws text from the model at random',
    more: 'In min-char-rnn, sample(h, ix, n) writes n characters, each drawn from the softmax and fed back in. In the captioning loop, sample takes the probabilities and draws one word.',
  },
  cnn: {
    is: 'an ImageNet ConvNet with its last layer cut off',
    more: 'It returns the 4,096 numbers before the class scores: the image vector v that conditions the captioning RNN.',
  },
};
