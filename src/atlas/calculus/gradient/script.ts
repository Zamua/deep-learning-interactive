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
        { id: 'du', say: 'Hold v fixed and move only u. Along that line f is an ordinary curve, and its slope is the partial derivative in u, written {∂f/∂u|partial f, partial u}. {The curly d, ∂,|The curly d,} read “partial”, means only u moves, with v held still. Here it is two u: two, at the point one, one.', code: 'du' },
        { id: 'dv', say: 'Hold u fixed instead, and the slope in v, {∂f/∂v|partial f, partial v}, is four v, which is four here.', code: 'dv' },
        { id: 'grad', say: 'Stack the partials into a vector, and you have the gradient of f. It is written {∇f|nabla f}, read “nabla f” after {the upside-down triangle ∇|the upside-down triangle}, called nabla. Here {∇f = [2, 4]|the gradient of f is two, four}.', code: 'grad' },
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
        { id: 'down', say: 'To make f smaller, step the other way, against the gradient: along {−∇f|minus nabla f}.', code: 'down' },
        { id: 'small', say: 'A small step, a tenth of the gradient, lands on a lower ring: f drops from three to {1.36|one point three six}.', code: 'small' },
      ],
    },
    {
      id: 'shape',
      title: 'One entry per input',
      codeTitle: 'shape.py',
      code: `
        W = np.random.randn(3, 4)   # 12 numbers  #@W
        # f: one number, from all of W           #@L
        df = np.zeros_like(W)       # ∂f/∂W      #@g
        df.shape                    # (3, 4)     #@g
        df[1, 2]  # how f moves with W[1, 2]     #@entry
      `,
      beats: [
        { id: 'loss', say: 'A function can take a whole grid of numbers as its input. Here W has three rows and four columns, twelve numbers in all, and f turns them into a single number.', code: ['W', 'L'] },
        { id: 'g', say: 'So the gradient {∇f|nabla f} has twelve partials, one per entry of W, laid out exactly like W: three by four. Since it holds the slopes of f in the entries of W, it is also written {∂f/∂W|partial f, partial W}.', code: 'g' },
        { id: 'entry', say: 'Each entry says how f moves when that one number in W is nudged: the gradient at row one, column two belongs to W at row one, column two.', code: 'entry' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
