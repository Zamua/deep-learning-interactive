import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-convolution',
  title: 'Convolution',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'slide',
      title: 'Slide and take a dot product',
      codeTitle: 'conv1d.py',
      code: `
        x = np.array([1, 2, 4, 4, 1])            #@x
        w = np.array([-1, 0, 1])                 #@w
        out = [x[i:i+3] @ w for i in range(3)]   #@slide
        # [3, 2, -3]                             #@out
      `,
      beats: [
        { id: 'row', say: 'Here is a row of five numbers, x, and a filter of three weights, w: minus one, zero and one.', code: ['x', 'w'] },
        { id: 'first', say: 'Lay the filter over the first three entries. Multiply each pair and add: minus one, plus zero, plus four. That is three, the first output.', code: 'slide' },
        { id: 'step', say: 'Now slide the filter one step to the right and do the same: minus two, plus zero, plus four. Two.', code: 'slide' },
        { id: 'last', say: 'One more step gives minus four plus one, minus three. Then the filter runs out of room: five inputs, three outputs.', code: 'out' },
        { id: 'dot', say: 'Each output is a dot product between the filter and the window under it, and the same three weights are used at every position.', code: 'slide' },
      ],
    },
    {
      id: 'edges',
      title: 'A filter is a detector',
      codeTitle: 'edges.py',
      code: `
        w = np.array([-1, 0, 1])                 #@w
        x = np.array([1, 1, 1, 6, 6, 6, 2])      #@x
        out = [x[i:i+3] @ w for i in range(5)]   #@slide
        # [0, 5, 5, 0, -4]                       #@out
        w2 = np.array([1, 1, 1])                 #@sum
        [x[i:i+3] @ w2 for i in range(5)]        #@sum
        # [3, 8, 13, 18, 14]                     #@sum
      `,
      beats: [
        { id: 'diff', say: 'This filter takes the last entry of each window minus the first: how much the input changes across it.', code: 'w' },
        { id: 'step', say: 'Slide it along a row of pixel brightnesses that jumps from one up to six. Where the row climbs, the output is five.', code: ['x', 'slide'] },
        { id: 'flat', say: 'Where the row is flat, the minus one and the plus one cancel, giving zero. Where it falls, the output goes negative.', code: 'out' },
        { id: 'detect', say: 'So this filter is an edge detector. Any filter answers most strongly where the input looks like the filter itself.', code: 'w' },
        { id: 'sum', say: 'A filter of all ones, one, one, one, looks like an even patch, and it just adds up each window: three, eight, thirteen, eighteen and fourteen. It peaks where the row is brightest, not at the edge.', code: 'sum' },
      ],
    },
    {
      id: 'grid',
      title: 'In two dimensions',
      codeTitle: 'conv2d.py',
      code: `
        x = np.array([[1, 2, 0, 1],              #@x
                      [0, 1, 3, 1],              #@x
                      [2, 1, 0, 2],              #@x
                      [1, 0, 1, 3]])             #@x
        w = np.eye(3)        # ones on the diagonal  #@w
        out = np.zeros((2, 2))                   #@conv
        for i in range(2):                       #@conv
            for j in range(2):                   #@conv
                win = x[i:i+3, j:j+3]            #@conv
                out[i, j] = (win * w).sum()      #@conv
        # out[0, 1]: x[0:3, 1:4], 2 + 3 + 2 = 7  #@step
        # [[2, 7], [2, 4]]                       #@out
      `,
      beats: [
        { id: 'image', say: 'An image is a grid, so its filter is a grid too: here three by three, with ones on the diagonal and zeros elsewhere.', code: ['x', 'w'] },
        { id: 'patch', say: 'Lay it on the top left three by three patch, multiply all nine pairs, and add. Only the diagonal counts: one, plus one, plus zero. Two.', code: 'conv' },
        { id: 'step', say: 'Now slide it one step to the right. Output row zero, column one uses the patch one column over: rows zero to two, columns one to three. Its diagonal is two, plus three, plus two: seven.', code: 'step' },
        { id: 'rule', say: 'In general, call the output\'s row number i and its column number j. Output i, j comes from the patch that starts i rows down and j columns across: rows i to i plus two, columns j to j plus two.', code: 'conv' },
        { id: 'rest', say: 'One row down, the last two patches give two and four. So a four by four image gives a two by two output: two, seven, two and four.', code: ['conv', 'out'] },
        { id: 'map', say: 'The output is a map of how well each patch matches the filter. Seven marks the brightest diagonal line in the image.', code: 'out' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
