import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-hinge-loss',
  title: 'Hinge loss',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'margin',
      title: 'Win by a margin',
      codeTitle: 'hinge.py',
      code: `
        s = np.array([3, 5, -1])   # cat, dog, ship   #@s
        y = 0                      # it is a cat      #@y
        s - s[y] + 1               # [1, 3, -3]       #@m
      `,
      beats: [
        { id: 's', say: 'Scores again: cat three, dog five, ship minus one. The image is a cat, so y is zero.', code: ['s', 'y'] },
        { id: 'line', say: 'The multiclass SVM loss wants the right class to win by a margin of at least one. Draw a line one below cat\'s score, at two.', code: 'm' },
        { id: 'poke', say: 'A wrong class that pokes above the line costs exactly how far it pokes. Dog, at five, is three above it.', code: 'm' },
        { id: 'safe', say: 'Ship, far below the line, costs nothing. Its term is minus three, and the hinge clips it to zero: no credit for being low.', code: 'm' },
      ],
    },
    {
      id: 'sum',
      title: 'One term per wrong class',
      codeTitle: 'hinge.py',
      code: `
        L = sum(max(0, s[j] - s[y] + 1)          #@L
                for j in range(3) if j != y)     #@skip
        # max(0, 3) + max(0, -3) = 3 + 0 = 3     #@sum
      `,
      beats: [
        { id: 'formula', say: 'In symbols: for every wrong class j, take the larger of zero and {sⱼ − s[y] + 1|s j, minus s y, plus one}. Then add them up.', code: 'L' },
        { id: 'skip', say: 'The right class is skipped. Its own term would always be one, a cost no score could ever remove.', code: 'skip' },
        { id: 'sum', say: 'Here that is three for dog, plus zero for ship. The loss is three.', code: 'sum' },
      ],
    },
    {
      id: 'zero',
      title: 'When the loss is zero',
      codeTitle: 'hinge.py',
      code: `
        s = np.array([7, 5, -1])            #@s
        s - s[y] + 1     # [1, -1, -7]      #@m
        # every wrong class at or below 0: L = 0   #@zero
      `,
      beats: [
        { id: 'raise', say: 'Raise cat\'s score to seven. The line rises to six, above every other class.', code: 's' },
        { id: 'zero', say: 'Every term is zero, so the loss is zero. That takes beating every other class by at least one. Just winning is not enough.', code: ['m', 'zero'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
