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
        { id: 'against', say: 'So to go downhill, step the other way, against the gradient. w moves left, and f drops.', code: 'step' },
        { id: 'left', say: 'On the other side of the valley the slope is negative, so stepping against it moves w to the right. Either way, the step goes downhill.', code: ['g', 'step'] },
      ],
    },
    {
      id: 'rule',
      title: 'The update',
      codeTitle: 'step.py',
      code: `
        eta = 0.5                       #@eta
        w = w - eta * g                 #@rule
        # g: 2.8, 1.4, 0.7, 0.35 ...    #@steep
        w = np.array([1.0, -0.5])       #@vec
        g = np.array([2.0, -1.0])       #@vec
        w = w - 0.1 * g   # [0.8, -0.4] #@vec
      `,
      beats: [
        { id: 'rule', say: 'That is the whole rule. The new w is the old w, minus {η|eta} times g.', code: 'rule' },
        { id: 'eta', say: '{η|Eta} is the step size: a small positive number that sets how far each step goes.', code: 'eta' },
        { id: 'steep', say: 'The step is proportional to g, so a steep slope makes a big step. Near the bottom the slope flattens, and the steps shrink on their own.', code: ['rule', 'steep'] },
        { id: 'vector', say: 'When w is a vector, every entry steps at once, each against its own entry of the gradient. One and minus a half become {0.8|zero point eight} and minus {0.4|zero point four}.', code: 'vec' },
      ],
    },
    {
      id: 'drop',
      title: 'How much f drops',
      codeTitle: 'drop.py',
      code: `
        w, g, eta = 3.0, 2.0, 0.1
        dw = -eta * g         # -0.2           #@move
        df = g * dw           # -0.4, about    #@dL
        # = -eta * g**2: never above 0         #@sq
      `,
      beats: [
        { id: 'tangent', say: 'How much does one step lower f? Close up, the curve is almost its tangent line, so f changes by about the slope times the move.', code: 'move' },
        { id: 'formula', say: 'The move is minus {η|eta} g. Times the slope g, that is minus {η|eta} g squared. Here, minus {0.4|zero point four}, and the true change is minus {0.38|zero point three eight}.', code: ['dL', 'sq'] },
        { id: 'always', say: 'g squared is never negative, so a small enough step never raises f. When w is a vector, each entry adds its own minus {η|eta} g squared.', code: 'sq' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
