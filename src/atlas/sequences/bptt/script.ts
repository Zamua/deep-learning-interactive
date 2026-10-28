import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-bptt',
  title: 'Backprop through time',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Werbos', year: 1990, title: 'Backpropagation through time: what it does and how to do it', url: 'https://doi.org/10.1109/5.58337', scene: 'unroll' },
    { who: 'Bengio, Simard & Frasconi', year: 1994, title: 'Learning long-term dependencies with gradient descent is difficult', url: 'https://doi.org/10.1109/72.279181', scene: 'products' },
    { who: 'Pascanu, Mikolov & Bengio', year: 2013, title: 'On the difficulty of training recurrent neural networks', url: 'https://arxiv.org/abs/1211.5063', scene: 'clip' },
  ],
  scenes: [
    {
      id: 'unroll',
      title: 'Unroll the loop',
      codeTitle: 'bptt.py',
      code: `
        h = np.zeros(H)
        for x in xs:          # one token   #@loop
            h = np.tanh(Whh @ h + Wxh @ x + b)  #@loop
        L = loss(h)           # one number  #@loss
        # unrolled: step 1, 2, 3            #@unroll
        # backward: step 3, 2, 1            #@back
      `,
      beats: [
        { id: 'loop', say: 'A recurrent network, an {RNN|R N N}, reads one token at a time: a single step, in a loop, takes each token and the memory, h, and passes the new memory on.', code: 'loop' },
        { id: 'loss', say: 'After the last token, a loss, L, is worked out from the final memory: one number saying how wrong the network was.', code: 'loss' },
        { id: 'need', say: 'To learn, each weight needs its gradient. But {W_hh|W h h} acted at every step, each step feeding the next. How does a gradient get back through a loop?', code: ['loop', 'loss'] },
        { id: 'unroll', say: 'Lay the loop out flat, one copy of the step per token: that is unrolling. No loop is left, just a deep graph whose copies share the same weights.', code: 'unroll' },
        { id: 'back', say: 'So backprop runs through it like any graph, from the loss back to step one. The steps are moments in time, so this is called backpropagation through time: {BPTT|B P T T}.', code: 'back' },
        { id: 'werbos', say: 'In 1990, Paul Werbos spelled it out in a paper titled Backpropagation Through Time: What It Does and How to Do It, noting that the derivatives can only be found backwards in time.', code: 'back' },
      ],
    },
    {
      id: 'rules',
      title: 'One step back',
      codeTitle: 'backward.py',
      code: `
        # one unit, one step back:
        d = Whh * (1 - h**2)   # dh_t/dh_t-1  #@factor
        #   Whh: mixed the old memory    #@whh
        #   1 - h**2: the tanh's slope   #@tanh
        dh = dh * d            # pass it on   #@factor
        # Whh used at steps 1, 2, 3      #@sum
        dWhh = 3 + (-1) + 2    # 4            #@add
      `,
      beats: [
        { id: 'factor', say: 'Zoom in on one step back. The gradient reaching {hₜ|h t} passes on to {hₜ₋₁|h t minus one}, times the local slope, {∂hₜ/∂hₜ₋₁|partial h t, partial h t minus one}: how far one moves when the other is nudged.', code: 'factor' },
        { id: 'whh', say: 'The step multiplied the old memory by {W_hh|W h h}: that is one part of the slope.', code: 'whh' },
        { id: 'tanh', say: 'Then came the tanh, whose slope, {tanh′|tanh prime}, is the other part. For one hidden unit, a step back multiplies by {W_hh|W h h} times {tanh′|tanh prime}.', code: 'tanh' },
        { id: 'sum', say: 'And {W_hh|W h h} was used at every step. Like any value feeding several nodes, it collects a gradient from each use, and they add up.', code: 'sum' },
        { id: 'add', say: 'If steps one, two and three send back three, minus one, and two, its gradient is their sum: four.', code: 'add' },
      ],
    },
    {
      id: 'products',
      title: 'Long products',
      codeTitle: 'products.py',
      code: `
        a = 2.0 * 0.25       # Whh * tanh'  #@slope
        grad = 1.0                          #@loop
        for _ in range(10):  # 10 steps     #@loop
            grad = grad * a                 #@loop
        # a = 0.5: 0.5 ** 10 ~ 0.001        #@vanish
        # a = 2:   2 ** 10 = 1024           #@explode
        # a = 0.9: 0.9 ** 100 ~ 0.00003     #@near
      `,
      beats: [
        { id: 'scalar', say: 'Now go many steps back, with one hidden unit and the same slope, {a|A}, at every step. Ten steps multiply the gradient by {a|A} ten times: {a¹⁰|A to the tenth}.', code: 'loop' },
        { id: 'slope', say: 'Say {W_hh|W h h} is two, and the tanh\'s slope is a quarter. Then {a|A} is two times a quarter: one half.', code: 'slope' },
        { id: 'vanish', say: 'One half to the tenth is about a thousandth. The gradient vanishes, as through a deep stack of sigmoids: the early tokens get almost none of it.', code: 'vanish' },
        { id: 'explode', say: 'If {a|A} is two instead, two to the tenth is over a thousand: the gradient explodes.', code: 'explode' },
        { id: 'near', say: 'Even {0.9|zero point nine}, over a hundred steps, shrinks the gradient to about three in a hundred thousand. Only exactly one keeps its size.', code: 'near' },
        { id: 'bengio', say: 'In 1994, Yoshua Bengio, Patrice Simard and Paolo Frasconi showed why: the longer the stretch a memory must span, the harder it is to learn by gradient.', code: ['vanish', 'explode'] },
      ],
    },
    {
      id: 'clip',
      title: 'Clip the norm',
      codeTitle: 'clip.py',
      code: `
        g = np.array([3.0, 4.0])             #@g
        n = np.linalg.norm(g)  # 5           #@norm
        c = 1.0                # the limit   #@c
        if n > c:                            #@scale
            g = g * c / n      # [0.6, 0.8]  #@scale
      `,
      beats: [
        { id: 'fix', say: 'Exploding has a blunt fix, proposed in 2013 by Razvan Pascanu, Tomas Mikolov and Yoshua Bengio: clip the gradient\'s norm.', code: 'scale' },
        { id: 'g', say: 'Draw a gradient as an arrow, and call it g: here, three and four. Its length is called its norm, and is written {‖g‖|with double bars}.', code: 'g' },
        { id: 'norm', say: 'Pythagoras gives it: square each entry, add them, and take the square root. Here that is {√(3² + 4²) = 5|the root of three squared plus four squared: five}.', code: 'norm' },
        { id: 'c', say: 'Pick a threshold, c, the longest gradient allowed: say one.', code: 'c' },
        { id: 'scale', say: 'Five is over one, so shrink the arrow to length one: multiply every entry by c over the norm, a fifth. That gives {0.6|zero point six} and {0.8|zero point eight}.', code: 'scale' },
        { id: 'same', say: 'Same direction, shorter length. A gradient already within c is left alone.', code: 'scale' },
        { id: 'limit', say: 'Clipping only ever shrinks: it tames a gradient that explodes, but cannot bring back one that has vanished.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
