import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-slopes',
  title: 'Chained slopes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Leibniz', year: 1684, title: 'Nova methodus pro maximis et minimis, itemque tangentibus, quae nec fractas nec irrationales quantitates moratur, et singulare pro illis calculi genus', url: 'https://archive.org/details/s1id13206500/page/467/', scene: 'leibniz' },
  ],
  scenes: [
    {
      id: 'chain',
      title: 'Two steps in a row',
      codeTitle: 'chain.py',
      code: `
        x = 1                  #@x
        u = 3 * x + 1   # 4    #@u
        z = u**2        # 16   #@z
        # z = (3x + 1)**2      #@nest
      `,
      beats: [
        { id: 'two', say: 'Often a number reaches a result in two steps. Here x is tripled, and one is added. Then what comes out is squared.', code: ['u', 'z'] },
        { id: 'ask', say: 'Nudge x a little, and the result moves too. But how far, when x reaches it only through the middle step?', code: 'x' },
        { id: 'known', say: 'Each step alone is easy: the first is a straight line, and the power rule handles the square. What is new is the two of them in a row.', code: ['u', 'z'] },
        { id: 'u', say: 'Call the middle value u: u is three x plus one.', code: 'u' },
        { id: 'z', say: 'And call the result z: z is u squared.', code: 'z' },
        { id: 'nest', say: 'In one line, z is {(3x + 1)²|three x plus one, squared}. Three x plus one is the inside. The squaring wrapped around it is the outside.', code: 'nest' },
        { id: 'vals', say: 'At x equals one, u is four, and z is sixteen.', code: ['x', 'u', 'z'] },
      ],
    },
    {
      id: 'nudge',
      title: 'Follow a nudge',
      codeTitle: 'nudge.py',
      code: `
        x = 1 + 0.01     # nudged        #@x
        u = 3 * x + 1    # 4 + 0.03      #@u
        z = u**2         # ≈ 16 + 0.24   #@z
        0.24 / 0.01      # 24 = 3 × 8    #@mult
      `,
      beats: [
        { id: 'line', say: 'Follow a nudge along the chain. The first link, u equals three x plus one, is a straight line with slope three.', code: 'u' },
        { id: 'n1', say: 'So nudge x by {0.01|zero point zero one}, and u moves three times as far: {0.03|zero point zero three}.', code: ['x', 'u'] },
        { id: 'curve', say: 'The second link, z equals u squared, is a curve. By the power rule its slope is two u, so it changes from place to place.', code: 'z' },
        { id: 'at4', say: 'The chain sits at u equals four, so the slope that counts is the one there: two times four, eight.', code: 'z' },
        { id: 'n2', say: 'So the {0.03|zero point zero three} arriving at u is multiplied by eight on its way to z: about {0.24|zero point two four}.', code: 'z' },
        { id: 'local', say: 'Three and eight are the local slopes: each link\'s own slope, right where the chain is now.', code: ['u', 'z'] },
        { id: 'mult', say: 'So z moves three times eight, twenty four times as far as x. Not three plus eight: each link multiplies the change it receives.', code: 'mult' },
        { id: 'name', say: 'That is the chain rule: along a chain of functions, the local slopes multiply.', code: 'mult' },
      ],
    },
    {
      id: 'leibniz',
      title: 'Writing it as d z, d x',
      codeTitle: 'rates.py',
      code: `
        du_dx = 3              # inside      #@du
        dz_du = 2 * u          # 8 at u = 4  #@dz
        dz_dx = dz_du * du_dx  # 24          #@dx
      `,
      beats: [
        { id: 'rate', say: 'That twenty four is the derivative of z with respect to x: how fast z changes, per change in x.', code: 'dx' },
        { id: 'dzdx', say: 'It is written {dz/dx|d z, d x}: a tiny change in z, over the tiny change in x that caused it.', code: 'dx' },
        { id: 'leibniz', say: 'The notation comes from Gottfried Wilhelm Leibniz. In 1684, in the first published paper on calculus, he called a tiny change in x, {dx|d x}: d, for difference.', code: 'dx' },
        { id: 'du', say: 'Each link gets its own rate as well. For the inside, {du/dx|d u, d x} is three.', code: 'du' },
        { id: 'dz', say: 'For the outside, {dz/du|d z, d u} is eight.', code: 'dz' },
        { id: 'rule', say: 'So the chain rule reads: {dz/dx|d z, d x} equals {dz/du|d z, d u} times {du/dx|d u, d x}. Written this way, the d u on the bottom and the d u on top seem to cancel, like fractions.', code: 'dx' },
        { id: 'prime', say: 'In prime notation, the same product is {z′(4) · u′(1)|z prime of four, times u prime of one}. The outside\'s slope is taken at four, where u is, not at one, where x is.', code: ['dz', 'du'] },
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
        { id: 'longer', say: 'A chain can be as long as you like. Here x feeds u, u feeds v, and v feeds z, with local slopes three, minus two, and a half. What is {dz/dx|d z, d x}?', code: 'fwd' },
        { id: 'back', say: 'Start at the end and walk backwards, multiplying as you go. A half, times minus two, is minus one.', code: ['v', 'u'] },
        { id: 'x', say: 'Times three is minus three. So {dz/dx|d z, d x} is minus three.', code: 'x' },
        { id: 'free', say: 'On the way, the walk also found how fast z changes with v, and with u: a half, and minus one.', code: ['v', 'u'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
