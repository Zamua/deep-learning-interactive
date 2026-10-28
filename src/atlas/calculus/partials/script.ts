import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-partials',
  title: 'Partial derivatives',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Adrien-Marie Legendre', year: 1786, title: 'Mémoire sur la manière de distinguer les maxima des minima dans le calcul des variations', url: 'https://archive.org/details/bub_gb_rIYlBNp4oiIC/page/n95/', scene: 'slice' },
    { who: 'Carl Gustav Jacob Jacobi', year: 1841, title: 'De determinantibus functionalibus', url: 'https://doi.org/10.1515/crll.1841.22.319', scene: 'slice' },
  ],
  scenes: [
    {
      id: 'slice',
      title: 'Which slope?',
      codeTitle: 'bowl.py',
      code: `
        def f(u, v): return u**2 + 2*v**2  #@f
        f(1, 1)          # 3: the height   #@pt
        # hold v = 1: f = u**2 + 2         #@slice
        2 * 1            # slope 2u at u=1 #@du
        # ∂f/∂u = 2u = 2                   #@name
      `,
      beats: [
        { id: 'two', say: 'So far, every function had one input. This one has two, u and v, so picture it as ground: each spot is a pair of inputs, and the height there is the output, f.', code: 'f' },
        { id: 'rings', say: 'Seen from above, like a hiking map, each ring joins spots of equal height. They rise away from the middle: a bowl.', code: 'f' },
        { id: 'which', say: 'Stand at the point one, one. How steep is it here? That depends on which way you step: along u, the ground climbs at one rate, and along v, at another.', code: 'pt' },
        { id: 'hold', say: 'So move one input at a time. Hold v at one and let only u move: you walk along this dashed line, and the heights along it trace an ordinary curve.', code: 'slice' },
        { id: 'f', say: 'This bowl is {f(u, v) = u² + 2v²|f of u and v equals u squared plus two v squared}. With v held at one, two v squared is a fixed two, so the curve is u squared, plus two.', code: ['f', 'slice'] },
        { id: 'slope', say: 'Differentiate it as usual. u squared gives two u, and the constant two gives zero. At u equals one, the slope is two.', code: 'du' },
        { id: 'partial', say: 'That slope is the partial derivative of f in u: partial, because it counts only the part of f\'s change that comes from u.', code: 'name' },
        { id: 'curly', say: 'It is written {∂f/∂u|partial f, partial u}, with a curly d, read “partial”. Here it is two.', code: 'name' },
        { id: 'legendre', say: 'Adrien-Marie Legendre wrote it this way in 1786, he said, to avoid any ambiguity: the curly d marks a slope where only one input moves.', code: 'name' },
        { id: 'jacobi', say: 'Legendre later dropped it. Carl Gustav Jacob Jacobi took it up again in 1841, to tell partial derivatives from ordinary ones at a glance, and it stuck.', code: 'name' },
      ],
    },
    {
      id: 'other',
      title: 'Now hold u',
      codeTitle: 'bowl.py',
      code: `
        def f(u, v): return u**2 + 2*v**2  #@f
        # hold u = 1: f = 1 + 2*v**2       #@slice
        4 * 1            # slope 4v at v=1 #@dv
        # ∂f/∂v = 4v = 4                   #@name
        # a term with no v: constant, 0    #@rule
        # one input: ∂f/∂x is f'(x)        #@one
      `,
      beats: [
        { id: 'hold', say: 'Now hold u at one instead, and let only v move. The line runs up the page, and along it the curve is one, plus two v squared.', code: 'slice' },
        { id: 'dv', say: 'Two v squared gives four v, and the constant one gives zero. So {∂f/∂v = 4v|partial f, partial v is four v}: four, at v equals one.', code: ['dv', 'name'] },
        { id: 'steep', say: 'That is twice as steep as along u, and the map shows it: the rings crowd closer together this way.', code: 'name' },
        { id: 'rule', say: 'So a partial is an ordinary derivative, with every other input frozen at a number. A term without the moving input is a constant, and gives zero.', code: 'rule' },
        { id: 'one', say: 'With a single input, there is nothing to hold still, and the partial is just the derivative, {f′|f prime}. The curly d only says that other inputs exist, and stay where they are.', code: 'one' },
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
        { id: 'mix', say: 'Some terms mix the inputs. Take {f(u, v) = u² + 3uv|f of u and v equals u squared plus three u v}, at the point u equals one, v equals two.', code: 'f' },
        { id: 'held', say: 'For the partial in u, walk the slice where v is two. There, three u v is three times two times u: six u, a line in u with slope six.', code: 'held' },
        { id: 'pu', say: 'So a held v is just a number multiplying u, and three u v gives three v. With u squared giving two u, {∂f/∂u = 2u + 3v|partial f, partial u is two u plus three v}: two plus six, eight.', code: 'du' },
        { id: 'pv', say: 'For the partial in v, walk the slice where u is one. u squared is a constant there, giving zero, and three u v gives three u: three.', code: 'dv' },
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        def f(u, v):                        #@p
            return u**2*v + 2*v**2 + 3*u    #@p
        # at (u, v) = (2, 1)                #@p
        df_du = 2*2*1 + 3      # 2uv + 3 = 7 #@du
        df_dv = 2**2 + 4*1     # u**2 + 4v = 8 #@dv
      `,
      beats: [
        { id: 'p', say: 'Try one. {f(u, v) = u²v + 2v² + 3u|f of u and v equals u squared v, plus two v squared, plus three u}. What is {∂f/∂u|partial f, partial u} at two, one?', code: 'p' },
        { id: 'du', say: 'Hold v. u squared v is v times u squared, so it gives v times two u: two u v. Two v squared gives zero, and three u gives three.', code: 'du' },
        { id: 'du-n', say: 'At two, one: two times two times one is four, plus three, seven.', code: 'du' },
        { id: 'q', say: 'And {∂f/∂v|partial f, partial v} at the same point?', code: 'p' },
        { id: 'dv', say: 'Hold u. u squared v is u squared times v, so it gives u squared. Two v squared gives four v, and three u gives zero.', code: 'dv' },
        { id: 'dv-n', say: 'Two squared is four, plus four times one: eight.', code: 'dv' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
