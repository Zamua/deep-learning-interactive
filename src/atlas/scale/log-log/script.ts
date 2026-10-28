import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-log-log',
  title: 'Scaling laws',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hestness et al.', year: 2017, title: 'Deep Learning Scaling is Predictable, Empirically', url: 'https://arxiv.org/abs/1712.00409', scene: 'predict' },
    { who: 'Kaplan et al.', year: 2020, title: 'Scaling Laws for Neural Language Models', url: 'https://arxiv.org/abs/2001.08361', scene: 'why' },
  ],
  scenes: [
    {
      id: 'predict',
      title: 'Predict the big run',
      codeTitle: 'runs.py',
      code: `
        compute = np.logspace(18, 20, 5)  #@dots
        loss = [3.98, 3.55, 3.16, 2.82, 2.51]  #@dots
        plt.plot(compute, loss)       #@flat
        plt.xscale('log')             #@log
        plt.yscale('log')             #@log
        # 1e21: read off the line     #@read
      `,
      beats: [
        { id: 'cost', say: 'Training a big model can take weeks of computing, and a great deal of money. Before paying for it, you would like to know how good it will get.', code: 'read' },
        { id: 'compute', say: 'Measure each run by its compute, C: all the arithmetic it does while it trains.', code: 'dots' },
        { id: 'flops', say: 'Compute is counted in FLOPs, for floating point operations. Floating point is how a computer stores a decimal, and one operation is one multiply or one add.', code: 'dots' },
        { id: 'dots', say: 'So train a few small runs first, and plot each one\'s final loss, L, against its compute.', code: 'dots' },
        { id: 'flat', say: 'On ordinary axes, the loss plunges, then flattens, and the small runs crowd into one corner. The big run sits far off to the right, with no clear way to reach it.', code: 'flat' },
        { id: 'log', say: 'Now space both axes by factors instead. Each step to the right is ten times the compute, and up the loss axis, equal gaps are equal factors too. These are log-log axes.', code: 'log' },
        { id: 'line', say: 'The small runs fall on a straight line. That is a scaling law: how the loss scales as the compute grows.', code: 'log' },
        { id: 'read', say: 'And a straight line extends with a ruler. Carry it on to ten times the compute, and read off the big run\'s loss before training it: about two.', code: 'read' },
        { id: 'found', say: 'In 2017, Joel Hestness and colleagues found lines like this in translation, language, images and speech, as the training data grew. Their title said it: deep learning scaling is predictable, empirically.', code: 'log' },
      ],
    },
    {
      id: 'why',
      title: 'Reading the line',
      codeTitle: 'line.py',
      code: `
        np.log10(1e20)   # 20               #@base
        log_l = log_a - alpha * log_c       #@line
        # alpha tilts it, log_a slides it   #@knobs
        loss = a * compute**-alpha          #@law
        0.1 * 20         # alpha * log_c    #@drop
        2.4 - 2          # log_l: 0.4       #@read
      `,
      beats: [
        { id: 'base', say: 'Each step right was ten times the compute. A log to base ten counts those steps: it asks what power of ten gives a number. So the log of {10²⁰|ten to the twenty} is twenty.', code: 'base' },
        { id: 'ticks', say: 'Label both axes by their logs, and nothing moves. A loss of four sits at about {0.6|zero point six}, and a loss of two at about {0.3|zero point three}.', code: 'base' },
        { id: 'school', say: 'So this is a straight line on plain axes, with log C across and log L up. You know one from school: {y = mx + b|y equals m x plus b}, where m is the slope and b sets the height.', code: 'line' },
        { id: 'slope', say: 'This line drops {0.1|zero point one} for each power of ten across, so its slope, m, is minus {0.1|zero point one}.', code: 'line' },
        { id: 'alpha', say: 'Call that drop per step {α|alpha}, the Greek letter alpha, so the slope is minus {α|alpha}. A bigger {α|alpha} tilts the line steeper: the loss falls faster.', code: 'knobs' },
        { id: 'height', say: 'Call the height {log a|log A}, for a number {a|A}. Change it, and the line slides up or down without turning.', code: 'knobs' },
        { id: 'shift', say: 'Hestness\'s team saw exactly this split: better model designs slid the line down, and left its slope alone.', code: 'knobs' },
        { id: 'eq', say: 'So the line is {log L = log a − α log C|log L equals log A, minus alpha times log C}.', code: 'line' },
        { id: 'undo', say: 'Now undo the logs. Log base ten follows the same rules as ln: a multiple of a log is the log of a power, and a sum of logs is the log of a product. So L is {a|A} times C to the minus {α|alpha}.', code: 'law' },
        { id: 'power', say: 'Compute raised to a power: that is why this is called a power law, and {α|alpha} its exponent, the scaling exponent.', code: 'law' },
        { id: 'kaplan', say: 'In 2020, Jared Kaplan and colleagues found it in language models, which predict the next word of a text. Their loss fell as a power law in compute, with some trends holding across more than seven powers of ten.', code: 'law' },
        { id: 'drop', say: 'Now read one run off the line. With {α|alpha} at {0.1|zero point one}, a run of {10²⁰|ten to the twenty} FLOPs has a log C of twenty, and {α|alpha} times twenty is two.', code: 'drop' },
        { id: 'read', say: 'With {log a|log A} at {2.4|two point four}, log L is {2.4|two point four} minus two: {0.4|zero point four}.', code: 'read' },
      ],
    },
    {
      id: 'try',
      title: 'A slope from two runs',
      codeTitle: 'slope.py',
      code: `
        # 1e18: 3.98, 1e21: 2.00     #@p
        log_c = [18, 21]             #@pts
        log_l = [0.6, 0.3]           #@pts
        rise = 0.3 - 0.6    # -0.3   #@rise
        run = 21 - 18       # 3      #@run
        slope = rise / run  # -0.1   #@slope
      `,
      beats: [
        { id: 'p', say: 'Try one. A run with {10¹⁸|ten to the eighteen} FLOPs ends at loss {3.98|three point nine eight}, and one with {10²¹|ten to the twenty one} at {2.00|two point zero}. What is the slope of the line through them? Use log {3.98|three point nine eight} is about {0.6|zero point six}, and log two about {0.3|zero point three}.', code: 'p' },
        { id: 'pts', say: 'On log-log axes, each run sits at log C, log L: eighteen, {0.6|zero point six}, and twenty one, {0.3|zero point three}.', code: 'pts' },
        { id: 'rise', say: 'The rise is {0.3|zero point three} minus {0.6|zero point six}, which is minus {0.3|zero point three}.', code: 'rise' },
        { id: 'run', say: 'The run is twenty one minus eighteen: three.', code: 'run' },
        { id: 'slope', say: 'Rise over run: minus {0.3|zero point three} over three, a slope of minus {0.1|zero point one}. So {α|alpha} is {0.1|zero point one}.', code: 'slope' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
