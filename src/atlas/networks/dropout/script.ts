import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dropout',
  title: 'Dropout',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'drop',
      title: 'Drop, then scale up',
      codeTitle: 'dropout.py',
      code: `
        h = np.array([2, 1, 3, 2])                             #@h
        p_keep = 0.5                                           #@mask
        m = np.random.rand(4) < p_keep   # [1, 0, 1, 0]        #@mask
        # kept on average: 4 * 0.5 = 2 units                  #@kept
        out = h * m                      # [2, 0, 3, 0]        #@zero
        out = out / p_keep               # [4, 0, 6, 0]        #@scale
      `,
      beats: [
        { id: 'layer', say: 'Here is a hidden layer\'s output, h: four units, with values two, one, three and two.', code: 'h' },
        { id: 'mask', say: 'During training, dropout keeps each unit with probability p, here a half, and zeroes the rest. A random mask, m, decides: a one keeps a unit, and a zero drops it. This time it keeps units zero and two.', code: 'mask' },
        { id: 'kept', say: 'On average, a fraction p of the units stay: four units times a half, two. Each step draws a new mask, so which two changes.', code: 'kept' },
        { id: 'zeroed', say: 'Multiply h by m, entry by entry, and the layer\'s output becomes two, zero, three, zero.', code: 'zero' },
        { id: 'scale', say: 'Then the kept units are divided by p. With p a half, that doubles them: four, zero, six, zero. This is inverted dropout.', code: 'scale' },
        { id: 'why', say: 'Why divide? A unit is kept only a fraction p of the time. Dividing by p makes up for it: on average, p times h over p is h, exactly what the unit gives without dropout.', code: 'scale' },
        { id: 'plain', say: 'Plain dropout skips the division, so a kept unit passes h as it is. Then unit zero averages a half times two, plus a half times zero: one. That is p times h, smaller than h.', code: 'zero' },
      ],
    },
    {
      id: 'test',
      title: 'At test time',
      codeTitle: 'dropout.py',
      code: `
        out = h    # test: no drops, no scaling      #@test
        # training average: p * (h / p) = h          #@match
        out = p_keep * h   # plain dropout, test     #@plain
        # any unit may vanish: none can rely on one  #@lean
      `,
      beats: [
        { id: 'test', say: 'At test time, every unit is kept and nothing is scaled. The layer passes h straight through: two, one, three, two.', code: 'test' },
        { id: 'match', say: 'Because training already divided by p, the next layer sees at test time what it saw on average in training. No correction is needed.', code: 'match' },
        { id: 'plain', say: 'Plain dropout never divided, so at test time it keeps every unit and multiplies each output by p instead: two, one, three, two become one, a half, one and a half, one. That matches its training average, p times h.', code: 'plain' },
        { id: 'lean', say: 'And in training, any unit might vanish at any moment, so no unit can count on another being there. Each has to be useful on its own.', code: 'lean' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
