import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative',
  title: 'Derivatives',
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
        { id: 'line', say: 'A straight line climbs at the same rate everywhere. Each time x steps along by one, {2x + 1|two x plus one} rises by two, so its slope is two.', code: 'line' },
        { id: 'shift', say: 'The plus one only sets the height. {2x − 2|Two x minus two} sits lower, but it tilts the same way: slope two. The constant never changes the slope.', code: 'shift' },
        { id: 'fall', say: 'A line that falls has a negative slope. {−3x + 4|Minus three x plus four} drops three for every step: slope minus three.', code: 'fall' },
        { id: 'forms', say: 'However the line is written, find the number multiplying x. Three times, x minus one, is three x minus three: slope three. Half of two x plus four is x plus two: slope one.', code: 'forms' },
        { id: 'curve', say: 'A curve is steeper in some places than others. Take the function {f(x) = x²|f of x equals x squared}, where {f(x)|f of x} is the value f gives for the input x. How steep is it at x equals one?', code: 'f' },
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
        for h in [1, 0.5, 0.1, 0.01]:      #@loop
            print((f(1 + h) - f(1)) / h)   #@loop
        # 3.0  2.5  2.1  2.01              #@out
        # f'(1) = 2                        #@d
        # 2x + 1: f'(x) = 2 at every x     #@line
      `,
      beats: [
        { id: 'shrink', say: 'Now shrink the step. With h equal to a half, the slope is {2.5|two point five}. With a tenth, it is {2.1|two point one}.', code: ['loop', 'out'] },
        { id: 'limit', say: 'As h shrinks toward zero, the slope settles on two. That limit is the derivative of f at one, written {f′(1)|f prime of one}, read “f prime of one”: {f′(1) = 2|f prime of one equals two}.', code: 'd' },
        { id: 'tangent', say: 'The line with that slope just grazes the curve at x equals one. It is the tangent.', code: 'd' },
        { id: 'line', say: 'A straight line has nothing to shrink: every step gives the same slope. So for {f(x) = 2x + 1|f of x equals two x plus one}, the derivative is two at every x: {f′(x) = 2|f prime of x equals two}.', code: 'line' },
      ],
    },
    {
      id: 'nudge',
      title: 'Predict with the slope',
      codeTitle: 'nudge.py',
      code: `
        # near x = 1, f'(1) = 2                   #@rate
        dx = 0.01                                  #@right
        df = 2 * dx           # 0.02               #@right
        f(1) + df             # 1.02 (true: 1.0201) #@value
        f(1) + 2 * -0.01      # 0.98 (true: 0.9801) #@left
        # change in f ≈ f'(x) * change in x        #@rule
      `,
      beats: [
        { id: 'rate', say: 'Read the derivative as a rate. Near x equals one, f changes about two times as much as x does.', code: 'rate' },
        { id: 'right', say: 'Nudge x from one to {1.01|one point zero one}. f changes by about two times {0.01|zero point zero one}: {≈ 0.02|about zero point zero two}, where the wavy equals sign, {≈|approximately equals}, means “is about”.', code: 'right' },
        { id: 'value', say: 'So f of {1.01|one point zero one} is about one plus {0.02|zero point zero two}: {1.02|one point zero two}. The true value, {1.0201|one point zero two zero one}, is very close.', code: 'value' },
        { id: 'left', say: 'Nudge to the left instead, to {0.99|zero point nine nine}, and the change flips sign: about minus {0.02|zero point zero two}, so f is near {0.98|zero point nine eight}.', code: 'left' },
        { id: 'rule', say: 'The same holds for any slope: the change in f is about f prime of x times the change in x. With {Δ|delta}, the Greek capital delta, for “the change in”: {Δf ≈ f′(x) Δx|delta f is about f prime of x times delta x}.', code: 'rule' },
      ],
    },
    {
      id: 'sign',
      title: 'The sign gives the direction',
      codeTitle: 'sign.py',
      code: `
        h = 1e-6                                 #@def
        (f(-1.5 + h) - f(-1.5)) / h   # -3.0     #@neg
        (f(0 + h) - f(0)) / h         #  0.0     #@zero
        (f(1.5 + h) - f(1.5)) / h     #  3.0     #@pos
        f(-1.5)                       # 2.25     #@height
        f(0.9), f(1), f(1.1)    # 0.81, 1, 1.21  #@table
        f(-0.1), f(0), f(0.1)   # 0.01, 0, 0.01  #@dip
      `,
      beats: [
        { id: 'slide', say: 'The derivative changes from point to point. Slide the tangent along the curve.', code: 'def' },
        { id: 'neg', say: 'On the left, f falls as x grows, and the slope is negative: minus three, at minus {1.5|one point five}.', code: 'neg' },
        { id: 'zero', say: 'At the bottom the tangent is level, and the slope is zero.', code: 'zero' },
        { id: 'pos', say: 'On the right, f rises, and the slope is positive: three.', code: 'pos' },
        { id: 'height', say: 'The sign is about direction, not height. At minus {1.5|one point five}, f is {2.25|two point two five}, well above zero, and still falling.', code: 'height' },
        { id: 'table', say: 'Nearby values show the sign too. Around one, f goes {0.81|zero point eight one}, one, {1.21|one point two one}: rising, so the slope there is positive.', code: 'table' },
        { id: 'dip', say: 'Around zero, f goes down to zero and back up. That is the bottom of a dip, where the slope is zero.', code: 'dip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
