import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-rule',
  title: 'Chain rule',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'formula',
      title: 'The slope at every x',
      codeTitle: 'formula.py',
      code: `
        # x = 1: u = 4, slopes 3 and 8 -> 24          #@recap
        du_dx = 3                  # inside: 3x + 1   #@letter
        dz_du = lambda u: 2 * u    # outside: u**2    #@outer
        # dz/dx = 2u * 3 = 6u                         #@times
        dz_dx = lambda x: 6 * (3 * x + 1)             #@sub
        dz_dx(1)                   # 24               #@check
        # inside x**2: 2x; outside e**u: e**u         #@curve
        dz_dx = lambda x: 2 * x * np.exp(x**2)        #@curve2
      `,
      beats: [
        { id: 'recap', say: 'Take {z = (3x + 1)²|z equals three x plus one, squared}. At x equals one, the inside is four, and the local slopes three and eight multiply to twenty four. That is the slope at one point.', code: 'recap' },
        { id: 'letter', say: 'To get it at every x, keep u as a letter. The inside, three x plus one, has slope three wherever x is.', code: 'letter' },
        { id: 'outer', say: 'The outside, u squared, has slope two u. Leave it written in u.', code: 'outer' },
        { id: 'times', say: 'Multiply them: two u times three is six u.', code: 'times' },
        { id: 'sub', say: 'Six u is still in u. Put the inside back in for u, and {dz/dx = 6(3x + 1)|d z, d x is six times, three x plus one}: a formula in x.', code: 'sub' },
        { id: 'check', say: 'At x equals one, the inside is four, and six times four is twenty four: the slope found before.', code: 'check' },
        { id: 'curve', say: 'The inside need not be a line. In {e^(x²)|e to the x squared}, the inside is x squared, with slope two x. The outside, e to the u, is its own derivative.', code: 'curve' },
        { id: 'curve2', say: 'Multiply, e to the u times two x, and put x squared back in for u: {dz/dx = 2x e^(x²)|d z, d x is two x, e to the x squared}.', code: 'curve2' },
      ],
    },
    {
      id: 'worked',
      title: 'Try one',
      codeTitle: 'worked.py',
      code: `
        # z = ln(2x + 3)                         #@p1
        du_dx = 2                 # u = 2x + 3   #@in1
        dz_du = lambda u: 1 / u   # z = ln u     #@out1
        dz_dx = lambda x: 2 / (2 * x + 3)        #@a1
        dz_dx(1)                  # 2 / 5 = 0.4  #@at
      `,
      beats: [
        { id: 'p1', say: 'Try one. What is the derivative of {ln(2x + 3)|ln of two x plus three} with respect to x? Call it z.', code: 'p1' },
        { id: 'in1', say: 'The inside is {u = 2x + 3|u equals two x plus three}, with slope two.', code: 'in1' },
        { id: 'out1', say: 'The outside is ln u, whose slope is one over u.', code: 'out1' },
        { id: 'a1', say: 'Multiply: one over u, times two, is two over u. Put the inside back in for u: {dz/dx = 2/(2x + 3)|d z, d x is two over, two x plus three}.', code: 'a1' },
        { id: 'at', say: 'Its slope at x equals one: the inside is five, so two over five, {0.4|zero point four}.', code: 'at' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
