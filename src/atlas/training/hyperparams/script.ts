import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-hyperparams',
  title: 'Hyperparameter search',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'log',
      title: 'Search on a log scale',
      codeTitle: 'search.py',
      code: `
        lr = np.random.uniform(1e-5, 1e-1)   # bad   #@uniform
        u = np.random.uniform(-5, -1)                #@log
        lr = 10 ** u                                 #@log
        # u = -3: 0.001,  u = -2.5: about 0.0032     #@ex
      `,
      beats: [
        { id: 'range', say: 'A good learning rate could be anywhere from {10⁻⁵|ten to the minus five} to {10⁻¹|ten to the minus one}: a range of four factors of ten.' },
        { id: 'uniform', say: 'Draw uniformly across that range, and nine draws in ten land between {0.01|zero point zero one} and {0.1|zero point one}. The small rates are barely tried.', code: 'uniform' },
        { id: 'log', say: 'Instead, draw the exponent: u uniform between minus five and minus one, and set the rate to ten to the u.', code: 'log' },
        { id: 'even', say: 'Now every decade, every factor of ten, gets the same share of the draws: a quarter each.', code: 'log' },
        { id: 'ex', say: 'A u of minus three gives {0.001|zero point zero zero one}. Minus {2.5|two point five} gives ten to the {0.5|zero point five}, about {3.16|three point one six}, times {0.001|zero point zero zero one}: about {0.0032|zero point zero zero three two}.', code: 'ex' },
      ],
    },
    {
      id: 'random',
      title: 'Random beats a grid',
      codeTitle: 'search.py',
      code: `
        for lr in [1e-4, 1e-3, 1e-2]:          #@grid
            for B in [32, 64, 128]:            #@grid
                run(lr, B)    # 9 runs         #@grid
        # random: 9 runs, 9 learning rates     #@random
      `,
      beats: [
        { id: 'grid', say: 'Say the learning rate matters a lot, and a second hyperparameter, like the batch size, barely matters. A three by three grid runs nine trainings.', code: 'grid' },
        { id: 'waste', say: 'But it tries only three learning rates, each three times over.', code: 'grid' },
        { id: 'random', say: 'Nine random trials try nine different learning rates. When one hyperparameter matters most, random search explores it far better.', code: 'random' },
      ],
    },
    {
      id: 'judge',
      title: 'Judge on validation',
      codeTitle: 'search.py',
      code: `
        for lr in candidates:                     #@train
            model = train(lr, train_split)        #@train
            scores[lr] = loss(model, val_split)   #@val
        best = min(scores, key=scores.get)        #@pick
        # test split: once, at the very end       #@test
      `,
      beats: [
        { id: 'train', say: 'Each trial is trained on the training split, and judged on the validation split.', code: ['train', 'val'] },
        { id: 'pick', say: 'Keep the one with the lowest validation loss. Not the lowest training loss: that only rewards memorizing.', code: 'pick' },
        { id: 'test', say: 'And leave the test split alone until the very end, so its one number stays honest.', code: 'test' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
