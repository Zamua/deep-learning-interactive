import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lora',
  title: 'LoRA',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hu, Shen, Wallis, Allen-Zhu, Li, Wang, Wang & Chen', year: 2021, title: 'LoRA: Low-Rank Adaptation of Large Language Models', url: 'https://arxiv.org/abs/2106.09685', scene: 'cost' },
  ],
  scenes: [
    {
      id: 'cost',
      title: 'A copy for every task',
      codeTitle: 'lora.py',
      code: `
        W = pretrained_W  # (d, k)         #@W
        W.shape           # (1000, 1000)   #@W
        W.size            # 1,000,000      #@size
        # fine-tune: W + a change (d, k)   #@size
        # LoRA: freeze W, learn B @ A      #@idea
        B.shape           # (d, r)         #@rank
        A.shape           # (r, k)         #@rank
      `,
      beats: [
        { id: 'W', say: 'Fine-tuning a pretrained network changes all of its weights a little. Take one weight matrix, W, with d rows and k columns: here, a thousand by a thousand.', code: 'W' },
        { id: 'size', say: 'That is a million numbers, all changed, so each new task needs its own copy: another million.', code: 'size' },
        { id: 'big', say: 'By 2021, some pretrained networks had a hundred and seventy five billion weights, and a fully fine-tuned copy for every task was far too costly.', code: 'size' },
        { id: 'lora', say: 'That year, Edward Hu and colleagues at Microsoft proposed LoRA: low-rank adaptation. Adapting means fitting a network to a new task.', code: 'idea' },
        { id: 'idea', say: 'LoRA freezes W, and learns only the change, built as the product of two thin matrices: B times A.', code: 'idea' },
        { id: 'rank', say: 'B is d by r, and A is r by k. Their thin side, r, is called the rank, and it is small: here, four.', code: 'rank' },
      ],
    },
    {
      id: 'rank',
      title: 'What the rank limits',
      codeTitle: 'rank.py',
      code: `
        B = np.array([[1], [2], [0],      #@B
                      [-1], [1]])  # (5, 1) #@B
        A = np.array([[1, 2, -1, 3, -2, 1]]) #@A
        B * A[0, 1]       # column 1: 2B   #@col
        # r = 2: B is (5, 2), A is (2, 6)  #@two
        # rank(B @ A) <= r                 #@def
      `,
      beats: [
        { id: 'small', say: 'To see what r limits, take a small change, five rows by six columns, with r of one. Then B is a single column, and A a single row.', code: ['B', 'A'] },
        { id: 'col', say: 'Each column of B times A is B times one column of A. Here, that column of A is one number, two, so this column of the change is B\'s column, doubled.', code: 'col' },
        { id: 'all', say: 'Every column is B\'s column, stretched, shrunk or flipped by one number. As vectors, they all point along one direction.', code: ['B', 'A'] },
        { id: 'two', say: 'With r of two, B has two columns, and each column of the change mixes them: some of the first, plus some of the second. Two directions.', code: 'two' },
        { id: 'def', say: 'That count is the rank: how many directions a matrix\'s columns really use, not counting mixes of the others. B times A never has more than r.', code: 'def' },
        { id: 'bet', say: 'At full size, a thousand columns are all mixed from just four. Hu and colleagues bet that fine-tuning needs only a few directions, and for some tasks, a rank of one was enough.', code: 'def' },
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
        # W (2000, 500): 8,000 + 2,000       #@wide
      `,
      beats: [
        { id: 'shape', say: 'B times A is d by r, times r by k. The inner r\'s drop out, leaving d by k: W\'s shape, so it can be added to W.', code: ['B', 'A', 'shape'] },
        { id: 'B', say: 'Now count what is learned. B has d rows of r numbers: a thousand times four, four thousand.', code: 'B' },
        { id: 'A', say: 'A has r rows of k numbers: four times a thousand, four thousand more.', code: 'A' },
        { id: 'total', say: 'Together, eight thousand: r times d, plus r times k. That is r times the sum, d plus k.', code: 'count' },
        { id: 'frac', say: 'Against the million in W, that is {0.8%|zero point eight percent}.', code: 'count' },
        { id: 'wide', say: 'Now a W that is not square: two thousand by five hundred. B takes its two thousand rows: eight thousand numbers.', code: 'wide' },
        { id: 'wideA', say: 'A takes its five hundred columns: two thousand numbers.', code: 'wide' },
        { id: 'pct', say: 'Ten thousand in all, against the million in W: one percent.', code: 'wide' },
      ],
    },
    {
      id: 'merge',
      title: 'Start at zero, merge at the end',
      codeTitle: 'lora.py',
      code: `
        out = W @ x + B @ (A @ x)              #@out
        B = np.zeros((d, r))  # so B @ A = 0   #@zero
        out = W @ x + 0       # W @ x          #@same
        W_merged = W + B @ A  # (d, k)         #@merge
      `,
      beats: [
        { id: 'out', say: 'While it trains, the layer computes W x, plus B A x. Only B and A learn.', code: 'out' },
        { id: 'zero', say: 'B starts at zero, and A at random. So at first, B A is zero, and the layer gives exactly what the pretrained one did.', code: ['zero', 'same'] },
        { id: 'start', say: 'So training starts from the pretrained network, and moves away only as B learns.', code: 'same' },
        { id: 'merge', say: 'When training is done, add B A into W. The sum has W\'s shape, so the layer runs exactly as fast as before.', code: 'merge' },
        { id: 'tasks', say: 'And each task keeps only its own B and A: eight thousand numbers, beside one shared, frozen W.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
