import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-majority-vote',
  title: 'Self-consistency\'s vote',
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
        # five stories: no two match            #@compare
      `,
      beats: [
        { id: 'paths', say: 'Sample a chain of thought at a temperature above zero, and every run takes a different path. Ask for {17 × 24|seventeen times twenty four}, five times.', code: ['q', 'sample'] },
        { id: 'answers', say: 'Most paths reach {408|four hundred and eight}, by different routes. One slips to {398|three hundred and ninety eight}, another to {418|four hundred and eighteen}.', code: 'answers' },
        { id: 'vote', say: 'Self-consistency ignores the paths and counts the final answers. {408|Four hundred and eight} has three votes of five, so it wins.', code: 'vote' },
        { id: 'greedy', say: 'This needs real sampling. As the temperature goes to zero, greedy decoding writes the same path every time, and five copies of one answer add nothing.', code: 'greedy' },
        { id: 'compare', say: 'And the vote needs answers that can be compared: a number, a letter, yes or no. Five stories never match word for word, so there is nothing to count.', code: 'compare' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        answers = [15, 12, 12, 8, 12, 15, 12]   #@p1
        Counter(answers)   # 12: 4, 15: 2, 8: 1  #@a1
        # returns 12, with 4 votes of 7         #@a1
        answers[0]         # 15: one path       #@not
        sum(answers) / 7   # 12.29: no path     #@not
        letters = ['B', 'B', 'C', 'B', 'D']     #@p2
        # 'B' wins, with 3 votes of 5           #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. Asked for {15%|fifteen percent} of eighty, a model samples seven chains of thought. Their final answers are fifteen, twelve, twelve, eight, twelve, fifteen and twelve. What does self-consistency return?', code: 'p1' },
        { id: 'a1', say: 'Count each answer: twelve four times, fifteen twice, and eight once. Twelve has the most votes, four of seven, so twelve is returned.', code: 'a1' },
        { id: 'not', say: 'Not the first path\'s fifteen: that is one path. And not the average, about {12.29|twelve point two nine}: a number no path reached.', code: 'not' },
        { id: 'p2', say: 'Now each of five replies to a multiple-choice question ends in a letter, A to D. Can the vote pick a better reply than one sample?', code: 'p2' },
        { id: 'a2', say: 'Yes. Different paths often end on the same letter, so letters can be counted. Here three of the five end in B, so B wins.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
