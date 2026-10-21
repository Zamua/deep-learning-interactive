import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  NearestNeighbor: {
    is: 'a classifier class that keeps its training data',
    more: 'Here it shows how Python classes work: NearestNeighbor() makes an object with no new keyword, and its train method stores the data on self.',
  },
  '.train': {
    is: 'stores the training images and labels',
    more: 'For a nearest neighbor classifier, training is memorizing: self.X_train = X keeps the data for predictions later.',
  },
  relu: {
    is: 'a ReLU with an optional leak, for one number',
    more: 'Defined in this scene: v if v is positive, otherwise leak * v. The default leak=0.0 gives a plain ReLU; a small leak like 0.1 gives a leaky ReLU.',
    eg: 'relu(-2.0, leak=0.1)   # -0.2',
  },
};
