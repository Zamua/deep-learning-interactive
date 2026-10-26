import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lora',
  title: 'LoRA',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'full',
      title: 'A change built from two thin matrices',
      codeTitle: 'lora.py',
      code: `
        W = pretrained_W     # (d, k)         #@W
        W.shape              # (1000, 1000)   #@W
        W.size               # 1,000,000      #@size
        # LoRA: freeze W, learn B @ A        #@idea
      `,
      beats: [
        { id: 'W', say: 'Fine-tuning a pretrained network changes its weight matrices. Take one, W, with d rows and k columns: here, a thousand by a thousand.', code: 'W' },
        { id: 'size', say: 'Training all of it means a million numbers to learn, and a million more to store for every task.', code: 'size' },
        { id: 'idea', say: 'LoRA freezes W, and learns only a change to it, written as a product of two thin matrices: B times A.', code: 'idea' },
        { id: 'rank', say: 'B is d by r, and A is r by k. The rank, r, is small: here, four.', code: 'idea' },
      ],
    },
    {
      id: 'count',
      title: 'A sliver of the numbers',
      codeTitle: 'lora.py',
      code: `
        r = 4                                #@r
        B = np.zeros((d, r))    # (1000, 4)  #@B
        A = np.random.randn(r, k) * 0.01     #@A
        (B @ A).shape    # (1000, 1000)      #@shape
        B.size + A.size  # 8,000             #@count
        out = W @ x + B @ (A @ x)            #@out
      `,
      beats: [
        { id: 'shape', say: 'B times A is d by r, times r by k. The inner r\'s match, and the product comes out d by k: exactly W\'s shape.', code: ['B', 'A', 'shape'] },
        { id: 'count', say: 'Count what is learned. B is a thousand by four: four thousand numbers. A is four by a thousand: four thousand more.', code: ['B', 'A'] },
        { id: 'total', say: 'Together, eight thousand. That is r times d, plus r times k: r times d plus k, here four times two thousand.', code: 'count' },
        { id: 'frac', say: 'That is {0.8%|zero point eight percent} of the million in W.', code: 'count' },
        { id: 'out', say: 'The layer now computes W x plus B A x. W gets no updates; only B and A learn.', code: 'out' },
      ],
    },
    {
      id: 'merge',
      title: 'Start at zero, merge at the end',
      codeTitle: 'lora.py',
      code: `
        B = np.zeros((d, r))   # so B @ A = 0  #@zero
        out = W @ x + 0        # W @ x         #@same
        W_merged = W + B @ A   # (d, k)        #@merge
      `,
      beats: [
        { id: 'zero', say: 'B starts at zero, and A at random. So at the start, B A is zero, and the layer gives exactly what the pretrained one did.', code: ['zero', 'same'] },
        { id: 'start', say: 'Training begins from the original model, and moves away from it only as B learns.', code: 'same' },
        { id: 'merge', say: 'When training is done, add B A into W. The merged matrix has W\'s shape, so the layer runs exactly as fast as before.', code: 'merge' },
        { id: 'tasks', say: 'And each task keeps only its own B and A: eight thousand numbers instead of a million.' },
      ],
    },
    {
      id: 'worked',
      title: 'A W that is not square',
      codeTitle: 'lora.py',
      code: `
        W.shape                      # (2000, 500)  #@ask
        r = 4                                       #@ask
        B = np.zeros((2000, r))      # 8,000        #@B
        A = np.random.randn(r, 500)  # 2,000        #@A
        B.size + A.size              # 10,000       #@sum
        # 10,000 / 1,000,000 = 1%                   #@pct
      `,
      beats: [
        { id: 'ask', say: 'Now a W that is not square: two thousand rows by five hundred columns, with LoRA at rank four. How many numbers does it train?', code: 'ask' },
        { id: 'B', say: 'B takes W\'s rows, and r columns: two thousand by four. That is eight thousand numbers.', code: 'B' },
        { id: 'A', say: 'A takes r rows, and W\'s columns: four by five hundred. That is two thousand more.', code: 'A' },
        { id: 'sum', say: 'Together, ten thousand: four times two thousand five hundred, r times d plus k.', code: 'sum' },
        { id: 'pct', say: 'W holds two thousand times five hundred: a million numbers. So LoRA trains one percent of them.', code: 'pct' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
