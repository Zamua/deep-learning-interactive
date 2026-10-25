import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-rule',
  title: 'Chain rule',
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
      `,
      beats: [
        { id: 'chain', say: 'Often one function feeds another. Here x goes in and u comes out, where u is three x plus one.', code: ['x', 'u'] },
        { id: 'feed', say: 'Then u feeds a second function: z is u squared.', code: 'z' },
        { id: 'vals', say: 'At x equals one, u is four, and z is sixteen. How fast does z change when x is nudged?', code: ['x', 'u', 'z'] },
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
        { id: 'du', say: 'Each link has its own local slope. u is three x plus one, so u moves three times as fast as x.', code: 'du' },
        { id: 'dz', say: 'z is u squared, whose slope is two u. At u equals four, that is eight.', code: 'dz' },
        { id: 'nudge', say: 'Now nudge x by {0.01|zero point zero one}. u moves three times that, {0.03|zero point zero three}. And z moves eight times that, {0.24|zero point two four}.', code: 'nudge' },
        { id: 'mult', say: 'So z moves three times eight, twenty four times as fast as x. That is the chain rule: multiply the local slopes.', code: 'mult' },
      ],
    },
    {
      id: 'back',
      title: 'Walk the chain backwards',
      codeTitle: 'back.py',
      code: `
        # x -> u -> v -> L: slopes 3, -2, 0.5   #@fwd
        dL_dv = 0.5               # 0.5          #@v
        dL_du = dL_dv * -2        # -1.0         #@u
        dL_dx = dL_du * 3         # -3.0         #@x
      `,
      beats: [
        { id: 'longer', say: 'A chain can be as long as you like. Here x feeds u, u feeds v, and v feeds a loss, L. Each link has a local slope.', code: 'fwd' },
        { id: 'back', say: 'Start at the end and walk backwards, multiplying as you go: a half, times minus two is minus one, times three is minus three.', code: ['v', 'u', 'x'] },
        { id: 'backprop', say: 'So a nudge to x moves the loss minus three times as much. This backward walk, multiplying local slopes, is backpropagation: how neural networks learn.', code: 'x' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        du_dx = 4                #@ask
        dz_du = 3                #@ask
        dz_dx = dz_du * du_dx    #@mult
        # 12                     #@mult
      `,
      beats: [
        { id: 'ask', think: true, say: 'Your turn. Along a chain from x to u to z, {du/dx = 4|d u d x is four} and {dz/du = 3|d z d u is three}. What is {dz/dx|d z d x}?', code: 'ask' },
        { id: 'mult', say: 'Multiply the local slopes: three times four is twelve.', code: 'mult' },
        { id: 'check', say: 'A nudge of {0.01|zero point zero one} in x moves u by {0.04|zero point zero four}, and z by {0.12|zero point one two}: twelve times as much.', code: 'mult' },
      ],
    },
  ],
};
