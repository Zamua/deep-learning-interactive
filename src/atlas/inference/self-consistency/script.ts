import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-self-consistency',
  title: 'Why the majority wins',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Condorcet', year: 1785, title: 'Essai sur l\'application de l\'analyse à la probabilité des décisions rendues à la pluralité des voix', url: 'https://archive.org/details/essaisurlapplica00cond', scene: 'claim' },
  ],
  scenes: [
    {
      id: 'claim',
      title: 'Outvoting a slip',
      codeTitle: 'vote3.py',
      code: `
        ok = [True, True, False]       #@one
        sum(ok) >= 2   # True: outvoted #@one
        ok = [True, False, False]      #@two
        sum(ok) >= 2   # False          #@two
        # each right more often than not #@jury
        # → the majority, more often     #@jury
      `,
      beats: [
        { id: 'one', say: 'Why should the most common answer beat a single sample? Take a vote of three. If one sample goes wrong, the other two outvote it, and the vote is still right.', code: 'one' },
        { id: 'two', say: 'The vote goes wrong only when at least two samples go wrong at once. And when each sample is usually right, two going wrong together is rarer than one.', code: 'two' },
        { id: 'condorcet', say: 'This is old mathematics. In 1785, the Marquis de Condorcet, a French mathematician, wrote an essay on the chance that a decision made by majority vote is right.', code: 'jury' },
        { id: 'jury', say: 'His result is now called the jury theorem. If voters decide independently, and each is right more often than not, the majority is right more often still, and more so the more voters there are.', code: 'jury' },
      ],
    },
    {
      id: 'both',
      title: 'Independent chances multiply',
      codeTitle: 'odds.py',
      code: `
        right = 0.7                    #@p
        # right in 7 runs of 10        #@p
        both = right * right   # 0.49  #@both
        mixed = right * (1 - right) # 0.21 #@mixed
        wrong = (1 - right) ** 2  # 0.09 #@wrong
      `,
      beats: [
        { id: 'p', say: 'To see how much rarer, give each sample\'s chance of being right a name, p. Say p is {0.7|zero point seven}: right in seven runs out of ten.', code: 'p' },
        { id: 'indep', say: 'Independently means how one sample comes out tells you nothing about another. Then two samples make a hundred equally likely pairs: the first across, the second down.', code: 'p' },
        { id: 'both', say: 'The first is right in seven columns of the ten. In each of them, the second is right in seven rows. So both are right in seven times seven: forty nine squares of the hundred.', code: 'both' },
        { id: 'mult', say: 'As chances, that is {0.7 × 0.7|zero point seven times zero point seven}: {0.49|zero point four nine}. That is the rule for independent samples: multiply their chances, one factor per sample.', code: 'both' },
        { id: 'mixed', say: 'A sample is wrong with chance one minus p, {0.3|zero point three}. First right and second wrong is seven columns by three rows: twenty one squares, or {0.21|zero point two one}.', code: 'mixed' },
        { id: 'wrong', say: 'And both wrong is three by three: only nine squares, or {0.09|zero point zero nine}. One sample is wrong thirty times in a hundred, but two together only nine.', code: 'wrong' },
      ],
    },
    {
      id: 'odds',
      title: 'The vote of three',
      codeTitle: 'vote.py',
      code: `
        right = 0.7  # vote of 3: P(right)? #@p
        three = right**3          # 0.343 #@three
        one_way = right**2 * 0.3  # 0.147 #@two
        two = 3 * one_way         # 0.441 #@ways
        three + two               # 0.784 #@sum
        # p**3 + 3 * p**2 * (1 - p)       #@formula
        # p = 0.4: 0.064 + 0.288 = 0.352  #@below
      `,
      beats: [
        { id: 'p', say: 'Now the vote. Three samples are each right with chance {0.7|zero point seven}, independently, and the vote is right when at least two of them are. How often is that?', code: 'p' },
        { id: 'three', say: 'All three right takes one more factor: {0.49 × 0.7|zero point four nine times zero point seven}, which is {0.343|zero point three four three}, or {0.7³|zero point seven cubed}.', code: 'three' },
        { id: 'two', say: 'Exactly two right, with the third one wrong: {0.7 × 0.7 × 0.3|zero point seven times zero point seven times zero point three}, which is {0.147|zero point one four seven}.', code: 'two' },
        { id: 'ways', say: 'But the wrong one could also be the first sample, or the second. That makes three ways, each {0.147|zero point one four seven}, so {0.441|zero point four four one} in all.', code: 'ways' },
        { id: 'sum', say: 'Add the two cases, and the vote is right {0.784|zero point seven eight four} of the time, more than one sample\'s {0.7|zero point seven}.', code: 'sum' },
        { id: 'formula', say: 'With p in place of the numbers, that is {p³ + 3p²(1 − p)|p cubed, plus three p squared times one minus p}: all three right, plus three ways of exactly two.', code: 'formula' },
        { id: 'below', say: 'It cuts both ways. At {0.4|zero point four}, a sample is usually wrong, and the vote is right only {0.352|zero point three five two} of the time: worse than one sample.', code: 'below' },
        { id: 'half', say: 'That is why Condorcet needed each voter to be right more often than not. At exactly one half, the vote neither helps nor hurts.', code: 'below' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
