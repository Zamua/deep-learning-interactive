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
        # 10 classes, 3072 inputs: (10, 3072)   #@big
      `,
      beats: [
        { id: 'grid', say: 'A matrix is a grid of numbers: rows that run across, and columns that run down.', code: 'W' },
        { id: 'rows', say: 'This one, W, has two rows,', code: 'W' },
        { id: 'cols', say: 'and three columns.', code: 'W' },
        { id: 'shape', say: 'Its shape is the rows, then the columns: two by three. Rows always come first.', code: 'shape' },
        { id: 'count', say: 'It holds two times three: six numbers.', code: 'size' },
        { id: 'big', say: 'Real ones are bigger. A classifier with ten classes, for images of {3,072|three thousand and seventy two} numbers, has one row per class and one column per input number: ten by {3,072|three thousand and seventy two}.', code: 'big' },
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
        { id: 'flip', say: 'Transposing a matrix turns its rows into columns. {W.T|W transpose} has shape three by two.', code: ['W', 'T'] },
        { id: 'ij', say: 'Entry i, j of the transpose is entry j, i of the original: the five at {W[1, 2]|W of one, two} lands at {W.T[2, 1]|W transpose of two, one}.', code: 'ij' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        W = np.array([[3, 0],
                      [1, 5],
                      [2, 4]])
        W.shape   # (3, 2)   #@ans
      `,
      beats: [
        { id: 'ask', think: true, say: 'Your turn. What is the shape of this matrix?' },
        { id: 'rows', say: 'Count the rows, top to bottom: one, two, three.' },
        { id: 'cols', say: 'Count the columns, left to right: one, two.' },
        { id: 'ans', say: 'Rows first: the shape is three by two.', code: 'ans' },
      ],
    },
  ],
};
