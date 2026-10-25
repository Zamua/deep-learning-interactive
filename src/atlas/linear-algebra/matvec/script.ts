import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matvec',
  title: 'Matrix × vector',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'rows',
      title: 'A stack of dot products',
      codeTitle: 'matvec.py',
      code: `
        W = np.array([[1, 2, 0],     #@W
                      [3, -1, 2]])   #@W
        x = np.array([2, 1, 3])      #@x
        W[0] @ x    # 4: row 0 with x   #@r0
        W[1] @ x    # 11: row 1 with x  #@r1
        W @ x       # [4, 11]           #@all
      `,
      beats: [
        { id: 'setup', say: 'Multiplying a matrix W by a vector x is written {Wx|W x}, the two side by side, and it is a stack of dot products. Here W has two rows of three, and x has three entries.', code: ['W', 'x'] },
        { id: 'row0', say: 'Dot the first row of W with x: one times two, plus two times one, plus zero times three. That is four, the first entry of the result.', code: 'r0' },
        { id: 'row1', say: 'The second row gives the second entry: six, minus one, plus six. Eleven.', code: 'r1' },
        { id: 'result', say: 'So W x is four, eleven: one entry for each row of W.', code: 'all' },
      ],
    },
    {
      id: 'shapes',
      title: 'What fits, and what comes out',
      codeTitle: 'shapes.py',
      code: `
        W.shape        # (2, 3)                   #@match
        x.shape        # (3,): one per column     #@match
        (W @ x).shape  # (2,): one per row        #@out
        # W: (10, 3072), x: (3072,) -> (10,)     #@big
        W @ np.array([2, 1])   # error: 3 vs 2   #@fail
      `,
      beats: [
        { id: 'match', say: 'Each row is dotted with x, so a row and x must be the same length: the number of columns of W must equal the length of x.', code: 'match' },
        { id: 'out', say: 'And there is one dot product per row, so the result has one entry per row of W. A two by three matrix turns three numbers into two: {(2, 3) @ (3,) → (2,)|two by three, times three, gives two}, where {@|the at sign} is the product and the arrow points to what comes out.', code: 'out' },
        { id: 'big', say: 'The sizes can be anything. A ten by {3,072|three thousand and seventy two} W turns an image of {3,072|three thousand and seventy two} numbers into ten.', code: 'big' },
        { id: 'fail', say: 'Give it a vector of the wrong length, and a column of W has no partner: the product is not defined.', code: 'fail' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
