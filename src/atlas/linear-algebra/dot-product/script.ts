import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dot-product',
  title: 'Dot product',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'multiply',
      title: 'Multiply, then add',
      codeTitle: 'dot.py',
      code: `
        w = np.array([2, -1, 3])   #@w
        x = np.array([1, 4, 2])    #@x
        w * x          # [2, -4, 6]    #@mul
        np.dot(w, x)   # 4             #@dot
        w @ x          # 4, the same   #@dot
      `,
      beats: [
        { id: 'pair', say: 'The dot product takes two vectors of the same length, here w and x, and gives back a single number.', code: ['w', 'x'] },
        { id: 'mult', say: 'First, multiply matching entries: two times one is two, minus one times four is minus four, and three times two is six.', code: 'mul' },
        { id: 'add', say: 'Then add up the products: two, minus four and six make four. That sum is written {w · x|w dot x}, read “w dot x”.', code: 'dot' },
        { id: 'formula', say: 'In symbols, {w · x = Σᵢ wᵢ xᵢ|w dot x is the sum over i of w i times x i}. {wᵢ|w i} is entry i of w, the same as {w[i]|w of i}, and the big {Σ|sigma}, a Greek capital S, means add up what follows for every position i.', code: 'dot' },
        { id: 'weigh', say: 'Read w as weights: each entry of x counts as much as its weight says, and a negative weight makes it count against.', code: 'mul' },
      ],
    },
    {
      id: 'sign',
      title: 'What the sign says',
      codeTitle: 'sign.py',
      code: `
        w = np.array([2, 1])      #@w
        x = np.array([3, 1])      #@same
        w @ x    # 7: same way    #@same
        x = np.array([-1, 2])     #@perp
        w @ x    # 0: right angle #@perp
        x = np.array([-2, -1])    #@opp
        w @ x    # -5: opposite   #@opp
      `,
      beats: [
        { id: 'arrows', say: 'In two dimensions, picture each vector as an arrow from the origin. Here w is the arrow to the point two, one.', code: 'w' },
        { id: 'same', say: 'When x points roughly the same way, like three, one, the products agree, and the dot product is positive: seven.', code: 'same' },
        { id: 'perp', say: 'Turn x to minus one, two, at a right angle to w, and the products cancel: minus two plus two is zero.', code: 'perp' },
        { id: 'opp', say: 'Turn it further, to minus two, minus one, and the dot product goes negative: minus five.', code: 'opp' },
        { id: 'agree', say: 'So the sign says whether two vectors agree: positive when they point the same way, zero at a right angle, negative when they point apart.', code: ['same', 'perp', 'opp'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
