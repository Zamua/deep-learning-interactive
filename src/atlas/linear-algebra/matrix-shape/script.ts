import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matrix-shape',
  title: 'Matrix shapes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Sylvester', year: 1850, title: 'Additions to the articles in the September number of this journal, "On a new class of theorems," and on Pascal\'s theorem', url: 'https://doi.org/10.1080/14786445008646629', scene: 'stack' },
    { who: 'Cayley', year: 1858, title: 'A memoir on the theory of matrices', url: 'https://doi.org/10.1098/rstl.1858.0002', scene: 'transpose' },
  ],
  scenes: [
    {
      id: 'stack',
      title: 'Many photos at once',
      codeTitle: 'stack.py',
      code: `
        x = img.reshape(-1)  # flatten  #@one
        # x: one photo, 48 numbers      #@one
        W = np.stack(photos)  # 4 rows  #@stack
        W.shape   # (4, 48)             #@shape
        # 10 photos of 3,072 each:      #@big
        #   W.shape is (10, 3072)       #@big
      `,
      beats: [
        { id: 'one', say: 'A photo becomes a vector by laying all its numbers out in one row, pixel after pixel. Pressing a grid of pixels into a single row like this is called flattening.', code: 'one' },
        { id: 'many', say: 'But a program rarely has just one photo. Flatten four, and stack their rows one under another.', code: 'stack' },
        { id: 'line', say: 'Now the numbers line up. Read across a row, and you get one photo. Read down a column, and you get the same number from every photo: here, each one\'s top left red.', code: 'stack' },
        { id: 'matrix', say: 'A grid of numbers in rows and columns like this is called a matrix.', code: 'stack' },
        { id: 'name', say: 'The English mathematician James Joseph Sylvester named it, in 1850. Matrix is Latin for womb, or source: he saw it as the grid that smaller, square grids are drawn from, by picking a few of its rows and as many of its columns.', code: 'stack' },
        { id: 'W', say: 'Matrices are usually named with capital letters, so call this one W.', code: 'stack' },
        { id: 'shape', say: 'Its shape is its size: how many rows, then how many columns, always in that order. Four photos of {48|forty eight} numbers each make it four by {48|forty eight}.', code: 'shape' },
        { id: 'big', say: 'A real stack is bigger. Ten flattened {32 by 32|thirty two by thirty two} color photos, of {3,072|three thousand and seventy two} numbers each, make a ten by {3,072|three thousand and seventy two} matrix.', code: 'big' },
      ],
    },
    {
      id: 'grid',
      title: 'Rows times columns',
      codeTitle: 'shape.py',
      code: `
        W = np.array([[1, 4, 2],   #@W
                      [0, 3, 5]])  #@W
        W.shape   # (2, 3)         #@shape
        W.size    # 2 * 3 = 6      #@size
        # 6 numbers in 2 rows:     #@back
        #   6 / 2 = 3 columns      #@back
      `,
      beats: [
        { id: 'rows', say: 'To read one up close, take a small W. Count its rows, top to bottom: two.', code: 'W' },
        { id: 'cols', say: 'Count its columns, left to right: three.', code: 'W' },
        { id: 'shape', say: 'So its shape is two by three. NumPy writes it {(2, 3)|two, three}, in round brackets, rows first.', code: 'shape' },
        { id: 'size', say: 'Every row holds one number for each column, so W holds two times three: six numbers. Rows times columns, not rows plus columns.', code: 'size' },
        { id: 'back', say: 'It works backward too. Six numbers in two rows means six over two, three, in each row: three columns.', code: 'back' },
      ],
    },
    {
      id: 'index',
      title: 'Finding an entry',
      codeTitle: 'index.py',
      code: `
        W[0, 2]   # 2: row 0, column 2  #@eg
        W[1, 0]   # 0: row 1, column 0  #@eg2
        W[1, 2]   # 5: the last         #@last
        W[2, 0]   # IndexError          #@out
      `,
      beats: [
        { id: 'ij', say: 'To pick out one entry, give its row, then its column, in square brackets. Like a vector\'s entries, both count from zero.', code: 'eg' },
        { id: 'photo', say: 'Row first, as in the shape. In the stack of photos, the row picks the photo, and the column picks which of its numbers.', code: 'eg' },
        { id: 'eg', say: '{W[0, 2]|W of zero, two} is in row zero, the first, and column two, the third: it is two.', code: 'eg' },
        { id: 'eg2', say: '{W[1, 0]|W of one, zero} is in the second row and the first column: zero. Swap the two numbers, and you ask for a different entry.', code: 'eg2' },
        { id: 'last', say: 'With two rows and three columns, the last entry is {W[1, 2]|W of one, two}: each index is one less than its count.', code: 'last' },
        { id: 'out', say: 'So {W[2, 0]|W of two, zero} does not exist. The rows are numbered zero and one, and there is no row two.', code: 'out' },
      ],
    },
    {
      id: 'transpose',
      title: 'Turning it over',
      codeTitle: 'transpose.py',
      code: `
        W.shape      # (2, 3)        #@W
        W.T.shape    # (3, 2)        #@T
        W[1, 2]      # 5             #@ij
        W.T[2, 1]    # 5, the same   #@ij
      `,
      beats: [
        { id: 'flip', say: 'Sometimes a matrix is wanted the other way round. Stand each row of W up, and lay it down as a column.', code: 'W' },
        { id: 'name', say: 'This is called transposing, from the Latin for putting across: rows and columns trade places.', code: 'T' },
        { id: 'cayley', say: 'Arthur Cayley set it out in 1858, in his memoir on the theory of matrices. Transposing, he wrote, turns a broad matrix into a deep one.', code: 'T' },
        { id: 'sym', say: 'The transpose of W is written {Wᵀ|W transpose}, with a small raised T. In code, it is {W.T|W dot T}.', code: 'T' },
        { id: 'shape', say: 'Two rows of three become three rows of two, so {Wᵀ|W transpose} has shape three by two: the two numbers of the shape swap.', code: ['W', 'T'] },
        { id: 'ij', say: 'Each entry\'s two indices swap too. The five at {W[1, 2]|W of one, two} lands at {W.T[2, 1]|W transpose of two, one}.', code: 'ij' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
