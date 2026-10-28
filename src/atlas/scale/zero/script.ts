import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-zero',
  title: 'Sharding the optimizer',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rajbhandari, Rasley, Ruwase & He', year: 2019, title: 'ZeRO: Memory Optimizations Toward Training Trillion Parameter Models', url: 'https://arxiv.org/abs/1910.02054', scene: 'copies' },
  ],
  scenes: [
    {
      id: 'copies',
      title: 'Four copies of everything',
      codeTitle: 'memory.py',
      code: `
        gpu = 80        # GB on one GPU   #@gpu
        n = 7           # billion params  #@state
        state = 16 * n  # 112 GB          #@state
        G = 4           # GPUs            #@dp
        # each GPU: all 112 GB           #@dp
        G * gpu         # 320 GB in all   #@waste
        state / G       # 28 GB: a share  #@idea
      `,
      beats: [
        { id: 'gpu', say: 'Training runs on GPUs, graphics processing units: the chips that do its multiplications, thousands at once. A large one holds eighty gigabytes.', code: 'gpu' },
        { id: 'state', say: 'A model of seven billion parameters, trained with Adam, keeps sixteen bytes per parameter: a hundred and twelve gigabytes. That is more than one GPU holds.', code: 'state' },
        { id: 'dp', say: 'Data parallelism shares the work among GPUs, say four, but gives each one a full copy of the weights, and so of the whole training state.', code: 'dp' },
        { id: 'waste', say: 'Between them, the four hold three hundred and twenty gigabytes, plenty for a hundred and twelve. Yet none can train the model: each must fit an identical copy on its own.', code: 'waste' },
        { id: 'idea', say: 'So keep a single copy, cut into four pieces, one per GPU: twenty eight gigabytes each, and it fits.', code: 'idea' },
        { id: 'shard', say: 'A broken-off piece of something, like glass, is called a shard, so this is called sharding.', code: 'idea' },
        { id: 'name', say: 'In 2019, Samyam Rajbhandari and colleagues at Microsoft named it {ZeRO|zero}, for Zero Redundancy Optimizer: it brings the redundant copies, the ones not needed, down to zero.', code: 'idea' },
      ],
    },
    {
      id: 'stages',
      title: 'One part at a time',
      codeTitle: 'zero.py',
      code: `
        n, G = 7, 4       # billions, GPUs
        full = 16 * n             # 112   #@full
        s1 = (2 + 2 + 12/G) * n   # 49    #@s1
        s2 = (2 + 14/G) * n       # 38.5  #@s2
        s3 = 16/G * n             # 28    #@s3
        # N params, G GPUs: 16 N / G      #@rule
      `,
      beats: [
        { id: 'bar', say: 'Inside a GPU\'s sixteen bytes per parameter: two for the 16-bit weight, two for its gradient, and twelve for Adam: the master copy, m and v.', code: 'full' },
        { id: 's1', say: 'Stage one cuts Adam\'s twelve bytes, the biggest part, into four. Each GPU keeps one quarter: three bytes.', code: 's1' },
        { id: 'own', say: 'It updates only its own quarter of the weights. Then the GPUs swap their new quarters, so each has all the new weights again.', code: 's1' },
        { id: 's1b', say: 'With the weight and gradient whole, that is two, plus two, plus three: seven bytes per parameter.', code: 's1' },
        { id: 's1gb', say: 'Forty nine gigabytes per GPU: under eighty, so it fits.', code: 's1' },
        { id: 's2', say: 'Stage two cuts the gradients too: a GPU that updates one quarter of the weights only needs that quarter\'s averaged gradient.', code: 's2' },
        { id: 's2b', say: 'Only the weight\'s two bytes stay whole, and the other fourteen split four ways: {5.5|five and a half} bytes per parameter.', code: 's2' },
        { id: 's2gb', say: 'That is {38.5|thirty eight and a half} gigabytes per GPU.', code: 's2' },
        { id: 's3', say: 'Stage three cuts the weights as well: all sixteen bytes split four ways, four per parameter.', code: 's3' },
        { id: 's3gb', say: 'Twenty eight gigabytes per GPU: a quarter of the hundred and twelve.', code: 's3' },
        { id: 'rule', say: 'With N parameters on G GPUs, that is sixteen N over G bytes each: G times less than a full copy.', code: 'rule' },
        { id: 'saved', say: 'So each GPU here saves a hundred and twelve, minus twenty eight: eighty four gigabytes.', code: ['full', 's3'] },
      ],
    },
    {
      id: 'cost',
      title: 'What it costs',
      codeTitle: 'zero.py',
      code: `
        # stage 3: gather, use, drop   #@gather
        # same gradient, same step     #@same
        # traffic, stage 1 or 2: 1x    #@traffic
        # traffic, stage 3: 1.5x       #@traffic
        16 * 7 / 64     # 1.75 GB      #@more
        16 * 1000 / 1024  # ~16 GB     #@trillion
      `,
      beats: [
        { id: 'gather', say: 'Stage three has a price. To compute, a GPU needs all the weights, and it keeps only a quarter. So just before each piece is used, its keeper sends it to the others, and they drop it after.', code: 'gather' },
        { id: 'same', say: 'The arithmetic does not change: the same averaged gradient, the same step. Only where the numbers live.', code: 'same' },
        { id: 'traffic', say: 'The cost is traffic. The paper counts it: stages one and two send no more between GPUs than plain data parallelism, and stage three about one and a half times as much.', code: 'traffic' },
        { id: 'more', say: 'And the shares keep shrinking as GPUs are added: on sixty four of them, the seven billion parameters need {1.75|one point seven five} gigabytes each.', code: 'more' },
        { id: 'trillion', say: 'That was the aim in the paper\'s title: a trillion parameters. Their sixteen thousand gigabytes of state, over {1,024|one thousand and twenty four} GPUs, come to about sixteen gigabytes each.', code: 'trillion' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
