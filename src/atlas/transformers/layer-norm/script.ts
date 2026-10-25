import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-layer-norm',
  title: 'Layer normalization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'sideways',
      title: 'Batch norm, turned sideways',
      codeTitle: 'norms.py',
      code: `
        X.shape          # (4, 4): 4 examples, 4 features   #@X
        X.mean(axis=0)   # batch norm: a mean per feature   #@col
        X.mean(axis=1)   # layer norm: a mean per example    #@row
      `,
      beats: [
        { id: 'recall', say: 'Batch norm normalizes each feature over the examples in a batch: down a column.', code: ['X', 'col'] },
        { id: 'rows', say: 'Layer norm turns that sideways. It normalizes each example over its own features: along a row.', code: 'row' },
        { id: 'alone', say: 'So an example\'s output depends on that example alone. The batch size does not matter, and training and test work the same way, with no running averages.', code: 'row' },
      ],
    },
    {
      id: 'one',
      title: 'One example at a time',
      codeTitle: 'layernorm.py',
      code: `
        x = np.array([9, 3, 17, 11])    # one example, 4 features   #@x
        mu = x.mean()                    # 10                        #@mu
        var = x.var()                    # 25                        #@var
        xhat = (x - mu) / np.sqrt(var + eps)                         #@xhat
        # [-0.2, -1.4, 1.4, 0.2]                                     #@xhat
        y = gamma * xhat + beta    # one gamma, one beta per feature  #@y
      `,
      beats: [
        { id: 'x', say: 'Take one example with four features: nine, three, seventeen and eleven.', code: 'x' },
        { id: 'mean', say: 'Their mean, {μ|mu}, is ten.', code: 'mu' },
        { id: 'var', say: 'The squared distances from it, one, forty nine, forty nine and one, average to twenty five, so the standard deviation is five.', code: 'var' },
        { id: 'xhat', say: 'Subtract the mean and divide by the standard deviation: nine becomes minus {0.2|zero point two}, three becomes minus {1.4|one point four}. Epsilon only guards against dividing by zero.', code: 'xhat' },
        { id: 'gamma', say: 'Then, as in batch norm, a learned scale, {γ|gamma}, and shift, {β|beta}, with one entry of each per feature. With d features, that is two d learned numbers.', code: 'y' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
