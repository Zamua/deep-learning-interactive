import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sigmoid-grad',
  title: 'Sigmoid gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Verhulst', year: 1838, title: 'Notice sur la loi que la population suit dans son accroissement', url: 'https://archive.org/details/correspondancem07unkngoog/page/113/mode/1up', scene: 'grow' },
  ],
  scenes: [
    {
      id: 'grow',
      title: 'Growth that levels off',
      codeTitle: 'sigmoid.py',
      code: `
        np.exp(x)      # grows without end   #@exp
        # Verhulst: growth that levels off   #@limit
        def sigmoid(x):                      #@def
            return 1 / (1 + np.exp(-x))      #@def
        sigmoid(0)   # 1 / (1 + 1) = 0.5     #@zero
        sigmoid(2)   # 1 / 1.14 = 0.88       #@two
        sigmoid(-2)  # 1 / 8.39 = 0.12       #@neg
      `,
      beats: [
        { id: 'exp', say: 'Growth that never stops is e to the x: it climbs faster and faster, without end.', code: 'exp' },
        { id: 'room', say: 'A real population cannot keep that up: it runs out of land and food.', code: 'limit' },
        { id: 'verhulst', say: 'In 1838, the Belgian mathematician {Pierre-François Verhulst|Pierre François Verhulst} put that in an equation: the bigger a population gets, the more its own size holds its growth back.', code: 'limit' },
        { id: 'S', say: 'His curve starts like e to the x, then bends and levels off below a limit it never quite reaches. With the limit at one and the bend at zero, it is this S.', code: 'limit' },
        { id: 'name', say: 'That shape gives it its name: sigmoid means shaped like a sigma, the Greek letter S. Its symbol is a small sigma, {σ|written like this}.', code: 'def' },
        { id: 'def', say: 'In its simplest form, his curve is one over, one plus e to the minus x.', code: 'def' },
        { id: 'squash', say: 'Any number can go in, and what comes out lies between zero and one: near zero far to the left, near one far to the right.', code: 'def' },
        { id: 'zero', say: 'At zero, e to the zero is one, so sigma is one over two: a half, the middle of the S.', code: 'zero' },
        { id: 'two', say: 'At two, e to the minus two is small, about {0.14|zero point one four}, so sigma is close to one: about {0.88|zero point eight eight}.', code: 'two' },
        { id: 'neg', say: 'At minus two, e to the minus x is e squared, about {7.39|seven point three nine}. That is big, so sigma is small: about {0.12|zero point one two}.', code: 'neg' },
      ],
    },
    {
      id: 'slope',
      title: 'How steep is the S?',
      codeTitle: 'slope.py',
      code: `
        # the node's local slope: ?            #@need
        sigmoid(0.01) - sigmoid(0)  # 0.0025   #@n0
        0.0025 / 0.01               # 0.25     #@n0
        sigmoid(2.01) - sigmoid(2)  # 0.00105  #@n2
        0.00105 / 0.01              # 0.105    #@n2
        0.5 * (1 - 0.5)             # 0.25     #@p0
        0.881 * (1 - 0.881)         # 0.105    #@p2
        local = out * (1 - out)                #@rule
      `,
      beats: [
        { id: 'need', say: 'In a graph, a sigmoid node sends the gradient back like any node: times its local slope. So how steep is the S?', code: 'need' },
        { id: 'n0', say: 'Measure it with a nudge. Move x from zero to {0.01|zero point zero one}, and sigma rises by {0.0025|zero point zero zero two five}: a slope of a quarter.', code: 'n0' },
        { id: 'slide', say: 'Slide along the S, and the tangent tilts less and less. By two, it is much flatter.', code: 'n2' },
        { id: 'n2', say: 'There, the same nudge raises sigma by only about {0.00105|zero point zero zero one zero five}: a slope of about {0.105|zero point one zero five}.', code: 'n2' },
        { id: 'rule', say: 'Verhulst\'s equation predicts both. In its simplest form, it says the growth rate is how much there is, times how much room is left.', code: 'rule' },
        { id: 'p0', say: 'At zero, half the room is filled and half is left: a half times a half is a quarter, the slope we measured.', code: 'p0' },
        { id: 'p2', say: 'At two, sigma is about {0.881|zero point eight eight one}, with {0.119|zero point one one nine} left. Their product is about {0.105|zero point one zero five}, again.', code: 'p2' },
        { id: 'formula', say: 'So the slope, {dσ/dx|d sigma, d x}, is sigma times one minus sigma, at every x. The node can build it from its own output.', code: 'rule' },
      ],
    },
    {
      id: 'node',
      title: 'Never more than a quarter',
      codeTitle: 'node.py',
      code: `
        # slope: 0.25 at x = 0, less elsewhere #@plot
        out = sigmoid(2)            # 0.881    #@fwd
        dout = 2                    # above    #@fwd
        dx = out * (1 - out) * dout # 0.21     #@dx
        # dx is at most 0.25 * dout            #@most
      `,
      beats: [
        { id: 'plot', say: 'Plot that slope at every x, and you get a hill: a quarter at zero, its peak, falling away on both sides.', code: 'plot' },
        { id: 'chain', say: 'Now a sigmoid node at x equals two, and say a gradient of two arrives from above: {∂f/∂σ|partial f, partial sigma}.', code: 'fwd' },
        { id: 'dx', say: 'The node multiplies it by its local slope, {0.105|zero point one zero five}, so x gets about {0.21|zero point two one}.', code: 'dx' },
        { id: 'most', say: 'Wherever x is, the slope is at most a quarter. So x gets at most a quarter of what arrives: with two from above, never more than a half.', code: 'most' },
      ],
    },
    {
      id: 'flat',
      title: 'Saturation',
      codeTitle: 'saturate.py',
      code: `
        out = sigmoid(6)          # 0.9975   #@six
        out * (1 - out)           # 0.0025   #@tiny
        out = sigmoid(-6)         # 0.0025   #@mirror
        out * (1 - out)           # 0.0025   #@mirror
        # dout = 1: x gets 0.0025            #@dead
      `,
      beats: [
        { id: 'six', say: 'Far from zero, the S goes flat. At six, sigma is {0.9975|zero point nine nine seven five}: the room is all but full.', code: 'six' },
        { id: 'tiny', say: 'With almost no room left, the slope is tiny: about {0.0025|zero point zero zero two five}.', code: 'tiny' },
        { id: 'mirror', say: 'At minus six, the mirror image: almost nothing there yet, so the same tiny slope.', code: 'mirror' },
        { id: 'name', say: 'A sigmoid stuck near zero or one is called saturated, like a soaked sponge that takes in no more: nudge x, and its output barely moves.', code: ['six', 'mirror'] },
        { id: 'dead', say: 'So almost no gradient gets through: with one arriving from above, x gets about {0.0025|zero point zero zero two five}.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
