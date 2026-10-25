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
        B @ A              # error: 4 vs 2     #@swap
        M = np.ones((2, 4))                    #@pair
        A @ M              # error: 3 vs 2     #@pair
        (A.T @ M).shape    # (3, 4)            #@fix
        (M.T @ A).shape    # (4, 3)            #@flip
      `,
      beats: [
        { id: 'swap', say: 'Order matters. B times A is three by four, times two by three: the inner dimensions are four and two, so there is no product.', code: 'swap' },
        { id: 'pair', say: 'Now take A, two by three, and a new matrix M, two by four. A times M fails too: its inner dimensions are three and two.', code: 'pair' },
        { id: 'fix', say: 'Transposing A swaps its shape to three by two. Three by two, times two by four, gives three by four.', code: 'fix' },
        { id: 'flip', say: 'M transpose times A works as well, and lays the same numbers out the other way: four by three.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
