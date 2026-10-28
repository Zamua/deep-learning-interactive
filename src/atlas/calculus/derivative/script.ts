import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-derivative',
  title: 'Reading a derivative',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Isaac Newton', year: 1736, title: 'The Method of Fluxions and Infinite Series (written 1671)', url: 'https://archive.org/details/methodoffluxions00newt/page/n43/', scene: 'zoom' },
    { who: 'Gottfried Wilhelm Leibniz', year: 1684, title: 'Nova methodus pro maximis et minimis, itemque tangentibus', url: 'https://archive.org/details/s1id13206500/page/467/', scene: 'sign' },
  ],
  scenes: [
    {
      id: 'zoom',
      title: 'How far does f move?',
      codeTitle: 'nudge.py',
      code: `
        def f(x): return x**2       #@f
        # x moves a little: and f?  #@ask
        dx = 0.01       # the run   #@dx
        2 * dx          # rise 0.02 #@df
        # f'(1) = 2: twice as far   #@rate
        # x**2 grows 2*x times as fast #@newton
      `,
      beats: [
        { id: 'ask', say: 'Here is {f(x) = x²|f of x equals x squared} again, with its tangent at x equals one. Now a practical question: if x moves a little, how far does f move?', code: ['f', 'ask'] },
        { id: 'zoom', say: 'Zoom in on that point, eighty times over. The closer you look, the less the curve bends, until it runs almost exactly along its tangent.', code: 'ask' },
        { id: 'run', say: 'So follow the tangent. Step x from one to {1.01|one point zero one}: a run of one hundredth.', code: 'dx' },
        { id: 'rise', say: 'The tangent climbs two for every one across, so over that run it rises two hundredths.', code: 'df' },
        { id: 'rate', say: 'That two is the derivative, {f′(1) = 2|f prime of one equals two}, read as a rate: how much f changes for each unit that x moves, the way miles per hour counts miles for each hour.', code: 'rate' },
        { id: 'twice', say: 'So near one, f moves about twice as far as x does.', code: 'rate' },
        { id: 'newton', say: 'Isaac Newton thought of it this way. In his Method of Fluxions, written in 1671, quantities flow like time, and the speed at which each one grows is its fluxion, from the Latin for flowing.', code: 'newton' },
        { id: 'flow', say: 'One of his examples was this very curve: x squared grows two x times as fast as x, so at x equals one, twice as fast.', code: 'newton' },
      ],
    },
    {
      id: 'predict',
      title: 'Predict the new value',
      codeTitle: 'predict.py',
      code: `
        f(1) + 2 * 0.01   # ≈ 1.02    #@value
        f(1.01)           # 1.0201    #@true
        f(1) + 2 * -0.01  # ≈ 0.98    #@left
        f(1) + 2 * 1      # 3, not 4  #@far
        # Δf ≈ f'(x) * Δx             #@rule
        5 * 0.1           # Δf ≈ 0.5  #@five
        7 + 0.5           # f(3.1) ≈ 7.5 #@seven
      `,
      beats: [
        { id: 'value', say: 'So the new value is the old one plus that rise: f of {1.01|one point zero one} is about one plus two hundredths.', code: 'value' },
        { id: 'approx', say: 'Written with {≈|a wavy equals sign}, which means “is about”: f of {1.01|one point zero one} is about {1.02|one point zero two}.', code: 'value' },
        { id: 'true', say: 'Its true value is {1.0201|one point zero two zero one}, so the prediction is off by just one ten-thousandth.', code: 'true' },
        { id: 'left', say: 'Step left instead, to {0.99|zero point nine nine}. The run is negative, so the rise is too: f falls by about two hundredths, to near {0.98|zero point nine eight}.', code: 'left' },
        { id: 'far', say: 'But this works only nearby. Zoom back out, and take a big step, from one to two: the tangent reaches three, while the curve has bent up to four.', code: 'far' },
        { id: 'rule', say: 'So for a small step, the change in f is about f prime of x, times the change in x. With {Δ|delta}, the Greek capital letter, for “the change in”: {Δf ≈ f′(x) Δx|delta f is about f prime of x times delta x}.', code: 'rule' },
        { id: 'five', say: 'It works for any f. Say the slope at three is five, and x steps from three to {3.1|three point one}. Then f changes by about five times a tenth: one half, not five, since the step is only a tenth.', code: 'five' },
        { id: 'seven', say: 'If f of three is seven, then f of {3.1|three point one} is about seven and a half.', code: 'seven' },
      ],
    },
    {
      id: 'sign',
      title: 'The sign gives the direction',
      codeTitle: 'sign.py',
      code: `
        h = 1e-6                             #@def
        (f(-1.5 + h) - f(-1.5)) / h  # -3.0  #@neg
        (f(0 + h) - f(0)) / h        #  0.0  #@zero
        (f(1.5 + h) - f(1.5)) / h    #  3.0  #@pos
        f(-1.5)            # 2.25: high     #@height
        -3 * 0.01          # Δf ≈ -0.03     #@down
        3 * -0.01          # Δf ≈ -0.03     #@up
        f(0.9), f(1), f(1.1) # 0.81, 1, 1.21 #@table
        f(-0.1), f(0), f(0.1) # 0.01, 0, 0.01 #@dip
      `,
      beats: [
        { id: 'slide', say: 'The slope changes from point to point. Slide the tangent along the curve, and watch its sign: above zero, or below.', code: 'def' },
        { id: 'neg', say: 'On the left, f falls as x grows, and the slope is negative: minus three, at minus {1.5|one point five}.', code: 'neg' },
        { id: 'zero', say: 'At the bottom, the tangent lies level, and the slope is zero.', code: 'zero' },
        { id: 'pos', say: 'On the right, f rises, and the slope is positive: three, at {1.5|one point five}.', code: 'pos' },
        { id: 'leibniz', say: 'Gottfried Wilhelm Leibniz spelled this out in his paper of 1684: where a curve\'s heights grow, their change is positive; where they shrink, negative; and where they do neither, zero, with the tangent level.', code: ['neg', 'zero', 'pos'] },
        { id: 'title', say: 'His title also promised a method for maxima and minima, the highest and lowest points: look where the slope is zero.', code: 'zero' },
        { id: 'height', say: 'The sign is about direction, not height. At minus {1.5|one point five}, f is {2.25|two point two five}, well above zero, and still falling.', code: 'height' },
        { id: 'down', say: 'So to make f smaller there, step the way it falls: to the right. The rule agrees: minus three, times a step of one hundredth, lowers f by about three hundredths.', code: 'down' },
        { id: 'up', say: 'Where the slope is positive, f falls to the left, so step left instead. To make f larger, step the other way.', code: 'up' },
        { id: 'table', say: 'Nearby values show the sign too. Around one, each value of f is bigger than the one before: f is rising, so the slope there is positive.', code: 'table' },
        { id: 'dip', say: 'Around zero, f goes down to zero and back up. That is the bottom of a dip, a minimum, where the slope is zero.', code: 'dip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
