import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-log-log',
  title: 'Scaling laws',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'runs',
      title: 'Loss against compute',
      codeTitle: 'runs.py',
      code: `
        compute = [1e18, 1e19, 1e20, 1e21]   #@runs
        loss = [3.98, 3.16, 2.51, 2.00]      #@runs
        plt.plot(compute, loss)              #@flat
        plt.xscale('log')                    #@log
        plt.yscale('log')   # a straight line  #@line
      `,
      beats: [
        { id: 'runs', say: 'Train the same kind of model with more and more compute, C: the total arithmetic of training, counted in floating point operations, or FLOPs. Each dot is one run\'s final loss, L.', code: 'runs' },
        { id: 'flat', say: 'On ordinary axes the loss plunges, then flattens, and most runs crowd into one corner.', code: 'flat' },
        { id: 'log', say: 'Now space both axes by powers of ten, so every step to the right is ten times the compute. These are log-log axes.', code: 'log' },
        { id: 'line', say: 'The runs fall on a straight line. That is a scaling law.', code: 'line' },
      ],
    },
    {
      id: 'why',
      title: 'Why a straight line',
      codeTitle: 'law.py',
      code: `
        # loss = a * compute**(-alpha)       #@law
        # log (10**3)**2 = 3 + 3 = 6         #@power
        # log (1e20)**(-0.1) = -0.1 * 20     #@minus
        # log loss = log a - alpha * log compute  #@line
        # log a = 2.4: at 1e20, 2.4 - 2 = 0.4    #@height
      `,
      beats: [
        { id: 'law', say: 'The law says L equals a times C to the minus {α|alpha}. The numbers a and {α|alpha}, the Greek letter alpha, are fixed by fitting the runs. {α|Alpha} is the scaling exponent.', code: 'law' },
        { id: 'logs', say: 'Take logs to base ten, written {log₁₀|log base ten}, or here just log. They count powers of ten: the log of {10²⁰|ten to the twenty} is twenty.' },
        { id: 'power', say: 'Like ln, a log to base ten turns a product into a sum. So it turns a power into a multiple: {10³|ten cubed}, squared, is {10³|ten cubed} times {10³|ten cubed}, so its log is three plus three, six: two times three.', code: 'power' },
        { id: 'minus', say: 'The same holds for the power minus {α|alpha}: the log of C to the minus {α|alpha} is minus {α|alpha} times the log of C. With C at {10²⁰|ten to the twenty} and {α|alpha} at {0.1|zero point one}, that is minus {0.1|zero point one} times twenty: minus two.', code: 'minus' },
        { id: 'line', say: 'So log L is log a, minus {α|alpha} times log C: a straight line, with slope minus {α|alpha}.', code: 'line' },
        { id: 'height', say: 'Log a sets its height. Here it is {2.4|two point four}, so at {10²⁰|ten to the twenty} FLOPs, log L is {2.4|two point four} minus two: {0.4|zero point four}.', code: 'height' },
      ],
    },
    {
      id: 'try',
      title: 'A slope from two runs',
      codeTitle: 'slope.py',
      code: `
        # 1e18 FLOPs: loss 3.98, 1e21: loss 2.00  #@p
        log_c = [18, 21]                          #@pts
        log_l = [0.6, 0.3]                        #@pts
        rise = 0.3 - 0.6       # -0.3             #@rise
        run = 21 - 18          # 3                #@rise
        slope = rise / run     # -0.1             #@slope
      `,
      beats: [
        { id: 'p', say: 'Try one. A run with {10¹⁸|ten to the eighteen} FLOPs ends at loss {3.98|three point nine eight}, and one with {10²¹|ten to the twenty one} at {2.00|two point zero}. What is the slope of the line through them? Use log {3.98|three point nine eight} is about {0.6|zero point six}, and log two about {0.3|zero point three}.', code: 'p' },
        { id: 'pts', say: 'On log-log axes, each run sits at log C, log L: eighteen, {0.6|zero point six}, and twenty one, {0.3|zero point three}.', code: 'pts' },
        { id: 'rise', say: 'The rise is {0.3|zero point three} minus {0.6|zero point six}: minus {0.3|zero point three}. The run is twenty one minus eighteen: three.', code: 'rise' },
        { id: 'slope', say: 'Rise over run: minus {0.3|zero point three} over three, a slope of minus {0.1|zero point one}. So {α|alpha} is {0.1|zero point one}.', code: 'slope' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
