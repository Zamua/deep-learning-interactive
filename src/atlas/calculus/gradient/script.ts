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
        # hold v: u**2 -> 2u, 2*v**2 -> 0     #@terms
        df_du = 2 * 1      # 2u = 2          #@du
        # hold u: u**2 -> 0, 2*v**2 -> 4v     #@vterms
        df_dv = 4 * 1      # 4v = 4          #@dv
        df = np.array([df_du, df_dv])        #@grad
        # [2, 4]                             #@grad
      `,
      beats: [
        { id: 'two', say: 'Many functions take more than one input. Here {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}: a bowl, seen from above as rings of equal height.', code: 'f' },
        { id: 'du', say: 'Hold v fixed and move only u. Along that line f is an ordinary curve, and its slope is the partial derivative in u, written {∂f/∂u|partial f, partial u}. {The curly d, ∂,|The curly d,} read “partial”, means only u moves, with v held still.', code: 'f' },
        { id: 'terms', say: 'Take f term by term. u squared gives two u. Two v squared does not change while v is held, so it is a constant, and gives zero. So {∂f/∂u = 2u|partial f, partial u is two u}: two, at the point one, one.', code: ['terms', 'du'] },
        { id: 'dv', say: 'Hold u fixed instead. Now u squared is the constant, and gives zero, while two v squared gives four v. So {∂f/∂v = 4v|partial f, partial v is four v}: four here.', code: ['vterms', 'dv'] },
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
      ],
    },
    {
      id: 'mixed',
      title: 'Terms that mix the inputs',
      codeTitle: 'mixed.py',
      code: `
        def f(u, v): return u**2 + 3*u*v     #@f
        # v = 2: 3*u*v is 6u, slope 6 = 3v   #@held
        df_du = 2*1 + 3*2      # 2u + 3v = 8 #@du
        # u = 1: u**2 is 1, 3*u*v is 3v      #@dv
        df_dv = 3*1            # 3u = 3      #@dv
        df = np.array([8, 3])                #@grad
        # f = 2u**2 + u*v + 4v at (1, 2)     #@p1
        df = np.array([4*1 + 2, 1 + 4])      #@a1
        # [6, 5]                             #@a1
        # f = u**2*v + 2v**2 + 3u at (2, 1)  #@p2
        df_du = 2*2*1 + 3      # 2uv + 3 = 7 #@a2
      `,
      beats: [
        { id: 'mix', say: 'Some terms mix the inputs. Take {f(u, v) = u² + 3uv|f of u and v is u squared plus three u v}, at the point u equals one, v equals two.', code: 'f' },
        { id: 'held', say: 'For the partial in u, hold v at two. Then three u v is three times two times u: six u, a line in u with slope six. And six is three times v.', code: 'held' },
        { id: 'pu', say: 'So a held v acts as a number multiplying u, and three u v gives three v. With u squared giving two u, {∂f/∂u = 2u + 3v|partial f, partial u is two u plus three v}: two plus six, eight.', code: 'du' },
        { id: 'pv', say: 'For the partial in v, hold u at one. u squared is a constant, giving zero. Three u v is three v, giving three, which is three u. So {∂f/∂v = 3u|partial f, partial v is three u}: three.', code: 'dv' },
        { id: 'both', say: 'Stack them: at one, two, {∇f = [8, 3]|the gradient is eight, three}.', code: 'grad' },
        { id: 'p1', say: 'Try one. {f(u, v) = 2u² + uv + 4v|f of u and v is two u squared, plus u v, plus four v}. What is {∇f|nabla f} at one, two?', code: 'p1' },
        { id: 'a1u', say: 'In u, with v held: two u squared gives four u, u v gives v, and four v gives zero. Four plus two is six.', code: 'a1' },
        { id: 'a1v', say: 'In v, with u held: two u squared gives zero, u v gives u, and four v gives four. One plus four is five. So {∇f = [6, 5]|nabla f is six, five}.', code: 'a1' },
        { id: 'p2', say: 'One more. {f(u, v) = u²v + 2v² + 3u|f of u and v is u squared v, plus two v squared, plus three u}. What is {∂f/∂u|partial f, partial u} at two, one?', code: 'p2' },
        { id: 'a2', say: 'Hold v. u squared v is v times u squared, so it gives v times two u: two u v. Two v squared gives zero, and three u gives three. Two times two times one, plus three: seven.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
