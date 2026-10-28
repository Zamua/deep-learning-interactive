import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative-rules',
  title: 'Derivatives of e and ln',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'grow',
      title: 'Slope equals height',
      codeTitle: 'grow.py',
      code: `
        # x**3: x is the base -> 3*x**2   #@pow
        # e**x: x is the power -> ?       #@exq
        # grows 100% of what is there     #@rate
        h = 1e-6                          #@h
        np.exp(1)            # 2.72       #@height
        (np.exp(1+h) - np.exp(1)) / h     #@slope
        # 2.72 again: slope = height      #@slope
        # e**x  ->  e**x                  #@rule
      `,
      beats: [
        { id: 'problem', say: 'The power rule finds the slope of x cubed at every x, with no measuring. There, x is the base: the number being multiplied. In {eˣ|e to the x}, x has moved up into the power, so the power rule does not apply.', code: ['pow', 'exq'] },
        { id: 'bank', say: 'Go back to the bank that grows a dollar by a hundred percent a year, at every instant. At each moment, it adds interest at a hundred percent of whatever is there now.', code: 'rate' },
        { id: 'rate', say: 'So the money grows at a rate equal to the amount. Two dollars grow at two dollars a year, and five dollars at five.', code: 'rate' },
        { id: 'slide', say: 'On the curve of {eˣ|e to the x}, the rate is the slope, and the amount is the height. Slide the tangent along it: at every point, the slope equals the height.', code: 'height' },
        { id: 'one', say: 'The tangent always meets the axis one step to the left, so its rise over that run of one is the height itself. At x equals one, both are {2.72|two point seven two}.', code: ['h', 'height', 'slope'] },
        { id: 'rule', say: 'So {eˣ|e to the x} is its own derivative: {eˣ|e to the x} becomes {eˣ|e to the x}.', code: 'rule' },
      ],
    },
    {
      id: 'fast',
      title: 'Three times as fast',
      codeTitle: 'fast.py',
      code: `
        g = lambda x: np.exp(3 * x)     #@g
        g(0)                  # 1.0     #@zero
        (g(0 + h) - g(0)) / h   # 3.0   #@zero
        # e**(a*x)  ->  a * e**(a*x)    #@rule
      `,
      beats: [
        { id: 'three', say: 'Now put a three in the power: {e³ˣ|e to the three x}. At x equals one, its power is already three, so it gets to each height in a third of the time.', code: 'g' },
        { id: 'squeeze', say: 'Its curve is the curve of {eˣ|e to the x}, squeezed sideways to a third of its width.', code: 'g' },
        { id: 'steep', say: 'Squeezing keeps every rise but cuts every run to a third, so each slope is three times as steep: three times the height.', code: 'g' },
        { id: 'zero', say: 'Check it at zero. There the power is zero, and e to the zero is one: the height is one, and the measured slope is three.', code: 'zero' },
        { id: 'rule', say: 'So the three comes out in front: {e³ˣ|e to the three x} becomes {3e³ˣ|three e to the three x}. For any number a, {eᵃˣ|e to the a x} becomes {a eᵃˣ|a times e to the a x}.', code: 'rule' },
      ],
    },
    {
      id: 'mirror',
      title: 'ln is the mirror',
      codeTitle: 'mirror.py',
      code: `
        np.exp(0.69)          # 2.0     #@e
        np.log(2)             # 0.69    #@ln
        # rise 2, run 1  ->  rise 1, run 2  #@swap
        (np.log(2 + h) - np.log(2)) / h  #@slope
        # 0.5: a half, at x = 2         #@slope
        # ln x  ->  1 / x               #@rule
      `,
      beats: [
        { id: 'ln', say: 'Now ln x. It reads {eˣ|e to the x} backwards: give it a height, and it returns the x. So its curve is the same curve with the two axes swapped: mirrored across the diagonal.', code: 'ln' },
        { id: 'point', say: '{eˣ|e to the x} reaches height two at about {0.69|zero point six nine}. In the mirror, that point lands at x equals two, with height {0.69|zero point six nine}: ln two.', code: ['e', 'ln'] },
        { id: 'swap', say: 'The tangent is mirrored too. There it rose two for every one across. In the mirror, rise and run trade places: one up for every two across, a slope of a half.', code: ['swap', 'slope'] },
        { id: 'every', say: 'Any point works the same way. Where {eˣ|e to the x} has height five, its slope is five, so ln, at five, has slope one fifth.', code: 'swap' },
        { id: 'rule', say: 'The slope of ln at any x is one over x: {ln x|ln x} becomes {1/x|one over x}.', code: 'rule' },
      ],
    },
    {
      id: 'try',
      title: 'One term at a time',
      codeTitle: 'try.py',
      code: `
        # 2x³ + 4e^(-2x) - 3 ln x       #@p1
        # 2x³       ->  6x²             #@t1
        # 4e^(-2x)  ->  -8e^(-2x)       #@t2
        # 3 ln x    ->  3 / x           #@t3
        # 6x² - 8e^(-2x) - 3/x          #@sum
        f  = lambda x: x**2 + 6*np.log(x)  #@p2
        df = lambda x: 2*x + 6/x        #@d2
        df(2)        # 4 + 3 = 7        #@a2
        # 5e^(3x) -> 15e^(3x): 15 at 0  #@zero
      `,
      beats: [
        { id: 'p1', say: 'Now mix all three kinds: a power, an exponential, and a log. A sum is differentiated one piece at a time.', code: 'p1' },
        { id: 't1', say: 'Two x cubed is a power: the three comes down, and three times two is six. Six x squared.', code: 't1' },
        { id: 't2', say: 'Four e to the minus two x: the minus two comes out in front. Four times minus two is minus eight, so minus eight e to the minus two x.', code: 't2' },
        { id: 't3', say: 'Three ln x becomes three over x. It is subtracted, so its derivative is subtracted as well: minus three over x.', code: 't3' },
        { id: 'sum', say: 'Put the three pieces back together, signs and all, and that is {f′(x)|f prime of x}.', code: 'sum' },
        { id: 'p2', say: 'For the slope at one point, differentiate first. {x² + 6 ln x|x squared plus six ln x} becomes {2x + 6/x|two x, plus six over x}.', code: ['p2', 'd2'] },
        { id: 'a2', say: 'Then put in two. Two x is four, and six over x is three, so {f′(2)|f prime of two} is seven.', code: 'a2' },
        { id: 'zero', say: 'For {5e³ˣ|five e to the three x}, the three comes out: {15e³ˣ|fifteen e to the three x}. At zero, e to the zero is one, so the slope there is fifteen, not the height, five.', code: 'zero' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
