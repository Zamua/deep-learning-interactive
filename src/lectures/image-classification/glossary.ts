import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  load_photo: {
    is: 'loads one photo as an array of pixel values',
    more: 'A stand-in, not a library call. What comes back is a 32 x 32 x 3 block of numbers: all a computer receives.',
  },
  classify: {
    is: 'turns an image into a label',
    more: 'The goal of the lecture. Its comments give the plan: find the most similar image seen before, and copy its label. That is the nearest neighbor classifier.',
  },
  find_edges: {
    is: 'a hand-written rule: find the edges in an image',
    more: 'Early computer vision tried rules like this: find edges, group them into shapes, then match the shapes against a description of a cat. It was brittle.',
  },
  group: { is: 'a hand-written rule: group edges into shapes' },
  looks_like_cat: {
    is: 'a hand-written rule: do these shapes make a cat',
    more: 'Nobody knows how to write this rule down, which is the point of the scene. Every new category meant starting over.',
  },
  knn_predict: {
    is: 'labels a point by its k nearest neighbors',
    more: 'Measures the L2 distance to every training point, counts the labels of the k closest with np.bincount, and returns the winner. A tie returns -1, drawn as a blank patch.',
  },
  KNearestNeighbor: {
    is: 'the assignment\'s k-nearest neighbor classifier',
    more: 'Same train and predict interface as NearestNeighbor, but predict takes k, and the k closest training images vote on each label.',
  },
  '.train': {
    is: 'memorizes the training images and labels',
    more: 'Nearest neighbor training does no computation: it stores X and y. That is why it is instant, and why all the cost moves to prediction.',
  },
  '.predict': {
    is: 'labels new images by their nearest training images',
    more: 'Compares each image with every stored training image, so its cost grows with the training set. With k, the k nearest vote; it returns one class index per image.',
  },
  knn: {
    is: 'trains k-NN and labels the validation fold',
    more: 'Shorthand in this scene: train on X_tr and y_tr, then label X_val by a vote of the k nearest neighbors under the L1 distance.',
  },
};
