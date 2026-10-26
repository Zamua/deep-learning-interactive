import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-power-laws',
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
        { id: 'flat', say: 'On ordinary axes the loss plunges, then flattens, and most of the runs crowd into one corner.', code: 'flat' },
        { id: 'log', say: 'Now space both axes by powers of ten, so that every step to the right is ten times the compute. These are log-log axes.', code: 'log' },
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
        log_c = [18, 20]     # log10 compute  #@slope
        log_l = [0.6, 0.4]   # log10 loss     #@slope
        slope = (0.4 - 0.6) / (20 - 18)  # -0.1  #@slope
      `,
      beats: [
        { id: 'law', say: 'The law says L equals a times C to the minus {α|alpha}. The numbers a and {α|alpha}, the Greek letter alpha, are fixed by fitting the runs. {α|Alpha} is the scaling exponent.', code: 'law' },
        { id: 'logs', say: 'Take logs to base ten, written {log₁₀|log base ten}, or here just log. They count powers of ten: the log of {10²⁰|ten to the twenty} is twenty.' },
        { id: 'power', say: 'Like ln, a log to base ten turns a product into a sum. So it turns a power into a multiple: {10³|ten cubed}, squared, is {10³|ten cubed} times {10³|ten cubed}, so its log is three plus three, six: two times three.', code: 'power' },
        { id: 'minus', say: 'The same holds for the power minus {α|alpha}: the log of C to the minus {α|alpha} is minus {α|alpha} times the log of C. With C at {10²⁰|ten to the twenty} and {α|alpha} at {0.1|zero point one}, that is minus {0.1|zero point one} times twenty: minus two.', code: 'minus' },
        { id: 'line', say: 'So log L is log a, minus {α|alpha} times log C: a straight line, with slope minus {α|alpha}.', code: 'line' },
        { id: 'slope', say: 'Read the slope off two runs. From {10¹⁸|ten to the eighteen} to {10²⁰|ten to the twenty} FLOPs, two powers of ten, log L falls from {0.6|zero point six} to {0.4|zero point four}. Minus {0.2|zero point two} over two: a slope of minus {0.1|zero point one}.', code: 'slope' },
      ],
    },
    {
      id: 'tenfold',
      title: 'Ten times the compute',
      codeTitle: 'tenfold.py',
      code: `
        alpha = 0.1                         #@step
        factor = 10 ** -alpha    # 0.79     #@ex
        3.16 * factor            # 2.51     #@ex
        3.16 * 10 ** (-2 * alpha)  # 2.00   #@hundred
        10 ** (-3 * alpha)       # 0.50     #@k
        2.56 / 4         # 0.64 = 0.8 * 0.8  #@back
        10 ** 2          # 100x the compute  #@factors
      `,
      beats: [
        { id: 'step', say: 'Each power of ten in compute moves log L down by {α|alpha}. In plain numbers, that multiplies the loss by ten to the minus {α|alpha}.', code: 'step' },
        { id: 'ex', say: 'With {α|alpha} at {0.1|zero point one}, the factor is {0.79|zero point seven nine}. Ten times the compute takes a loss of {3.16|three point one six} down to {2.51|two point five one}.', code: 'ex' },
        { id: 'hundred', say: 'A hundred times the compute is two such steps: {0.79|zero point seven nine} times {0.79|zero point seven nine}. That is ten to the minus {0.1|zero point one}, twice, and multiplying adds the powers: ten to the minus {0.2|zero point two}, about {0.63|zero point six three}. The loss reaches about {2.00|two point zero}.', code: 'hundred' },
        { id: 'k', say: 'So k factors of ten in compute multiply the loss by ten to the minus k {α|alpha}. A thousand times the compute is three factors: ten to the minus {0.3|zero point three}, about a half.', code: 'k' },
        { id: 'cost', say: 'Each cut by that same fraction costs another ten times the compute, so every gain asks for a far bigger run than the last.' },
        { id: 'back', say: 'Run it backwards, too. Say each tenfold step multiplies the loss by {0.8|zero point eight}. How much more compute takes a loss of four down to {2.56|two point five six}? {2.56|Two point five six} over four is {0.64|zero point six four}, which is {0.8|zero point eight} times {0.8|zero point eight}: two factors.', code: 'back' },
        { id: 'factors', say: 'Each factor costs ten times the compute, so two of them cost ten times ten: a hundred times the compute.', code: 'factors' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
