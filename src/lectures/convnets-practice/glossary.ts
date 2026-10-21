import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  few_labeled_images: {
    is: 'loads a small labeled dataset',
    more: 'A stand-in for the usual situation: far fewer labeled images than the network has parameters. Augmentation and transfer learning both answer it.',
  },
  augment: {
    is: 'randomly changes an image but not its label',
    more: 'Here: a horizontal flip half the time, a resize so the shorter side is L, between 256 and 480, and a random 224 × 224 crop. Every epoch the network sees a new version of each image.',
  },
  pretrained: {
    is: 'a network already trained on ImageNet',
    more: 'Starting from its weights instead of random ones is transfer learning: its early layers already detect the edges and colors almost any visual task needs.',
  },
  conv: {
    is: 'a conv layer: slides the filters W over X',
    more: 'Chapter 11 defined it. This lecture is about which convolutions to stack and how to compute them fast: im2col, the FFT and Winograd.',
  },
  train: {
    is: 'runs the training loop',
    more: 'Its arguments mark what each scene is about: the data and learning rate when fine-tuning, the GPU, framework or number format when discussing hardware.',
  },
  '.loss': { is: 'the network\'s loss on one image and label', more: 'Computed on the augmented image, which is why an augmentation must keep the label.' },
  resize_short: {
    is: 'rescales an image so its shorter side is L',
    more: 'The aspect ratio is kept. With L drawn between 256 and 480, the object appears at a new scale before the 224 × 224 crop.',
  },
  ten_crops: {
    is: 'four corners and the center, plus their mirrors',
    more: 'Ten fixed 224 × 224 views for test time. Averaging the predictions over them replaces the random crops of training.',
  },
  net: {
    is: 'runs the network on a batch of images',
    more: 'It returns one row of class probabilities per image; np.mean(..., axis=0) then averages the rows of the ten crops into one answer.',
  },
  rotate: {
    is: 'rotates an image by an angle in degrees',
    more: 'Here a random angle up to 10 degrees either way. Large turns can change the label: a 6 rotated 180 degrees is a 9.',
  },
  shear: {
    is: 'slants an image sideways',
    more: 'Each row shifts in proportion to its height, like pushing the top of a deck of cards. Here the factor is up to 0.2 either way.',
  },
  batchnorm: {
    is: 'normalizes activations with batch statistics',
    more: 'In training it uses the noisy mean and variance of the current mini-batch; at test time, fixed averages. Noise in training, averaged out at test.',
  },
  init: {
    is: 'a fresh network, its random weights set by a seed',
    more: 'Five seeds give five starting points, so the trained networks make different mistakes, and averaging them, an ensemble, smooths those out.',
  },
  load_pretrained: {
    is: 'loads a network with its ImageNet weights',
    more: 'Training on ImageNet took weeks, so people share trained weights, as in Caffe\'s Model Zoo. Here it is AlexNet, whose last layer, fc8, holds the 1000 class scores.',
  },
  '.forward': {
    is: 'runs images through the network',
    more: 'With fc8 deleted, the output is fc7: 4,096 numbers per image after a ReLU, the CNN codes, shaped (N, 4096).',
  },
  train_softmax: {
    is: 'trains a linear softmax classifier',
    more: 'It fits on the fixed CNN codes and leaves the ConvNet untouched. One paper called this recipe an astounding baseline.',
  },
  Linear: {
    is: 'a fully connected layer, 4096 inputs to n_classes',
    more: 'A fresh head with random weights replaces ImageNet\'s 1000-class fc8. During fine-tuning it gets the full learning rate.',
  },
  looks_like_imagenet: {
    is: 'whether the images resemble ImageNet photos',
    more: 'A stand-in for a judgment call. With the dataset size, it picks the strategy: X-rays, say, look nothing like ImageNet.',
  },
  '.features': {
    is: 'the activations up to a chosen layer',
    more: 'For images like ImageNet\'s, the top layer fc7 works; for very different ones, an earlier and more generic layer such as conv4 transfers better.',
  },
  fine_tune_top: {
    is: 'fine-tunes only the top k layers',
    more: 'The layers below stay frozen. Similar data needs only the top 2 retrained; very different data, a larger part of the network (6 here).',
  },
  divmod: {
    is: 'the quotient and remainder of a division',
    more: 'Here it turns the patch number m, 0 to 8, into its row i and column j on the 3 × 3 grid of window positions.',
    eg: 'divmod(7, 3)   # (2, 1)',
  },
  f: {
    is: 'a function of the data, applied in one call',
    more: 'In the hardware scene, a simple operation: a CPU applies it to one x[i] after another, a GPU to all of x at once. In the software scene, the compiled Theano function: real arrays in, the loss and gradients out.',
  },
  Thread: {
    is: 'runs a function in a separate thread',
    more: 'Here it prepares the next batch on the CPU while the GPU trains on the current one, so the slow copy does not stall training.',
  },
  to_gpu: { is: 'copies an array into GPU memory', more: 'Slow next to GPU compute, which is why the next batch is prepared in a separate thread.' },
  grad: {
    is: 'the gradient of the loss on one shard',
    more: 'In data parallelism every GPU holds the whole model and computes this on its own slice of the batch; synchronous training then averages the G results.',
  },
  '.matrix': {
    is: 'a symbolic matrix variable, with no data yet',
    more: 'Theano builds the graph from such named placeholders; real arrays arrive only when the compiled function runs.',
  },
  '.ivector': {
    is: 'a symbolic vector of integers',
    more: 'It holds the labels y. The i stands for integer: Theano puts a type letter before the shape, as in fvector or imatrix.',
  },
  '.softmax': {
    is: 'a softmax node in the graph',
    more: 'Theano\'s T.nnet.softmax turns each row of scores into probabilities, but only once the compiled function runs on real data.',
  },
  ce: {
    is: 'the cross-entropy of probabilities against labels',
    more: 'A short name for T.nnet.categorical_crossentropy: minus the log of each example\'s correct-class probability, which .mean() averages into the loss.',
  },
  '.grad': {
    is: 'symbolic gradients of the loss',
    more: 'T.grad runs backprop on the graph itself and returns new graph nodes, dw1 and dw2. Nothing is computed until the function is compiled and called.',
  },
  '.function': {
    is: 'compiles the graph into a callable function',
    more: 'theano.function takes the symbolic inputs and the outputs to compute, and generates fast code for the CPU or GPU. Calling it on real arrays runs the graph.',
  },
  fine_tune: {
    is: 'keeps training pretrained weights on new data',
    more: 'Here with a tenth of the base learning rate, since the weights are already good and large steps would undo them.',
  },
};
