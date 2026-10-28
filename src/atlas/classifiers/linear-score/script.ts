import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-score',
  title: 'Linear scores',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'line',
      title: 'Draw a line',
      codeTitle: 'line.py',
      code: `
        x = np.array([3, 3])  # a ship       #@x
        w = np.array([1, 1])  # turns it     #@w
        b = -4                # slides it    #@b
        w @ x + b    # 3 + 3 - 4 = 2: ship   #@s
        # the line: w @ x + b == 0           #@line
      `,
      beats: [
        { id: 'points', say: 'Boil each image down to two numbers, two features, and every image becomes a point on a graph. The cats land low and to the left, the ships up and to the right.', code: 'x' },
        { id: 'line', say: 'Telling them apart means drawing a line between them. You know a line from school as {y = mx + b|y equals m x plus b}: m tilts it, and b slides it.', code: 'line' },
        { id: 'rewrite', say: 'Here both directions are features, so the same line is written another way: every point x where w dot x, plus b, is zero. The weights, w, do what m did, and b is the same b.', code: 'line' },
        { id: 'rotate', say: 'Change the weights in w, and the line turns.', code: 'w' },
        { id: 'slide', say: 'Change b, and it slides without turning. Set b to zero, and the line is pinned to the corner where both features are zero: no line through there splits these. b moves it out between them.', code: 'b' },
        { id: 'side', say: 'Plug a point in, and w dot x plus b is its score. A ship at three, three: three plus three, minus four, is two. A cat at one, one scores minus two. Positive on one side, negative on the other, and bigger the farther from the line.', code: 's' },
        { id: 'linear', say: 'Features times weights, added up, plus b: a straight line. That is why this is called a linear classifier.', code: ['w', 'b'] },
      ],
    },
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
        { id: 'x', say: 'Now three classes, cat, dog and ship, and an input x with features two and one.', code: 'x' },
        { id: 'W', say: 'Each class gets its own line: its own weights, and its own bias. Stack the weights as rows, and they make a matrix, W: one row per class, one column per feature.', code: 'W' },
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
        s.max()          # 5: cat           #@pred
        W @ x            # [4, 1, 5]: ship  #@nob
        W @ np.zeros(2) + b   # [1, 0, -2]  #@zero
      `,
      beats: [
        { id: 'b', say: 'Then each class adds its bias, b, one number per class: one, zero, and minus two.', code: 'b' },
        { id: 's', say: 'The scores, {s = Wx + b|s equals W x plus b}, come out five, one and three. Cat scores highest, so the classifier says cat.', code: ['s', 'pred'] },
        { id: 'forget', say: 'Leave the bias out, and ship wins instead, with five. The bias is part of the score, not an afterthought.', code: 'nob' },
        { id: 'zero', say: 'Set x to all zeros, and W times x vanishes. The scores are exactly b: each class\'s lean before it sees any evidence.', code: 'zero' },
        { id: 'name', say: 'That lean gives the bias its name: it tilts a class\'s score up or down before any evidence, the way a bias tilts a judgment.', code: 'zero' },
        { id: 'why', say: 'It is the same b that slid the line. Without it, an input of all zeros would score zero for every class, so every class would start level. With it, a class that turns up often, like cat, can start ahead.', code: 'zero' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
