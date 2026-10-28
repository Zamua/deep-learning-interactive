import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-convolution',
  title: 'Convolution',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hubel & Wiesel', year: 1959, title: 'Receptive fields of single neurones in the cat\'s striate cortex', url: 'https://doi.org/10.1113/jphysiol.1959.sp006308', scene: 'edge' },
    { who: 'Fukushima', year: 1980, title: 'Neocognitron: a self-organizing neural network model for a mechanism of pattern recognition unaffected by shift in position', url: 'https://doi.org/10.1007/BF00344251', scene: 'edge' },
  ],
  scenes: [
    {
      id: 'edge',
      title: 'Finding an edge',
      codeTitle: 'edges.py',
      code: `
        x = np.array([1, 1, 1, 6, 6, 6, 2])  #@x
        w = np.array([-1, 0, 1])  # edge     #@w
        x[0:3] @ w    # -1 + 0 + 1 = 0       #@first
        out = [x[i:i+3] @ w for i in range(5)]  #@slide
        # [0, 5, 5, 0, -4]                   #@out
        w2 = np.ones(3)    # [1, 1, 1]       #@sum
        [x[i:i+3] @ w2 for i in range(5)]    #@sum
        # [3, 8, 13, 18, 14]                 #@sum
      `,
      beats: [
        { id: 'problem', say: 'Where are the edges in a picture? An edge is where the brightness jumps, like where a dark roof meets a bright sky. It could be anywhere, so whatever finds it must look everywhere.', code: 'x' },
        { id: 'row', say: 'Take one row of pixels and write each brightness as a number. That row is x. It reads one, one, one in the dark part, six, six, six in the bright part, then two.', code: 'x' },
        { id: 'cells', say: 'In 1959, David Hubel and Torsten Wiesel found cells in a cat\'s brain that each answer to an edge at one angle, in one small patch of what the cat sees.', code: 'x' },
        { id: 'machine', say: 'In 1980, Kunihiko Fukushima turned that into a computer model, the neocognitron: one small detector, copied to every position.', code: 'slide' },
        { id: 'filter', say: 'So make one small detector: three weights, w, minus one, zero and one. It is called a filter: like a filter for light or sound, it lets one kind of pattern through and holds back the rest.', code: 'w' },
        { id: 'diff', say: 'On the patch under it, multiply each brightness by its weight and add: a dot product. Here, that is the last pixel minus the first: how much the row climbs across the patch.', code: 'first' },
        { id: 'climb', say: 'Slide the filter along one pixel at a time. Where the row climbs, one then six, the output is five.', code: 'slide' },
        { id: 'flat', say: 'Where the row is flat, the minus one and the plus one cancel, so the output is zero. Where it falls, the output goes negative: minus four.', code: 'out' },
        { id: 'agree', say: 'So the output is largest where the patch looks like the filter, low then high: where the two agree most. Flip its signs, making it one, zero, minus one, and the same slide finds the falls instead.', code: 'w' },
        { id: 'sum', say: 'A filter of all ones looks like an even patch. It just adds each patch up, three, eight, thirteen, eighteen and fourteen, so it peaks where the row is brightest, not at the edge.', code: 'sum' },
      ],
    },
    {
      id: 'slide',
      title: 'Slide, multiply, add',
      codeTitle: 'conv1d.py',
      code: `
        x = np.array([1, 2, 5, 2, 3])        #@x
        w = np.array([-1, 2, -1])  # bump    #@w
        x[0:3] @ w   # -1 + 4 - 5 = -2       #@first
        x[1:4] @ w   # -2 + 10 - 2 = 6       #@step
        x[2:5] @ w   # -5 + 4 - 3 = -4       #@last
        # 5 inputs, 3 outputs: [-2, 6, -4]   #@out
      `,
      beats: [
        { id: 'spot', say: 'Now a filter shaped like a bump: minus one, two, minus one, high in the middle and low on both sides. It should answer to a bright spot, like the five in this row.', code: ['x', 'w'] },
        { id: 'first', say: 'Lay it on the first three entries, its first weight on the first entry. Multiply each pair and add: minus one, plus four, minus five. Minus two. That is output zero.', code: 'first' },
        { id: 'step', say: 'Slide one step and do the same: minus two, plus ten, minus two. Six, output one, the largest, right on the spot.', code: 'step' },
        { id: 'last', say: 'One more step: minus five, plus four, minus three, which is minus four. Then the filter runs out of room: five inputs give three outputs, numbered zero, one and two.', code: ['last', 'out'] },
        { id: 'name', say: 'Sliding one filter along and taking a dot product at every stop is a convolution, from the Latin for rolling together: the filter rolls along its input.', code: 'out' },
        { id: 'flip', say: 'In mathematics, a convolution flips the filter around first. Libraries such as PyTorch slide it as it is, first weight on the first entry, just as here.', code: 'first' },
      ],
    },
    {
      id: 'grid',
      title: 'In two dimensions',
      codeTitle: 'conv2d.py',
      code: `
        x = np.array([[1, 3, 0, 1],          #@x
                      [0, 1, 3, 0],          #@x
                      [2, 0, 1, 3],          #@x
                      [1, 2, 0, 1]])         #@x
        w = np.eye(3)     # a diagonal line  #@w
        win = x[0:3, 1:4]  # row 0, col 1    #@step
        (win * w).sum()    # 3 + 3 + 3 = 9   #@step
        out = np.zeros((2, 2))               #@conv
        for i in range(2):                   #@conv
            for j in range(2):               #@conv
                win = x[i:i+3, j:j+3]        #@conv
                out[i, j] = (win * w).sum()  #@conv
        # [[3, 9], [0, 3]]                   #@out
      `,
      beats: [
        { id: 'image', say: 'An image is a grid of pixels, so its filter is a grid too. This tiny image, four by four, has a bright diagonal line across it.', code: 'x' },
        { id: 'w', say: 'The filter is three by three, with ones on its diagonal and zeros elsewhere: it looks like a diagonal line.', code: 'w' },
        { id: 'patch', say: 'Lay it on the top left patch. Multiply all nine pairs and add: the zeros drop out, so only the diagonal counts. One, plus one, plus one: three.', code: 'conv' },
        { id: 'step', say: 'Slide it one column right, and its diagonal lands on the line: three, plus three, plus three. Nine.', code: 'step' },
        { id: 'index', say: 'That is output row zero, column one, because its patch starts zero rows down and one column across. An output\'s row and column say where its patch starts.', code: 'step' },
        { id: 'rest', say: 'One row down, the last two patches give zero and three. So a four by four image gives a two by two output.', code: ['conv', 'out'] },
        { id: 'map', say: 'The output is a map of where the image looks like the filter, and the nine marks the line.', code: 'out' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
