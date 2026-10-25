import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-scaled-attention',
  title: 'Scaled dot-product attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
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
        { id: 'formula', say: 'Scaled dot-product attention changes one thing. Each score is the dot product of a query and a key, divided by the square root of {dₖ|d k}, their length.', code: ['qk', 'scaled'] },
        { id: 'example', say: 'Here the vectors have four entries, so {dₖ|d k} is four. The dot product is four, the square root of four is two, so the score is two.', code: ['dk', 'dot', 'scaled'] },
        { id: 'row', say: 'Do the same for every key. Dot products of four, zero and two become scores of two, zero and one.', code: 'row' },
        { id: 'softmax', say: 'Then softmax, as before. With e squared about {7.39|seven point three nine} and e about {2.72|two point seven two}, the weights are {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}.', code: 'a' },
      ],
    },
    {
      id: 'why',
      title: 'Why the square root',
      codeTitle: 'spread.py',
      code: `
        q = np.random.choice([-1, 1], d_k)   #@coin
        k = np.random.choice([-1, 1], d_k)   #@coin
        q @ k     # typically about sqrt(d_k) from 0   #@sum
        softmax([2, 0, 1])   # [0.67, 0.09, 0.24]      #@sharp
        softmax([8, 0, 4])   # [0.98, 0.00, 0.02]      #@sharp
        q @ k / np.sqrt(d_k)  # typically about 1     #@fix
      `,
      beats: [
        { id: 'coin', say: 'Why the square root? Picture a query and a key whose entries are plus or minus one, at random. Each product in their dot product is then plus or minus one, like a coin flip.', code: 'coin' },
        { id: 'sum', say: 'Add up {dₖ|d k} of them and they partly cancel. The total typically lands about the square root of {dₖ|d k} from zero: two for four terms, eight for sixty four.', code: 'sum' },
        { id: 'sharp', say: 'So longer vectors give bigger scores, and big scores make softmax all or nothing. Two, zero and one give {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}. Four times bigger, they give {0.98|zero point nine eight}, zero, and {0.02|zero point zero two}.', code: 'sharp' },
        { id: 'stuck', say: 'With one weight near one, nudging a score barely moves any weight, so the queries and keys get almost no gradient to learn from.', code: 'sharp' },
        { id: 'fix', say: 'Dividing by the square root of {dₖ|d k} brings a typical score back to about one, however long the vectors are.', code: 'fix' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
