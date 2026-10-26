import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gradient',
  title: 'Gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'stack',
      title: 'Stack the partials',
      codeTitle: 'stack.py',
      code: `
        def f(u, v): return u**2 + 2*v**2    #@f
        df_du, df_dv = 2, 4      # at (1, 1) #@f
        df = np.array([df_du, df_dv])        #@grad
        # [2, 4]: where f climbs fastest      #@up
        pt = np.array([1, 1]) - 0.1 * df     #@down
        pt            # [0.8, 0.6]           #@small
        f(0.8, 0.6)   # 1.36, down from 3    #@small
      `,
      beats: [
        { id: 'recap', say: 'Take {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}, a bowl, at the point one, one. Its partial derivatives there are {∂f/∂u = 2|partial f, partial u is two} and {∂f/∂v = 4|partial f, partial v is four}.', code: 'f' },
        { id: 'grad', say: 'Stack the partials into a vector, and you have the gradient of f. It is written {∇f|nabla f}, read “nabla f” after {the upside-down triangle ∇|the upside-down triangle}, called nabla. Here {∇f = [2, 4]|the gradient of f is two, four}.', code: 'grad' },
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
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        def f(u, v): return 2*u**2 + u*v + 4*v   #@p
        # at (u, v) = (1, 2)                     #@p
        df_du = 4*1 + 2        # 4u + v = 6      #@du
        df_dv = 1 + 4          # u + 4 = 5       #@dv
        df = np.array([6, 5])                    #@dv
      `,
      beats: [
        { id: 'p', say: 'Try one. {f(u, v) = 2u² + uv + 4v|f of u and v is two u squared, plus u v, plus four v}. What is {∇f|nabla f} at one, two?', code: 'p' },
        { id: 'du', say: 'In u, with v held: two u squared gives four u, u v gives v, and four v gives zero. Four plus two is six.', code: 'du' },
        { id: 'dv', say: 'In v, with u held: two u squared gives zero, u v gives u, and four v gives four. One plus four is five. So {∇f = [6, 5]|nabla f is six, five}.', code: 'dv' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
