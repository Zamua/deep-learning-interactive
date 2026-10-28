import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-batch-norm',
  title: 'Batch normalization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ioffe & Szegedy', year: 2015, title: 'Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift', url: 'https://arxiv.org/abs/1502.03167', scene: 'flat' },
  ],
  scenes: [
    {
      id: 'flat',
      title: 'Far out on the flat',
      codeTitle: 'unit.py',
      code: `
        z = w @ x + b   # pre-activation  #@z
        a = sigmoid(z)  # the bend        #@a
        # one unit's z over a batch:      #@batch
        # [9, 3, 17, 11]                  #@batch
        # sigmoid there: slope near 0     #@flat
        # fix: center z, then rescale it  #@fix
      `,
      beats: [
        { id: 'unit', say: 'Every unit in a network adds up its weighted inputs into z, then bends z with an activation. Take the sigmoid: the S between zero and one.', code: ['z', 'a'] },
        { id: 'batch', say: 'Nothing keeps z near zero. Here is one unit\'s z for a batch of four examples: nine, three, seventeen and eleven. All four sit far out, on the flat top of the S.', code: 'batch' },
        { id: 'flat', say: 'There the slope is nearly zero, so almost no gradient gets back through. The unit is saturated, and the weights feeding it barely move.', code: 'flat' },
        { id: 'paper', say: 'In 2015, Sergey Ioffe and Christian Szegedy proposed a fix, batch normalization. Their deep image network built on sigmoids never did better than chance without it, and reached about seventy percent accuracy with it.', code: 'fix' },
        { id: 'name', say: 'To normalize is to rescale to a standard form. Here the standard is mean zero and spread one: slide the values to center on zero, then squeeze them.', code: 'fix' },
      ],
    },
    {
      id: 'normalize',
      title: 'Slide, then squeeze',
      codeTitle: 'batchnorm.py',
      code: `
        X = np.array([[9, 4], [3, 6],     #@batch
                      [17, 2], [11, 8]])  #@batch
        x = X[:, 0]    # [9, 3, 17, 11]   #@x
        mu = x.mean()  # 10               #@mu
        var = x.var()  # 25               #@var
        sigma = np.sqrt(var)  # 5         #@sigma
        xhat = (x - mu) / sigma           #@xhat
        # [-0.2, -1.4, 1.4, 0.2]          #@xhat
        xhat = (x - mu) / np.sqrt(var + eps)  #@eps
      `,
      beats: [
        { id: 'batch', say: 'Batch norm works on a batch, X: one example per row, one feature per column. A feature here is any number a layer reads, such as our unit\'s z.', code: 'batch' },
        { id: 'column', say: 'It handles each feature on its own, down its column, never across a row. Column zero holds our unit\'s values: nine, three, seventeen and eleven. Call them x.', code: 'x' },
        { id: 'mean', say: 'First the batch mean, written with the Greek letter {μ|mu}. Together the values make forty, so {μ|mu} is ten. Subtract it from each value, and what is left is that value\'s distance from the mean.', code: 'mu' },
        { id: 'var', say: 'Next, the spread. Square each distance from the mean, and average: one, forty nine, forty nine and one have an average of twenty five. That average is the variance.', code: 'var' },
        { id: 'sigma', say: 'Its square root, five, is the standard deviation: a typical distance from the mean. It is written {σ|sigma}, which here means this spread, not the sigmoid.', code: 'sigma' },
        { id: 'xhat', say: 'Divide those distances by {σ|sigma}, and each value is counted in standard deviations from the mean: nine becomes minus {0.2|zero point two}, a fifth of a standard deviation below the mean. That is {x̂|x hat}, the normalized x, with mean zero and spread one.', code: 'xhat' },
        { id: 'eps', say: 'In code, a tiny {ε|epsilon} is added to the variance, so it never divides by zero. By hand, ignore it.', code: 'eps' },
      ],
    },
    {
      id: 'affine',
      title: 'Then scale and shift',
      codeTitle: 'batchnorm.py',
      code: `
        # learned, one pair per feature  #@gamma
        y = gamma * xhat + beta          #@y
        # gamma 2, beta 1: -0.2 -> 0.6   #@num
        # gamma = sigma, beta = mu:      #@undo
        # y is x again                   #@undo
      `,
      beats: [
        { id: 'middle', say: 'Now the values sit where the S is steep. But that stretch is almost a straight line, and layers that never bend collapse into one, as two layers without a ReLU do.' },
        { id: 'gamma', say: 'So batch norm adds two numbers per feature, learned by gradient steps like any weight. First a scale, {γ|gamma}, which stretches {x̂|x hat}.', code: 'gamma' },
        { id: 'beta', say: 'Then a shift, {β|beta}, which slides it: {y = γx̂ + β|y equals gamma x hat, plus beta}.', code: 'y' },
        { id: 'num', say: 'With {γ|gamma} two and {β|beta} one, minus {0.2|zero point two} becomes two times minus {0.2|zero point two}, plus one: {0.6|zero point six}.', code: 'num' },
        { id: 'undo', say: 'Set {γ|gamma} to the standard deviation and {β|beta} to the mean, and the normalization is undone: nine, three, seventeen and eleven again. The paper built it that way, so the network gets to choose.', code: 'undo' },
      ],
    },
    {
      id: 'test',
      title: 'At test time',
      codeTitle: 'batchnorm.py',
      code: `
        # test: one example, x = 13    #@one
        # its own mean is 13: x̂ = 0     #@one
        run_mu = 0.9 * run_mu + 0.1 * mu     #@run
        run_var = 0.9 * run_var + 0.1 * var  #@run
        sd = np.sqrt(run_var + eps)  # 5     #@test
        xhat = (x - run_mu) / sd  # 0.6      #@test
      `,
      beats: [
        { id: 'test', say: 'Once training is done, the network is put to work on new examples, often one at a time. That is called test time.', code: 'one' },
        { id: 'one', say: 'A batch of one breaks the arithmetic: its mean is the example itself, so x minus {μ|mu} is zero, and every feature comes out zero. In a bigger batch, an answer would depend on which others came along.', code: 'one' },
        { id: 'run', say: 'So during training, batch norm also keeps a running average of the batch means. It starts at zero, and each batch moves it a tenth of the way toward that batch\'s own mean.', code: 'run' },
        { id: 'settle', say: 'The batch means scatter, but the running average settles near the true mean, here ten. The variance gets a running average the same way.', code: 'run' },
        { id: 'apply', say: 'At test time, every example is normalized with those running averages. With a running mean of ten and a running variance of twenty five, thirteen becomes thirteen minus ten, over five: {0.6|zero point six}. Then {γ|gamma} and {β|beta}, as before.', code: 'test' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
