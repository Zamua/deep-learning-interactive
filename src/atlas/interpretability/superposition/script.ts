import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-superposition',
  title: 'Superposition',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Elhage, Hume, Olsson, Schiefer et al.', year: 2022, title: 'Toy Models of Superposition', url: 'https://arxiv.org/abs/2209.10652', scene: 'sparse' },
  ],
  scenes: [
    {
      id: 'room',
      title: 'More to track than room',
      codeTitle: 'room.py',
      code: `
        d = 2   # numbers per token        #@d
        W = np.array([[1, 0],  # feature 0 #@W
                      [0, 1]]) # feature 1 #@W
        f = np.array([3, 2])   # values    #@f
        x = f @ W     # [3, 2]             #@x
        x @ W[0]      # 3: feature 0       #@read
      `,
      beats: [
        { id: 'want', say: 'A token\'s residual stream is a list of d numbers. But a model has far more than d things to track: is the text French, is it inside a quote, does it name a person.', code: 'd' },
        { id: 'feature', say: 'Each such property is called a feature, and its value says how strongly it is present. The model stores it along a direction of its own: an arrow.', code: 'W' },
        { id: 'perp', say: 'With d of two, two features fit perfectly: one arrow along each axis, at a right angle. Stacked as rows, the arrows make W.', code: 'W' },
        { id: 'store', say: 'Give them values, f: three and two. As with an embedding table, f times W adds up each row times its value, so the stream, x, is three, two.', code: ['f', 'x'] },
        { id: 'read', say: 'Dot x with feature zero\'s arrow, one, zero, and you read back three: exactly its value. The other arrow, at a right angle, adds nothing.', code: 'read' },
        { id: 'limit', say: 'But a plane has no third direction at a right angle to both: a stream of width d holds at most d arrows all at right angles.', code: 'd' },
      ],
    },
    {
      id: 'three',
      title: 'Three arrows, two numbers',
      codeTitle: 'three.py',
      code: `
        W = np.array([[1, 0],          #@W
                      [-0.5, 0.87],    #@W
                      [-0.5, -0.87]])  #@W
        W[0] @ W[0]  # 1*1 + 0*0 = 1   #@self
        W[0] @ W[1]  # -0.5 + 0 = -0.5 #@pair
      `,
      beats: [
        { id: 'three', say: 'To fit a third feature, give up exact right angles: spread three arrows evenly around the circle, {120°|a hundred and twenty degrees} apart.', code: 'W' },
        { id: 'unit', say: 'Each is one unit long, with its tip on the circle of radius one. Feature zero\'s arrow is still one, zero.', code: 'W' },
        { id: 'self', say: 'Dot an arrow with itself, and you get one: one times one, plus zero times zero.', code: 'self' },
        { id: 'pair', say: 'Two different arrows give minus a half: one times minus a half, plus zero. Every pair is {120°|a hundred and twenty degrees} apart, so every pair overlaps by that same minus a half.', code: 'pair' },
      ],
    },
    {
      id: 'read',
      title: 'Store three, read one back',
      codeTitle: 'read.py',
      code: `
        f = np.array([3, 0, 2])        #@f
        x = f @ W  # 3*W[0] + 2*W[2]   #@x
        #  = [3, 0] + [-1, -1.74]      #@x
        #  = [2, -1.74]                #@sum
        x @ W[0]   # 2, not 3          #@read
        # 3*1 + 2*(-0.5) = 2           #@split
        # own - 0.5 * each other on    #@rule
      `,
      beats: [
        { id: 'store', say: 'Now store three values: f is three, zero and two. Features zero and two are on, and feature one is off.', code: 'f' },
        { id: 'scale', say: 'f times W is three of feature zero\'s arrow, which is three, zero, plus two of feature two\'s, which is minus one, minus {1.74|one point seven four}.', code: 'x' },
        { id: 'sum', say: 'So the stream, x, is two, and minus {1.74|one point seven four}: three values laid on top of one another in two numbers. That is superposition: placing one thing on top of another.', code: 'sum' },
        { id: 'read', say: 'Read feature zero back as before: x dot its arrow, one, zero, picks out the first entry of x. Two, not three.', code: 'read' },
        { id: 'split', say: 'Why two? x is three of feature zero\'s arrow plus two of feature two\'s, so the reading splits: three times one, plus two times minus a half.', code: 'split' },
        { id: 'rule', say: 'So a reading is the feature\'s own value, minus half of each other value that is on. The minus one leaked in from feature two: that leak is called interference.', code: 'rule' },
      ],
    },
    {
      id: 'sparse',
      title: 'Why sparse features fit',
      codeTitle: 'sparse.py',
      code: `
        # each on for ~1 token in 100    #@rare
        # two together: ~1 in 10,000     #@rare
        f = np.array([0, 0, 2])          #@alone
        x @ W[0]        # -1: a leak     #@alone
        relu(x @ W[0])  # 0: filtered    #@relu
        # at right angles: at most d     #@many
      `,
      beats: [
        { id: 'sparse', say: 'Interference only comes from features that are on together. But most features are sparse, on for few tokens: if each is on for one token in a hundred, two given ones are on together for about one in ten thousand.', code: 'rare' },
        { id: 'alone', say: 'So mostly a feature is on alone. Say only feature two is on, at two: reading feature zero gives minus a half times two, minus one, though it is off.', code: 'alone' },
        { id: 'relu', say: 'A ReLU after the reading keeps positive numbers and zeros the rest: minus one becomes zero, off, as it should be.', code: 'relu' },
        { id: 'many', say: 'And the more dimensions, the gentler the squeeze: only d arrows fit at exact right angles, but far more fit nearly so, overlapping only a little.', code: 'many' },
        { id: 'toy', say: 'In 2022, in Toy Models of Superposition, Nelson Elhage, Chris Olah and colleagues trained tiny models to squeeze five features into two numbers, with a ReLU after.', code: 'many' },
        { id: 'found', say: 'With dense features, on most of the time, the models kept only the two most important, at a right angle. With sparse ones, they kept more by letting arrows overlap: five equally important features spread out as a pentagon.', code: 'many' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
