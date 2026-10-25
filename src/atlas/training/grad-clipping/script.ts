import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grad-clipping',
  title: 'Gradient clipping',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'size',
      title: 'How big is a gradient?',
      codeTitle: 'norm.py',
      code: `
        g = np.array([6.0, 8.0])   # exploded   #@g
        g @ g              # 36 + 64 = 100      #@dot
        np.sqrt(g @ g)     # 10                 #@norm
        np.linalg.norm(g)  # 10, the same       #@norm
      `,
      beats: [
        { id: 'explode', say: 'Backprop through time can make a gradient explode. This one has grown ten times over, to six, eight, and a step along it would throw the weights far off course.', code: 'g' },
        { id: 'norm', say: 'Clipping caps how big a gradient may get. Its size is its norm, written {‖g‖|the norm of g} with double bars: the length of its arrow.', code: 'norm' },
        { id: 'pyth', say: 'By Pythagoras, that is {√(6² + 8²)|the square root of six squared plus eight squared}: the square root of a hundred, which is ten.', code: 'norm' },
        { id: 'dot', say: 'And six squared plus eight squared is just g dotted with itself. So the norm is the square root of {g · g|g dot g}, however many entries g has.', code: ['dot', 'norm'] },
      ],
    },
    {
      id: 'clip',
      title: 'Scale it down',
      codeTitle: 'clip.py',
      code: `
        c = 5.0                               #@c
        norm = np.linalg.norm(g)    # 10      #@c
        clipped = g                           #@c
        if norm > c:                          #@scale
            clipped = g * c / norm  # [3, 4]  #@scale
        np.clip(g, -c, c)   # [5, 5]: turned  #@each
      `,
      beats: [
        { id: 'threshold', say: 'Pick a threshold, c, here five. A gradient whose norm is at most c is left alone.', code: 'c' },
        { id: 'scale', say: 'This norm is ten, over c, so multiply all of g by c over the norm: five over ten, one half. Six, eight becomes three, four.', code: 'scale' },
        { id: 'same', say: 'Both entries shrink by the same factor, so the arrow keeps its direction, and its new norm is exactly c.', code: 'scale' },
        { id: 'each', say: 'It is tempting to clip each entry on its own instead, to between minus c and c, written {[−c, c]|minus c to c}. Six, eight would become five, five.', code: 'each' },
        { id: 'turns', say: 'But five, five is not a multiple of six, eight: eight was cut more than six, so that arrow points somewhere else. Scaling cuts every entry by the same factor, so it never turns the step.', code: 'each' },
      ],
    },
    {
      id: 'step',
      title: 'Then step',
      codeTitle: 'step.py',
      code: `
        w = np.array([1.0, 2.0])             #@w
        eta = 0.1                            #@w
        w - eta * clipped    # [0.7, 1.6]    #@step
        w - eta * g          # [0.4, 1.2]    #@raw
      `,
      beats: [
        { id: 'step', say: 'Then take the gradient step as usual, with the clipped gradient. From w at one, two, with step size {0.1|zero point one}, the step is {0.3|zero point three}, {0.4|zero point four}, and w lands at {0.7|zero point seven}, {1.6|one point six}.', code: ['w', 'step'] },
        { id: 'raw', say: 'Unclipped, the step would have been twice as long. However far a gradient explodes, a clipped step never goes further than {η|eta} times c.', code: 'raw' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
