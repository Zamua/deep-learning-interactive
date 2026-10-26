import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative-rules',
  title: 'Derivatives of e and ln',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'explog',
      title: 'e and ln',
      codeTitle: 'explog.py',
      code: `
        h = 1e-6
        np.exp(1)           # 2.718: height   #@ex
        d = (np.exp(1 + h) - np.exp(1)) / h   #@ex
        d                   # 2.718: slope    #@ex
        g = lambda x: np.exp(3 * x)           #@eax
        (g(0 + h) - g(0)) / h   # 3.0         #@eax
        g(1)                    # 20.09       #@one
        (g(1 + h) - g(1)) / h   # 60.26       #@one
        # e**(a*x)  ->  a * e**(a*x)          #@rule
        (np.log(2 + h) - np.log(2)) / h # 0.5 #@ln
      `,
      beats: [
        { id: 'ex', say: 'e to the x is special: it is its own derivative. At every point its slope equals its height: at x equals one, both are {2.72|two point seven two}.', code: 'ex' },
        { id: 'eax', say: 'Now put a three in the power. Each step in x moves the power three times as far, and the measured slope of {e³ˣ|e to the three x} at zero is three, where its height is one.', code: 'eax' },
        { id: 'one', say: 'At x equals one, the height is {20.09|twenty point oh nine}, and the slope is about {60.3|sixty point three}: three times the height again.', code: 'one' },
        { id: 'rule', say: 'So the three comes out in front: {e³ˣ|e to the three x} becomes {3e³ˣ|three e to the three x}. For any number a, {eᵃˣ|e to the a x} becomes {a eᵃˣ|a times e to the a x}.', code: 'rule' },
        { id: 'ln', say: 'And ln x has derivative one over x: steep near zero, flatter as x grows. At x equals two, its slope is a half.', code: 'ln' },
      ],
    },
    {
      id: 'try',
      title: 'One term at a time',
      codeTitle: 'try.py',
      code: `
        # 2x³ + 4e^(-2x) - 3 ln x           #@p1
        # 2x³       ->  6x²                 #@t1
        # 4e^(-2x)  ->  4 · (-2)e^(-2x)     #@t2
        # 3 ln x    ->  3 / x               #@t3
        df = lambda x: 6*x**2 - 8*np.exp(-2*x) - 3/x   #@sum
        f  = lambda x: x**2 + 6*np.log(x)   #@p2
        df = lambda x: 2*x + 6/x            #@a2
        df(2)    # 4 + 3 = 7                #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try a mix: {f(x) = 2x³ + 4e⁻²ˣ − 3 ln x|f of x equals two x cubed, plus four e to the minus two x, minus three ln x}. Take it one term at a time.', code: 'p1' },
        { id: 't1', say: 'Two x cubed: the three comes down, and three times two is six. Six x squared.', code: 't1' },
        { id: 't2', say: 'Four e to the minus two x: the minus two in the power comes out in front. Four times minus two is minus eight, so minus eight e to the minus two x.', code: 't2' },
        { id: 't3', say: 'Three ln x has derivative three over x. It is subtracted, so its derivative is too: minus three over x.', code: 't3' },
        { id: 'sum', say: 'Together, {f′(x) = 6x² − 8e⁻²ˣ − 3/x|f prime of x is six x squared, minus eight e to the minus two x, minus three over x}.', code: 'sum' },
        { id: 'p2', say: 'Now a slope at one point. For {f(x) = x² + 6 ln x|f of x equals x squared plus six ln x}, what is {f′(2)|f prime of two}?', code: 'p2' },
        { id: 'a2', say: 'Differentiate first: two x, plus six over x. Then put in two: four plus three, seven.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
