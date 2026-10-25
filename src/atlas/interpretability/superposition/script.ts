import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-superposition',
  title: 'Superposition',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'room',
      title: 'Three features, two dimensions',
      codeTitle: 'directions.py',
      code: `
        d = 2                                       #@d
        W = np.array([[1, 0], [-0.5, 0.87],
                      [-0.5, -0.87]])   # 3 features  #@W
        W[0] @ W[1]          # -0.5: they overlap    #@cos
      `,
      beats: [
        { id: 'perp', say: 'A stream of d numbers has room for only d directions at exact right angles. In two dimensions, two features fit perfectly.', code: 'd' },
        { id: 'three', say: 'Three features? Give up exact right angles, and spread them a hundred and twenty degrees apart.', code: 'W' },
        { id: 'cos', say: 'Now every pair overlaps: the dot product of any two directions is the cosine of a hundred and twenty degrees, minus a half.', code: 'cos' },
      ],
    },
    {
      id: 'read',
      title: 'Reading a feature back',
      codeTitle: 'read.py',
      code: `
        f = np.array([1, 0, 0])    # feature 0 on     #@one
        x = f @ W                  # [1, 0]           #@one
        x @ W[0], x @ W[1]         # 1, -0.5          #@read
        f = np.array([1, 1, 0])    # 0 and 1 on       #@two
        (f @ W) @ W[0]             # 1 - 0.5 = 0.5    #@two
      `,
      beats: [
        { id: 'store', say: 'Store a value: feature zero at one. The stream is its direction, one, zero.', code: 'one' },
        { id: 'read', say: 'Read each feature back with a dot product. Feature zero reads one, exactly right. Feature one reads minus a half: a leak, called interference.', code: 'read' },
        { id: 'both', say: 'Now turn on features zero and one together. Reading feature zero gives one, minus a half: only a half. The leak has eaten half the signal.', code: 'two' },
      ],
    },
    {
      id: 'sparse',
      title: 'Why sparsity rescues it',
      codeTitle: 'sparse.py',
      code: `
        # each feature on for about 1 token in 100   #@rare
        # two at once: about 1 token in 10,000       #@rare
        relu(x @ W[k] + b)    # clips small leaks    #@relu
      `,
      beats: [
        { id: 'rare', say: 'Interference only happens between features that are on at the same time. If each feature is rare, on for one token in a hundred, two at once are rarer still.', code: 'rare' },
        { id: 'clip', say: 'Most of the time one feature is on alone. Its neighbors read small negative leaks, and a ReLU clips them to zero.', code: 'relu' },
        { id: 'more', say: 'In many dimensions, far more than d directions can be nearly perpendicular. So a model can store many more sparse features than it has dimensions. That is superposition.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
