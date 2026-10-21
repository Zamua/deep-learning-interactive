import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  TwoLayerNet: {
    is: 'the two-layer network from chapters 7 and 8',
    more: 'TwoLayerNet(D, H, C): D inputs, H hidden units, C class scores. This chapter is about training it well.',
  },
  grad_check: {
    is: 'compares backprop\'s gradient with a numerical one',
    more: 'Run before training, in double precision on a few examples. A relative error below about 1e-7 is a pass; above 1e-2, the gradient is probably wrong.',
  },
  sanity_check: {
    is: 'quick checks on the untrained network',
    more: 'The three of this chapter: the starting loss is near chance (2.302 for a 10-class softmax), more regularization raises the loss, and 20 examples can be memorized.',
  },
  '.loss': {
    is: 'the loss on a batch, plus its gradients',
    more: 'Returns the data loss plus regularization, and a dict of gradients, one per parameter array. Its reg argument overrides the regularization strength for the checks.',
  },
  log: {
    is: 'records numbers for the training plots',
    more: 'A stand-in for whatever logging a run uses. The loss and the training and validation accuracy, logged every epoch, become the curves this chapter reads.',
  },
  random_search: {
    is: 'tries random hyperparameter settings, keeps the best',
    more: 'Each trial samples the knobs (learning rate and regularization on a log scale), trains, and scores on validation data. Random beats a grid because only a few knobs really matter.',
  },
  f: {
    is: 'the function whose gradient is checked',
    more: 'Usually the loss as a function of one parameter array x. num_grad evaluates it twice per entry: nudged up by h, and nudged down.',
  },
  num_grad: {
    is: 'the gradient by nudging each entry up and down',
    more: 'The centered difference (f(x + h) - f(x - h)) / 2h for every entry, restoring each one after. Its error shrinks like h squared, at two evaluations of f per parameter.',
  },
  analytic_grad: {
    is: 'the gradient from backprop, the one being checked',
    more: 'Fast and exact if the code is right. Compared with num_grad by relative error: the difference over the larger of the two magnitudes, worst entry reported.',
  },
  full_loss: {
    is: 'the loss over the whole training set',
    more: 'Logged once per epoch against the epoch number, so the axis means the same whatever the batch size.',
  },
  '.predict': {
    is: 'the predicted class for each example',
    more: 'The index of each row\'s highest score. Compared with y, the mean of the matches is the accuracy.',
  },
  acc: {
    is: 'the fraction of examples predicted correctly',
    more: 'Computed on both the training and the validation set. A big gap between them means overfitting; both low and close means too little capacity.',
  },
  show_images: {
    is: 'draws first-layer weights as small pictures',
    more: 'Each column of W1, reshaped to 32 x 32 x 3. Smooth, varied filters are a good sign; noisy speckles are a warning.',
  },
  grad: {
    is: 'the exact gradient of the toy loss',
    more: 'Noise added to it imitates a mini-batch gradient, which keeps a constant learning rate bouncing at a noise floor.',
  },
  schedule: {
    is: 'the learning rate at step t',
    more: 'One of the four schedules above: constant, step decay (halve every 150 steps), exponential decay, or 1/t decay.',
  },
  hessian: {
    is: 'the matrix of all second derivatives',
    more: 'D by D for D parameters: how fast each slope changes. Newton\'s method uses it to jump to the bottom of a fitted bowl. Named after the mathematician Otto Hesse.',
  },
  uniform: {
    is: 'a random number drawn evenly from a range',
    more: 'Imported from numpy.random. 10 ** uniform(-6, 1) samples the exponent evenly, so each power of ten from 1e-6 to 10 is equally likely: a log-scale search.',
    eg: '10 ** uniform(-6, 1)   # between 1e-6 and 10',
  },
  train: {
    is: 'trains one model with the given settings',
    more: 'One trial of the search. Coarse rounds train for few epochs (1 here) to rule out bad regions fast; finer rounds train longer.',
  },
  evaluate: { is: 'scores a trained model on validation data', more: 'The number each trial is ranked by. The test set stays untouched until the very end.' },
  checkpoint: {
    is: 'saves the model and its score to disk',
    more: 'An automated search runs many trials, so every result is kept, and the best models can be reloaded or ensembled later.',
  },
  '.probs': {
    is: 'class probabilities for every example',
    more: 'Shape (N, C) for each model. The ensemble averages them over models, then takes the argmax of each row.',
  },
};
