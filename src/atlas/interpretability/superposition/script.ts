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
        W = np.array([[1, 0],      # 3 features  #@W
                      [-0.5, 0.87],              #@W
                      [-0.5, -0.87]])            #@W
        W[0] @ W[0]    # 1*1 + 0*0 = 1               #@self
        W[0] @ W[1]    # 1*(-0.5) + 0*0.87 = -0.5     #@pair
      `,
      beats: [
        { id: 'perp', say: 'A stream of d numbers has room for only d directions at exact right angles. In two dimensions, two features fit perfectly.', code: 'd' },
        { id: 'three', say: 'Three features? Give up exact right angles, and spread them {120°|a hundred and twenty degrees} apart.', code: 'W' },
        { id: 'rows', say: 'Each feature\'s direction is a row of W, an arrow of length one. Feature zero points along one, zero. Features one and two point to minus a half, and plus or minus {0.87|zero point eight seven}.', code: 'W' },
        { id: 'self', say: 'Dot a direction with itself, and you get one. For feature zero: one times one, plus zero times zero.', code: 'self' },
        { id: 'pair', say: 'Dot two different directions, and you get minus a half: one times minus a half, plus zero times {0.87|zero point eight seven}. Every pair, {120°|a hundred and twenty degrees} apart, overlaps by that same minus a half.', code: 'pair' },
      ],
    },
    {
      id: 'read',
      title: 'Store, then read back',
      codeTitle: 'read.py',
      code: `
        f = np.array([3, 0, 2])      # the values      #@f
        x = f @ W     # 3*W[0] + 2*W[2]                #@scale
        #   = [3, 0] + [-1, -1.74] = [2, -1.74]        #@sum
        x @ W[0]      # 2*1 + (-1.74)*0 = 2            #@read
        # = 3*(W[0] @ W[0]) + 2*(W[2] @ W[0])          #@split
        # = 3*1 + 2*(-0.5) = 2                         #@split
        # own value, plus -0.5 times each other one    #@rule
      `,
      beats: [
        { id: 'store', say: 'Store values by adding up each feature\'s value times its direction. Say the values, f, are three, zero and two: features zero and two are on.', code: 'f' },
        { id: 'scale', say: 'Three times feature zero\'s direction is three, zero. Two times feature two\'s is minus one, minus {1.74|one point seven four}.', code: 'scale' },
        { id: 'sum', say: 'Add them: the stream, x, is two, minus {1.74|one point seven four}. Three values, packed into two numbers.', code: 'sum' },
        { id: 'read', say: 'Read feature zero back with a dot product: two times one, plus minus {1.74|one point seven four} times zero. Two, not three.', code: 'read' },
        { id: 'split', say: 'Why two? The stream is three of feature zero\'s direction plus two of feature two\'s, so the dot product splits into pieces: three times one, plus two times minus a half.', code: 'split' },
        { id: 'rule', say: 'So a reading is the feature\'s own value, plus minus a half times each other value that is on. The minus one is the leak, called interference, and it grows with the other feature\'s value.', code: 'rule' },
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
      ],
    },
    {
      id: 'try',
      title: 'Read one back',
      codeTitle: 'try.py',
      code: `
        f = [2, 1, 3]          # read feature 1  #@p1
        1 - 0.5*2 - 0.5*3      # -1.5            #@a1
        f = [0.5, 2, 1]        # read feature 0  #@p2
        relu(0.5 - 0.5*2 - 0.5*1)   # 0          #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. The same three directions hold the values two, one and three. What does reading feature one give?', code: 'p1' },
        { id: 'own', say: 'Start from its own value, one. Each other value leaks in at minus a half: minus a half times two is minus one, and minus a half times three is minus one and a half.', code: 'a1' },
        { id: 'a1', say: 'Add them: one, minus one, minus one and a half. Minus one and a half.', code: 'a1' },
        { id: 'p2', say: 'Now the values are a half, two and one, and a ReLU follows the reading. Read feature zero.', code: 'p2' },
        { id: 'a2', say: 'A half, minus one, minus a half: minus one. The ReLU clips it to zero.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
