import type { Page } from '../core/page';
import type { SymbolMap } from '../core/symbols';

export interface ChapterDef {
  symbols: SymbolMap;
  render(p: Page): void;
}

export interface ChapterMeta {
  id: string;
  /** Shown as the big numeral; assignments use "A1" etc. */
  num: string;
  title: string;
  part: string;
  blurb: string;
  /** Which 2016 lectures this covers, e.g. "Lectures 2-3". */
  lectures?: string;
  /** The original course notes this chapter follows. */
  notes?: { title: string; url: string }[];
  /** The third layer after the lecture and the chapter: an assignment to link (`id`) or a note. */
  practice?: { id?: string; text: string };
}

export const PARTS = ['Start here', 'Neural networks', 'Convolutional networks', 'Beyond still images', 'Assignments'] as const;

const N = 'https://cs231n.github.io';

export const CHAPTERS: ChapterMeta[] = [
  { id: 'welcome', num: '0', part: 'Start here', title: 'How this course works', blurb: 'What CS231n is, how the figures and color-coded symbols work, and a map of everything ahead.' },
  { id: 'math-kit', num: '1', part: 'Start here', title: 'Math survival kit', blurb: 'Vectors, matrices, sums, slopes, gradients and the chain rule, rebuilt from scratch with code next to every idea.', practice: { text: 'No assignment for this one: these are the tools every assignment uses.' } },
  { id: 'numpy', num: '2', part: 'Start here', title: 'Python and NumPy', blurb: 'Arrays, shapes, indexing, broadcasting and vectorization: the language every assignment is written in.', notes: [{ title: 'Python / NumPy tutorial', url: `${N}/python-numpy-tutorial/` }] },

  { id: 'image-classification', num: '3', part: 'Neural networks', title: 'Image classification and nearest neighbors', blurb: 'Images as grids of numbers, the data-driven approach, kNN, distances, and honest evaluation with validation sets.', lectures: 'Lecture 2', notes: [{ title: 'Image classification', url: `${N}/classification/` }] },
  { id: 'linear-classification', num: '4', part: 'Neural networks', title: 'Linear classifiers: SVM and Softmax', blurb: 'One matrix multiply that scores every class, two ways to grade those scores, and the templates it learns from CIFAR-10.', lectures: 'Lectures 2-3', notes: [{ title: 'Linear classification', url: `${N}/linear-classify/` }] },
  { id: 'optimization', num: '5', part: 'Neural networks', title: 'Optimization and gradient descent', blurb: 'Loss landscapes, numerical vs analytic gradients, and walking downhill one mini-batch at a time.', lectures: 'Lecture 3', notes: [{ title: 'Optimization', url: `${N}/optimization-1/` }] },
  { id: 'backprop', num: '6', part: 'Neural networks', title: 'Backpropagation', blurb: 'Computational graphs and the chain rule: how every gradient in deep learning actually gets computed.', lectures: 'Lecture 4', notes: [{ title: 'Backpropagation, intuitions', url: `${N}/optimization-2/` }] },
  { id: 'nn-architecture', num: '7', part: 'Neural networks', title: 'Neural networks: the architecture', blurb: 'Neurons, activation functions, layers, and why stacking simple pieces can bend a decision boundary into any shape.', lectures: 'Lectures 4-5', notes: [{ title: 'Neural Networks Part 1', url: `${N}/neural-networks-1/` }] },
  { id: 'nn-data-loss', num: '8', part: 'Neural networks', title: 'Data, initialization and regularization', blurb: 'Preprocessing, weight initialization, batch normalization, dropout and the losses that tie it together.', lectures: 'Lectures 5-6', notes: [{ title: 'Neural Networks Part 2', url: `${N}/neural-networks-2/` }] },
  { id: 'nn-learning', num: '9', part: 'Neural networks', title: 'Training: updates, monitoring, tuning', blurb: 'Gradient checks, reading loss curves, momentum, Adam and friends, learning-rate schedules and hyperparameter search.', lectures: 'Lectures 5-6', notes: [{ title: 'Neural Networks Part 3', url: `${N}/neural-networks-3/` }] },
  { id: 'case-study', num: '10', part: 'Neural networks', title: 'Putting it together: the spiral', blurb: 'A complete softmax classifier and a two-layer network trained from scratch, line by line, live.', notes: [{ title: 'Minimal neural network case study', url: `${N}/neural-networks-case-study/` }] },

  { id: 'convnets', num: '11', part: 'Convolutional networks', title: 'Convolutional networks', blurb: 'Filters that slide, pooling that shrinks, the arithmetic of output sizes, and the architectures that won ImageNet.', lectures: 'Lectures 6-7', notes: [{ title: 'Convolutional networks', url: `${N}/convolutional-networks/` }] },
  { id: 'visualizing', num: '12', part: 'Convolutional networks', title: 'Understanding and visualizing ConvNets', blurb: 'Looking inside a trained network: filters, activations, saliency, occlusion, adversarial examples, DeepDream and style.', lectures: 'Lecture 9', notes: [{ title: 'Understanding and visualizing', url: `${N}/understanding-cnn/` }] },
  { id: 'convnets-practice', num: '13', part: 'Convolutional networks', title: 'ConvNets in practice', blurb: 'Data augmentation, transfer learning, fast convolution, hardware and the deep learning software stack.', lectures: 'Lectures 11-12', notes: [{ title: 'Transfer learning', url: `${N}/transfer-learning/` }] },
  { id: 'detection', num: '14', part: 'Convolutional networks', title: 'Localization, detection and segmentation', blurb: 'From one label per image to boxes and pixel masks: IoU, non-max suppression, R-CNN, YOLO and upsampling.', lectures: 'Lectures 8 and 13' },

  { id: 'rnn', num: '15', part: 'Beyond still images', title: 'Recurrent networks and image captioning', blurb: 'Networks with memory: vanilla RNNs, character models, vanishing gradients, LSTMs, and describing images in words.', lectures: 'Lecture 10', notes: [{ title: 'Recurrent neural networks', url: `${N}/rnn/` }] },
  { id: 'attention', num: '16', part: 'Beyond still images', title: 'Attention and spatial transformers', blurb: 'Letting a network choose where to look: soft attention over image regions and differentiable cropping.', lectures: 'Lecture 13' },
  { id: 'unsupervised', num: '17', part: 'Beyond still images', title: 'Video and unsupervised learning', blurb: 'ConvNets over time, then learning without labels: autoencoders, variational autoencoders and GANs.', lectures: 'Lecture 14' },

  { id: 'a1', num: 'A1', part: 'Assignments', title: 'Assignment 1: the image classification pipeline', blurb: 'kNN, SVM, Softmax, a two-layer network and image features, all on CIFAR-10 in vectorized NumPy.' },
  { id: 'a2', num: 'A2', part: 'Assignments', title: 'Assignment 2: deep networks and ConvNets', blurb: 'Modular layers, update rules, batch normalization, dropout and a ConvNet trained on CIFAR-10.' },
  { id: 'a3', num: 'A3', part: 'Assignments', title: 'Assignment 3: RNNs and image gradients', blurb: 'Captioning with RNNs and LSTMs, saliency maps, fooling images, class visualization, inversion and DeepDream.' },
];

const modules = import.meta.glob<{ default: ChapterDef }>(['./*.ts', '!./index.ts']);

/** Loads a chapter's module, or null if it has not been written yet. */
export function loadChapter(id: string): Promise<ChapterDef> | null {
  const loader = modules[`./${id}.ts`];
  return loader ? loader().then((m) => m.default) : null;
}

export function hasChapter(id: string): boolean {
  return `./${id}.ts` in modules;
}
