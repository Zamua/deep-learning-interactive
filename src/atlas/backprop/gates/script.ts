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
        q = x + z          # 3 + -4 = -1   #@fwd
        dq = 2.0           # from above    #@up
        dx = 1 * dq        # 2.0           #@local
        dz = 1 * dq        # 2.0           #@local
      `,
      beats: [
        { id: 'gate', say: 'Zoom in on one node of a graph: an add gate. Going forward, it adds x and z to make q.', code: 'fwd' },
        { id: 'up', say: 'Going backward, a gradient arrives from above: how much the graph\'s final output, L, moves per unit of q. Say it is two.', code: 'up' },
        { id: 'local', say: 'The gate multiplies it by its local slopes. For an add, both are one: nudge x or z, and q moves by the same amount.', code: 'local' },
        { id: 'copy', say: 'So an add gate passes the gradient through unchanged to both inputs. Each gets the full two, not half of it.', code: 'local' },
      ],
    },
    {
      id: 'mul',
      title: 'Multiply swaps',
      codeTitle: 'mul.py',
      code: `
        q = x * z          # 3 * -4 = -12  #@fwd
        dx = z * dq        # -4 * 2 = -8   #@dx
        dz = x * dq        #  3 * 2 = 6    #@dz
      `,
      beats: [
        { id: 'gate', say: 'A multiply gate works differently. Here x is three, z is minus four, and again two arrives from above.', code: 'fwd' },
        { id: 'slope', say: 'q is x times z, so nudging x moves q by z times the nudge. The local slope for x is z.', code: 'dx' },
        { id: 'swap', say: 'So x gets z times the upstream gradient: minus four times two, minus eight. And z gets x times it: three times two, six.', code: ['dx', 'dz'] },
        { id: 'rule', say: 'Each input gets the other input\'s value, times the gradient from above. The multiply gate swaps.', code: ['dx', 'dz'] },
      ],
    },
    {
      id: 'max',
      title: 'Max routes',
      codeTitle: 'max.py',
      code: `
        q = np.maximum(x, z)   # x = 3, z = 5: q = 5   #@fwd
        dx = 0.0       # the smaller input             #@dx
        dz = 1 * dq    # the larger gets all: 2.0      #@dz
      `,
      beats: [
        { id: 'gate', say: 'A max gate passes on the larger input. With x three and z five, q is five.', code: 'fwd' },
        { id: 'route', say: 'Nudge x a little, and q does not move at all. Nudge z, and q moves with it. So the larger input, z, gets all of the gradient, and x gets zero.', code: ['dx', 'dz'] },
        { id: 'router', say: 'Add copies, multiply swaps, and max routes: the winner takes the whole gradient, and the other input gets nothing.', code: 'dz' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
