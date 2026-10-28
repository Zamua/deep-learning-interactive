import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gradient',
  title: 'Gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Maxwell', year: 1873, title: 'A treatise on electricity and magnetism, volume 1', url: 'https://archive.org/details/electricandmagne01maxwrich', scene: 'uphill' },
    { who: 'Hamilton', year: 1846, title: 'On a proof of Pascal\'s theorem by means of quaternions; and on some other connected subjects', url: 'https://www.maths.tcd.ie/pub/HistMath/People/Hamilton/Pascal/', scene: 'down' },
    { who: 'Tait', year: 1867, title: 'An elementary treatise on quaternions', url: 'https://archive.org/details/anelementarytre01taitgoog', scene: 'down' },
  ],
  scenes: [
    {
      id: 'uphill',
      title: 'Which way is uphill?',
      codeTitle: 'uphill.py',
      code: `
        def f(u, v): return u**2 + 2*v**2  #@f
        df_du = 2    # along u               #@du
        df_dv = 4    # along v: steeper      #@du
        # f rises ≈ 2*Δu + 4*Δv              #@mix
        df = np.array([df_du, df_dv])        #@grad
        # [2, 4]: the way f climbs fastest   #@up
        # along a ring: f stays level        #@level
      `,
      beats: [
        { id: 'bowl', say: 'Here is the bowl from partial derivatives, {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}, seen from above as rings of equal height. Stand at the point one, one. Which way is straight uphill?', code: 'f' },
        { id: 'any', say: 'With one input, there are only two ways to go, and the slope\'s sign says which one climbs. With two inputs, you can set off in any direction at all.', code: 'f' },
        { id: 'axes', say: 'The partial derivatives answer only along the two axes. Along u, f climbs at a rate of two. Along v, at four: twice as steep.', code: 'du' },
        { id: 'mix', say: 'Set off at an angle, and the two climbs add up. A small step changes f by about two times its move in u, plus four times its move in v.', code: 'mix' },
        { id: 'sweep', say: 'So swing a short step all the way round the point, and watch how much f rises. The climb is steepest in one direction: two along u for every four along v.', code: 'mix' },
        { id: 'grad', say: 'That direction comes straight from the partials: stack them into one vector, two and four, and it points exactly that way. This vector is called the gradient of f.', code: 'grad' },
        { id: 'maxwell', say: 'In 1873, {James Clerk Maxwell|James Clark Maxwell} described it both ways: measure how fast f rises along each axis and combine them into one arrow, or find the direction in which it rises fastest. Either way, the same arrow.', code: ['grad', 'up'] },
        { id: 'name', say: 'Gradient is an everyday word for a slope, how steeply a road or a railway climbs. This slope has a direction too: it points the way up, and the longer it is, the steeper the climb.', code: 'up' },
        { id: 'level', say: 'Swing a quarter turn away from it, along the ring, and f barely changes. The gradient crosses the rings at right angles.', code: 'level' },
      ],
    },
    {
      id: 'down',
      title: 'Nabla, and the way down',
      codeTitle: 'down.py',
      code: `
        df = np.array([2, 4])  # ∇f          #@nabla
        -df       # [-2, -4]: fastest down   #@down
        # [0, -4]: only v, slower down       #@slow
        # [-4, 2]: along the ring, level     #@slow
      `,
      beats: [
        { id: 'nabla', say: 'The gradient of f is written {∇f|nabla f}: f, with an upside-down triangle in front, called nabla. Here, {∇f = [2, 4]|nabla f is two and four}.', code: 'nabla' },
        { id: 'hamilton', say: 'William Rowan Hamilton, who named the vector, wrote this triangle in 1846, lying on its side. Peter Guthrie {Tait|Tate} stood it upright in an 1867 textbook.', code: 'nabla' },
        { id: 'smith', say: 'William Robertson Smith suggested its name: nabla, after an ancient harp of that shape.', code: 'nabla' },
        { id: 'down', say: 'To make f smaller, step the opposite way, along {−∇f|minus nabla f}: minus two and minus four. That is straight downhill, where f falls fastest.', code: 'down' },
        { id: 'others', say: 'A step along v alone still goes down, but more slowly. A step along the ring hardly changes f at all.', code: 'slow' },
      ],
    },
    {
      id: 'shape',
      title: 'One entry per input',
      codeTitle: 'shape.py',
      code: `
        W = np.random.randn(3, 4)  # 12 in   #@W
        # f(W): one number out               #@L
        df = np.zeros_like(W)      # ∂f/∂W   #@g
        df.shape                   # (3, 4)  #@g
        df[1, 2]  # f's slope in W[1, 2]     #@entry
        w = np.random.randn(5)               #@vec
        # ∂f/∂w: shape (5,)                  #@vec
      `,
      beats: [
        { id: 'many', say: 'Nothing limits this to two inputs. Here f takes a whole grid of numbers, W, with three rows and four columns: twelve inputs, and one number out.', code: ['W', 'L'] },
        { id: 'g', say: 'Twelve inputs make a bowl no one can draw, but the rule holds: one partial per input, so twelve partials. They are laid out exactly like W, three by four.', code: 'g' },
        { id: 'name', say: 'Since it holds the slopes of f in the entries of W, the gradient is also written {∂f/∂W|partial f, partial W}.', code: ['g', 'entry'] },
        { id: 'vec', say: 'A vector w of five numbers works the same way: its gradient is five numbers, shape {(5,)|five, comma}. The gradient always has the shape of the input.', code: 'vec' },
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        def f(u, v):                         #@p
            return 2*u**2 + u*v + 4*v        #@p
        # at (u, v) = (1, 2)                 #@p
        df_du = 4*1 + 2    # 4u + v = 6      #@du
        df_dv = 1 + 4      # u + 4 = 5       #@dv
        df = np.array([6, 5])  # u, then v   #@stack
      `,
      beats: [
        { id: 'p', say: 'Try one. {f(u, v) = 2u² + uv + 4v|f of u and v is two u squared, plus u v, plus four v}. What is {∇f|nabla f} at the point one, two?', code: 'p' },
        { id: 'du', say: 'For the first entry, hold v still. Two u squared gives four u. u v is v times u, so it gives v. Four v does not move, so it gives zero.', code: 'p' },
        { id: 'du-n', say: 'So {∂f/∂u = 4u + v|partial f, partial u is four u plus v}. At one, two, that is four plus two: six.', code: 'du' },
        { id: 'dv', say: 'For the second entry, hold u still. Two u squared gives zero. u v is u times v, so it gives u. And four v gives four.', code: 'p' },
        { id: 'dv-n', say: 'So {∂f/∂v = u + 4|partial f, partial v is u plus four}: one plus four, five.', code: 'dv' },
        { id: 'stack', say: 'Stack them in order, u first: {∇f = [6, 5]|nabla f is six and five}.', code: 'stack' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
