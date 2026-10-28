import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-slope',
  title: 'Slope at a point',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Gottfried Wilhelm Leibniz', year: 1684, title: 'Nova methodus pro maximis et minimis, itemque tangentibus', url: 'https://archive.org/details/s1id13206500/page/467/', scene: 'steep' },
    { who: 'Joseph-Louis Lagrange', year: 1797, title: 'Théorie des fonctions analytiques', url: 'https://archive.org/details/theoriedesfoncti00lagr', scene: 'shrink' },
    { who: 'Augustin-Louis Cauchy', year: 1823, title: 'Résumé des leçons sur le calcul infinitésimal', url: 'https://archive.org/details/TO0E033362_TO0324_PNI-2035_000000', scene: 'shrink' },
  ],
  scenes: [
    {
      id: 'steep',
      title: 'How steep, right here?',
      codeTitle: 'steep.py',
      code: `
        # how steep is the curve at x = 1? #@ask
        # a line: y = m*x + b               #@line
        # 2x + 1: up 2 per step of 1        #@two
        (5 - 1) / (2 - 0)   # rise/run: 2.0 #@run
        # 2x - 2: lower, same slope 2       #@shift
        # 4 - 3x: down 3 per step: -3       #@fall
        # 3(x - 1) = 3x - 3: slope 3        #@forms
        # (2x + 4) / 2 = x + 2: slope 1     #@half
      `,
      beats: [
        { id: 'walk', say: 'Walk along this curve from left to right. Near the bottom it is almost flat, and farther right it climbs harder and harder.', code: 'ask' },
        { id: 'ask', say: 'So how steep is it at one exact point? Call the position across x, and take the point where x is one.', code: 'ask' },
        { id: 'tangent', say: 'Lay a straight edge on the curve there, so that it just touches. That line is the tangent, from the Latin for touching, and its tilt is what we want.', code: 'ask' },
        { id: 'leibniz', say: 'In 1684, Gottfried Wilhelm Leibniz published the first paper on calculus. Its title promised a new method for tangents.', code: 'ask' },
        { id: 'line', say: 'Start where steepness is easy: a straight line. You know one from school as {y = mx + b|y equals m x plus b}, where m is its slope.', code: 'line' },
        { id: 'two', say: 'Take {y = 2x + 1|y equals two x plus one}. Each step of one to the right, it rises by two, so m is two.', code: 'two' },
        { id: 'run', say: 'That is rise over run: how far up, divided by how far across. Over a run of two it rises four, and four over two is still two.', code: 'run' },
        { id: 'shift', say: 'Make b minus two: {2x − 2|two x minus two} sits lower, but tilts the same, slope two. b only sets the height.', code: 'shift' },
        { id: 'fall', say: 'A line that falls has a negative slope. {4 − 3x|Four minus three x} drops three for each step: slope minus three, the number multiplying x.', code: 'fall' },
        { id: 'forms', say: 'Whatever the form, find that number. Multiply out {3(x − 1)|three times, x minus one,} and you get {3x − 3|three x minus three}: slope three.', code: 'forms' },
        { id: 'half', say: 'And half of {2x + 4|two x plus four} is {x + 2|x plus two}: slope one.', code: 'half' },
        { id: 'curve', say: 'A curve has no single m: its tilt changes as you go. And rise over run needs two points, while a tangent touches at only one.', code: 'ask' },
      ],
    },
    {
      id: 'two',
      title: 'Two points on a curve',
      codeTitle: 'secant.py',
      code: `
        def f(x): return x**2               #@f
        f(2)                # 4             #@sq
        x, h = 1, 1         # step h        #@h
        f(x + h) - f(x)     # 4 - 1 = 3     #@rise
        f(x) - f(x + h)     # -3: backwards #@flip
        (f(x + h) - f(x)) / h   # 3.0       #@slope
      `,
      beats: [
        { id: 'f', say: 'So name the curve. A function is a rule that turns each input into one output. Call this one f: its output for the input x is written {f(x)|f of x}.', code: 'f' },
        { id: 'sq', say: 'This curve is {f(x) = x²|f of x equals x squared}: x times itself. So f of two is four.', code: 'sq' },
        { id: 'h', say: 'For a second point, step to the right by a distance called h. With x at one and h of one, the second point is at two.', code: 'h' },
        { id: 'rise', say: 'Between them, f goes from one up to four. The rise is the later value minus the earlier one: three.', code: 'rise' },
        { id: 'flip', say: 'Subtract the other way round, and you get minus three, as if the curve fell. The order matters.', code: 'flip' },
        { id: 'slope', say: 'Over a run of one, the slope between the two points is three over one: three.', code: 'slope' },
        { id: 'secant', say: 'The line through both points has that slope. It is called a secant, from the Latin for cutting, because it cuts through the curve.', code: 'slope' },
        { id: 'formula', say: 'For any x and any step h, the slope between x and x plus h is f of x plus h, minus f of x, all over h.', code: 'slope' },
      ],
    },
    {
      id: 'shrink',
      title: 'Shrink the step',
      codeTitle: 'shrink.py',
      code: `
        (f(1.5) - f(1)) / 0.5   # 2.5       #@half
        (f(1.1) - f(1)) / 0.1   # 2.1       #@tenth
        for h in [0.01, 0.001]:             #@tiny
            print((f(1 + h) - f(1)) / h)    #@tiny
        # 2.01  2.001                       #@tiny
        (f(1) - f(1)) / 0   # 0/0: error    #@zero
        # the limit as h -> 0: 2            #@lim
        # f'(1) = 2: the derivative         #@d
        # 3x - 1: f'(x) = 3 at every x      #@line
      `,
      beats: [
        { id: 'pin', say: 'But three belongs to the whole stretch from one to two, and at one itself the curve is gentler. So slide the second point in: shrink h.', code: 'half' },
        { id: 'half', say: 'With h a half, the slope is {2.5|two point five}.', code: 'half' },
        { id: 'tenth', say: 'With h a tenth, it is {2.1|two point one}.', code: 'tenth' },
        { id: 'tiny', say: 'A hundredth gives {2.01|two point zero one}, and a thousandth, {2.001|two point zero zero one}. The slopes close in on two.', code: 'tiny' },
        { id: 'zero', say: 'Why not set h to zero? Then the rise and the run are both zero, and zero over zero has no answer. In code, it is an error.', code: 'zero' },
        { id: 'limit', say: 'Instead, let h shrink toward zero without ever reaching it, and take the value the slopes close in on. It is called the limit: here, two.', code: 'lim' },
        { id: 'derived', say: 'That limit is the derivative of f at one. The name is Joseph-Louis Lagrange\'s, from 1797: a function derived from f, giving its slope.', code: 'd' },
        { id: 'prime', say: 'He marked it with a tick, read prime: {f′(1) = 2|f prime of one equals two}.', code: 'd' },
        { id: 'cauchy', say: 'In 1823, Augustin-Louis Cauchy defined it exactly this way: the limit of rise over run, as the two shrink toward zero together.', code: 'lim' },
        { id: 'tangent', say: 'And the secant has become the tangent: through the point, with slope two, just touching the curve.', code: 'd' },
        { id: 'line', say: 'On a straight line every step gives the same slope, so for {f(x) = 3x − 1|f of x equals three x minus one}, the derivative is three at every x.', code: 'line' },
        { id: 'height', say: 'At x equals two, f prime of two is three. And f of two is five, but that is the line\'s height there, not its slope.', code: 'line' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
