import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-momentum',
  title: 'Momentum',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'ravine',
      title: 'A long, narrow valley',
      codeTitle: 'valley.py',
      code: `
        # L = 0.5 * (0.05 * w0**2 + w1**2)    #@valley
        w = w - lr * g            # plain     #@plain
        v = mu * v - lr * g       # momentum  #@mom
        w = w + v                             #@mom
      `,
      beats: [
        { id: 'valley', say: 'Here is a loss, L, the function training makes small. It is shaped like a long, narrow valley, seen from above: steep across, and nearly flat along its length.', code: 'valley' },
        { id: 'zig', say: 'Plain gradient descent zigzags. Across the valley the slope is steep, so each step overshoots to the other side and the gradient flips sign. Along it the slope is gentle, so progress crawls.', code: 'plain' },
        { id: 'idea', say: 'Momentum gives the weights a velocity, v: a running blend of past gradients. Stepping along it, the zigzag calms down and the run speeds up.', code: 'mom' },
      ],
    },
    {
      id: 'rule',
      title: 'The update',
      codeTitle: 'momentum.py',
      code: `
        mu, lr = 0.9, 0.1                     #@mu
        v = mu * v - lr * g                   #@v
        w = w + v                             #@w
        # g = 2, 2:  v = -0.2, then -0.38     #@ex
      `,
      beats: [
        { id: 'rule', say: 'Each step, the velocity keeps a share, {μ|mu}, the Greek letter mu, of itself, and adds minus {η|eta} times the gradient: {v ← μv − ηg|v gets mu v minus eta g}. Then the weights move by the velocity: {w ← w + v|w gets w plus v}.', code: ['v', 'w'] },
        { id: 'mu', say: '{μ|Mu}, often {0.9|zero point nine}, is how much velocity survives a step: think of one minus friction.', code: 'mu' },
        { id: 'first', say: 'From rest, with {η|eta} at {0.1|zero point one} and a gradient of two, the first velocity is minus {0.2|zero point two}: just a plain step. w goes from one to {0.8|zero point eight}.', code: ['v', 'w'] },
        { id: 'second', say: 'If the gradient is two again, the velocity becomes {0.9|zero point nine} times minus {0.2|zero point two}, minus another {0.2|zero point two}: minus {0.38|zero point three eight}. So w moves to {0.42|zero point four two}.', code: 'ex' },
      ],
    },
    {
      id: 'build',
      title: 'Agree and build, flip and cancel',
      codeTitle: 'velocity.py',
      code: `
        # same gradient every step: pushes add up    #@steady
        # v: -0.2, -0.38, -0.54, -0.69, ...          #@steady
        # it settles where v == 0.9 * v - 0.2        #@settle
        # 0.1 * v == -0.2, so v == -2.0              #@solve
        v_limit = -lr * g / (1 - mu)   # 10x a step  #@limit
        # gradient flips every step: pushes cancel   #@flip
      `,
      beats: [
        { id: 'steady', say: 'When the gradient keeps pointing the same way, the pushes pile up in v. Keep the gradient at two: v goes minus {0.2|zero point two}, minus {0.38|zero point three eight}, then about minus {0.54|zero point five four} and minus {0.69|zero point six nine}, each step adding a little less.', code: 'steady' },
        { id: 'settle', say: 'It levels off where a step no longer changes it: where v equals {0.9|zero point nine} v, minus {0.2|zero point two}.', code: 'settle' },
        { id: 'solve', say: 'Take {0.9|zero point nine} v from both sides: {0.1|zero point one} v is minus {0.2|zero point two}. So v is minus two: ten plain steps.', code: 'solve' },
        { id: 'limit', say: 'The same steps, with any {μ|mu}, give {v → −ηg / (1 − μ)|v approaches minus eta g over one minus mu}, the arrow read “approaches”: one over one minus {μ|mu} times a plain step.', code: 'limit' },
        { id: 'flip', say: 'When the gradient flips sign every step, each push undoes the last one inside v, and the steps shrink. The zigzag is damped.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
