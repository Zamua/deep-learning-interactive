import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gates',
  title: 'Gate gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'add',
      title: 'Add copies',
      codeTitle: 'add.py',
      code: `
        q = x + z      # 3 + -4 = -1      #@fwd
        dq = 2.0       # ∂f/∂q, from above #@up
        dx = 1 * dq    # 2.0              #@dx
        dz = 1 * dq    # 2.0              #@dz
      `,
      beats: [
        { id: 'problem', say: 'Walking back along a chain, you multiply by one local slope per link. But a node in a graph can take two inputs, so walking back through it raises a question: how much of the slope goes to each input?', code: 'fwd' },
        { id: 'gate', say: 'Take an add. Going forward, it adds x, three, and z, minus four, to make q, minus one. Then q flows on, through the rest of the graph, to its final output, f.', code: 'fwd' },
        { id: 'name', say: 'Nodes like this are also called gates, after the gates of an electronic circuit: small parts that each take a couple of inputs, and send out one.', code: 'fwd' },
        { id: 'above', say: 'Say the walk back has already reached q. Nudge q up by a hundredth, and f moves up two hundredths: two per unit of q.', code: 'up' },
        { id: 'up', say: 'That rate is the gradient of f with respect to q, written {∂f/∂q|partial f, partial q}: here, two. It arrives from above, from the output\'s side, and the code calls it {dq|d q}.', code: 'up' },
        { id: 'curly', say: 'Why the curly d? f depends on many inputs, so its slope in q holds all the others still: a partial derivative. In a chain with one input, like {dz/dx|d z, d x}, there is nothing to hold, and the two mean the same.', code: 'up' },
        { id: 'upstream', say: 'Gradients flow backward, from the output toward the inputs. So the output\'s side is upstream, where the flow comes from, as on a river, and two is called the upstream gradient.', code: 'up' },
        { id: 'nudge', say: 'Now nudge x instead: three becomes {3.01|three point zero one}. q moves by the same hundredth, so the add\'s local slope for x is one, and f again moves two hundredths.', code: ['fwd', 'dx'] },
        { id: 'dx', say: 'So {∂f/∂x|partial f, partial x}, called {dx|d x} in the code, is the local slope times the gradient from above: one times two, two.', code: 'dx' },
        { id: 'copy', say: 'z is the same: q moves one for one with it. So an add gate copies the gradient from above, unchanged, to both inputs. Each gets the full two, not half of it.', code: 'dz' },
      ],
    },
    {
      id: 'mul',
      title: 'Multiply swaps',
      codeTitle: 'mul.py',
      code: `
        q = x * z      # 3 * -4 = -12     #@fwd
        # x to 3.01: q = -12.04           #@nudge
        dx = z * dq    # -4 * 2 = -8      #@dx
        dz = x * dq    #  3 * 2 = 6       #@dz
      `,
      beats: [
        { id: 'gate', say: 'A multiply gate is different. Now q is x times z: three times minus four, minus twelve. Again, two arrives from above.', code: 'fwd' },
        { id: 'nudge', say: 'Nudge x up a hundredth, making it {3.01|three point zero one}, and q becomes {−12.04|minus twelve point zero four}: it moves minus four times the nudge. So the local slope for x is z\'s value, minus four.', code: 'nudge' },
        { id: 'dx', say: 'Then x gets minus four times the gradient from above: minus four times two, minus eight.', code: 'dx' },
        { id: 'dz', say: 'Nudge z instead, and q moves three times the nudge: the slope for z is x\'s value, three. So z gets three times two, six.', code: 'dz' },
        { id: 'rule', say: 'Each input gets the other input\'s value, times the gradient from above. The multiply gate swaps.', code: ['dx', 'dz'] },
      ],
    },
    {
      id: 'max',
      title: 'Max routes',
      codeTitle: 'max.py',
      code: `
        q = np.maximum(x, z)  # 5         #@fwd
        dx = 0.0       # q ignores x      #@dx
        dz = 1 * dq    # z is larger: 2.0 #@dz
      `,
      beats: [
        { id: 'gate', say: 'A max gate passes on the larger of its inputs. With x three and z five, q is five.', code: 'fwd' },
        { id: 'x', say: 'Nudge x up a hundredth, making it {3.01|three point zero one}, and q stays five: z is still larger. The slope for x is zero, so x gets nothing.', code: 'dx' },
        { id: 'z', say: 'Nudge z up a hundredth, making it {5.01|five point zero one}, and q moves with it: a slope of one. So z, the larger input, gets all of the two.', code: 'dz' },
        { id: 'router', say: 'Add copies, multiply swaps, and max routes: the winner takes the whole gradient, and the other input gets nothing.', code: 'dz' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
