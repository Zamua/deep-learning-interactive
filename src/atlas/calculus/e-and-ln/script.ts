import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-e-and-ln',
  title: 'e and ln',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Jacob Bernoulli', year: 1690, title: 'Quaestiones nonnullae de usuris, cum solutione problematis de sorte alearum', url: 'https://books.google.com/books?id=s4pw4GyHTRcC&pg=PA222', scene: 'grow' },
    { who: 'Leonhard Euler', year: 1736, title: 'Mechanica, sive motus scientia analytice exposita', url: 'https://scholarlycommons.pacific.edu/euler-works/15/', scene: 'grow' },
    { who: 'John Napier', year: 1614, title: 'Mirifici Logarithmorum Canonis Descriptio', url: 'https://archive.org/details/mirificilogarit00napi', scene: 'log' },
  ],
  scenes: [
    {
      id: 'grow',
      title: 'Interest on interest',
      codeTitle: 'grow.py',
      code: `
        (1 + 1/1) ** 1      # 2.0     #@year
        (1 + 1/2) ** 2      # 2.25    #@half
        (1 + 1/12) ** 12    # 2.613   #@month
        (1 + 1/365) ** 365  # 2.7146  #@day
        np.exp(1)           # 2.71828 #@e
      `,
      beats: [
        { id: 'bank', say: 'Put a dollar in a bank that pays {100%|a hundred percent} interest a year. Paid once, at the year\'s end, it becomes two.', code: 'year' },
        { id: 'half', say: 'Now let it pay {50%|fifty percent}, twice a year. The second payment earns on the first one\'s interest too, so the year ends at {$2.25|two dollars and twenty five cents}.', code: 'half' },
        { id: 'factor', say: 'That is compound interest: each payment multiplies by the same factor, {1.5|one point five}. A factor is a number you multiply by.', code: 'half' },
        { id: 'month', say: 'Pay monthly, and the year ends near {$2.61|two dollars sixty one}.', code: 'month' },
        { id: 'day', say: 'Pay daily: near {$2.71|two dollars seventy one}. Each extra payment adds less.', code: 'day' },
        { id: 'limit', say: 'Grow at every instant, with no steps at all, and the year ends at the number the steps close in on: about {2.718|two point seven one eight}.', code: 'e' },
        { id: 'bernoulli', say: 'Jacob Bernoulli posed this question in 1690, and showed the answer lies between two and a half and three.', code: 'e' },
        { id: 'e', say: 'Leonhard Euler later named the number e.', code: 'e' },
        { id: 'approx', say: '{e ≈ 2.718|e is about two point seven one eight}: the wavy equals sign means “is about”.', code: 'e' },
        { id: 'natural', say: 'No calendar of payments picks it; it is just growth that never stops. That makes e the natural number for growth.', code: 'e' },
      ],
    },
    {
      id: 'exp',
      title: 'Each year multiplies by e',
      codeTitle: 'exp.py',
      code: `
        np.exp(1)   # 2.718: one year     #@one
        np.exp(2)   # 7.389: e * e        #@two
        np.exp(3)   # 20.09               #@three
        np.exp(0)   # 1.0: no growth yet  #@zero
        np.exp(-1)  # 0.368: 1 / e        #@neg
        np.exp(2) * np.exp(1)  # exp(3)   #@add
        np.exp(3) / np.exp(1)  # exp(2)   #@sub
        np.exp(2) ** 3         # exp(6)   #@pow
      `,
      beats: [
        { id: 'two', say: 'A second year multiplies by e again: e times e, about {7.39|seven point three nine}.', code: 'two' },
        { id: 'power', say: 'That is {e²|e squared}. The raised two, called the power or exponent, counts the factors of e.', code: 'two' },
        { id: 'three', say: 'A third year: {e³|e cubed}, about twenty. Each step right multiplies the height by e, about {2.72|two point seven two}.', code: 'three' },
        { id: 'ex', say: 'So x years of growth is {eˣ|e to the x}, called an exponential because x sits in the exponent. The curve fills in every x in between, too.', code: ['one', 'two', 'three'] },
        { id: 'zero', say: 'At zero years nothing has grown: {e⁰ = 1|e to the zero is one}.', code: 'zero' },
        { id: 'neg', say: 'Each year back divides by e: {e⁻¹|e to the minus one} is about {0.37|zero point three seven}. The curve nears zero but never reaches it, so e to any power is positive.', code: 'neg' },
        { id: 'add', say: 'Count years, and the rules follow. Two years, then one more: {e² · e¹ = e³|e squared times e to the one is e cubed}, the raised dot meaning times.', code: 'add' },
        { id: 'rule', say: 'Multiplying exponentials adds their powers. Read the other way, a sum in the power is a product.', code: 'add' },
        { id: 'sub', say: 'Dividing takes years back off: {e³ / e¹ = e²|e cubed over e to the one is e squared}. The powers subtract.', code: 'sub' },
        { id: 'pow', say: 'And {(e²)³|e squared, cubed,} is three stretches of two years, six in all: {e⁶|e to the six}. A power of a power multiplies.', code: 'pow' },
      ],
    },
    {
      id: 'log',
      title: 'ln reads it backwards',
      codeTitle: 'log.py',
      code: `
        np.log(7.389)       # 2.0: years   #@two
        np.log(1)           # 0.0          #@one
        np.log(np.exp(1))   # 1.0          #@one
        np.log(0.368)       # -1.0         #@neg
        -np.log(0.368)      # 1.0          #@minus
        np.log(np.exp(1.5)) # 1.5          #@undo
        np.exp(np.log(5))   # 5.0          #@back
        np.log(np.exp(4) * np.exp(-1))     #@try
        np.log(np.exp(3))   # 3.0          #@solve
      `,
      beats: [
        { id: 'ask', say: 'Now run it backwards. The money reads {$7.39|seven dollars thirty nine}: how many years did that take? Across to the curve, then down: two.', code: 'two' },
        { id: 'ln', say: 'That backwards reading is the natural log, ln: {ln 7.39 = 2|ln of seven point three nine is two}.', code: 'two' },
        { id: 'y', say: 'For a positive number y, {ln y|ln of y} asks: e to what power gives y?', code: 'two' },
        { id: 'natural', say: 'Natural, because it counts factors of e. Logarithm is John Napier\'s word, from 1614: Greek for ratio and number, a count of equal factors.', code: 'two' },
        { id: 'one', say: 'Zero years leave one, so {ln 1 = 0|ln of one is zero}. One year gives e, so {ln e = 1|ln of e is one}.', code: 'one' },
        { id: 'neg', say: 'Below one is before the start: {ln 0.37 = −1|ln of zero point three seven is minus one}. Between zero and one, every log is negative.', code: 'neg' },
        { id: 'minus', say: 'So a minus sign in front makes it positive: {−ln 0.37 = 1|minus ln of zero point three seven is one}.', code: 'minus' },
        { id: 'none', say: 'Zero and below are never heights on the curve, so they have no log.', code: 'neg' },
        { id: 'undo', say: 'So ln and e to a power undo each other. Grow for a years, then ask how long that took: a years. {ln(eᵃ) = a|ln of e to the a is a}.', code: 'undo' },
        { id: 'back', say: 'And for a positive a, find the years that reach it, grow that long, and you are back at a: {eˡⁿ ᵃ = a|e to the ln of a is a}.', code: 'back' },
        { id: 'try', say: 'Try one: what is {ln(e⁴ · e⁻¹)|ln of e to the four, times e to the minus one}?', code: 'try' },
        { id: 'solve', say: 'The powers add, four plus minus one, to make {e³|e cubed}. And ln returns the power: three.', code: 'solve' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
