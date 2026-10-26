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
      id: 'formula',
      title: 'The slope at every x',
      codeTitle: 'formula.py',
      code: `
        du_dx = 3                  # inside: 3x + 1   #@letter
        dz_du = lambda u: 2 * u    # outside: u**2    #@outer
        # dz/dx = 2u * 3 = 6u                         #@times
        dz_dx = lambda x: 6 * (3 * x + 1)             #@sub
        dz_dx(1)                   # 24               #@check
        # inside x**2: 2x; outside e**u: e**u         #@curve
        dz_dx = lambda x: 2 * x * np.exp(x**2)        #@curve2
      `,
      beats: [
        { id: 'letter', say: 'That was the slope at one point. To get it at every x, keep u as a letter. The inside, three x plus one, has slope three wherever x is.', code: 'letter' },
        { id: 'outer', say: 'The outside, u squared, has slope two u. Leave it written in u.', code: 'outer' },
        { id: 'times', say: 'Multiply them: two u times three is six u.', code: 'times' },
        { id: 'sub', say: 'Six u is still in u. Put the inside back in for u, and {dz/dx = 6(3x + 1)|d z, d x is six times, three x plus one}: a formula in x.', code: 'sub' },
        { id: 'check', say: 'At x equals one, the inside is four, and six times four is twenty four: the slope found before.', code: 'check' },
        { id: 'curve', say: 'The inside need not be a line. In {e^(x²)|e to the x squared}, the inside is x squared, with slope two x. The outside, e to the u, is its own derivative.', code: 'curve' },
        { id: 'curve2', say: 'Multiply, e to the u times two x, and put x squared back in for u: {dz/dx = 2x e^(x²)|d z, d x is two x, e to the x squared}.', code: 'curve2' },
      ],
    },
    {
      id: 'back',
      title: 'Walk back, then try one',
      codeTitle: 'back.py',
      code: `
        # x -> u -> v -> z: slopes 3, -2, 0.5   #@fwd
        dz_dv = 0.5               # 0.5          #@v
        dz_du = dz_dv * -2        # -1.0         #@u
        dz_dx = dz_du * 3         # -3.0         #@x
        # z = ln(2x + 3)                         #@p1
        du_dx = 2                 # u = 2x + 3   #@in1
        dz_du = lambda u: 1 / u   # z = ln u     #@out1
        dz_dx = lambda x: 2 / (2 * x + 3)        #@a1
      `,
      beats: [
        { id: 'longer', say: 'A chain can be as long as you like. Here x feeds u, u feeds v, and v feeds z, with local slopes three, minus two, and a half.', code: 'fwd' },
        { id: 'back', say: 'Start at the end and walk backwards, multiplying as you go: a half, times minus two is minus one, times three is minus three.', code: ['v', 'u', 'x'] },
        { id: 'backprop', say: 'So {dz/dx|d z, d x} is minus three. On the way, the walk also found the slope of z with respect to v and to u.', code: 'x' },
        { id: 'p1', say: 'Now one as a formula. What is the derivative of {ln(2x + 3)|ln of two x plus three} with respect to x? Call it z.', code: 'p1' },
        { id: 'in1', say: 'The inside is {u = 2x + 3|u equals two x plus three}, with slope two.', code: 'in1' },
        { id: 'out1', say: 'The outside is ln u, whose slope is one over u.', code: 'out1' },
        { id: 'a1', say: 'Multiply: one over u, times two, is two over u. Put the inside back in for u: {dz/dx = 2/(2x + 3)|d z, d x is two over, two x plus three}.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
