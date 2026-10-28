import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-comp-graph',
  title: 'Computational graphs',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'R. E. Wengert', year: 1964, title: 'A simple automatic derivative evaluation program', url: 'https://doi.org/10.1145/355586.364791', scene: 'steps' },
  ],
  scenes: [
    {
      id: 'steps',
      title: 'From a chain to steps',
      codeTitle: 'steps.py',
      code: `
        u = 3 * x + 1    # inside      #@u
        u ** 2           # outside     #@sq
        # f = (x * z + c) ** 2         #@f
        q = x * z        # step 1      #@q
        r = q + c        # step 2      #@r
        f = r ** 2       # step 3      #@last
      `,
      beats: [
        { id: 'chain', say: 'In the chain rule, x fed one simple function, and its output, u, fed the next. Each link was simple, with a slope you knew.', code: ['u', 'sq'] },
        { id: 'more', say: 'Most formulas are not one straight chain. This one takes three inputs, x, z and c, and their paths join.', code: 'f' },
        { id: 'wengert', say: 'In 1964, R. E. Wengert, at General Electric, showed how a computer can take any formula apart: into a series of elementary steps, each a single simple operation.', code: 'f' },
        { id: 'list', say: 'Here, the steps are: multiply x by z, and call it q. Add c to q, and call that r. Square r, and that is f.', code: ['q', 'r', 'last'] },
        { id: 'why', say: 'Then nothing is handled all at once: each step is simple enough to compute, and to find the slope of, on its own.', code: ['q', 'r', 'last'] },
      ],
    },
    {
      id: 'graph',
      title: 'Steps as a graph',
      codeTitle: 'graph.py',
      code: `
        # f = (x * z + c) ** 2   #@f
        q = x * z                #@mul
        r = q + c                #@add
        f = r ** 2               #@sq
      `,
      beats: [
        { id: 'mul', say: 'Now draw the steps. The multiply becomes a circle, called a node, with x and z coming in along wires, and q going out.', code: 'mul' },
        { id: 'add', say: 'q travels along a wire into an add node, which also takes c, and sends out r.', code: 'add' },
        { id: 'sq', say: 'And a square node turns r into f, the output.', code: 'sq' },
        { id: 'name', say: 'Nodes joined by wires make a graph: not a plotted curve, but dots joined by lines. This one computes, so it is called a computational graph.', code: ['mul', 'add', 'sq'] },
        { id: 'count', say: 'One node per operation: three operations, three nodes. A formula that added twice would get two add nodes.', code: ['mul', 'add', 'sq'] },
        { id: 'ends', say: 'The inputs are not nodes: they are where values come in. And f is just what the last node sends out.', code: 'f' },
      ],
    },
    {
      id: 'forward',
      title: 'Run it forward',
      codeTitle: 'forward.py',
      code: `
        x, z, c = {{xv:2}}, 3, -4    #@in
        q = x * z   # {{qv:6}}       #@mul
        r = q + c   # {{rv:2}}       #@add
        f = r ** 2  # {{fv:4}}       #@sq
      `,
      beats: [
        { id: 'inputs', say: 'To evaluate the graph, give the inputs values: x is two, z is three, and c is minus four.', code: 'in' },
        { id: 'mul', say: 'Values flow forward, from the inputs toward the output. The multiply gives two times three: six.', code: 'mul' },
        { id: 'add', say: 'The add gives six plus minus four: two. It never sees x or z, only q, the one value the multiply sent.', code: 'add' },
        { id: 'sq', say: 'And the square gives two squared: four. So f is four.', code: 'sq' },
        { id: 'ready', say: 'The order is forced. A node can run only once every value it needs has arrived, so the add waits for the multiply, and the square waits for the add.', code: ['mul', 'add', 'sq'] },
        { id: 'pass', say: 'One trip through the nodes in that order, inputs to output, is called the forward pass.', code: ['mul', 'add', 'sq'] },
        { id: 'again', say: 'Change x to three, and run the forward pass again. Every value that depends on x changes, and f becomes twenty five.', code: ['in', 'mul', 'add', 'sq'] },
      ],
    },
    {
      id: 'more',
      title: 'Max, exp, and a shared input',
      codeTitle: 'more.py',
      code: `
        x, z = 1, -2                #@in
        m = np.maximum(x, z)  # 1   #@max
        e = np.exp(m)       # 2.72  #@exp
        f = e * z          # -5.44  #@mul
      `,
      beats: [
        { id: 'max', say: 'Two more kinds of node. A max node passes on the larger of its inputs, written {max(x, z)|max of x and z}: the max of one and minus two is one.', code: ['in', 'max'] },
        { id: 'exp', say: '{An exp node|An exponential node} raises e to its input: e to the one is about {2.72|two point seven two}.', code: 'exp' },
        { id: 'share', say: 'And one input can feed two nodes: z goes into the max, and also into the multiply at the end. Two wires, but still no node of its own.', code: ['max', 'mul'] },
        { id: 'mul', say: 'The multiply gives {2.72|two point seven two} times minus two: about minus {5.44|five point four four}.', code: 'mul' },
        { id: 'pieces', say: 'Add, multiply, max, exp and square: from a handful of pieces like these, every formula here is built.', code: ['max', 'exp', 'mul'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
