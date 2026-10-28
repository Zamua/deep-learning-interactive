import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-hinge-loss',
  title: 'Hinge loss',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Cortes & Vapnik', year: 1995, title: 'Support-vector networks', url: 'https://doi.org/10.1007/BF00994018', scene: 'gap' },
    { who: 'Weston & Watkins', year: 1999, title: 'Support vector machines for multi-class pattern recognition', url: 'https://www.esann.org/sites/default/files/proceedings/legacy/es1999-461.pdf', scene: 'sum' },
  ],
  scenes: [
    {
      id: 'gap',
      title: 'Leave room around the line',
      codeTitle: 'margin.py',
      code: `
        s = w @ x + b   # +: ship, -: cat   #@s
        # ask: ship s >= 1, cat s <= -1     #@gap
        # cat at s = -2: clear, costs 0     #@cost
        # cat at s = -0.5: costs 0.5        #@cost
        L = 0.5         # its loss          #@L
      `,
      beats: [
        { id: 'recap', say: 'Here are the cats and ships again, split by the line where w dot x, plus b, is zero. A point\'s score, s, is positive on the ship side and negative on the cat side, and bigger the farther it sits from the line.', code: 's' },
        { id: 'close', say: 'Every point is on its own side. But this cat is right against the line: a slightly different cat could land on the ship side.', code: 's' },
        { id: 'gap', say: 'So ask for more than the right side. Every ship should score at least one, and every cat at most minus one. That leaves room on both sides of the line: a margin.', code: 'gap' },
        { id: 'cost', say: 'A point clear of the margin costs nothing. One that falls short costs how far short it falls: this cat scores minus a half, half a point short of minus one, so it costs a half.', code: 'cost' },
        { id: 'loss', say: 'That cost is the point\'s loss, L: one number for how bad its score is, and zero when nothing is wrong.', code: 'L' },
        { id: 'svm', say: 'Corinna Cortes and Vladimir Vapnik charged points exactly this way in their support-vector network of 1995, now called the support vector machine, or SVM. Points right on the edges hold the margin in place: they are its support vectors.', code: 'gap' },
      ],
    },
    {
      id: 'classes',
      title: 'Beat every wrong class by one',
      codeTitle: 'hinge.py',
      code: `
        # scores: cat, plane, ship          #@s
        s = np.array([3, 5, -1])            #@s
        y = 0            # it is a cat      #@y
        s[y] - 1         # the line: 2      #@line
        5 - 2            # plane: 3 above   #@poke
        # cost: 0 below the line, then      #@h
        # up one for every point above      #@h
      `,
      beats: [
        { id: 'three', say: 'With three classes, each class has its own score. Here are one image\'s scores: three for cat, five for plane, and minus one for ship.', code: 's' },
        { id: 'y', say: 'It is a cat, so the right class, y, is cat: class zero, counting from zero.', code: 'y' },
        { id: 'line', say: 'Now the margin sits between scores: the right class must beat every wrong class by at least one. So draw a line one below cat\'s score, at two.', code: 'line' },
        { id: 'poke', say: 'A wrong class that pokes above the line costs how far it pokes. Plane, at five, is three above the line, so it costs three.', code: 'poke' },
        { id: 'slide', say: 'Slide plane\'s score up from the bottom, and watch its cost. It stays at zero all the way to the line, then climbs one for one.', code: 'h' },
        { id: 'hinge', say: 'Flat, then a corner, then a straight climb: the graph bends at one point, like a hinge. That is why this is called the hinge loss.', code: 'h' },
      ],
    },
    {
      id: 'sum',
      title: 'One term per wrong class',
      codeTitle: 'hinge.py',
      code: `
        s - s[y] + 1     # [1, 3, -3]       #@m
        max(0, -3)       # ship: 0          #@max
        L = sum(max(0, s[j] - s[y] + 1)     #@L
                for j in range(3) if j != y)  #@skip
        # 3 + 0 = 3                         #@sum
      `,
      beats: [
        { id: 'height', say: 'A wrong class\'s height above the line is its score, minus the right class\'s, plus one. For plane: five, minus three, plus one, is three.', code: 'm' },
        { id: 'max', say: 'Ship sits below the line, at a height of minus three. Its cost is the max of zero and that height, the larger of the two: zero. Being far below earns no credit.', code: 'max' },
        { id: 'sum', say: 'The hinge loss, L, adds up that cost over every wrong class j, written {j ≠ y|j not equal to y}. Here that is three for plane, plus zero for ship: L is three.', code: ['L', 'sum'] },
        { id: 'skip', say: 'The right class is skipped. Its own term would always be one, a cost no score could ever remove.', code: 'skip' },
        { id: 'ww', say: 'Jason Weston and Chris Watkins carried the support vector machine to many classes this way in 1999, with one term for each wrong class. So this is also called the multiclass SVM loss.', code: 'L' },
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
        { id: 'raise', say: 'Raise cat\'s score to six. The line rises to five, level with plane.', code: 's' },
        { id: 'zero', say: 'Plane\'s term is five, minus six, plus one: zero. Ship\'s term is zero as well, so the loss is zero.', code: ['m', 'zero'] },
        { id: 'least', say: 'Six is the smallest score that does it: the highest other score, plus one. At five and a half, cat still wins, but plane pokes half a point above the line. Winning is not enough: the right class must win by at least one.', code: 'least' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
