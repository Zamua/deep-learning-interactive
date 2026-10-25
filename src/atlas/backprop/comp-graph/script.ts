import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-comp-graph',
  title: 'Computational graphs',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'graph',
      title: 'A formula as a graph',
      codeTitle: 'graph.py',
      code: `
        # f = (x * z + c) ** 2   #@f
        q = x * z                #@mul
        r = q + c                #@add
        f = r ** 2               #@sq
      `,
      beats: [
        { id: 'formula', say: 'Take a formula: x times z, plus c, all squared. A computational graph breaks it into simple operations, one node each.', code: 'f' },
        { id: 'mul', say: 'First, a multiply node. It takes x and z, and sends out their product. Call it q.', code: 'mul' },
        { id: 'add', say: 'A wire carries q into an add node, which adds c. Call that r.', code: 'add' },
        { id: 'sq', say: 'Then a square node turns r into f, the output. Three operations, three nodes.', code: 'sq' },
        { id: 'pieces', say: 'Any formula breaks down into a handful of such pieces: add, multiply, max, e to the x, and square.', code: ['mul', 'add', 'sq'] },
      ],
    },
    {
      id: 'forward',
      title: 'Evaluate it forward',
      codeTitle: 'forward.py',
      code: `
        x, z, c = 2, 3, -4    #@in
        q = x * z   # 6       #@mul
        r = q + c   # 2       #@add
        f = r ** 2  # 4       #@sq
      `,
      beats: [
        { id: 'inputs', say: 'To evaluate the graph, give the inputs values: x is two, z is three, and c is minus four.', code: 'in' },
        { id: 'mul', say: 'Values flow forward, from the inputs toward the output. The multiply gives two times three: six.', code: 'mul' },
        { id: 'add', say: 'The add gives six plus minus four: two.', code: 'add' },
        { id: 'sq', say: 'And the square gives two squared, four. So f is four.', code: 'sq' },
        { id: 'ready', say: 'The order is forced. A node can run only once every value it needs has arrived, so the add waits for the multiply, and the square waits for the add.', code: ['mul', 'add', 'sq'] },
      ],
    },
    {
      id: 'more',
      title: 'Max and exp',
      codeTitle: 'more.py',
      code: `
        x, z = 1, -2                #@in
        m = np.maximum(x, z)  # 1   #@max
        e = np.exp(m)       # 2.72  #@exp
        f = e * z          # -5.44  #@mul
      `,
      beats: [
        { id: 'max', say: 'The other pieces work the same way. A max node passes on the larger of its inputs, written {max(x, z)|max of x and z}: the max of one and minus two is one.', code: ['in', 'max'] },
        { id: 'exp', say: 'An exp node raises e to its input. e to the one is about {2.72|two point seven two}.', code: 'exp' },
        { id: 'mul', say: 'And z feeds a second node too: the multiply. {2.72|Two point seven two} times minus two is about minus {5.44|five point four four}.', code: 'mul' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
