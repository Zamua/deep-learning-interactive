import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matrix-shape',
  title: 'Matrix shapes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'grid',
      title: 'Rows and columns',
      codeTitle: 'shape.py',
      code: `
        W = np.array([[1, 4, 2],     #@W
                      [0, 3, 5]])    #@W
        W.shape   # (2, 3): rows, columns   #@shape
        W.size    # 6 numbers               #@size
        # 10 photos, 3072 numbers each: (10, 3072)   #@big
      `,
      beats: [
        { id: 'grid', say: 'A matrix is a grid of numbers: rows that run across, and columns that run down.', code: 'W' },
        { id: 'rows', say: 'This one, W, has two rows,', code: 'W' },
        { id: 'cols', say: 'and three columns.', code: 'W' },
        { id: 'shape', say: 'Its shape is the rows, then the columns: two by three. Rows always come first.', code: 'shape' },
        { id: 'count', say: 'It holds two times three: six numbers.', code: 'size' },
        { id: 'big', say: 'Real ones are bigger. Stack ten flattened {32 by 32|thirty two by thirty two} photos, one per row. Each row holds {3,072|three thousand and seventy two} numbers, so the shape is ten by {3,072|three thousand and seventy two}.', code: 'big' },
      ],
    },
    {
      id: 'index',
      title: 'Finding an entry',
      codeTitle: 'index.py',
      code: `
        W = np.array([[1, 4, 2],     #@W
                      [0, 3, 5]])    #@W
        W[0, 2]   # 2: row 0, column 2      #@eg
        W[1, 0]   # 0: row 1, column 0      #@eg2
        W[2, 0]   # IndexError: no row 2    #@out
      `,
      beats: [
        { id: 'ij', say: 'To pick out one entry, give its row, then its column. Both count from zero.', code: 'W' },
        { id: 'eg', say: '{W[0, 2]|W of zero, two} is in row zero, the first row, and column two, the third column: it is two.', code: 'eg' },
        { id: 'eg2', say: '{W[1, 0]|W of one, zero} is the second row\'s first entry: zero.', code: 'eg2' },
        { id: 'out', say: 'And {W[2, 0]|W of two, zero} does not exist. With two rows, the rows are zero and one.', code: 'out' },
      ],
    },
    {
      id: 'transpose',
      title: 'Transposing',
      codeTitle: 'transpose.py',
      code: `
        W.shape      # (2, 3)        #@W
        W.T.shape    # (3, 2)        #@T
        W[1, 2]      # 5             #@ij
        W.T[2, 1]    # 5, the same   #@ij
      `,
      beats: [
        { id: 'flip', say: 'Transposing a matrix turns its rows into columns. The transpose of W is written {Wᵀ|W transpose}, with a raised T, and in code {W.T|W dot T}. It has shape three by two.', code: ['W', 'T'] },
        { id: 'ij', say: 'Row i, column j of the transpose holds what was at row j, column i: the five at {W[1, 2]|W of one, two} lands at {W.T[2, 1]|W transpose of two, one}.', code: 'ij' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
