import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grad-check',
  title: 'Gradient checking',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bottou', year: 2012, title: 'Stochastic gradient descent tricks', url: 'https://doi.org/10.1007/978-3-642-35289-8_25', scene: 'why' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'Is backprop right?',
      codeTitle: 'slip.py',
      code: `
        def f(x): return x**2  # slope 2x     #@f
        x = 3                  # slope 6      #@f
        a = x    # backprop, with a slip      #@slip
        a        # says 3                     #@slip
      `,
      beats: [
        { id: 'slip', say: 'Backprop works out a gradient by rules, one local slope at a time, and a single slip makes it wrong. Take f as x squared: its slope is two x, so six at x equals three.', code: 'f' },
        { id: 'wrong', say: 'Write x where two x belongs, and backprop says three. Its line there is too flat, yet nothing crashes, and nothing warns you.', code: 'slip' },
        { id: 'bottou', say: 'Léon Bottou described this trap in 2012. A program stepping downhill along a slightly wrong gradient still runs, but often slowly and erratically, and such bugs can sit in code used quietly for years.', code: 'slip' },
        { id: 'measure', say: 'Reading the code line by line, he wrote, is the wrong way to check. Instead, measure the slope straight from f: nudge x, and watch f move.', code: 'f' },
        { id: 'cost', say: 'That is the slow way, one more run of f for every input: too slow to use every time, but fine for a check.', code: 'f' },
      ],
    },
    {
      id: 'numeric',
      title: 'Measure the slope',
      codeTitle: 'numeric.py',
      code: `
        def f(x): return x**2                 #@f
        h = 0.1                               #@h
        f(3 + h), f(3 - h)   # 9.61, 8.41     #@sides
        (9.61 - 8.41) / (2 * h)   # 6.0       #@c
        (f(3 + h) - f(3)) / h     # 6.1       #@one
      `,
      beats: [
        { id: 'sides', say: 'Step a small distance h to each side of three, here a tenth. There, f is {9.61|nine point six one} on the right, and {8.41|eight point four one} on the left.', code: ['h', 'sides'] },
        { id: 'divide', say: 'Rise over run: their difference, {1.2|one point two}, over the distance between them, two h, since each point sits h from three. That gives six.', code: 'c' },
        { id: 'name', say: 'This is the centered difference, centered because its two points sit evenly around x. A difference over a real, finite step, instead of the limit, is called a finite difference.', code: 'c' },
        { id: 'caught', say: 'It says six, and backprop said three. They disagree, so backprop has a bug.', code: ['c', 'f'] },
        { id: 'one', say: 'Why two points? A one-sided step, from three to {3.1|three point one}, gives {6.1|six point one}: a tenth too high. The centered one is exactly right here.', code: 'one' },
      ],
    },
    {
      id: 'error',
      title: 'Why centered is closer',
      codeTitle: 'error.py',
      code: `
        def f(x): return x**3  # slope at 1: 3  #@f
        (f(1.1) - f(1)) / 0.1       # 3.31   #@one
        (f(1.1) - f(0.9)) / 0.2     # 3.01   #@mid
        (f(1) - f(0.9)) / 0.1       # 2.71   #@left
        (3.31 + 2.71) / 2           # 3.01   #@avg
        (f(1.01) - f(1)) / 0.01     # 3.0301 #@one2
        (f(1.01) - f(0.99)) / 0.02  # 3.0001 #@mid2
      `,
      beats: [
        { id: 'cube', say: 'That exactness belongs to x squared. Take x cubed at one, where the power rule gives the slope: three x squared, so three.', code: 'f' },
        { id: 'one', say: 'With h a tenth, the one-sided secant, from one to {1.1|one point one}, has slope {3.31|three point three one}: off by {0.31|zero point three one}.', code: 'one' },
        { id: 'mid', say: 'The centered secant, from {0.9|zero point nine} to {1.1|one point one}, has slope {3.01|three point zero one}: off by only {0.01|zero point zero one}, though its points are twice as far apart.', code: 'mid' },
        { id: 'left', say: 'Why? Step to the left instead, from {0.9|zero point nine} to one. That slope is {2.71|two point seven one}: too low by {0.29|zero point two nine}, about as much as the right step was too high.', code: 'left' },
        { id: 'cancel', say: 'The centered slope is the average of the two, {3.01|three point zero one}. One overshoots, the other undershoots, and their errors nearly cancel.', code: 'avg' },
        { id: 'shrink', say: 'Now shrink h ten times, to a hundredth. The one-sided error shrinks about ten times too, to about three hundredths.', code: 'one2' },
        { id: 'shrink2', say: 'The centered error shrinks a hundred times, to one ten-thousandth.', code: 'mid2' },
        { id: 'order', say: 'So the one-sided error shrinks like h, and the centered error like h squared: a tenth of the step, a hundredth of the error.', code: ['one2', 'mid2'] },
      ],
    },
    {
      id: 'compare',
      title: 'Relative error',
      codeTitle: 'check.py',
      code: `
        a = backprop_grad   # analytic        #@a
        n = centered_diff   # numerical       #@n
        gap = abs(a - n)                      #@gap
        rel = gap / max(abs(a), abs(n))       #@rel
        # rel 1e-7 or less: right             #@ok
        # rel near 1e-4: suspicious           #@sus
        # rel 1e-2 or more: a bug             #@bug
        # the slip: 3 / 6 = 0.5               #@ex
      `,
      beats: [
        { id: 'a', say: 'Call backprop\'s answer {a|A}, the analytic gradient: worked out from formulas.', code: 'a' },
        { id: 'n', say: 'Call the measured one n, the numerical gradient: measured from the values of f.', code: 'n' },
        { id: 'gap', say: 'Their gap alone says too little. Off by one ten-thousandth is nothing next to a thousand, but huge next to two ten-thousandths.', code: 'gap' },
        { id: 'abs', say: 'So take the gap as a size: {\\|a − n\\||the absolute value of A minus n}. The bars mean absolute value, a number with its sign dropped.', code: 'gap' },
        { id: 'rel', say: 'Then divide it by the larger of the two sizes. That is the relative error: the gap as a fraction of the numbers being compared.', code: 'rel' },
        { id: 'ok', say: 'As a rule of thumb, a relative error of {10⁻⁷|ten to the minus seven}, one ten-millionth, or less, means the two agree: backprop is right.', code: 'ok' },
        { id: 'sus', say: 'Near {10⁻⁴|ten to the minus four}, one ten-thousandth, be suspicious: it is worth a closer look.', code: 'sus' },
        { id: 'bug', say: 'At {10⁻²|ten to the minus two}, one hundredth, or more, there is a bug.', code: 'bug' },
        { id: 'ex', say: 'The slip from before gave three where the slope is six: a gap of three, over the larger size, six. A relative error of a half: clearly a bug.', code: 'ex' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
