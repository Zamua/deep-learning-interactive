import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-shapes',
  title: 'Matmul shapes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'columns',
      title: 'Many products at once',
      codeTitle: 'matmul.py',
      code: `
        A = np.ones((2, 3))      #@A
        B = np.ones((3, 4))      #@A
        A @ B[:, 0]    # column 0 of the result   #@many
        # A's columns = B's rows: 3 = 3           #@inner
        (A @ B).shape  # (2, 4)                   #@outer
      `,
      beats: [
        { id: 'many', say: 'Multiplying two matrices is many matrix-vector products at once. A multiplies each column of B, and each answer becomes a column of the result.', code: ['A', 'many'] },
        { id: 'inner', say: 'So each column of B must be as long as a row of A: A\'s columns must equal B\'s rows. These are the inner dimensions, three and three.', code: 'inner' },
        { id: 'outer', say: 'The result keeps the outer ones: A\'s two rows, and B\'s four columns. Two by three, times three by four, gives two by four.', code: 'outer' },
        { id: 'rule', say: 'In general, m by n, times n by k, gives m by k. The inner n\'s must match, and they disappear.', code: ['inner', 'outer'] },
      ],
    },
    {
      id: 'order',
      title: 'Order matters',
      codeTitle: 'order.py',
      code: `
        B @ A            # error: 4 vs 2          #@swap
        X.shape          # (N, D)                 #@batch
        W.shape          # (C, D)                 #@batch
        X @ W            # error: D vs C          #@fix
        (X @ W.T).shape  # (N, C)                 #@fix
        (W @ X.T).shape  # (C, N)                 #@flip
      `,
      beats: [
        { id: 'swap', say: 'Order matters. B times A is three by four, times two by three: the inner dimensions are four and two, so there is no product.', code: 'swap' },
        { id: 'batch', say: 'A common case: a batch X of N examples with D numbers each, and weights W with one row of D for each of C classes.', code: 'batch' },
        { id: 'fix', say: 'X times W fails: its inner dimensions are D and C. Transpose W first: N by D, times D by C, gives N by C, a score for every example and class.', code: 'fix' },
        { id: 'flip', say: 'W times X transpose works too, but lays the same scores out the other way: C by N.', code: 'flip' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        A = np.ones((4, 2))
        B = np.ones((2, 5))
        # inner: 2 and 2 match         #@inner
        (A @ B).shape   # (4, 5)       #@outer
      `,
      beats: [
        { id: 'ask', say: 'Your turn. A is four by two, and B is two by five. What shape is A times B?' },
        { id: 'inner', say: 'The inner dimensions are two and two. They match, so the product works.', code: 'inner' },
        { id: 'outer', say: 'The outer ones give the shape: four by five.', code: 'outer' },
      ],
    },
  ],
};
