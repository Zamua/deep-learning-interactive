import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  model: {
    is: 'any classifier: an image in, ten scores out',
    more: 'A stand-in for whatever the course builds, from a nearest neighbor to a ConvNet. The image is 3,072 numbers, and np.argmax of the ten scores is the guess.',
  },
  KNearestNeighbor: {
    is: 'labels a photo by its most similar training photos',
    more: 'The first classifier of assignment 1. It memorizes the training set, and the k closest images vote on the label.',
  },
  LinearSVM: {
    is: 'a linear classifier trained with the SVM loss',
    more: 'One matrix multiply scores every class at once, and the multiclass SVM loss wants the correct class to win by a margin. Assignment 1.',
  },
  TwoLayerNet: {
    is: 'a two-layer neural network classifier',
    more: 'TwoLayerNet(3072, 50, 10): 3,072 pixel values in (32 x 32 x 3), 50 hidden units, 10 class scores out. Trained with backpropagation in assignment 1.',
  },
  '.loss': {
    is: 'the loss on a batch, plus every gradient',
    more: 'net.loss(X, y) scores the images X against their labels y, and returns one loss number and a dict of gradients, one per weight array, ready for an update step.',
  },
  affine_forward: {
    is: 'a fully connected layer\'s forward pass',
    more: 'Computes x times w plus b, and returns a cache of its inputs for the backward pass. Affine means linear plus a shift: the multiply is linear, and adding b shifts it.',
  },
  affine_backward: {
    is: 'a fully connected layer\'s backward pass',
    more: 'Takes the upstream gradient dout and the cache from affine_forward, and returns dx, dw and db, one gradient per input. Assignment 2 builds whole networks from such pairs.',
  },
  ThreeLayerConvNet: {
    is: 'a small convolutional network classifier',
    more: 'Assignment 2 stacks its layers: a convolution, a ReLU and max pooling, then two fully connected layers that give the class scores.',
  },
  CaptioningRNN: {
    is: 'a recurrent network that captions images',
    more: 'Assignment 3. It reads image features and produces a caption one word at a time; word_to_idx maps each vocabulary word to an integer.',
  },
};
