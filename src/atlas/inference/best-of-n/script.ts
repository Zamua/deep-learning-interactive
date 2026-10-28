import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-best-of-n',
  title: 'Best-of-n with a verifier',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Chen et al.', year: 2021, title: 'Evaluating Large Language Models Trained on Code', url: 'https://arxiv.org/abs/2107.03374', scene: 'check' },
    { who: 'Cobbe et al.', year: 2021, title: 'Training Verifiers to Solve Math Word Problems', url: 'https://arxiv.org/abs/2110.14168', scene: 'trust' },
  ],
  scenes: [
    {
      id: 'check',
      title: 'Hard to find, easy to check',
      codeTitle: 'best_of_n.py',
      code: `
        q = 'Solve 3x + 7 = 31 for x.'         #@q
        answers = [solve(q) for _ in range(4)] #@draw
        # [6, 8, 9, 7]                         #@draw
        3 * 8 + 7 == 31     # True: 8 passes   #@check
        kept = [a for a in answers             #@keep
                if passes(a)]       # [8]      #@keep
      `,
      beats: [
        { id: 'vote', say: 'Self-consistency\'s vote needs each sample to be right more often than not. A model right one time in ten gives it little to work with.' },
        { id: 'easy', say: 'But some answers are easy to check, even when hard to find. Solving {3x + 7 = 31|three x plus seven equals thirty one} takes steps. Checking an answer takes one: plug it back in.', code: 'q' },
        { id: 'draw', say: 'So sample four answers: six, eight, nine and seven.', code: 'draw' },
        { id: 'check', say: 'Plug each one in. Three times eight, plus seven, is thirty one, so eight passes. The other three miss.', code: 'check' },
        { id: 'name', say: 'A checker like this is called a verifier. Draw some number of samples, n, and keep one the verifier accepts: that is best-of-n.', code: 'keep' },
        { id: 'tests', say: 'Code can be checked too: run each program against its tests.', code: 'keep' },
        { id: 'chen', say: 'In 2021, Mark Chen and colleagues at OpenAI scored a code model this way. With one sample per problem, it solved {28.8%|twenty eight point eight percent}. Counting a problem solved when any of a hundred samples passed, it solved {70.2%|seventy point two percent}.' },
      ],
    },
    {
      id: 'odds',
      title: 'How often one gets through',
      codeTitle: 'odds.py',
      code: `
        right = 0.3        # p, per sample     #@p
        wrong = 1 - right  # 0.7               #@wrong
        miss = wrong ** 4  # 0.24: all wrong   #@miss
        hit = 1 - miss     # 0.76              #@hit
        # hit = 1 - (1 - p) ** n               #@formula
        # not 4 * 0.3 = 1.2: they overlap      #@add
      `,
      beats: [
        { id: 'p', say: 'How often does best-of-n find a right answer? Say each sample is right with chance p, here {0.3|zero point three}, independently of the others.', code: 'p' },
        { id: 'wrong', say: 'With a perfect verifier, best-of-n fails only when every sample is wrong. One sample is wrong with chance one minus p: {0.7|zero point seven}.', code: 'wrong' },
        { id: 'miss', say: 'Independent chances multiply, so all four are wrong with {0.7⁴|zero point seven to the fourth}: about {0.24|zero point two four}.', code: 'miss' },
        { id: 'hit', say: 'That is the only way it fails, so it succeeds with one minus that: {0.76|zero point seven six}, from a model right less than a third of the time.', code: 'hit' },
        { id: 'formula', say: 'With n samples in place of four, a hit has chance {1 − (1 − p)ⁿ|one minus, one minus p, to the n}.', code: 'formula' },
        { id: 'add', say: 'Chances do not simply add: four times {0.3|zero point three} is {1.2|one point two}, more than certain. Samples can be right together, and one is all it takes.', code: 'add' },
      ],
    },
    {
      id: 'many',
      title: 'How many to draw',
      codeTitle: 'how_many.py',
      code: `
        for n in range(1, 9):          #@loop
            print(n, 1 - 0.7 ** n)     #@loop
        0.7 ** 6   # 0.12: above 0.1   #@six
        0.7 ** 7   # 0.08: n = 7       #@seven
        1 - 0.9 ** 20  # p = 0.1: 0.88 #@rare
      `,
      beats: [
        { id: 'curve', say: 'Draw more, and the chance climbs, but each sample adds less than the one before: it can only cut what is left of the miss.', code: 'loop' },
        { id: 'target', say: 'To be right {90%|ninety percent} of the time, the miss must fall to a tenth or less. Find the smallest n that gets it there.', code: 'loop' },
        { id: 'six', say: '{0.7⁶|zero point seven to the sixth} is about {0.12|zero point one two}: still above a tenth, so six samples give only {0.88|zero point eight eight}.', code: 'six' },
        { id: 'seven', say: '{0.7⁷|zero point seven to the seventh} is about {0.08|zero point zero eight}, so seven samples are right {92%|ninety two percent} of the time: the smallest n.', code: 'seven' },
        { id: 'rare', say: 'It works even where a vote cannot: at p of {0.1|zero point one}, twenty samples include a right answer {88%|eighty eight percent} of the time.', code: 'rare' },
      ],
    },
    {
      id: 'trust',
      title: 'What the verifier must do',
      codeTitle: 'trust.py',
      code: `
        right = 0.3        # passed: all      #@pool
        fooled = 0.7 / 5   # wrong, passed    #@pool
        right / (right + fooled)  # 0.68      #@share
        # the same mix for any n              #@level
        # rejects some right: needs more n    #@strict
      `,
      beats: [
        { id: 'fooled', say: 'All this assumed a verifier that is never wrong. Say instead it is fooled by one wrong answer in five.', code: 'pool' },
        { id: 'pool', say: 'Count a hundred samples at p of {0.3|zero point three}. Thirty are right, and all of them pass. Seventy are wrong, and one in five of those gets through: fourteen.', code: 'pool' },
        { id: 'share', say: 'So of the forty four that pass, thirty are right: {30 / 44|thirty over forty four}, about {0.68|zero point six eight}.', code: 'share' },
        { id: 'level', say: 'More samples add both kinds in that same mix, so the answer kept stays right about {0.68|zero point six eight} of the time, however large n gets.', code: 'level' },
        { id: 'cobbe', say: 'In 2021, Karl Cobbe and colleagues at OpenAI trained a second model as the verifier for grade-school math word problems.' },
        { id: 'limit', say: 'Past about four hundred samples per problem, more samples stopped paying off: the search began to find wrong answers that fooled it.' },
        { id: 'strict', say: 'A verifier that rejects some right answers does far less harm. Nothing wrong is kept, so success still climbs toward one, as if right answers were rarer.', code: 'strict' },
        { id: 'must', say: 'So above all, a verifier must reject the wrong ones.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
