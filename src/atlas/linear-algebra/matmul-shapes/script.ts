import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-shapes',
  title: 'Matmul shapes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Cayley', year: 1858, title: 'A Memoir on the Theory of Matrices', url: 'https://doi.org/10.1098/rstl.1858.0002', scene: 'chain' },
  ],
  scenes: [
    {
      id: 'columns',
      title: 'Many vectors at once',
      codeTitle: 'matmul.py',
      code: `
        A = np.ones((2, 3))           #@A
        v = np.ones(3)                #@v
        (A @ v).shape   # (2,)        #@v
        B = np.ones((3, 4))           #@B
        A @ B[:, 0]  # AB's column 0  #@col
        (A @ B).shape   # (2, 4)      #@AB
        # (m, n) @ (n, k) -> (m, k)   #@rule
      `,
      beats: [
        { id: 'many', say: 'Say you have one matrix, A, two by three, and four vectors of three numbers each, all to go through it.', code: 'A' },
        { id: 'one', say: 'One at a time, that is four matrix-vector products, and each one turns three numbers into two.', code: 'v' },
        { id: 'stand', say: 'Stand the four vectors side by side, and they make a single matrix, B: three rows, and four columns, one per vector.', code: 'B' },
        { id: 'AB', say: 'Multiplying A by B, written {AB|A B}, does all four at once. A times each column of B gives the same column of the result.', code: 'col' },
        { id: 'shape', say: 'Four answers of two numbers each: the result is two by four.', code: 'AB' },
        { id: 'fit', say: 'Each column of B goes into A, so it must be as long as a row of A. A\'s columns must equal B\'s rows: here, three and three.', code: ['A', 'B'] },
        { id: 'inner', say: 'Written as shapes, two by three, times three by four, the threes sit in the middle: they are the inner dimensions.', code: 'AB' },
        { id: 'outer', say: 'The result keeps the outer ones: two rows from A, and four columns from B.', code: 'AB' },
        { id: 'm', say: 'For any sizes, call A\'s rows m.', code: 'rule' },
        { id: 'n', say: 'Call the inner dimension, where A and B meet, n.', code: 'rule' },
        { id: 'k', say: 'And call B\'s columns k.', code: 'rule' },
        { id: 'rule', say: 'Then m by n, times n by k, gives m by k. The two inner sizes, both n, must match, and they vanish from the result.', code: 'rule' },
      ],
    },
    {
      id: 'chain',
      title: 'One after another',
      codeTitle: 'chain.py',
      code: `
        v = np.ones(4)                #@v
        B @ v        # 4 numbers -> 3 #@B
        A @ (B @ v)  # 3 -> 2         #@A
        (A @ B) @ v  # 4 -> 2 at once #@AB
        C = np.ones((4, 5))           #@C
        (A @ B @ C).shape  # (2, 5)   #@ABC
      `,
      beats: [
        { id: 'turn', say: 'Here is a second way to see it. A matrix turns one vector into another: B, three by four, turns four numbers into three.', code: ['v', 'B'] },
        { id: 'then', say: 'Then A, two by three, turns those three into two.', code: 'A' },
        { id: 'handoff', say: 'The hand-off is the rule: what B gives out must be as long as what A takes in. B\'s rows must equal A\'s columns.', code: 'A' },
        { id: 'cayley', say: 'That is how Arthur Cayley defined the product of two matrices, in {1858|eighteen fifty eight}, in his Memoir on the Theory of Matrices: one applied after the other, combined into a single matrix.', code: 'AB' },
        { id: 'rect', say: 'He gave the shape rule too: the second matrix needs as many rows as the first has columns.', code: 'AB' },
        { id: 'once', say: 'So {AB|A B}, two by four, does both steps at once: four numbers straight to two. The three in the middle is used up inside, which is why the inner dimension vanishes.', code: 'AB' },
        { id: 'C', say: 'A longer chain works the same way. Put a third matrix, C, four by five, on the right: it turns five numbers into the four that B takes.', code: 'C' },
        { id: 'ABC', say: 'Combine two at a time: {AB|A B} is two by four, and two by four, times four by five, gives two by five.', code: 'ABC' },
      ],
    },
    {
      id: 'order',
      title: 'Order matters',
      codeTitle: 'order.py',
      code: `
        B @ A   # error: 4 vs 2       #@swap
        M = np.ones((2, 4))           #@M
        A @ M   # error: 3 vs 2       #@M
        A.T.shape   # (3, 2)          #@T
        (A.T @ M).shape   # (3, 4)    #@fix
        (M.T @ A).shape   # (4, 3)    #@flip
      `,
      beats: [
        { id: 'swap', say: 'Order matters. Swap them, B times A, and a row of B has four numbers, while a column of A has only two. Nothing pairs up, so there is no product.', code: 'swap' },
        { id: 'M', say: 'Now take A and a new matrix, M, two by four. A times M fails too: A\'s rows have three numbers, and M\'s columns have two.', code: 'M' },
        { id: 'T', say: 'Transpose A, turning its rows into columns: {A.T|A transpose} is three by two.', code: 'T' },
        { id: 'fix', say: 'Now its rows have two numbers, like M\'s columns. Three by two, times two by four, gives three by four.', code: 'fix' },
        { id: 'flip', say: '{M.T|M transpose} times A works too, but gives four by three. The rows come from the first matrix and the columns from the second, so the order sets the shape.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
