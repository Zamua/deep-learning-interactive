import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-self-consistency',
  title: 'Why the majority wins',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'both',
      title: 'Independent chances multiply',
      codeTitle: 'odds.py',
      code: `
        right = 0.7                          #@p
        # right in 7 runs of 10              #@p
        both = right * right         # 0.49  #@both
        mixed = right * (1 - right)  # 0.21  #@mixed
        three = both * right         # 0.343 #@third
      `,
      beats: [
        { id: 'one', say: 'Why does a majority vote help? Start with one sample. Say it is right with probability p, here {0.7|zero point seven}: in seven runs out of ten.', code: 'p' },
        { id: 'two', say: 'Now draw two samples, independently: how the first comes out tells you nothing about the second. Lay out a hundred equally likely pairs, the first sample across, the second down.', code: 'p' },
        { id: 'both', say: 'The first is right in seven columns of the ten. In each of those, the second is right in seven rows of ten. So both are right in seven times seven, forty nine squares of the hundred: {0.7 × 0.7|zero point seven times zero point seven}, which is {0.49|zero point four nine}.', code: 'both' },
        { id: 'mixed', say: 'The second is wrong with probability one minus p, {0.3|zero point three}. So first right and second wrong is seven columns times three rows, twenty one squares: {0.7 × 0.3|zero point seven times zero point three}, which is {0.21|zero point two one}.', code: 'mixed' },
        { id: 'rule', say: 'That is the rule for independent samples. The chance that each comes out a given way is the product of their chances, one factor per sample.', code: ['both', 'mixed'] },
        { id: 'third', say: 'A third sample is right in {0.7|zero point seven} of those {0.49|zero point four nine}: {0.49 × 0.7|zero point four nine times zero point seven} is {0.343|zero point three four three}, or {0.7³|zero point seven cubed}.', code: 'third' },
      ],
    },
    {
      id: 'odds',
      title: 'The vote of three',
      codeTitle: 'odds.py',
      code: `
        right = 0.7     # vote of 3: P(right)?  #@p
        three = right**3          # 0.343 #@three
        one_way = right**2 * 0.3  # 0.147 #@two
        two = 3 * one_way         # 0.441 #@ways
        three + two               # 0.784 #@sum
      `,
      beats: [
        { id: 'p', say: 'Now the vote. Three samples are each right with probability {0.7|zero point seven}, independently, and the vote is right when at least two of them are. What is the chance the vote is right?', code: 'p' },
        { id: 'three', say: 'All three right: one factor per sample, {0.7 × 0.7 × 0.7|zero point seven times zero point seven times zero point seven}, which is {0.343|zero point three four three}.', code: 'three' },
        { id: 'two', say: 'Exactly two right, with the third one wrong: {0.7 × 0.7 × 0.3|zero point seven times zero point seven times zero point three}, which is {0.147|zero point one four seven}.', code: 'two' },
        { id: 'ways', say: 'But the wrong one could also be the first sample, or the second. Three ways, each {0.147|zero point one four seven}, so {0.441|zero point four four one} in all.', code: 'ways' },
        { id: 'sum', say: 'Together, {0.784|zero point seven eight four}, or in symbols {p³ + 3p²(1 − p)|p cubed, plus three p squared times one minus p}: better than one sample\'s {0.7|zero point seven}. When most samples are right, the majority is right even more often.', code: 'sum' },
        { id: 'below', say: 'It cuts both ways. At {0.4|zero point four}, a majority of three is right only {0.352|zero point three five two} of the time.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
