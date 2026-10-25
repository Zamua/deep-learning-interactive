import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-backprop-graph',
  title: 'Backprop on a graph',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
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
        dz = x * dq       # 8         #@mul
      `,
      beats: [
        { id: 'fwd', say: 'To backprop through a graph, first run it forward and keep every value. With x two, z three and c minus four: q is six, r is two, and f is four.', code: 'fwd' },
        { id: 'seed', say: 'Then start at the output, where the gradient of f with respect to itself is one.', code: 'seed' },
        { id: 'sq', say: 'Walk back one node at a time. At each, multiply the gradient from above by the node\'s local slope. The square\'s slope is two r, which is four, so r gets one times four: four.', code: 'sq' },
        { id: 'add', say: 'The add passes that four, unchanged, to both q and c.', code: 'add' },
        { id: 'mul', say: 'The multiply swaps: x gets z times four, twelve, and z gets x times four, eight.', code: 'mul' },
        { id: 'all', say: 'So the gradient is twelve for x, eight for z, and four for c. One backward walk gives every one of them.', code: ['sq', 'add', 'mul'] },
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
        { id: 'paths', say: 'Walking back, x receives a gradient along each wire: one from the add, and from the multiply, z times one, which is two.', code: ['add', 'mul'] },
        { id: 'sum', say: 'The two add up: x\'s total gradient is three. Nudge x, and f moves through both paths at once, so their effects add.', code: 'sum' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
