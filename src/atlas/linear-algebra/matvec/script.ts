import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matvec',
  title: 'Matrix × vector',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Cayley', year: 1858, title: 'A Memoir on the Theory of Matrices', url: 'https://doi.org/10.1098/rstl.1858.0002', scene: 'questions' },
  ],
  scenes: [
    {
      id: 'questions',
      title: 'Many questions at once',
      codeTitle: 'ask.py',
      code: `
        x = np.array([2, 1])      #@x
        w = np.array([1, 1])      #@w
        w @ x      # 3: one answer   #@one
        W = np.array([[1, 1],     #@W
                      [-1, 2],    #@W
                      [-1, -1]])  #@W
        W @ x      # [3, 0, -3]   #@all
      `,
      beats: [
        { id: 'x', say: 'Here is a vector, x: two across and one up, an arrow on the plane.', code: 'x' },
        { id: 'one', say: 'A dot product asks it one question: how much does x agree with a weight vector, w? Say w is one and one: the answer is three.', code: ['w', 'one'] },
        { id: 'more', say: 'One answer is rarely enough. Bring two more weight vectors, and the same x gives two more answers.', code: 'W' },
        { id: 'agree', say: 'The second, minus one and two, meets x at a right angle, so its answer is zero. The third, minus one and minus one, points away from x: minus three.', code: 'W' },
        { id: 'W', say: 'Now stack the three weight vectors as the rows of one matrix, W: one row per question. W is three by two.', code: 'W' },
        { id: 'Wx', say: 'Stack the three answers the same way, and they make a new vector: three, zero, minus three. That is W times x, written {Wx|W x}, the two side by side.', code: 'all' },
        { id: 'turns', say: 'So a matrix turns one vector into another. Two numbers go in and three come out, each one how much x agrees with a row.', code: 'all' },
        { id: 'cayley', say: 'In {1858|eighteen fifty eight}, Arthur Cayley wrote that the idea of a matrix arises naturally from exactly this: a set of equations, each new number a weighted sum of the old ones, written in short: the weights as one grid, beside the list of old numbers.', code: 'all' },
      ],
    },
    {
      id: 'rows',
      title: 'Row by row',
      codeTitle: 'rows.py',
      code: `
        W = np.array([[1, 2, 0],    #@W
                      [3, -1, 2]])  #@W
        x = np.array([2, 1, 3])     #@x
        W[0] * x   # [2, 2, 0]      #@pair
        W[0] @ x   # 4: entry 0     #@r0
        W[1] @ x   # 11: entry 1    #@r1
        W @ x      # [4, 11]        #@all
        # a column: 2 long, x: 3    #@col
      `,
      beats: [
        { id: 'setup', say: 'Now a W with two rows of three, and an x of three entries, one above each column. Three entries take x out of the page, but the recipe never needed the picture.', code: ['W', 'x'] },
        { id: 'pair', say: 'Entry zero of W x is row zero\'s answer. Pair row zero with x, entry by entry, and multiply: one times two, two times one, and zero times three.', code: 'pair' },
        { id: 'r0', say: 'Add them up: two, plus two, plus zero, is four. That is entry zero.', code: 'r0' },
        { id: 'r1', say: 'Row one gives entry one: six, minus one, and six make eleven.', code: 'r1' },
        { id: 'all', say: 'So W x is four and eleven. Entry i always comes from row i, both counted from zero.', code: 'all' },
        { id: 'col', say: 'Never from a column. A column of W holds one number per row, two of them here, and x has three: they do not even line up.', code: 'col' },
      ],
    },
    {
      id: 'shapes',
      title: 'What fits, and what comes out',
      codeTitle: 'shapes.py',
      code: `
        W.shape      # (2, 3)            #@W
        x.shape      # (3,): 3 columns   #@match
        (W @ x).shape  # (2,): 2 rows    #@out
        # (10, 3072) @ (3072,) -> (10,)  #@big
        W @ np.array([2, 1])  # error    #@fail
      `,
      beats: [
        { id: 'match', say: 'Every row is dotted with x, and a dot product pairs entries one to one. So x needs one entry per column of W: three.', code: ['W', 'match'] },
        { id: 'out', say: 'And there is one dot product per row, so W x has one entry per row: two. A two by three matrix turns three numbers into two.', code: 'out' },
        { id: 'at', say: 'In code, the product is {W @ x|W at x}, with the at sign of the dot product.', code: 'out' },
        { id: 'rule', say: 'In shapes: {(2, 3) @ (3,) → (2,)|two by three, at three, gives two}, the arrow pointing to what comes out. The three of x meets the three columns, and the two rows set the length of the answer.', code: ['W', 'match', 'out'] },
        { id: 'big', say: 'The sizes can be anything. A ten by {3,072|three thousand and seventy two} W asks an image of {3,072|three thousand and seventy two} numbers ten questions, and turns it into ten numbers.', code: 'big' },
        { id: 'fail', say: 'Give it an x of the wrong length, and the last column of W has no partner: the product is not defined, and NumPy refuses.', code: 'fail' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
