import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-slope',
  title: 'Slope at a point',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'slope',
      title: 'Slope is rise over run',
      codeTitle: 'slope.py',
      code: `
        # 2x + 1: up 2 per step of 1        #@line
        # 2x - 2: lower, same tilt          #@shift
        # -3x + 4: down 3 per step          #@fall
        # 3(x - 1) = 3x - 3: slope 3        #@forms
        def f(x): return x**2               #@f
        x, h = 1, 1                         #@xh
        rise = f(x + h) - f(x)   # 4 - 1    #@rise
        rise / h                 # 3.0      #@rise
      `,
      beats: [
        { id: 'line', say: 'A straight line climbs at the same rate everywhere. Each time x steps by one, {2x + 1|two x plus one} rises by two, so its slope is two.', code: 'line' },
        { id: 'shift', say: 'The plus one only sets the height: {2x − 2|two x minus two} sits lower but tilts the same way, slope two. The constant never changes the slope.', code: 'shift' },
        { id: 'fall', say: 'A line that falls has a negative slope. {−3x + 4|Minus three x plus four} drops three for every step: slope minus three.', code: 'fall' },
        { id: 'forms', say: 'However the line is written, find the number multiplying x. Three times, x minus one, is three x minus three: slope three. Half of two x plus four is x plus two: slope one.', code: 'forms' },
        { id: 'curve', say: 'A curve is steeper in some places than others. Take {f(x) = x²|f of x equals x squared}, where {f(x)|f of x} is the value f gives for the input x. How steep is it at x equals one?', code: 'f' },
        { id: 'two', say: 'Pick a second point a step h to the right, at x equals two. Between them, f goes from one to four.', code: 'xh' },
        { id: 'rise', say: 'The rise is the later value minus the earlier one: four minus one, three. Over a run of one, the slope between the two points is three.', code: 'rise' },
        { id: 'formula', say: 'Written out: the slope between x and x plus h is f of x plus h, minus f of x, all over h.', code: 'rise' },
      ],
    },
    {
      id: 'shrink',
      title: 'Shrink the step',
      codeTitle: 'shrink.py',
      code: `
        (f(1.5) - f(1)) / 0.5   # 1.25 / 0.5 = 2.5   #@half
        (f(1.1) - f(1)) / 0.1   # 0.21 / 0.1 = 2.1   #@tenth
        for h in [0.01, 0.001]:              #@loop
            print((f(1 + h) - f(1)) / h)     #@loop
        # 2.01  2.001                        #@loop
        # f'(1) = 2                          #@d
        # 2x + 1: f'(x) = 2 at every x     #@line
      `,
      beats: [
        { id: 'shrink', say: 'Shrink the step to a half. f of {1.5|one point five} is {2.25|two point two five}, so the rise is {2.25|two point two five} minus one: {1.25|one point two five}. Over a run of {0.5|zero point five}, the slope is {1.25|one point two five} over {0.5|zero point five}: {2.5|two point five}.', code: 'half' },
        { id: 'tenth', say: 'With a step of a tenth, f of {1.1|one point one} is {1.21|one point two one}: a rise of {0.21|zero point two one} over a run of {0.1|zero point one}, a slope of {2.1|two point one}.', code: 'tenth' },
        { id: 'limit', say: 'As h shrinks toward zero, the slope settles on two: {2.01|two point zero one}, then {2.001|two point zero zero one}. That limit is the derivative of f at one, written with a tick read “prime”: {f′(1) = 2|f prime of one equals two}.', code: ['loop', 'd'] },
        { id: 'tangent', say: 'The line with that slope just grazes the curve at x equals one. It is the tangent.', code: 'd' },
        { id: 'line', say: 'A straight line has the same slope over every step, so for {f(x) = 2x + 1|f of x equals two x plus one}, the derivative is two at every x: {f′(x) = 2|f prime of x equals two}.', code: 'line' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
