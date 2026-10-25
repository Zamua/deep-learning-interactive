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
        # 2x + 1 rises 2 per step: slope 2   #@line
        def f(x): return x**2               #@f
        x, h = 1, 1                         #@xh
        rise = f(x + h) - f(x)   # 4 - 1    #@rise
        rise / h                 # 3.0      #@rise
      `,
      beats: [
        { id: 'line', say: 'A straight line climbs at the same rate everywhere. {2x + 1|Two x plus one} rises two for every step of one, so its slope is two.', code: 'line' },
        { id: 'curve', say: 'A curve is steeper in some places than others. Take {f(x) = x²|f of x equals x squared}. How steep is it at x equals one?', code: 'f' },
        { id: 'two', say: 'Pick a second point a step h to the right, at x equals two. Between them, f goes from one to four.', code: 'xh' },
        { id: 'rise', say: 'Rise over run is three over one. The slope between the two points is three.', code: 'rise' },
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
      `,
      beats: [
        { id: 'shrink', say: 'Now shrink the step. With h equal to a half, the slope is {2.5|two point five}. With a tenth, it is {2.1|two point one}.', code: ['loop', 'out'] },
        { id: 'limit', say: 'As h shrinks toward zero, the slope settles on two. That limit is the derivative: {f′(1) = 2|f prime of one equals two}.', code: 'd' },
        { id: 'tangent', say: 'The line with that slope just grazes the curve at x equals one. It is the tangent.', code: 'd' },
        { id: 'nudge', say: 'Read it as a rate. Nudge x by {0.01|zero point zero one}, and f moves by about twice as much: {0.02|zero point zero two}.', code: 'd' },
      ],
    },
    {
      id: 'sign',
      title: 'The sign gives the direction',
      codeTitle: 'sign.py',
      code: `
        h = 1e-6                           #@def
        (f(-1.5 + h) - f(-1.5)) / h  # -3.0 #@neg
        (f(0 + h) - f(0)) / h        #  0.0 #@zero
        (f(1.5 + h) - f(1.5)) / h    #  3.0 #@pos
      `,
      beats: [
        { id: 'slide', say: 'The derivative changes from point to point. Slide the tangent along the curve.', code: 'def' },
        { id: 'neg', say: 'On the left, f falls as x grows, and the slope is negative: minus three, at minus {1.5|one point five}.', code: 'neg' },
        { id: 'zero', say: 'At the bottom the tangent is level, and the slope is zero.', code: 'zero' },
        { id: 'pos', say: 'On the right, f rises, and the slope is positive: three.', code: 'pos' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        f(3), f(3.5)        # 9, 12.25   #@ask
        rise = 12.25 - 9    # 3.25       #@rise
        rise / 0.5          # 6.5        #@run
      `,
      beats: [
        { id: 'ask', say: 'Your turn to follow along. f of three is nine, and f of three and a half is {12.25|twelve point two five}. With h equal to a half, what is the slope between them?', code: 'ask' },
        { id: 'rise', say: 'The rise is {12.25|twelve point two five} minus nine: {3.25|three point two five}.', code: 'rise' },
        { id: 'run', say: 'Divide by the run, a half: {3.25 / 0.5 = 6.5|three point two five over a half is six point five}.', code: 'run' },
        { id: 'close', say: 'That is close to the slope right at three, which is six. A smaller step would land closer still.', code: 'run' },
      ],
    },
  ],
};
