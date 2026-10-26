import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-slopes',
  title: 'Chained slopes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'chain',
      title: 'A function inside a function',
      codeTitle: 'chain.py',
      code: `
        x = 1                  #@x
        u = 3 * x + 1   # 4    #@u
        z = u**2        # 16   #@z
        # z = (3x + 1)**2      #@nest
      `,
      beats: [
        { id: 'chain', say: 'Often one function feeds another. Here x goes in and u comes out, where u is three x plus one.', code: ['x', 'u'] },
        { id: 'feed', say: 'Then u feeds a second function: z is u squared.', code: 'z' },
        { id: 'nest', say: 'In one line, z is {(3x + 1)²|three x plus one, squared}. Three x plus one is the inside. The squaring wrapped around it is the outside.', code: 'nest' },
        { id: 'vals', say: 'At x equals one, u is four, and z is sixteen. How fast does z change when x is nudged? That rate is written {dz/dx|d z, d x}, read “d z, d x”: the derivative of z with respect to x, a tiny change in z over the tiny change in x that caused it.', code: ['x', 'u', 'z'] },
      ],
    },
    {
      id: 'local',
      title: 'Multiply the local slopes',
      codeTitle: 'local.py',
      code: `
        du_dx = 3              # of 3x + 1    #@du
        dz_du = 2 * u          # 8            #@dz
        # x + 0.01 -> u + 0.03 -> z + 0.24    #@nudge
        dz_dx = dz_du * du_dx  # 24           #@mult
      `,
      beats: [
        { id: 'du', say: 'Each link has its own local slope. The inside, u equals three x plus one, moves three times as fast as x: {du/dx = 3|d u, d x is three}.', code: 'du' },
        { id: 'dz', say: 'The outside, z equals u squared, has slope two u. At u equals four, {dz/du = 8|d z, d u is eight}, also written {z′(4) = 8|z prime of four is eight}.', code: 'dz' },
        { id: 'nudge', say: 'Now nudge x by {0.01|zero point zero one}. u moves three times that, {0.03|zero point zero three}. And z moves eight times that, {0.24|zero point two four}.', code: 'nudge' },
        { id: 'mult', say: 'So z moves three times eight, twenty four times as fast as x. That is the chain rule: multiply the local slopes, {dz/dx = dz/du · du/dx|d z, d x equals d z, d u times d u, d x}.', code: 'mult' },
      ],
    },
    {
      id: 'back',
      title: 'Walk back',
      codeTitle: 'back.py',
      code: `
        # x -> u -> v -> z: slopes 3, -2, 0.5   #@fwd
        dz_dv = 0.5               # 0.5          #@v
        dz_du = dz_dv * -2        # -1.0         #@u
        dz_dx = dz_du * 3         # -3.0         #@x
      `,
      beats: [
        { id: 'longer', say: 'A chain can be as long as you like. Here x feeds u, u feeds v, and v feeds z. At the current point, the local slopes are three, minus two, and a half. What is {dz/dx|d z, d x}?', code: 'fwd' },
        { id: 'back', say: 'Start at the end and walk backwards, multiplying as you go: a half, times minus two is minus one, times three is minus three.', code: ['v', 'u', 'x'] },
        { id: 'backprop', say: 'So {dz/dx|d z, d x} is minus three. On the way, the walk also found the slope of z with respect to v and to u.', code: 'x' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
