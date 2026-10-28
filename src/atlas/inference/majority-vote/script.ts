import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-majority-vote',
  title: 'Self-consistency\'s vote',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Wang et al.', year: 2022, title: 'Self-Consistency Improves Chain of Thought Reasoning in Language Models', url: 'https://arxiv.org/abs/2203.11171', scene: 'vote' },
  ],
  scenes: [
    {
      id: 'slip',
      title: 'One path can slip',
      codeTitle: 'paths.py',
      code: `
        q = 'What is 17 × 24?'          #@q
        # 17 × 20 = 340                 #@path
        # 17 × 4 = 68                   #@path
        # 340 + 68 = 408                #@path
        # slip: 17 × 4 = 58, so 398     #@slip
        answers = [solve(q, T=0.7)      #@sample
                   for _ in range(5)]   #@sample
        # 408, 398, 408, 408, 418       #@answers
      `,
      beats: [
        { id: 'path', say: 'With a chain of thought, a model writes its steps before its answer. Asked for {17 × 24|seventeen times twenty four}, it finds {340|three hundred and forty}, then {68|sixty eight}, and adds them: {408|four hundred and eight}.', code: ['q', 'path'] },
        { id: 'slip', say: 'But every step is a chance to slip. Get seventeen times four wrong, as {58|fifty eight}, and the steps after it carry the slip all the way to a wrong answer: {398|three hundred and ninety eight}.', code: 'slip' },
        { id: 'sample', say: 'And with sampling, which path you get is luck. At a temperature above zero, each run picks its tokens at random, so each run takes its own route. Sample five of them.', code: 'sample' },
        { id: 'scatter', say: 'Three reach {408|four hundred and eight}, by three different routes. The two slips land apart: one at {398|three hundred and ninety eight}, one at {418|four hundred and eighteen}.', code: 'answers' },
        { id: 'agree', say: 'That is the pattern. There is one right answer, so right paths pile up on it. A slip can land anywhere, so wrong paths seldom agree with each other.', code: 'answers' },
      ],
    },
    {
      id: 'vote',
      title: 'Count the final answers',
      codeTitle: 'vote.py',
      code: `
        answers = [408, 398, 408, 408, 418]  #@answers
        votes = Counter(answers)             #@count
        # 408: 3, 398: 1, 418: 1             #@count
        votes.most_common(1)  # 408, 3 of 5  #@win
        # the answer the samples agree on    #@name
        # 40 paths: 56.5% → 74.4% right      #@gain
      `,
      beats: [
        { id: 'count', say: 'So ignore the routes, and count only the final answers: one vote per run.', code: ['answers', 'count'] },
        { id: 'win', say: '{408|Four hundred and eight} has three votes of five, the most, so it is the answer returned. It is right, even though two of the runs went wrong.', code: 'win' },
        { id: 'name', say: 'This is self-consistency. The answer it returns is the one the model\'s own samples are consistent about, and that is where the name comes from.', code: 'name' },
        { id: 'wang', say: 'In 2022, {Xuezhi Wang|Shweh-jer Wahng} and colleagues at Google proposed it, in place of the single greedy path that chain of thought had used. Their bet: right reasoning, however varied, agrees on its final answer more often than wrong reasoning does.', code: 'name' },
        { id: 'gain', say: 'On grade-school math word problems, one large model solved {56.5%|fifty six and a half percent} with its greedy path. Voting over forty sampled paths, it solved {74.4%|seventy four point four percent}.', code: 'gain' },
      ],
    },
    {
      id: 'needs',
      title: 'What the vote needs',
      codeTitle: 'needs.py',
      code: `
        T = 0.01   # T → 0: greedy         #@greedy
        # 408, 408, 408, 408, 408          #@copies
        # one path, copied five times      #@copies
        # a number, a letter, yes or no    #@compare
        # five stories: no two match       #@stories
      `,
      beats: [
        { id: 'greedy', say: 'The vote needs real sampling. As the temperature goes toward zero, sampling turns greedy: every run takes the most likely token at every step.', code: 'greedy' },
        { id: 'copies', say: 'So all five runs write the same path and reach the same answer. Five copies of one answer give the vote nothing to choose between.', code: 'copies' },
        { id: 'compare', say: 'And it needs final answers that can be compared: a number, a letter, yes or no. Wang\'s team said as much: the answer has to come from a fixed set.', code: 'compare' },
        { id: 'stories', say: 'Five stories about a lighthouse never match word for word. Each gets one vote, and there is no majority to find.', code: 'stories' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        answers = [15, 12, 12, 8, 12, 15, 12]   #@p1
        Counter(answers)  # 12: 4, 15: 2, 8: 1   #@a1
        # returns 12, with 4 votes of 7         #@a1
        answers[0]        # 15: one path        #@not
        sum(answers) / 7  # 12.29: no path      #@not
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
