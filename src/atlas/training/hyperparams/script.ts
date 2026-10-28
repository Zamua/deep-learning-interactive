import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-hyperparams',
  title: 'Hyperparameter search',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bergstra & Bengio', year: 2012, title: 'Random search for hyper-parameter optimization', url: 'https://www.jmlr.org/papers/v13/bergstra12a.html', scene: 'random' },
  ],
  scenes: [
    {
      id: 'knobs',
      title: 'Settings you choose',
      codeTitle: 'train.py',
      code: `
        lr = 0.001     # chosen by you   #@lr
        B = 64         # chosen by you   #@B
        for step in range(steps):        #@w
            w -= lr * g  # learned       #@w
      `,
      beats: [
        { id: 'learned', say: 'Training sets the weights on its own: every step moves them against the gradient, downhill on the loss.', code: 'w' },
        { id: 'chosen', say: 'But some settings it never touches: the learning rate, how far each step goes, and the batch size, how many examples each step averages. You pick those before training starts.', code: ['lr', 'B'] },
        { id: 'name', say: 'They are called hyperparameters. Hyper is Greek for over: they sit over the weights, and decide how the weights get learned.', code: ['lr', 'B'] },
        { id: 'cost', say: 'And every try is costly. To learn how good one learning rate is, you train a whole model with it, and measure its validation loss. So where you spend your tries matters.', code: 'w' },
      ],
    },
    {
      id: 'log',
      title: 'Search on a log scale',
      codeTitle: 'search.py',
      code: `
        lo, hi = 1e-5, 1e-1  # 10⁻⁵, 10⁻¹    #@range
        lr = np.random.uniform(lo, hi)  #@uniform
        u = np.random.uniform(-5, -1)   #@log
        lr = 10 ** u                    #@log
        # u = -3:   0.001               #@ex
        # u = -2.5: about 0.0032        #@ex2
      `,
      beats: [
        { id: 'range', say: 'Say a good learning rate could be anywhere from {10⁻⁵|ten to the minus five} up to {10⁻¹|ten to the minus one}, a tenth. Mark the powers of ten evenly, each one ten times the last.', code: 'range' },
        { id: 'decade', say: 'On this axis a rate\'s place is its power of ten, so it is called a log scale. Each stretch from one power of ten to the next is a decade: four decades here.', code: 'range' },
        { id: 'why', say: 'Why so wide? On a bowl, the largest rate that does not blow up is one over a, its steepness. A bowl a hundred times steeper needs a rate a hundred times smaller, and you rarely know the steepness ahead of time.', code: 'range' },
        { id: 'uniform', say: 'The plain way to search is to draw rates uniformly: every value in the range equally likely. Look where the draws land: nine in ten fall in the top decade, above {0.01|zero point zero one}.', code: 'uniform' },
        { id: 'ruler', say: 'On a plain ruler, that top decade covers nine tenths of the length, so it catches nine tenths of the draws. The three lower decades share the last tenth, and the small rates are barely tried.', code: 'uniform' },
        { id: 'log', say: 'So draw the exponent instead. Call it u, draw it uniformly between minus five and minus one, and set the rate to ten to the u.', code: 'log' },
        { id: 'even', say: 'Now each decade covers the same stretch of exponents, one unit long, so it gets the same share of the draws: a quarter each.', code: 'log' },
        { id: 'ends', say: 'For any range, read off its powers of ten. To search from {0.001|zero point zero zero one} up to a tenth, draw the exponent from minus three to minus one.', code: 'log' },
        { id: 'ex', say: 'An exponent of minus three gives ten to the minus three: {0.001|zero point zero zero one}.', code: 'ex' },
        { id: 'ex2', say: 'Minus {2.5|two point five} is minus three, plus a half, and a sum in the power is a product: ten to the half, about {3.16|three point one six}, times {0.001|zero point zero zero one}. About {0.0032|zero point zero zero three two}.', code: 'ex2' },
      ],
    },
    {
      id: 'random',
      title: 'Random beats a grid',
      codeTitle: 'search.py',
      code: `
        for u in [-4, -3, -2]:          #@grid
            for B in [32, 64, 128]:     #@grid
                run(10 ** u, B)  # 9    #@grid
        # random: 9 runs, 9 rates       #@random
      `,
      beats: [
        { id: 'grid', say: 'Now tune two at once: the learning rate, which matters a lot, and the batch size, which here barely matters. The obvious plan is a grid: three rates, times three batch sizes, nine trainings.', code: 'grid' },
        { id: 'waste', say: 'But look along the learning rate. The nine trainings try only three rates, three times each, and since the batch size barely matters, each repeat comes out about the same.', code: 'grid' },
        { id: 'random', say: 'Draw all nine at random instead, and the same nine trainings try nine different rates, so one is far more likely to land near the best.', code: 'random' },
        { id: 'bergstra', say: 'James Bergstra and Yoshua Bengio drew this picture in 2012, in Random Search for Hyper-Parameter Optimization. On most problems, they found, only a few hyperparameters really matter, and which ones changes from problem to problem, so a grid spends most of its tries varying the ones that do not.', code: 'random' },
      ],
    },
    {
      id: 'judge',
      title: 'Judge on validation',
      codeTitle: 'search.py',
      code: `
        for lr in candidates:                 #@train
            m = train(lr, train_split)        #@train
            val[lr] = loss(m, val_split)      #@val
        best = min(val, key=val.get)          #@pick
        # test split: once, at the very end   #@test
      `,
      beats: [
        { id: 'train', say: 'Each try trains on the training split, and is judged on the validation split: examples its weights were never fit to.', code: ['train', 'val'] },
        { id: 'pick', say: 'Keep the one with the lowest validation loss, here run C. Not the lowest training loss, run B: that only rewards memorizing.', code: 'pick' },
        { id: 'test', say: 'And leave the test split alone until the very end. Choose by it, and it becomes one more validation split: its number no longer measures data the choices never saw.', code: 'test' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
