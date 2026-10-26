import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gd-step',
  title: 'Gradient step',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'uphill',
      title: 'The gradient points uphill',
      codeTitle: 'step.py',
      code: `
        w = 3.0                       #@w
        f = 0.5 * (w - 1)**2 + 0.5    #@w
        g = w - 1        # slope: 2.0 #@g
        w = w - eta * g               #@step
      `,
      beats: [
        { id: 'curve', say: 'The goal is to make a function as small as possible. Here is f as a function of a single number, w, which sits at three.', code: 'w' },
        { id: 'slope', say: 'The gradient, g, is the slope of f right there. It is plus two: moving w to the right makes f go up.', code: 'g' },
        { id: 'against', say: 'So to go downhill, step the other way, against the gradient: a move of minus {η|eta} times g, where {η|eta}, the Greek letter eta, is a small positive number. w moves left, and f drops.', code: 'step' },
        { id: 'left', say: 'On the other side of the valley the slope is negative, so stepping against it moves w to the right. Either way, the step goes downhill.', code: ['g', 'step'] },
      ],
    },
    {
      id: 'rule',
      title: 'The update',
      codeTitle: 'step.py',
      code: `
        eta = 0.5                          #@eta
        w = w - eta * g                    #@rule
        3 - 0.5 * 2          # 2.0         #@num
        -1 - 0.5 * (-2)      # 0.0         #@neg
        # g: 2, 1, 0.5, 0.25 ...           #@steep
        w = np.array([1.0, -0.5])          #@vec
        g = np.array([2.0, -1.0])          #@vec
        0.1 * g              # [0.2, -0.1] #@vnum
        w - 0.1 * g          # [0.8, -0.4] #@vnum
      `,
      beats: [
        { id: 'rule', say: 'That is the whole rule, written {w ← w − ηg|w gets w minus eta g}. The arrow reads “gets”: the new w is the old w, minus {η|eta} times g.', code: 'rule' },
        { id: 'eta', say: '{η|Eta} is the step size: a small positive number that sets how far each step goes.', code: 'eta' },
        { id: 'num', say: 'Try it where w is three and the slope g is two, with {η|eta} equal to {0.5|zero point five}. The step, {η|eta} times g, is one, and three minus one is two.', code: 'num' },
        { id: 'neg', say: 'At minus one the slope is minus two, so {η|eta} times g is minus one. Subtracting a negative adds: minus one, plus one, is zero. w moves right, still downhill.', code: 'neg' },
        { id: 'steep', say: 'The step is proportional to g, so a steep slope makes a big step. From three, g goes two, one, a half: near the bottom the slope flattens, and the steps shrink on their own.', code: ['rule', 'steep'] },
        { id: 'vector', say: 'When w is a vector, every entry steps at once. Entry i, written {wᵢ|w sub i} with the index set low, moves against {gᵢ|g sub i}, its own entry of the gradient.', code: 'vec' },
        { id: 'vnum', say: 'With w equal to one and minus a half, g equal to two and minus one, and {η|eta} {0.1|zero point one}: {η|eta} times g is {0.2|zero point two} and minus {0.1|zero point one}. Subtract entry by entry, and w becomes {0.8|zero point eight} and minus {0.4|zero point four}.', code: 'vnum' },
      ],
    },
    {
      id: 'drop',
      title: 'How much f drops',
      codeTitle: 'drop.py',
      code: `
        w, g, eta = 3.0, 2.0, 0.1
        dw = -eta * g         # -0.2              #@move
        df = g * dw           # -0.4, about       #@dL
        # = -eta * g**2: never above 0            #@sq
        g = np.array([2.0, -1.0])                 #@sum
        -0.1 * (g**2).sum()   # -0.1 * 5 = -0.5   #@sum
      `,
      beats: [
        { id: 'tangent', say: 'How much does one step lower f? Close up, the curve is almost its tangent line, so f changes by about the slope times the move.', code: 'move' },
        { id: 'formula', say: 'The move is minus {η|eta} g. Times the slope g, that is minus {η|eta} g squared. Here, minus {0.4|zero point four}, and the true change is minus {0.38|zero point three eight}.', code: ['dL', 'sq'] },
        { id: 'always', say: '{η|Eta} g squared is never negative, written {ηg² ≥ 0|eta g squared is at least zero}, where the sign {≥|greater than or equal} reads “is at least”. So a small enough step never raises f.', code: 'sq' },
        { id: 'sum', say: 'When w is a vector, each entry adds its own minus {η|eta} g squared. For g of two and minus one, with {η|eta} {0.1|zero point one}: two squared, plus minus one squared, is four plus one, five. Minus {0.1|zero point one} times five is minus {0.5|zero point five}.', code: 'sum' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
