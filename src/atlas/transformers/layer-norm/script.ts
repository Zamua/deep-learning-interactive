import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-layer-norm',
  title: 'Layer normalization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ba, Kiros & Hinton', year: 2016, title: 'Layer Normalization', url: 'https://arxiv.org/abs/1607.06450', scene: 'sideways' },
  ],
  scenes: [
    {
      id: 'company',
      title: 'It depends on the company',
      codeTitle: 'batchnorm.py',
      code: `
        x = np.array([9, 3, 17, 11])       #@four
        (x - x.mean()) / x.std()           #@four
        # [-0.2, -1.4, 1.4, 0.2]           #@four
        x = np.array([9, 3])               #@two
        (x - x.mean()) / x.std()           #@two
        # [1, -1]                          #@two
        x = np.array([9])  # minus mean: 0 #@one
      `,
      beats: [
        { id: 'recall', say: 'Batch norm rescued a unit stuck on the flat top of the sigmoid. Over a batch of four examples, its z was nine, three, seventeen and eleven. Batch norm slid them to center on zero, then squeezed them to a spread of one.', code: 'four' },
        { id: 'company', say: 'But each value was measured against the rest of its batch. Nine came out minus {0.2|zero point two} only because three, seventeen and eleven came along.', code: 'four' },
        { id: 'two', say: 'Put nine in a batch of two, beside three. Their mean is six, and each sits three away from it, so now nine becomes plus one.', code: 'two' },
        { id: 'always', say: 'Every batch of two ends the same way: the larger value becomes plus one and the smaller minus one, however far apart they are.', code: 'two' },
        { id: 'one', say: 'And in a batch of one, nine is its own mean, so it becomes zero. Whatever the input, the output is the same.', code: 'one' },
      ],
    },
    {
      id: 'sideways',
      title: 'Turn it sideways',
      codeTitle: 'norms.py',
      code: `
        X.shape         # (examples, features) #@X
        X.mean(axis=0)  # down: batch norm     #@col
        X.mean(axis=1)  # along: layer norm    #@row
        x = X[0]        # [9, 1, 15, 7]        #@x
      `,
      beats: [
        { id: 'grid', say: 'Lay a batch out as before: one example per row, one feature per column. Our unit is column zero, and batch norm works down it, so every value leans on the rest of its column.', code: ['X', 'col'] },
        { id: 'paper', say: 'In 2016, Jimmy Ba, Jamie Kiros and Geoffrey Hinton pointed out that this makes batch norm depend on the size of the batch. Their answer, in their words, was to transpose it: turn it sideways.', code: 'col' },
        { id: 'row', say: 'Layer normalization works along a row: one example\'s own features, and nothing else. Example zero\'s row is nine, one, fifteen and seven.', code: 'row' },
        { id: 'name', say: 'A row holds the value of every unit in a layer, for that one example. The mean and spread are taken across the whole layer, which gives layer norm its name.', code: 'row' },
        { id: 'alone', say: 'Now shrink the batch to one. Each column holds a single number, so batch norm turns every one into zero. The row still holds four, so layer norm still works.', code: 'x' },
        { id: 'same', say: 'Since nothing outside the row enters, the other examples can never change this one\'s result. Training and test do exactly the same arithmetic, with no running averages to keep.', code: 'row' },
      ],
    },
    {
      id: 'one',
      title: 'Along one row',
      codeTitle: 'layernorm.py',
      code: `
        x = np.array([9, 1, 15, 7])  #@x
        mu = x.mean()         # 8    #@mu
        var = x.var()         # 25   #@var
        sigma = np.sqrt(var)  # 5    #@sigma
        xhat = (x - mu) / sigma      #@xhat
        # [0.2, -1.4, 1.4, -0.2]     #@xhat
        y = gamma * xhat + beta      #@y
        # gamma, beta: d numbers each #@count
      `,
      beats: [
        { id: 'x', say: 'Follow example zero along its row: nine, one, fifteen and seven, the values of the layer\'s four units for this one example.', code: 'x' },
        { id: 'mean', say: 'Together they make thirty two, so their mean, {μ|mu}, is eight. Slide every value down by eight, and the row centers on zero.', code: 'mu' },
        { id: 'var', say: 'The squared distances from the mean, one, forty nine, forty nine and one, average to twenty five: the variance.', code: 'var' },
        { id: 'sigma', say: 'Its square root, five, is the standard deviation, {σ|sigma}. Squeeze every distance by it.', code: 'sigma' },
        { id: 'xhat', say: 'So nine, one above the mean, becomes one fifth: {0.2|zero point two}. The row now has mean zero and spread one, whatever else is in the batch.', code: 'xhat' },
        { id: 'gamma', say: 'Then come the learned scale and shift from batch norm, {γ|gamma} and {β|beta}: one pair per feature, never per example.', code: 'y' },
        { id: 'scale', say: 'If feature zero\'s {γ|gamma} is two and its {β|beta} is one, {0.2|zero point two} becomes two times {0.2|zero point two}, plus one: {1.4|one point four}.', code: 'y' },
        { id: 'count', say: 'Write d for the number of features. Each layer norm learns d scales and d shifts, {2d|two d} in all, however big the batch: with {512|five hundred twelve} features, {1,024|one thousand and twenty four}.', code: 'count' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
