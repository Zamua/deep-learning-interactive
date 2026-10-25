import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-score',
  title: 'Linear scores',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'rows',
      title: 'One row per class',
      codeTitle: 'scores.py',
      code: `
        x = np.array([2, 1])          #@x
        W = np.array([[ 1, 2],   # cat    #@W
                      [-1, 3],   # dog    #@W
                      [ 2, 1]])  # ship   #@W
        W[0] @ x     # 1*2 + 2*1 = 4      #@row
        W @ x        # [4, 1, 5]          #@all
      `,
      beats: [
        { id: 'x', say: 'An input arrives as a vector, x. This one has two features: two and one.', code: 'x' },
        { id: 'W', say: 'A linear classifier keeps a matrix of weights, W, with one row per class and one column per feature. Three classes, cat, dog and ship, make three rows of two.', code: 'W' },
        { id: 'row', say: 'Each class scores the input with its own row. Cat\'s row is one and two. Dot it with x: one times two, plus two times one, is four.', code: 'row' },
        { id: 'all', say: 'Dog\'s row gives one, and ship\'s gives five. That is all W times x does: one dot product per row.', code: 'all' },
        { id: 'col', say: 'Always a row, never a column. A column holds one weight per class, three of them here, so it does not even line up with the two features.', code: 'W' },
      ],
    },
    {
      id: 'bias',
      title: 'Then add the bias',
      codeTitle: 'scores.py',
      code: `
        b = np.array([1, 0, -2])            #@b
        s = W @ x + b    # [5, 1, 3]        #@s
        s.argmax()       # 0, cat           #@pred
        W @ x            # [4, 1, 5]: ship  #@nob
        W @ np.zeros(2) + b   # [1, 0, -2]  #@zero
      `,
      beats: [
        { id: 'b', say: 'Then each class adds its bias, one number per class: one, zero, and minus two.', code: 'b' },
        { id: 's', say: 'The scores come out five, one and three. Cat scores highest, so the classifier says cat.', code: ['s', 'pred'] },
        { id: 'forget', say: 'Leave the bias out, and ship wins instead, with five. The bias is part of the score, not an afterthought.', code: 'nob' },
        { id: 'zero', say: 'Set x to all zeros, and W times x vanishes. The scores are exactly b: each class\'s lean before it sees any evidence.', code: 'zero' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        W = np.array([[ 2, 0, 1],
                      [-1, 3, 2]])
        x = np.array([2, 1, -1])
        b = np.array([1, -2])
        W[0] @ x + b[0]   # 3 + 1 = 4      #@r0
        W[1] @ x + b[1]   # -1 - 2 = -3    #@r1
        W @ x + b         # [4, -3]        #@s
      `,
      beats: [
        { id: 'ask', say: 'Your turn. W has two rows of three. x is two, one, and minus one, and b is one and minus two. What are the scores?' },
        { id: 'r0', say: 'Class zero: two times two, plus zero times one, plus one times minus one, is three. Add its bias, one, and it scores four.', code: 'r0' },
        { id: 'r1', say: 'Class one: minus two, plus three, plus two times minus one, is minus one. Add its bias, minus two, and it scores minus three.', code: 'r1' },
        { id: 's', say: 'So the scores are four and minus three, one per class, in order.', code: 's' },
      ],
    },
  ],
};
