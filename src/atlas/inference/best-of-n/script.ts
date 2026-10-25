import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-best-of-n',
  title: 'Best-of-n with a verifier',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'draw',
      title: 'Keep one the checker accepts',
      codeTitle: 'best_of_n.py',
      code: `
        answers = [solve(q) for _ in range(4)]    #@draw
        kept = [a for a in answers if passes(a)]  #@check
        right = 0.3                # per sample   #@p
        miss = (1 - right) ** 4    # 0.24         #@miss
        hit = 1 - miss             # 0.76         #@hit
      `,
      beats: [
        { id: 'draw', say: 'Some answers can be checked. A program can be run against its tests, and a solution can be plugged back into its equation. Then there is a plan simpler than a vote: draw several answers, and keep one the checker accepts.', code: 'draw' },
        { id: 'check', say: 'Here are four programs sampled for one task. The tests fail three of them and pass one, so best-of-n keeps that one.', code: 'check' },
        { id: 'miss', say: 'How often does this work? Say each sample is right with probability {0.3|zero point three}, so wrong with {0.7|zero point seven}. All four are wrong with {0.7⁴|zero point seven to the fourth}, about {0.24|zero point two four}.', code: ['p', 'miss'] },
        { id: 'hit', say: 'That is the only way best-of-n fails. So it succeeds with one minus that, {0.76|zero point seven six}, from a model that is right less than a third of the time.', code: 'hit' },
        { id: 'formula', say: 'In general, {1 − (1 − p)ⁿ|one minus, one minus p, to the n}. Every extra sample shrinks the chance that all of them miss.', code: ['miss', 'hit'] },
      ],
    },
    {
      id: 'enough',
      title: 'How many to draw, and what the checker must do',
      codeTitle: 'how_many.py',
      code: `
        for n in range(1, 9):                #@loop
            print(n, 1 - 0.7 ** n)           #@loop
        # n = 6: 0.88    n = 7: 0.92         #@seven
        # fooled 1 time in 5: stuck at 0.68  #@fooled
      `,
      beats: [
        { id: 'curve', say: 'Each sample adds less than the one before. With p at {0.3|zero point three}: {0.3|zero point three} with one sample, {0.51|zero point five one} with two, {0.66|zero point six six} with three.', code: 'loop' },
        { id: 'seven', say: 'To be right {90%|ninety percent} of the time, find the smallest n that gets there. Six samples give {0.88|zero point eight eight}, not quite; seven give {0.92|zero point nine two}.', code: 'seven' },
        { id: 'rare', say: 'It works even when right answers are rare. At p of {0.1|zero point one}, one sample in ten is right, far too few to win a vote, yet twenty samples hold a right one {88%|eighty eight percent} of the time.' },
        { id: 'fooled', say: 'All this assumes the checker never accepts a wrong answer. If it is fooled one time in five, more samples bring more wrong answers past it, and success levels off near {0.68|zero point six eight}.', code: 'fooled' },
        { id: 'strict', say: 'A checker that rejects some right answers only costs more samples. So above all, it must reject the wrong ones.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
