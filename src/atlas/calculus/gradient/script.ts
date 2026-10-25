import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gradient',
  title: 'Gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'partials',
      title: 'One slope per input',
      codeTitle: 'partials.py',
      code: `
        def f(u, v): return u**2 + 2*v**2    #@f
        # at (u, v) = (1, 1):
        df_du = 2 * 1      # 2u = 2          #@du
        df_dv = 4 * 1      # 4v = 4          #@dv
        df = np.array([df_du, df_dv])        #@grad
        # [2, 4]                             #@grad
      `,
      beats: [
        { id: 'two', say: 'Many functions take more than one input. Here {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}: a bowl, seen from above as rings of equal height.', code: 'f' },
        { id: 'du', say: 'Hold v fixed and move only u. Along that line f is an ordinary curve, and its slope is the partial derivative in u: two u, which is two at the point one, one.', code: 'du' },
        { id: 'dv', say: 'Hold u fixed instead, and the slope in v is four v, which is four here.', code: 'dv' },
        { id: 'grad', say: 'Stack the partials into a vector, and you have the gradient: {∇f = [2, 4]|the gradient of f is two, four}.', code: 'grad' },
      ],
    },
    {
      id: 'uphill',
      title: 'It points uphill',
      codeTitle: 'uphill.py',
      code: `
        df = np.array([2, 4])     # at (1, 1)   #@up
        pt = np.array([1, 1]) - 0.1 * df        #@down
        pt            # [0.8, 0.6]              #@small
        f(0.8, 0.6)   # 1.36, down from 3       #@small
      `,
      beats: [
        { id: 'up', say: 'The gradient points the way f climbs fastest: straight up the bowl, across the rings.', code: 'up' },
        { id: 'down', say: 'To make f smaller, step the other way, against the gradient.', code: 'down' },
        { id: 'small', say: 'A small step, a tenth of the gradient, lands on a lower ring: f drops from three to {1.36|one point three six}.', code: 'small' },
      ],
    },
    {
      id: 'shape',
      title: 'One entry per weight',
      codeTitle: 'shape.py',
      code: `
        W = np.random.randn(3, 4)   # 12 weights  #@W
        # L: one number, from all of W           #@L
        g = np.zeros_like(W)        # dL/dW      #@g
        g.shape                     # (3, 4)     #@g
        g[1, 2]   # how L moves with W[1, 2]     #@entry
      `,
      beats: [
        { id: 'loss', say: 'In training, the function is the loss, L, and its inputs are the weights. A weight matrix W with three rows and four columns is twelve inputs.', code: ['W', 'L'] },
        { id: 'g', say: 'So the gradient g has twelve partials, one per weight, laid out exactly like W: three by four.', code: 'g' },
        { id: 'entry', say: 'Each entry says how the loss moves when that one weight is nudged: g at row one, column two belongs to W at row one, column two.', code: 'entry' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        def f(u, v): return u**2 + 2*u*v + 3*v  #@ask
        df_du = 2*1 + 2*2   # 2u + 2v = 6       #@du
        df_dv = 2*1 + 3     # 2u + 3 = 5        #@dv
        np.array([df_du, df_dv])   # [6, 5]     #@grad
      `,
      beats: [
        { id: 'ask', say: 'Your turn to follow along. {f(u, v) = u² + 2uv + 3v|f of u and v is u squared plus two u v plus three v}. What is the gradient at u equals one, v equals two?', code: 'ask' },
        { id: 'du', say: 'In u, hold v fixed. The partial is {2u + 2v|two u plus two v}, which is two plus four: six.', code: 'du' },
        { id: 'dv', say: 'In v, hold u fixed: {2u + 3|two u plus three}, which is five.', code: 'dv' },
        { id: 'grad', say: 'So the gradient is six, five.', code: 'grad' },
      ],
    },
  ],
};
