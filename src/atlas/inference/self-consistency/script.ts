import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-self-consistency',
  title: 'Self-consistency',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'vote',
      title: 'Sample several paths, then vote',
      codeTitle: 'vote.py',
      code: `
        q = 'What is 17 × 24?'                  #@q
        answers = [solve(q, T=0.7)              #@sample
                   for _ in range(5)]           #@sample
        # 408, 408, 398, 408, 418               #@answers
        Counter(answers).most_common(1)         #@vote
        # 408: 3 votes of 5                     #@vote
        # T → 0: one path, five times           #@greedy
      `,
      beats: [
        { id: 'paths', say: 'Sample a chain of thought at a temperature above zero, and every run takes a different path. Ask for {17 × 24|seventeen times twenty four}, five times.', code: ['q', 'sample'] },
        { id: 'answers', say: 'Most paths reach {408|four hundred and eight}, by different routes. One slips to {398|three hundred and ninety eight}, another to {418|four hundred and eighteen}.', code: 'answers' },
        { id: 'vote', say: 'Self-consistency ignores the paths and counts the final answers. {408|Four hundred and eight} has three votes of five, so it wins.', code: 'vote' },
        { id: 'greedy', say: 'This needs real sampling. As the temperature goes to zero, greedy decoding writes the same path every time, and five copies of one answer add nothing.', code: 'greedy' },
      ],
    },
    {
      id: 'odds',
      title: 'Why the majority does better',
      codeTitle: 'odds.py',
      code: `
        right = 0.7                       #@p
        three = right**3          # 0.343 #@three
        two = 3 * right**2 * 0.3  # 0.441 #@two
        three + two               # 0.784 #@sum
      `,
      beats: [
        { id: 'p', say: 'Why does voting help? Say each sample is right with probability p, here {0.7|zero point seven}, independently. Take three, and the vote is right when at least two of them are.', code: 'p' },
        { id: 'three', say: 'All three right: {0.7³|zero point seven cubed}, which is {0.343|zero point three four three}.', code: 'three' },
        { id: 'two', say: 'Exactly two right: the wrong one can be the first, the second or the third sample. Three ways, each {0.7² × 0.3|zero point seven squared times zero point three}, so {0.441|zero point four four one} in all.', code: 'two' },
        { id: 'sum', say: 'Together, {0.784|zero point seven eight four}, or in symbols {p³ + 3p²(1 − p)|p cubed, plus three p squared times one minus p}: better than one sample\'s {0.7|zero point seven}. When most samples are right, the majority is right even more often.', code: 'sum' },
        { id: 'below', say: 'It cuts both ways. At {0.4|zero point four}, a majority of three is right only {0.352|zero point three five two} of the time.' },
        { id: 'compare', say: 'And the vote needs answers that can be compared: a number, a letter, yes or no. Five stories never match word for word, so there is nothing to count.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
