import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-power-laws',
  title: 'Ten times the compute',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kaplan et al.', year: 2020, title: 'Scaling Laws for Neural Language Models', url: 'https://arxiv.org/abs/2001.08361', scene: 'shrink' },
  ],
  scenes: [
    {
      id: 'step',
      title: 'One step along the line',
      codeTitle: 'step.py',
      code: `
        alpha = 0.1                  #@line
        # 10x compute: log L - 0.1   #@step
        10 ** -alpha    # 0.79       #@factor
        3.98 * 10**-0.1  # 3.16      #@value
        # loss = a * C**-alpha       #@law
        10**-0.1 * 10**-0.1  # 0.63  #@two
        10 ** -(3 * alpha)   # 0.5   #@k
      `,
      beats: [
        { id: 'ask', say: 'You have a model, and you want a better one, with a lower loss. Before you train it, you would like to know the price: how much more compute will it take?', code: 'line' },
        { id: 'line', say: 'The runs of one family of models fall on a straight line on log-log axes, with a slope of minus {α|alpha}. Here {α|alpha} is {0.1|zero point one}.', code: 'line' },
        { id: 'step', say: 'Take one step to the right: ten times the compute. The line drops by {α|alpha}, so log L goes down by {0.1|zero point one}.', code: 'step' },
        { id: 'factor', say: 'Minus {0.1|zero point one} is the log of ten to the minus {0.1|zero point one}, and adding logs multiplies the numbers. So the loss is multiplied by ten to the minus {0.1|zero point one}: about {0.79|zero point seven nine}.', code: 'factor' },
        { id: 'value', say: 'So a loss of {3.98|three point nine eight}, multiplied by that, becomes about {3.16|three point one six}.', code: 'value' },
        { id: 'same', say: 'Every step along a straight line has the same shape: across one power of ten, and down {α|alpha}. So every tenfold step multiplies the loss by the same factor, ten to the minus {α|alpha}.', code: 'factor' },
        { id: 'law', say: 'The power law says so too. In L equals {a|A} times C to the minus {α|alpha}, replace C with ten times C, and the ten comes out as a factor of its own: ten to the minus {α|alpha}, times the old loss.', code: 'law' },
        { id: 'two', say: 'A hundred times the compute is two steps, so two factors. Multiplying adds the powers: ten to the minus {0.1|zero point one}, twice, is ten to the minus {0.2|zero point two}, about {0.63|zero point six three}.', code: 'two' },
        { id: 'k', say: 'So k steps of ten multiply the loss by ten to the minus k {α|alpha}. Three steps, a thousand times the compute, give ten to the minus {0.3|zero point three}: about a half.', code: 'k' },
      ],
    },
    {
      id: 'shrink',
      title: 'Same factor, smaller drops',
      codeTitle: 'drops.py',
      code: `
        loss = [3.98, 3.16, 2.51, 2.00]  #@plain
        # drops: 0.82, 0.65, 0.51        #@drops
        # compute: 1e18, 1e19, ... 1e21  #@price
        alpha = 0.05    # Kaplan et al.  #@kaplan
        10 ** -alpha    # 0.89           #@tenth
        10 ** -(6 * alpha)  # 0.5: half  #@million
      `,
      beats: [
        { id: 'plain', say: 'Now put the loss axis back to plain numbers, and keep the tenfold steps across.', code: 'plain' },
        { id: 'drops', say: 'The steps no longer match. Each takes the same fraction off a smaller loss, so the drops shrink: {0.82|zero point eight two}, then {0.65|zero point six five}, then {0.51|zero point five one}.', code: 'drops' },
        { id: 'price', say: 'And each step costs ten times the compute of the one before. The last step here takes off the least, and its run costs a hundred times the first one\'s.', code: 'price' },
        { id: 'kaplan', say: 'Measured exponents are smaller still. In 2020, Jared Kaplan and colleagues measured {α|alpha} at about {0.05|zero point zero five}, for language models given more and more compute.', code: 'kaplan' },
        { id: 'tenth', say: 'Then each tenfold step multiplies the loss by ten to the minus {0.05|zero point zero five}: only about {0.89|zero point eight nine}.', code: 'tenth' },
        { id: 'million', say: 'Halving the loss takes six such steps, since six times {0.05|zero point zero five} is {0.3|zero point three}. Six steps of ten: a million times the compute.', code: 'million' },
      ],
    },
    {
      id: 'back',
      title: 'Running it backwards',
      codeTitle: 'back.py',
      code: `
        loss = [4.0, 3.2]  # at 1x, 10x  #@given
        3.2 / 4.0     # 0.8 per step     #@factor
        3.2 * 0.8     # 100x: 2.56       #@again
        3.2 - 0.8     # 2.4: not this    #@not
        2.56 / 4.0    # 0.64             #@back
        0.8 * 0.8     # 0.64: two steps  #@count
        10 ** 2       # 100x the compute #@hundred
      `,
      beats: [
        { id: 'given', say: 'Now a different family. One run ends at a loss of four, and a run with ten times its compute ends at {3.2|three point two}. What loss will a hundred times the compute reach?', code: 'given' },
        { id: 'factor', say: 'First find the factor per step: {3.2|three point two} over four is {0.8|zero point eight}.', code: 'factor' },
        { id: 'again', say: 'A hundred times the compute is one more tenfold step past {3.2|three point two}, so multiply by {0.8|zero point eight} again: {2.56|two point five six}.', code: 'again' },
        { id: 'not', say: 'Not {3.2|three point two} minus another {0.8|zero point eight}, which would give {2.4|two point four}. The factor stays the same, so the drops shrink.', code: 'not' },
        { id: 'back', say: 'Now run it backwards. A loss of four should become {2.56|two point five six}: how much more compute does that take? Divide first: {2.56|two point five six} over four is {0.64|zero point six four}.', code: 'back' },
        { id: 'count', say: '{0.64|Zero point six four} is {0.8|zero point eight} times {0.8|zero point eight}: two factors, so two tenfold steps.', code: 'count' },
        { id: 'hundred', say: 'Each step is ten times the compute, so two steps cost ten times ten: a hundred times the compute.', code: 'hundred' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
