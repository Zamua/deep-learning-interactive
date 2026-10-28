import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-backprop-graph',
  title: 'Backprop on a graph',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Linnainmaa', year: 1976, title: 'Taylor expansion of the accumulated rounding error', url: 'https://doi.org/10.1007/BF01931367', scene: 'ask' },
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning representations by back-propagating errors', url: 'https://doi.org/10.1038/323533a0', scene: 'ask' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'Every slope at once',
      codeTitle: 'ask.py',
      code: `
        x, z, c = 2, 3, -4             #@in
        f = (x * z + c) ** 2  # 4      #@in
        # dx, dz, dc = ?               #@ask
        x = 2.01                       #@nudge
        f = (x * z + c) ** 2  # 4.1209 #@nudge
        # 0.1209 / 0.01: about 12      #@slope
        # one rerun per input          #@cost
        # backprop: one walk back      #@back
      `,
      beats: [
        { id: 'ask', say: 'Here is the graph from before, with its inputs set and its output, f, worked out. Now a new question: nudge one input, and how much does f move?', code: 'in' },
        { id: 'grad', say: 'There is one answer per input: {∂f/∂x|partial f, partial x}, and the same for z and for c. Together, those three partials make the gradient of f.', code: 'ask' },
        { id: 'nudge', say: 'One way to find them is to nudge each input and run the graph again. Raise x by a hundredth, making it {2.01|two point zero one}, and f, which was four, becomes about {4.12|four point one two}.', code: 'nudge' },
        { id: 'slope', say: 'f moved twelve times as far as x did, so {∂f/∂x|partial f, partial x} is about twelve.', code: 'slope' },
        { id: 'cost', say: 'But that costs one more run of the whole graph for every input. Three inputs, three runs. A graph with a million inputs would need a million.', code: 'cost' },
        { id: 'walk', say: 'A chain of functions showed a cheaper way: start at the end, walk backward multiplying local slopes, and every slope turns up on the way. A graph works the same, one gate at a time.', code: 'back' },
        { id: 'name', say: 'That backward walk is called backpropagation, or backprop for short. To propagate is to pass something along, step by step, the way a ripple spreads. Here the gradient is passed backward, from the output, node by node, to the inputs.', code: 'back' },
        { id: 'found', say: 'The walk has been found more than once. Seppo Linnainmaa wrote it down in his master\'s thesis in Helsinki, in 1970, to estimate how the tiny roundings a computer makes at every step build up through a long calculation.', code: 'back' },
        { id: 'named', say: 'In 1986, David Rumelhart, Geoffrey Hinton and Ronald Williams used it on networks of neuron-like units, to learn which way to adjust each of their many numbers. They called it back-propagation, and the name stuck.', code: 'back' },
      ],
    },
    {
      id: 'walk',
      title: 'Forward, then backward',
      codeTitle: 'backprop.py',
      code: `
        x, z, c = 2, 3, -4
        q = x * z         # 6         #@fwd
        r = q + c         # 2         #@fwd
        f = r ** 2        # 4         #@fwd
        df = 1.0                      #@seed
        dr = 2 * r * df   # 4         #@sq
        dq = dr; dc = dr  # 4, 4      #@add
        dx = z * dq       # 12        #@mul
        dz = x * dq       # 8         #@mulz
      `,
      beats: [
        { id: 'fwd', say: 'First, run the graph forward, and keep every value it makes along the way: the walk back will need them.', code: 'fwd' },
        { id: 'seed', say: 'Then start at the output. Nudge f, and f moves by exactly that much, so its gradient with respect to itself is one.', code: 'seed' },
        { id: 'rule', say: 'Now walk back one node at a time. Each node takes the gradient arriving from above, and multiplies it by its own local slope: add copies, multiply swaps, max routes.', code: ['sq', 'add', 'mul'] },
        { id: 'sq', say: 'The square\'s local slope is two r, and r was two going forward, so that slope is four.', code: 'sq' },
        { id: 'sq2', say: 'Times the one arriving from above, r\'s gradient is four.', code: 'sq' },
        { id: 'add', say: 'The add copies that four, unchanged, to both of its inputs, q and c.', code: 'add' },
        { id: 'mul', say: 'The multiply swaps. x gets z\'s value, three, times the four from above: twelve.', code: 'mul' },
        { id: 'mulz', say: 'And z gets x\'s value, two, times four: eight.', code: 'mulz' },
        { id: 'all', say: 'Every question mark is filled, and x\'s twelve is the slope the nudge measured. On the way, the walk also found the gradient of each value in between, like q\'s four.', code: ['sq', 'add', 'mul', 'mulz'] },
        { id: 'once', say: 'And it visited each node just once, as the forward run did. A million inputs would still need only one walk back.', code: ['seed', 'sq', 'add', 'mul', 'mulz'] },
      ],
    },
    {
      id: 'twice',
      title: 'A value used twice',
      codeTitle: 'twice.py',
      code: `
        x, z = 3, 2
        q = x * z            # 6           #@fwd
        f = q + x            # 9           #@fwd
        dq = 1.0; dx = 1.0   # the add     #@add
        dz = x * dq          # 3           #@mul
        dx += z * dq         # 1 + 2 = 3   #@sum
      `,
      beats: [
        { id: 'fork', say: 'Sometimes one value feeds two nodes. Here x goes into the multiply, and also straight into the add.', code: 'fwd' },
        { id: 'nudge', say: 'Nudge x, and the nudge travels down both wires at once: f feels it through the add, and again through the multiply.', code: 'fwd' },
        { id: 'add', say: 'So walking back, x collects a gradient from each wire. The add copies its one straight back to x.', code: 'add' },
        { id: 'mul', say: 'The multiply swaps: x gets z\'s value, two, times one. That is two.', code: ['mul', 'sum'] },
        { id: 'sum', say: 'Both effects happen together, so they add: x\'s total gradient is one plus two, three.', code: 'sum' },
        { id: 'check', say: 'Check it by hand: f is x z plus x, whose slope in x is z plus one. With z at two, that is three.', code: 'fwd' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
