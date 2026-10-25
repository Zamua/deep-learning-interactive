import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-batch-norm',
  title: 'Batch normalization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'normalize',
      title: 'Normalize over the batch',
      codeTitle: 'batchnorm.py',
      code: `
        x = np.array([9, 3, 17, 11])   # one feature, 4 examples  #@x
        mu = x.mean()                  # 10                       #@mu
        var = x.var()                  # 25                       #@var
        xhat = (x - mu) / np.sqrt(var + eps)                      #@xhat
        # [-0.2, -1.4, 1.4, 0.2]                                  #@xhat
      `,
      beats: [
        { id: 'batch', say: 'Batch normalization looks at one feature at a time, across every example in the batch. Here is one feature over a batch of four: nine, three, seventeen and eleven.', code: 'x' },
        { id: 'mean', say: 'First, the batch mean, written with the Greek letter {μ|mu}. They add up to forty, so {μ|mu} is ten.', code: 'mu' },
        { id: 'var', say: 'Then the variance: the average squared distance from the mean. One, forty nine, forty nine and one average to twenty five. Its square root, {√25|the square root of twenty five}, is five: the standard deviation. Here {σ|sigma} means this spread, not the sigmoid, so the variance is {σ²|sigma squared}.', code: 'var' },
        { id: 'xhat', say: 'Subtract the mean, and divide by the standard deviation. The result is {x̂|x hat}, the normalized x: {x̂ = (x − μ) / σ|x hat is x minus mu, over sigma}. Nine becomes minus {0.2|zero point two}, and three becomes minus {1.4|one point four}.', code: 'xhat' },
        { id: 'eps', say: 'The formula adds a tiny {ε|epsilon} to the variance, so it never divides by zero. For arithmetic by hand, it can be ignored.', code: 'xhat' },
        { id: 'unit', say: 'Now the feature has mean zero and variance one, whatever scale it arrived at.' },
      ],
    },
    {
      id: 'affine',
      title: 'Then scale and shift',
      codeTitle: 'batchnorm.py',
      code: `
        y = gamma * xhat + beta   # learned, per feature   #@y
        # gamma = 2, beta = 1:                            #@y
        # [0.6, -1.8, 3.8, 1.4]                           #@y
        # gamma = 5, beta = 10: back to x                 #@undo
      `,
      beats: [
        { id: 'gamma', say: 'Forcing mean zero and variance one every time could be too rigid. So batch norm adds two learned numbers per feature: a scale, {γ|gamma}, and a shift, {β|beta}. The output is {y = γx̂ + β|y equals gamma x hat, plus beta}.', code: 'y' },
        { id: 'y', say: 'With {γ|gamma} two and {β|beta} one, minus {0.2|zero point two} becomes two times minus {0.2|zero point two}, plus one: {0.6|zero point six}.', code: 'y' },
        { id: 'undo', say: 'If the network learns {γ|gamma} equal to the standard deviation and {β|beta} equal to the mean, it undoes the normalization entirely. It gets to choose.', code: 'undo' },
      ],
    },
    {
      id: 'test',
      title: 'At test time',
      codeTitle: 'batchnorm.py',
      code: `
        run_mu = 0.9 * run_mu + 0.1 * mu       # training  #@train
        run_var = 0.9 * run_var + 0.1 * var    # training  #@train
        xhat = (x - run_mu) / np.sqrt(run_var + eps)       #@test
      `,
      beats: [
        { id: 'running', say: 'During training, every batch has its own mean and variance, and batch norm keeps running averages of both.', code: 'train' },
        { id: 'test', say: 'At test time it normalizes with those running averages, not with the test batch. So an example\'s output never depends on which other examples came with it.', code: 'test' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
