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
        { id: 's', say: 'Scores again, s: cat three, dog five, ship minus one. The image is a cat, so the right class, y, is zero.', code: ['s', 'y'] },
        { id: 'line', say: 'A loss, L, is one number for how bad the scores are. The multiclass SVM loss, or hinge loss, wants the right class to win by a margin of at least one. Draw a line one below cat\'s score, at two.', code: 'm' },
        { id: 'poke', say: 'A wrong class that pokes above the line costs exactly how far it pokes. Dog, at five, is three above it.', code: 'm' },
        { id: 'safe', say: 'Ship, far below the line, costs nothing. Its term is minus three, and the hinge clips it to zero: {max(0, −3)|the max of zero and minus three}, the larger of the two, is zero. No credit for being low.', code: 'm' },
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
        { id: 'formula', say: 'In symbols: for every wrong class, {j ≠ y|j not equal to y}, take {max(0, sⱼ − s[y] + 1)|the max of zero and s j, minus s y, plus one}. Then add them up.', code: 'L' },
        { id: 'skip', say: 'The right class is skipped. Its own term would always be one, a cost no score could ever remove.', code: 'skip' },
        { id: 'sum', say: 'Here that is three for dog, plus zero for ship. The loss is three.', code: 'sum' },
      ],
    },
    {
      id: 'zero',
      title: 'When the loss is zero',
      codeTitle: 'hinge.py',
      code: `
        s = np.array([6, 5, -1])            #@s
        s - s[y] + 1     # [1, 0, -6]       #@m
        # max(0, 0) + max(0, -6) = 0        #@zero
        # smallest s[y]: 5 + 1 = 6          #@least
      `,
      beats: [
        { id: 'raise', say: 'Raise cat\'s score to six. The line rises to five, level with dog.', code: 's' },
        { id: 'zero', say: 'Dog\'s term is five, minus six, plus one: zero, and the max of zero and zero is zero. Ship\'s is zero too, so the loss is zero.', code: ['m', 'zero'] },
        { id: 'least', say: 'Six is the smallest score that does it: the highest other score, plus one. At five and a half, dog pokes half a point above the line. Just winning is not enough: the right class must win by at least one.', code: 'least' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
