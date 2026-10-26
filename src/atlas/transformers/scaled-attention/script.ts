import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-scaled-attention',
  title: 'Scaled dot-product attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'sharp',
      title: 'Big scores, all or nothing',
      codeTitle: 'sharp.py',
      code: `
        e = np.array([2, 0, 1])   # scores   #@small
        softmax(e)       # [0.67, 0.09, 0.24]            #@small
        softmax(4 * e)   # [0.98, 0.00, 0.02]            #@big
        # nudge a score: the weights barely move         #@stuck
      `,
      beats: [
        { id: 'sharp', say: 'Attention turns a query\'s scores into weights with softmax. Scores of two, zero and one give {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}: mostly the first key, some of the others.', code: 'small' },
        { id: 'bigger', say: 'Make the scores four times bigger, eight, zero and four, and the weights become {0.98|zero point nine eight}, zero and {0.02|zero point zero two}: all or nothing.', code: 'big' },
        { id: 'stuck', say: 'With one weight near one, nudging a score barely moves any weight, so the queries and keys get almost no gradient to learn from.', code: 'stuck' },
      ],
    },
    {
      id: 'why',
      title: 'Why long vectors give big scores',
      codeTitle: 'spread.py',
      code: `
        q = np.random.choice([-1, 1], d_k)   #@coin
        k = np.random.choice([-1, 1], d_k)   #@coin
        # d_k = 4: 16 ways, sums -4, -2, 0, 2, 4      #@count
        # seen 1, 4, 6, 4, 1 times                    #@count
        (sums ** 2).mean()   # 4.0                    #@square
        np.sqrt(4.0)         # 2.0: a typical size    #@square
        q @ k        # about sqrt(d_k) from 0  #@sum
        q @ k / np.sqrt(d_k)   # about 1     #@fix
      `,
      beats: [
        { id: 'coin', say: 'And long vectors do give big scores. Picture a query and a key whose entries are plus or minus one, at random. Each product in their dot product is then plus or minus one, like a coin flip.', code: 'coin' },
        { id: 'count', say: 'Take {dₖ|d k}, their length, as four. Four flips can land sixteen ways, and their sums are minus four once, minus two four times, zero six times, two four times, and four once.', code: 'count' },
        { id: 'square', say: 'Plus and minus cancel, so measure size by squaring. The squares average {64|sixty four} over sixteen: four. Its square root, two, is a typical size.', code: 'square' },
        { id: 'sum', say: 'Count any length this way and the average square is {dₖ|d k} itself, so a typical score lands about {√dₖ|the square root of d k} from zero. Sixty four terms give eight: sixteen times the terms, only four times the size.', code: 'sum' },
        { id: 'fix', say: 'Dividing by {√dₖ|the square root of d k} brings a typical score back to about one, however long the vectors are.', code: 'fix' },
      ],
    },
    {
      id: 'scale',
      title: 'Divide by the square root',
      codeTitle: 'scaled.py',
      code: `
        q = np.array([2, 1, 0, 1])      #@qk
        k = np.array([1, 0, 1, 2])      #@qk
        d_k = len(q)       # 4          #@dk
        q @ k              # 4          #@dot
        q @ k / np.sqrt(d_k)   # 2.0    #@scaled
        dots = np.array([4, 0, 2])     # q against 3 keys   #@row
        e = dots / np.sqrt(d_k)        # [2, 0, 1]          #@row
        a = softmax(e)     # [0.67, 0.09, 0.24]             #@a
      `,
      beats: [
        { id: 'formula', say: 'That is scaled dot-product attention. Each score is the dot product of a query and a key, divided by the square root of {dₖ|d k}.', code: ['qk', 'scaled'] },
        { id: 'example', say: 'Here the vectors have four entries, so {dₖ|d k} is four. The dot product is two plus zero plus zero plus two: four. The square root of four is two, so the score is two.', code: ['dk', 'dot', 'scaled'] },
        { id: 'row', say: 'Do the same for every key. Dot products of four, zero and two become scores of two, zero and one.', code: 'row' },
        { id: 'softmax', say: 'Then softmax, as before. With e squared about {7.39|seven point three nine} and e about {2.72|two point seven two}, the weights are {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}.', code: 'a' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
