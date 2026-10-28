import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-rule',
  title: 'Chain rule',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Leibniz', year: 1684, title: 'Nova methodus pro maximis et minimis, itemque tangentibus, quae nec fractas nec irrationales quantitates moratur, et singulare pro illis calculi genus', url: 'https://archive.org/details/s1id13206500/page/467/', scene: 'every' },
  ],
  scenes: [
    {
      id: 'every',
      title: 'A slope at every x',
      codeTitle: 'every.py',
      code: `
        z = lambda x: (3*x + 1)**2     #@z
        # x = 1: slopes 3, 8 -> 24     #@one
        # x = 0? x = -1? every x?      #@every
        # = 9x² + 6x + 1: power rule   #@expand
        # e**(x**2): can't multiply out  #@stuck
      `,
      beats: [
        { id: 'recap', say: 'Chained slopes found the slope of {z = (3x + 1)²|z equals three x plus one, squared}, at x equals one: the local slopes three and eight, multiplied, make twenty four.', code: ['z', 'one'] },
        { id: 'every', say: 'But that took a fresh round of numbers for a single point. Slide x along the curve, and the slope keeps changing. Is there one formula for it, at every x?', code: 'every' },
        { id: 'expand', say: 'This one you could multiply out first, then use the power rule. But {e^(x²)|e to the x squared} cannot be multiplied out, and neither can {ln(2x + 3)|ln of two x plus three}.', code: ['expand', 'stuck'] },
        { id: 'leibniz', say: 'Earlier methods for slopes had to untangle a formula first, clearing out its fractions and roots. Leibniz\'s 1684 paper, the one that named d x, promised a method that skips the untangling: it handles the pieces one at a time.', code: 'stuck' },
      ],
    },
    {
      id: 'formula',
      title: 'Keep u as a letter',
      codeTitle: 'formula.py',
      code: `
        du_dx = 3               # inside     #@in
        dz_du = lambda u: 2*u   # outside    #@out
        # 2u · 3 = 6u: still in u            #@times
        dz_dx = lambda x: 6*(3*x + 1)        #@sub
        dz_dx(1)                # 24         #@check
      `,
      beats: [
        { id: 'letter', say: 'Do what the chain did, but keep u as a letter instead of a number. The inside, three x plus one, has slope three, wherever x is.', code: 'in' },
        { id: 'outer', say: 'The outside, u squared, has slope two u. Leave it in u.', code: 'out' },
        { id: 'times', say: 'Multiply them, as the chain rule says: two u times three is six u.', code: 'times' },
        { id: 'sub', say: 'But six u is still in u. Put the inside back in for u: {dz/dx = 6(3x + 1)|d z, d x is six times, three x plus one}, a formula in x.', code: 'sub' },
        { id: 'notx', say: 'It is the inside that goes back in, not x alone: the outside only ever sees u.', code: 'sub' },
        { id: 'check', say: 'At x equals one, the inside is four, and six times four is twenty four: the slope found before.', code: 'check' },
        { id: 'slide', say: 'And it holds at every x. Slide x along the curve, and six times, three x plus one, matches the slope measured there, all the way.', code: 'sub' },
      ],
    },
    {
      id: 'bend',
      title: 'When the inside bends',
      codeTitle: 'exp.py',
      code: `
        # e**(3*x) -> 3 * e**(3*x)              #@seen
        # inside x**2: slope 2x                 #@in
        # outside e**u: slope e**u              #@out
        dz_dx = lambda x: 2*x * np.exp(x**2)    #@res
      `,
      beats: [
        { id: 'seen', say: 'You have used this rule before, without its name: {e^(3x)|e to the three x} became {3e^(3x)|three e to the three x}.', code: 'seen' },
        { id: 'why', say: 'Its inside, three x, has slope three. Its outside, e to the u, is its own slope. Multiply, and the three comes out in front.', code: 'seen' },
        { id: 'in', say: 'The inside need not be a line. In {e^(x²)|e to the x squared}, the inside is x squared, whose slope, two x, changes with x.', code: 'in' },
        { id: 'out', say: 'The outside is e to the u, whose slope is e to the u.', code: 'out' },
        { id: 'res', say: 'Multiply, e to the u times two x, and put x squared back in for u: {dz/dx = 2x e^(x²)|d z, d x is two x, e to the x squared}.', code: 'res' },
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        # z = ln(2x + 3)                      #@p1
        du_dx = 2               # u = 2x + 3  #@in1
        dz_du = lambda u: 1/u   # z = ln u    #@out1
        # 1/u · 2 = 2/u                       #@a1
        dz_dx = lambda x: 2 / (2*x + 3)       #@back
        dz_dx(1)                # 2/5 = 0.4   #@at
      `,
      beats: [
        { id: 'p1', say: 'Try one. What is the derivative of {ln(2x + 3)|ln of two x plus three}? Call it z.', code: 'p1' },
        { id: 'in1', say: 'The inside is {u = 2x + 3|u equals two x plus three}, with slope two.', code: 'in1' },
        { id: 'out1', say: 'The outside is ln u, whose slope is one over u.', code: 'out1' },
        { id: 'a1', say: 'Multiply: one over u, times two, is two over u.', code: 'a1' },
        { id: 'back', say: 'Put the inside back in for u: {dz/dx = 2/(2x + 3)|d z, d x is two over, two x plus three}.', code: 'back' },
        { id: 'at', say: 'At x equals one, the inside is five, so the slope there is two over five: {0.4|zero point four}.', code: 'at' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
