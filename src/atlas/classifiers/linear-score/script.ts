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
        x = np.array([2, 4])  # a ship       #@x
        w = np.array([1, 1])  # turns it     #@w
        b = -4                # slides it    #@b
        w @ x + b    # 2 + 4 - 4 = 2: ship   #@s
        # the line: w @ x + b == 0           #@line
      `,
      beats: [
        { id: 'points', say: 'Describe each image by two numbers, called its features: say, how much blue it has, and how many straight edges. Then every image is a point on a graph. Cats land low and to the left; ships, with sea and masts, up and to the right.', code: 'x' },
        { id: 'line', say: 'Telling them apart means drawing a line between them. You know a line from school as {y = mx + b|y equals m x plus b}: m tilts it, and b slides it.', code: 'line' },
        { id: 'rewrite', say: 'Here both directions are features, so the same line is written another way: every point x where w dot x, plus b, is zero. The weights, w, do what m did, and b is the same b.', code: 'line' },
        { id: 'rotate', say: 'Change the weights in w, and the line turns.', code: 'w' },
        { id: 'slide', say: 'Change b, and it slides without turning. Set b to zero, and the line is pinned to the corner where both features are zero: no line through there splits these. b moves it out between them.', code: 'b' },
        { id: 'side', say: 'Plug a point in, and w dot x plus b is its score. A ship at two, four: two plus four, minus four, is two. A cat at one, one scores minus two. Positive on one side, negative on the other, and bigger the farther from the line.', code: 's' },
        { id: 'linear', say: 'Features times weights, added up, plus b: a straight line. That is why this is called a linear classifier.', code: ['w', 'b'] },
      ],
    },
    {
      id: 'classes',
      title: 'Three classes',
      codeTitle: 'classes.py',
      code: `
        classes = ['cat', 'plane', 'ship']   #@three
        # each class: its own w and b        #@regions
        x = np.array([2, 1])                 #@x
      `,
      beats: [
        { id: 'three', say: 'Add a third class: planes, with lots of blue sky and few edges. Now there are three groups on the same graph.', code: 'three' },
        { id: 'regions', say: 'Each class gets its own weights and bias, so its own score. Score every spot with all three, and let the highest win. The graph splits into three regions, one per class, with straight borders.', code: 'regions' },
        { id: 'x', say: 'Now an input, x: two and one, a little blue and few edges. It lands in the cats\' region, so the classifier will say cat.', code: 'x' },
      ],
    },
    {
      id: 'rows',
      title: 'One row per class',
      codeTitle: 'scores.py',
      code: `
        x = np.array([2, 1])          #@x
        W = np.array([[1, 1],    # cat    #@W
                      [4, 2],    # plane  #@W
                      [2, 4]])   # ship   #@W
        W[0] @ x     # 1*2 + 1*1 = 3      #@row
        W @ x        # [3, 10, 8]         #@all
      `,
      beats: [
        { id: 'W', say: 'To score x with all three at once, stack the three classes\' weights as rows of a matrix, W: one row per class, one column per feature.', code: 'W' },
        { id: 'row', say: 'Each class scores the input with its own row. Cat\'s row is one and one. Dot it with x: one times two, plus one times one, is three.', code: 'row' },
        { id: 'all', say: 'Plane\'s row gives ten, and ship\'s gives eight. That is all W times x does: one dot product per row.', code: 'all' },
        { id: 'col', say: 'Always a row, never a column. A column holds one weight per class, three of them here, so it does not even line up with the two features.', code: 'W' },
      ],
    },
    {
      id: 'bias',
      title: 'Then add the bias',
      codeTitle: 'scores.py',
      code: `
        b = np.array([-1, -10, -10])      #@b
        s = W @ x + b    # [2, 0, -2]     #@s
        s.max()          # 2: cat         #@pred
        W @ x            # [3, 10, 8]     #@nob
        W @ np.zeros(2) + b   # = b       #@zero
      `,
      beats: [
        { id: 'b', say: 'Then each class adds its bias, b, one number per class: minus one, minus ten, and minus ten.', code: 'b' },
        { id: 's', say: 'The scores, {s = Wx + b|s equals W x plus b}, come out two, zero and minus two. Cat scores highest, so the classifier says cat: the region x landed in.', code: ['s', 'pred'] },
        { id: 'forget', say: 'Leave the bias out, and plane wins instead, with ten. The bias is part of the score, not an afterthought.', code: 'nob' },
        { id: 'zero', say: 'Set x to all zeros, and W times x vanishes. The scores are exactly b: each class\'s lean before it sees any evidence.', code: 'zero' },
        { id: 'name', say: 'That lean gives the bias its name: it tilts a class\'s score up or down before any evidence, the way a bias tilts a judgment.', code: 'zero' },
        { id: 'why', say: 'It is the same b that slid the line. Without it, an input of all zeros would score zero for every class, so every class would start level. With it, a class that turns up often, like cat, can start ahead.', code: 'zero' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
