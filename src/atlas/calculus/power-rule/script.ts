import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-power-rule',
  title: 'The power rule',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'power',
      title: 'The power rule',
      codeTitle: 'power.py',
      code: `
        f = lambda x: x**2                  #@measured
        h = 1e-6                            #@measured
        for x in [-1.5, 0, 1, 1.5]:         #@measured
            print((f(x + h) - f(x)) / h)    #@measured
        # -3.0  0.0  2.0  3.0: 2 * x        #@twox
        # x**2  ->  2 * x                   #@sq
        # x**3  ->  3 * x**2                #@cube
        g = lambda x: x**3                  #@check
        (g(2 + h) - g(2)) / h   # 12.0      #@check
        3 * 2**2                # 12        #@check
        # x**n  ->  n * x**(n - 1)          #@rule
      `,
      beats: [
        { id: 'measured', say: 'Measure the slope of x squared with a tiny step, at a few points: minus three at minus {1.5|one point five}, zero at zero, two at one, and three at {1.5|one point five}.', code: 'measured' },
        { id: 'twox', say: 'Every one of them is two times x. So the derivative of x squared is two x, at every point, with no limit to take.', code: 'twox' },
        { id: 'sq', say: 'Write it as x squared becomes two x. {The arrow →|The arrow} stands for “becomes”, from a function to its derivative. The two came down in front, and the power dropped by one.', code: 'sq' },
        { id: 'cube', say: 'Do the same to x cubed: bring the three down, and drop the power to two. x cubed becomes three x squared.', code: 'cube' },
        { id: 'check', say: 'Check it at x equals two. The measured slope of x cubed is twelve, and three times two squared is twelve.', code: 'check' },
        { id: 'rule', say: 'In general, for any power n, {xⁿ|x to the n} becomes {n xⁿ⁻¹|n times x to the n minus one}. That is the power rule.', code: 'rule' },
      ],
    },
    {
      id: 'sums',
      title: 'Constants and sums',
      codeTitle: 'sums.py',
      code: `
        # 5x³  ->  5 · 3x² = 15x²           #@factor
        # 2x   ->  2                        #@sum
        # 7    ->  0                        #@zero
        f  = lambda x: 5*x**3 + 2*x + 7     #@whole
        df = lambda x: 15*x**2 + 2          #@whole
        df(2)                               #@ask
        15 * 2**2 + 2      # 60 + 2 = 62    #@put
      `,
      beats: [
        { id: 'factor', say: 'A number in front comes along for the ride. Five x cubed becomes five times three x squared: fifteen x squared.', code: 'factor' },
        { id: 'sum', say: 'A sum is differentiated one term at a time. Two x is a line with slope two.', code: 'sum' },
        { id: 'zero', say: 'A constant on its own is flat, so its derivative is zero. The seven drops out.', code: 'zero' },
        { id: 'whole', say: 'So {5x³ + 2x + 7|five x cubed plus two x plus seven} has derivative {15x² + 2|fifteen x squared plus two}.', code: 'whole' },
        { id: 'ask', say: 'Now the slope at one point. For that f, what is {f′(2)|f prime of two}?', code: 'ask' },
        { id: 'put', say: 'Put two into the derivative. Two squared is four, fifteen times four is sixty, and sixty plus two is sixty-two.', code: 'put' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
