import type { LectureScript } from '../../../lecture/types';

const linear = `
  x = np.array([3, 1, 2, 1])          # four pixels  #@x
  W = np.array([[ 1, -3,  0,  2],     # class 0      #@W
                [ 2,  1, -1,  0],     # class 1      #@W
                [-1,  0,  4, -2]])    # class 2      #@W
  s = W @ x                           # [2, 5, 3]    #@s
  g = W[0]       # ds0/dx: [1, -3, 0, 2]             #@g
  sal = abs(g)             # [1, 3, 0, 2]            #@sal
  sal.argmax()             # pixel 1                 #@top
`;

export const script: LectureScript = {
  id: 'atlas-saliency',
  title: 'Saliency maps',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'linear',
      title: 'The gradient of one score',
      codeTitle: 'saliency.py',
      code: linear,
      beats: [
        { id: 'setup', say: 'A linear classifier scores an image of four pixels, x, with one row of W per class: s is W times x.', code: ['x', 'W', 's'] },
        { id: 'ask', say: 'Which pixels does class zero\'s score, {s₀|s zero}, depend on most? Ask its gradient with respect to the pixels: how fast {s₀|s zero} moves as each pixel is nudged.', code: 's' },
        { id: 'nudge', say: '{s₀|s zero} is row zero of W dotted with x: each pixel times its weight, added up. Nudge pixel one, and only its term moves: by its weight, minus three, times the nudge.', code: ['W', 's'] },
        { id: 'row', say: 'So the gradient, {∂s₀/∂x|partial s zero, partial x}, one partial per pixel, is row zero itself: one, minus three, zero, two. In backprop terms, the add copies and each multiply swaps. The pixel values drop out, and so would a bias.', code: 'g' },
      ],
    },
    {
      id: 'map',
      title: 'The saliency map',
      codeTitle: 'saliency.py',
      code: linear,
      beats: [
        { id: 'sign', say: 'The sign says which way the score moves; the size says how fast. Minus three moves it as fast as plus three would, just downward.', code: 'g' },
        { id: 'abs', say: 'So a saliency map takes the absolute value of the gradient, its size with the sign dropped: one, three, zero, two. It is written between two bars, {\\|∂s₀/∂x\\||the absolute value of partial s zero, partial x}.', code: 'sal' },
        { id: 'show', say: 'Painted onto the image, pixel one lights up most. It is the map\'s argmax, the position of its largest entry: class zero is most sensitive to it. Pixel two, with weight zero, does not matter at all.', code: 'top' },
        { id: 'other', say: 'Each class has its own map. Class two\'s row is minus one, zero, four, minus two, so for class two, pixel two lights up instead.', code: 'W' },
      ],
    },
    {
      id: 'deeper',
      title: 'Through a deeper model',
      codeTitle: 'deeper.py',
      code: `
        x0, x1 = 2, 1                         #@x
        q = 2 * x0 - x1         # 3           #@fwd
        r = max(0, q)           # 3           #@fwd
        s = 3 * r               # 9           #@fwd
        dr = 3 * 1.0            # 3           #@mul
        dq = dr if q > 0 else 0 # 3           #@max
        dx0, dx1 = 2 * dq, -1 * dq   # 6, -3  #@add
        sal = [abs(dx0), abs(dx1)]   # [6, 3] #@sal
      `,
      beats: [
        { id: 'graph', say: 'A deeper model is a bigger graph, but the question is the same. Here the score is three times the max of zero and two {x₀|x zero} minus {x₁|x one}.', code: 'fwd' },
        { id: 'fwd', say: 'Run it forward on the image two, one: q is three, the max keeps three, and s is nine.', code: ['x', 'fwd'] },
        { id: 'back', say: 'Then backprop from s, starting at one. The multiply hands back three, and the max routes it on, since q beat zero.', code: ['mul', 'max'] },
        { id: 'pixels', say: 'The add copies it to both terms, and the multiplies hand pixel zero two times three, six, and pixel one minus three. Saliency: six and three.', code: ['add', 'sal'] },
        { id: 'depends', say: 'Unlike the linear case, this depends on the image. Make q negative, and the max routes nothing back: every pixel\'s saliency is zero.', code: 'max' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
