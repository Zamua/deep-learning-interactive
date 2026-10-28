import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-scaled-attention',
  title: 'Scaled dot-product attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Britz, Goldie, Luong & Le', year: 2017, title: 'Massive Exploration of Neural Machine Translation Architectures', url: 'https://arxiv.org/abs/1703.03906', scene: 'sharp' },
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'sharp' },
  ],
  scenes: [
    {
      id: 'sharp',
      title: 'All or nothing',
      codeTitle: 'sharp.py',
      code: `
        e = np.array([2, 0, 1])  # fish   #@e
        softmax(e)  # [0.67, 0.09, 0.24]  #@soft
        softmax(4 * e)  # [0.98, 0, 0.02] #@hard
        # fish + 0.5:  soft  +0.10        #@nudge
        #              sharp +0.01        #@nudge
      `,
      beats: [
        { id: 'recall', say: 'Back to cats like fish. Fish\'s query gave cats a score of two, like zero, and itself one. Softmax turned those into soft weights: mostly cats, some of the rest.', code: ['e', 'soft'] },
        { id: 'long', say: 'Those queries and keys had two entries each; Vaswani\'s had sixty four. A dot product adds one product per entry, so longer vectors tend to give bigger scores.', code: 'e' },
        { id: 'bigger', say: 'Make the scores four times bigger: eight, zero and four. Their gaps grow just as much, and softmax goes all or nothing: nearly all the weight lands on cats.', code: 'hard' },
        { id: 'nudge', say: 'Now nudge fish\'s score up by a half, in both. The soft weights shift. The sharp ones barely move.', code: 'nudge' },
        { id: 'flat', say: 'How far the weights move for a nudge is their slope: the gradient that backprop carries to the queries and keys. Near zero, they have almost nothing to learn from. The softmax is saturated, like a sigmoid far from zero.', code: 'nudge' },
        { id: 'britz', say: 'In 2017, Denny Britz and colleagues found long vectors hurting translation. With queries and keys of {1,024|a thousand and twenty four} numbers, dot-product attention did much worse than with {512|five hundred and twelve}.', code: 'hard' },
        { id: 'vaswani', say: 'Months later, Ashish Vaswani and colleagues suspected why: large dot products, they wrote, push the softmax into regions where it has extremely small gradients.', code: 'hard' },
      ],
    },
    {
      id: 'why',
      title: 'Why long vectors give big scores',
      codeTitle: 'spread.py',
      code: `
        q = np.random.choice([-1, 1], d_k) #@coin
        k = np.random.choice([-1, 1], d_k) #@coin
        q * k   # each +1 or -1: a flip    #@coin
        q @ k   # d_k flips, added up      #@walk
        # d_k = 4: 16 ways, sums -4 to 4   #@count
        # the squares average 4            #@square
        np.sqrt(4)   # 2: a typical size   #@typical
        # any d_k: about sqrt(d_k) from 0  #@grow
      `,
      beats: [
        { id: 'coin', say: 'Why do longer vectors give bigger scores? Picture a query and a key whose entries are plus or minus one, at random. Each product in their dot product is then also plus or minus one: a coin flip.', code: 'coin' },
        { id: 'walk', say: 'Add the flips one at a time, and the running total takes a walk, up one or down one. Here are many walks of sixty four steps.', code: 'walk' },
        { id: 'cancel', say: 'Ups and downs mostly cancel, but rarely exactly. The longer the walk, the farther from zero it tends to end, yet nowhere near the sixty four it could reach.', code: 'walk' },
        { id: 'count', say: 'Now count exactly, with just four flips. They can land sixteen ways, and their sums run from minus four to four, zero most often.', code: 'count' },
        { id: 'square', say: 'Pluses and minuses would cancel in an average, so measure size by squaring. The sixteen squares average exactly four: {dₖ|d k} itself.', code: 'square' },
        { id: 'typical', say: 'The square root of that, two, is a typical size: how far from zero a score usually lands.', code: 'typical' },
        { id: 'grow', say: 'At any length, the average square is {dₖ|d k}, so a typical score lands about {√dₖ|the square root of d k} from zero. Sixty four flips give about eight: sixteen times the flips, only four times the size.', code: 'grow' },
        { id: 'footnote', say: 'Vaswani\'s paper makes this same argument, in a footnote.', code: 'grow' },
      ],
    },
    {
      id: 'scale',
      title: 'Divide by the square root',
      codeTitle: 'scaled.py',
      code: `
        q @ k / np.sqrt(d_k)  # about 1    #@fix
        q @ k / d_k   # shrinks toward 0   #@root
        q = np.array([2, 1, 0, 1])         #@qk
        k = np.array([1, 0, 1, 2])         #@qk
        q @ k                 # 4          #@dot
        q @ k / np.sqrt(4)    # 2.0        #@scaled
        dots = np.array([4, 0, 2])         #@row
        e = dots / np.sqrt(4)  # [2, 0, 1] #@row
        softmax(e)  # [0.67, 0.09, 0.24]   #@a
      `,
      beats: [
        { id: 'fix', say: 'So divide every score by {√dₖ|the square root of d k}. A typical score then lands about one from zero, however long the vectors.', code: 'fix' },
        { id: 'root', say: 'Why the square root, and not {dₖ|d k} itself? Divide by {dₖ|d k}, and long vectors\' scores shrink toward zero, and every weight toward an equal share.', code: 'root' },
        { id: 'name', say: 'Vaswani\'s team called this scaled dot-product attention, and the name is the recipe: a dot product, scaled down by {√dₖ|the square root of d k}.', code: 'scaled' },
        { id: 'dot', say: 'Try it with four entries each. The dot product of these two is two, plus zero, plus zero, plus two: four.', code: ['qk', 'dot'] },
        { id: 'divide', say: 'Here {dₖ|d k} is four, and its square root is two, so the score is four over two: two.', code: 'scaled' },
        { id: 'row', say: 'Scale the dot products with all three keys the same way. Four, zero and two become two, zero and one: the soft scores we began with.', code: 'row' },
        { id: 'soft', say: 'Softmax gives the soft weights again, about two thirds on the first key, and a nudge still moves them.', code: 'a' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
