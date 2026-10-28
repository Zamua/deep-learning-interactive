import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gd-step',
  title: 'Gradient step',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Cauchy', year: 1847, title: 'Méthode générale pour la résolution des systèmes d\'équations simultanées', url: 'https://archive.org/details/comptesrendusheb25acad', scene: 'walk' },
  ],
  scenes: [
    {
      id: 'walk',
      title: 'Downhill in fog',
      codeTitle: 'walk.py',
      code: `
        def f(u, v):                  #@f
            return u**2 + 2*v**2      #@f
        u, v = 1.0, 1.0    # you      #@p
        # gradient here: [2, 4]       #@g
        # so head along [-2, -4]      #@down
        # a short step, then again    #@walk
      `,
      beats: [
        { id: 'bowl', say: 'Here is the bowl from the gradient, {f(u, v) = u² + 2v²|f of u and v is u squared plus two v squared}, seen from above, with a point at one, one. The task now: get to the bottom, where f is smallest.', code: ['f', 'p'] },
        { id: 'fog', say: 'This bowl can be seen whole. A function of thousands of inputs cannot be drawn, so all you can learn is how it slopes right where you stand, like a walker in thick fog who feels only the ground underfoot.', code: 'p' },
        { id: 'down', say: 'That is enough to choose a direction. The gradient, two, four, points straight uphill, so head the opposite way, along minus two, minus four: straight downhill.', code: ['g', 'down'] },
        { id: 'short', say: 'But go only a short way, since the slope you felt holds only near your feet. Take a small step, then feel the slope again where you land.', code: 'walk' },
        { id: 'walk', say: 'Step after step, each one straight downhill from wherever you stand, the walk winds its way to the bottom.', code: 'walk' },
        { id: 'cauchy', say: 'Augustin-Louis Cauchy proposed this walk in 1847. Working out the orbit of a heavenly body meant solving many equations at once, so he folded them into one function to make small, and stepped against its slopes.', code: 'walk' },
      ],
    },
    {
      id: 'rule',
      title: 'The update',
      codeTitle: 'step.py',
      code: `
        w = np.array([1.0, 1.0])     #@w
        g = np.array([2.0, 4.0])     #@g
        eta = 0.1    # step size     #@eta
        eta * g      # [0.2, 0.4]    #@eg
        w - eta * g  # [0.8, 0.6]    #@new
        w = w - eta * g              #@rule
        # at [-1, 1], g is [-2, 4]   #@sign
      `,
      beats: [
        { id: 'w', say: 'Now give things names. Gather the inputs into one vector, w, for where you stand: here, one, one.', code: 'w' },
        { id: 'g', say: 'Call the gradient at w just g: two, four.', code: 'g' },
        { id: 'eta', say: 'How far to step is set by a small positive number, {η|eta}, the Greek letter eta, called the step size. Here it is {0.1|zero point one}.', code: 'eta' },
        { id: 'eg', say: 'The step goes against g, scaled by {η|eta}. {η|Eta} times g is {0.2|zero point two}, {0.4|zero point four}: the gradient, cut to a tenth.', code: 'eg' },
        { id: 'new', say: 'Subtract that from w, entry by entry, and w becomes {0.8|zero point eight}, {0.6|zero point six}: one step down the bowl.', code: 'new' },
        { id: 'rule', say: 'That is the whole rule, written {w ← w − ηg|w gets w minus eta g}. The arrow reads “gets”: the new w is the old w, minus {η|eta} times g.', code: 'rule' },
        { id: 'sign', say: 'Each entry moves against its own slope. From minus one, one, the gradient is minus two, four. Subtracting {η|eta} times minus two adds, so u moves right, toward the bottom, while v moves down.', code: ['rule', 'sign'] },
        { id: 'which', say: 'So the sign of each entry of g decides which way that entry of w goes. {η|Eta} is always positive: it sets how far, never which way.', code: ['eta', 'rule'] },
        { id: 'steep', say: 'And twice the slope makes twice the step. Near the bottom the bowl flattens, g shrinks, and the steps shrink on their own.', code: 'rule' },
      ],
    },
    {
      id: 'drop',
      title: 'How much f drops',
      codeTitle: 'drop.py',
      code: `
        g = np.array([2.0, 4.0])        #@g
        dw = -0.1 * g   # [-0.2, -0.4]  #@dw
        g * dw          # [-0.4, -1.6]  #@dw
        # each: -eta * g[i]**2 <= 0     #@sq
        (g**2).sum()    # 4 + 16 = 20   #@sum
        -0.1 * 20       # about -2.0    #@est
        f(0.8, 0.6) - f(1, 1)  # -1.64  #@true
      `,
      beats: [
        { id: 'ask', say: 'How much lower is f after that step? The gradient answers this too: a small move changes f by about each slope times its move, added up.', code: ['g', 'dw'] },
        { id: 'each', say: 'Each entry moved by minus {η|eta} times its own slope. Times that slope again, its share of the change is minus {η|eta} times its slope squared.', code: 'sq' },
        { id: 'never', say: 'A square is never negative, written {g[i]² ≥ 0|g of i, squared, is at least zero}, where the sign {≥|in the middle} reads “is at least”. So every share is a drop.', code: 'sq' },
        { id: 'works', say: 'That is why the rule works: a small enough step never raises f. Cauchy wrote down this same estimate in 1847.', code: 'sq' },
        { id: 'sum', say: 'Here, two squared plus four squared is twenty.', code: 'sum' },
        { id: 'est', say: 'Times minus {η|eta}, which is minus {0.1|zero point one}: f should drop by about two.', code: 'est' },
        { id: 'true', say: 'In fact, the new f is {1.36|one point three six}, down from three: a drop of {1.64|one point six four}. Close, and closer still for a smaller step.', code: 'true' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
