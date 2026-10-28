import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-power-rule',
  title: 'The power rule',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'pattern',
      title: 'The slopes make a pattern',
      codeTitle: 'slopes.py',
      code: `
        f = lambda x: x**2             #@f
        h = 1e-6                       #@f
        (f(1 + h) - f(1)) / h  # 2.0   #@one
        for x in [-2, -1, 0, 1, 2]:    #@slide
            print((f(x + h) - f(x)) / h)  #@slide
        # -4  -2  0  2  4: 2 * x       #@line
        g = lambda x: x**3             #@cube
        (g(2 + h) - g(2)) / h  # 12.0  #@check
        3 * 2**2               # 12    #@check
      `,
      beats: [
        { id: 'one', say: 'To measure a slope, take a tiny step, h, and divide the rise by it. For x squared at x equals one, the slope comes out as two.', code: ['f', 'one'] },
        { id: 'every', say: 'But that is the slope at one point only. Is there a way to know it at every point at once?', code: 'one' },
        { id: 'slide', say: 'Slide the tangent along the curve, and mark each slope it measures on a second graph below, at the same x.', code: 'slide' },
        { id: 'line', say: 'The marks fall on a straight line: at every x, the slope is two times x. So the derivative of x squared is two x, everywhere at once.', code: 'line' },
        { id: 'cube', say: 'Do the same for x cubed. This time the slopes trace a curve: three x squared.', code: 'cube' },
        { id: 'check', say: 'Check one point. At x equals two, the measured slope is twelve, and three times two squared is twelve.', code: 'check' },
      ],
    },
    {
      id: 'rule',
      title: 'The power rule',
      codeTitle: 'power.py',
      code: `
        # x**2 = x * x: the power is 2  #@power
        # x**2  ->  2 * x               #@sq
        # x**3  ->  3 * x**2            #@cube
        # x**n  ->  n * x**(n - 1)      #@rule
      `,
      beats: [
        { id: 'power', say: 'x squared means x times x. The small raised two counts how many x\'s are multiplied, and it is called the power.', code: 'power' },
        { id: 'sq', say: 'x squared becomes two x, where {the arrow →|the arrow} reads “becomes”. The two came down in front, and the power dropped by one, leaving plain x.', code: 'sq' },
        { id: 'cube', say: 'x cubed became three x squared: the three came down, and the power fell by one, leaving x squared.', code: 'cube' },
        { id: 'rule', say: 'The same holds for any power n: {xⁿ|x to the n} becomes {n xⁿ⁻¹|n times x to the n minus one}. That is the power rule: the rule for the derivative of a power.', code: 'rule' },
      ],
    },
    {
      id: 'sums',
      title: 'Numbers in front, and sums',
      codeTitle: 'sums.py',
      code: `
        # 5x³  ->  5 · 3x² = 15x²       #@factor
        # 2x   ->  2                    #@sum
        # 7    ->  0                    #@zero
        f  = lambda x: 5*x**3 + 2*x + 7 #@whole
        df = lambda x: 15*x**2 + 2      #@whole
        df(2)                           #@ask
        15 * 2**2 + 2    # 60 + 2 = 62  #@put
      `,
      beats: [
        { id: 'factor', say: 'A number multiplying a power comes along for the ride. Five x cubed becomes five times three x squared: fifteen x squared.', code: 'factor' },
        { id: 'sum', say: 'Taking a derivative is also called differentiating. A sum is differentiated one piece at a time. The next piece, two x, is a straight line with slope two.', code: 'sum' },
        { id: 'zero', say: 'A constant on its own is flat, so its derivative is zero. The seven drops out.', code: 'zero' },
        { id: 'whole', say: 'So {5x³ + 2x + 7|five x cubed plus two x plus seven} has derivative {15x² + 2|fifteen x squared plus two}.', code: 'whole' },
        { id: 'ask', say: 'Now the slope at one point. For that f, what is {f′(2)|f prime of two}?', code: 'ask' },
        { id: 'put', say: 'Put two in for x. Fifteen times two squared is sixty.', code: 'put' },
        { id: 'add', say: 'Then add the two from the line: sixty-two.', code: 'put' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
