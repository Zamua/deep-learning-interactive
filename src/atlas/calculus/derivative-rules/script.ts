import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative-rules',
  title: 'Derivative rules',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'power',
      title: 'The power rule',
      codeTitle: 'power.py',
      code: `
        # x**2  ->  2 * x                  #@sq
        # x**3  ->  3 * x**2               #@cube
        # x**n  ->  n * x**(n - 1)         #@rule
        f = lambda x: x**3                 #@check
        h = 1e-6                           #@check
        (f(2 + h) - f(2)) / h   # 12.0     #@check
        3 * 2**2                # 12       #@check
      `,
      beats: [
        { id: 'sq', say: 'Derivatives follow rules, so the limit is rarely needed. For x squared, bring the two down in front and lower the power by one: two x.', code: 'sq' },
        { id: 'cube', say: 'x cubed becomes three x squared.', code: 'cube' },
        { id: 'rule', say: 'In general, {xⁿ|x to the n} becomes {n xⁿ⁻¹|n times x to the n minus one}. That is the power rule.', code: 'rule' },
        { id: 'check', say: 'Check it at x equals two. The measured slope of x cubed is twelve, and three times two squared is twelve.', code: 'check' },
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
      `,
      beats: [
        { id: 'factor', say: 'A number in front comes along for the ride. Five x cubed becomes five times three x squared: fifteen x squared.', code: 'factor' },
        { id: 'sum', say: 'A sum is differentiated one term at a time. Two x is a line with slope two.', code: 'sum' },
        { id: 'zero', say: 'A constant on its own is flat, so its derivative is zero. The seven drops out.', code: 'zero' },
        { id: 'whole', say: 'So {5x³ + 2x + 7|five x cubed plus two x plus seven} has derivative {15x² + 2|fifteen x squared plus two}.', code: 'whole' },
      ],
    },
    {
      id: 'explog',
      title: 'e and ln',
      codeTitle: 'explog.py',
      code: `
        h = 1e-6
        np.exp(1)           # 2.718: height   #@ex
        d = (np.exp(1 + h) - np.exp(1)) / h   #@ex
        d                   # 2.718: slope    #@ex
        # e**(3x)  ->  3 * e**(3x)            #@eax
        (np.log(2 + h) - np.log(2)) / h # 0.5 #@ln
      `,
      beats: [
        { id: 'ex', say: 'e to the x is special: it is its own derivative. At every point, its slope equals its height.', code: 'ex' },
        { id: 'eax', say: 'With a number multiplying x in the power, that number comes out in front: {e³ˣ|e to the three x} has derivative {3e³ˣ|three e to the three x}.', code: 'eax' },
        { id: 'ln', say: 'And ln x has derivative one over x: steep near zero, flatter as x grows. At x equals two, its slope is a half.', code: 'ln' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        f  = lambda x: 4*x**3 - 3*x**2 + 5   #@ask
        # 4x³   ->  12x²                     #@t1
        # -3x²  ->  -6x                      #@t2
        # 5     ->  0                        #@t3
        df = lambda x: 12*x**2 - 6*x         #@ans
      `,
      beats: [
        { id: 'ask', think: true, say: 'Your turn. What is the derivative of {4x³ − 3x² + 5|four x cubed minus three x squared plus five}?', code: 'ask' },
        { id: 't1', say: 'Term by term. In four x cubed, the three comes down: four times three is twelve, so {12x²|twelve x squared}.', code: 't1' },
        { id: 't2', say: 'Minus three x squared becomes minus six x.', code: 't2' },
        { id: 't3', say: 'The five is a constant, so it drops out. The derivative is {12x² − 6x|twelve x squared minus six x}.', code: ['t3', 'ans'] },
      ],
    },
  ],
};
