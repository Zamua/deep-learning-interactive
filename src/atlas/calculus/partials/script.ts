import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-partials',
  title: 'Partial derivatives',
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
      `,
      beats: [
        { id: 'two', say: 'Many functions take more than one input. Here {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}: a bowl, seen from above as rings of equal height.', code: 'f' },
        { id: 'du', say: 'Hold v fixed and move only u. Along that line f is an ordinary curve, and its slope is the partial derivative in u, written {∂f/∂u|partial f, partial u}. {The curly d, ∂,|The curly d,} read “partial”, means only u moves, with v held still.', code: 'f' },
        { id: 'terms', say: 'Take f term by term. u squared gives two u. Two v squared does not change while v is held, so it is a constant, and gives zero. So {∂f/∂u = 2u|partial f, partial u is two u}: two, at the point one, one.', code: ['terms', 'du'] },
        { id: 'dv', say: 'Hold u fixed instead. Now u squared is the constant, and gives zero, while two v squared gives four v. So {∂f/∂v = 4v|partial f, partial v is four v}: four here. Each input has its own slope.', code: ['vterms', 'dv'] },
        { id: 'one', say: 'With a single input, there is nothing to hold still, and the partial is just the derivative, {f′|f prime}. The curly d only says that other inputs exist, and stay where they are.', code: 'f' },
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
      `,
      beats: [
        { id: 'mix', say: 'Some terms mix the inputs. Take {f(u, v) = u² + 3uv|f of u and v is u squared plus three u v}, at the point u equals one, v equals two.', code: 'f' },
        { id: 'held', say: 'For the partial in u, hold v at two. Then three u v is three times two times u: six u, a line in u with slope six. And six is three times v.', code: 'held' },
        { id: 'pu', say: 'So a held v acts as a number multiplying u, and three u v gives three v. With u squared giving two u, {∂f/∂u = 2u + 3v|partial f, partial u is two u plus three v}: two plus six, eight.', code: 'du' },
        { id: 'pv', say: 'For the partial in v, hold u at one. u squared is a constant, giving zero. Three u v is three v, giving three, which is three u. So {∂f/∂v = 3u|partial f, partial v is three u}: three.', code: 'dv' },
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        def f(u, v): return u**2*v + 2*v**2 + 3*u   #@p
        # at (u, v) = (2, 1)                        #@p
        df_du = 2*2*1 + 3      # 2uv + 3 = 7        #@du
        df_dv = 2**2 + 4*1     # u**2 + 4v = 8      #@dv
      `,
      beats: [
        { id: 'p', say: 'Try one. {f(u, v) = u²v + 2v² + 3u|f of u and v is u squared v, plus two v squared, plus three u}. What is {∂f/∂u|partial f, partial u} at two, one?', code: 'p' },
        { id: 'du', say: 'Hold v. u squared v is v times u squared, so it gives v times two u: two u v. Two v squared gives zero, and three u gives three. Two times two times one, plus three: seven.', code: 'du' },
        { id: 'q', say: 'And {∂f/∂v|partial f, partial v} at the same point?', code: 'p' },
        { id: 'dv', say: 'Hold u. u squared v is u squared times v, so it gives u squared. Two v squared gives four v, and three u gives zero. Two squared, plus four times one: eight.', code: 'dv' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
