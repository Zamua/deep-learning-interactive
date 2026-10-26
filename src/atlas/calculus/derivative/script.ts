import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative',
  title: 'Reading a derivative',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'nudge',
      title: 'Predict with the slope',
      codeTitle: 'nudge.py',
      code: `
        # f(x) = x**2: f'(1) = 2                  #@rate
        dx = 0.01                                  #@right
        df = 2 * dx           # 0.02               #@right
        f(1) + df             # 1.02 (true: 1.0201) #@value
        f(1) + 2 * -0.01      # 0.98 (true: 0.9801) #@left
        # change in f ≈ f'(x) * change in x        #@rule
      `,
      beats: [
        { id: 'rate', say: 'For {f(x) = x²|f of x equals x squared}, the derivative at one is two: {f′(1) = 2|f prime of one equals two}. Read it as a rate: near x equals one, f changes about two times as much as x does.', code: 'rate' },
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
        f(-1.2)                 # 1.44 < 2.25    #@down
        f(0.9), f(1), f(1.1)    # 0.81, 1, 1.21  #@table
        f(-0.1), f(0), f(0.1)   # 0.01, 0, 0.01  #@dip
      `,
      beats: [
        { id: 'slide', say: 'The derivative changes from point to point. Slide the tangent along the curve.', code: 'def' },
        { id: 'neg', say: 'On the left, f falls as x grows, and the slope is negative: minus three, at minus {1.5|one point five}.', code: 'neg' },
        { id: 'zero', say: 'At the bottom the tangent is level, and the slope is zero.', code: 'zero' },
        { id: 'pos', say: 'On the right, f rises, and the slope is positive: three.', code: 'pos' },
        { id: 'height', say: 'The sign is about direction, not height. At minus {1.5|one point five}, f is {2.25|two point two five}, well above zero, and still falling.', code: 'height' },
        { id: 'down', say: 'So to make f smaller there, step the way it falls, to the right: f of minus {1.2|one point two} is {1.44|one point four four}. Where the slope is positive, step left instead.', code: 'down' },
        { id: 'table', say: 'Nearby values show the sign too. Around one, f goes {0.81|zero point eight one}, one, {1.21|one point two one}: rising, so the slope there is positive.', code: 'table' },
        { id: 'dip', say: 'Around zero, f goes down to zero and back up. That is the bottom of a dip, where the slope is zero.', code: 'dip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
