import type { SymbolMap } from '../core/symbols';

/** Shared by the image-classification chapter and its lecture, so a symbol keeps its color across both. */
export const IMAGE_CLASSIFICATION_SYMBOLS: SymbolMap = {
  Ia: {
    color: 'orange',
    name: 'I₁: the image we want to label (a test image)',
    tex: 'I_1',
    code: ['I1'],
    about: 'Cast to int32 before subtracting, because uint8 pixels wrap around below zero (10 - 20 gives 246). Its distance to every training image decides its label.',
  },
  Ib: {
    color: 'blue',
    name: 'I₂: a training image we compare it against',
    tex: 'I_2',
    code: ['I2'],
    about: 'One of the memorized training images. If it is the nearest to I₁, its label becomes the prediction.',
  },
  X: {
    color: 'teal',
    name: 'X: a stack of examples, one per row (an image flattened to 3,072 numbers, or a 2-D point)',
    code: ['X', 'Xtr', 'X_train', 'X_test', 'Xval', 'X_folds', 'X_tr', 'X_val'],
    about: 'CIFAR-10 arrives as (N, 32, 32, 3); flattened, each row is 3,072 numbers, so the 1,000-image sample Xtr is (1000, 3072). Nearest neighbor training just stores it, and prediction compares each test image with every row.',
  },
  y: {
    color: 'gold',
    name: 'y: labels, a class index from 0 to 9 for each example',
    code: ['y', 'ytr', 'y_train', 'y_test', 'yval', 'y_pred', 'y_hat', 'y_folds', 'y_tr', 'y_val'],
    about: 'Shape (N,). y_pred holds predicted labels, and np.mean(y_pred == y) is the accuracy. With 10 balanced classes, guessing scores 10%.',
  },
  d: {
    color: 'red',
    name: 'd: a distance between two examples; 0 means identical',
    code: ['d', 'd1', 'd2', 'dists'],
    about: 'L1 sums the absolute gaps; L2 squares them, sums, and takes the square root, so it punishes one big gap more than many small ones. In high dimensions distances bunch together, until the nearest point is barely nearer than the farthest.',
  },
  k: {
    color: 'slate',
    name: 'k: how many neighbors get a vote (a hyperparameter)',
    code: ['k', 'best_k'],
    about: 'k = 1 is plain nearest neighbor; a larger k outvotes outliers and smooths the boundaries, but too large lets big classes outvote small ones. Cross-validation picked 5 here (about 7 on full CIFAR-10). It is a hyperparameter, hyper as in above: a setting of the learning algorithm, chosen by you, not learned from the data.',
  },
};
