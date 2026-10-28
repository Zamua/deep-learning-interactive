import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gqa',
  title: 'Grouped-query attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shazeer', year: 2019, title: 'Fast Transformer Decoding: One Write-Head is All You Need', url: 'https://arxiv.org/abs/1911.02150', scene: 'reread' },
    { who: 'Ainslie, Lee-Thorp, de Jong, Zemlyanskiy, Lebrón & Sanghai', year: 2023, title: 'GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints', url: 'https://arxiv.org/abs/2305.13245', scene: 'groups' },
  ],
  scenes: [
    {
      id: 'reread',
      title: 'Read again for every token',
      codeTitle: 'decode.py',
      code: `
        # each step, for the newest token:  #@gen
        #   its k and v join the cache      #@gen
        #   its q reads every k and v       #@read
        # per token and block:              #@heads
        #   h keys and h values             #@heads
        n_heads, d_head = 8, 64             #@count
        cache = 2 * n_heads * d_head        #@count
        # 2 * 8 * 64 = 1,024 numbers        #@count
      `,
      beats: [
        { id: 'gen', say: 'A language model writes one token at a time, and its {KV|K V} cache, K and V for keys and values, keeps every earlier token\'s key and value, in every block.', code: 'gen' },
        { id: 'read', say: 'But each new token\'s queries read the whole cache, in every block, at every step: the longer the text, the more there is to keep, and to read again.', code: 'read' },
        { id: 'shazeer', say: 'In 2019, Noam Shazeer, an author of Attention Is All You Need, showed that this reading is what limits the speed: chips compute far faster than they fetch numbers from memory.', code: 'read' },
        { id: 'heads', say: 'The heads make the cache big. In multi-head attention, each of h query heads has its own key head and value head, so each token keeps h keys and h values per block.', code: 'heads' },
        { id: 'count', say: 'With h at eight, and each head sixty four numbers wide, that is two, times eight, times sixty four: {1,024|one thousand and twenty four} numbers per token, per block.', code: 'count' },
      ],
    },
    {
      id: 'mqa',
      title: 'One key and value for all',
      codeTitle: 'mqa.py',
      code: `
        n_heads = 8     # query heads, own q  #@ask
        # keys, values: one head, shared     #@mqa
        cache = 2 * 1 * d_head   # 128       #@small
      `,
      beats: [
        { id: 'ask', say: 'Shazeer\'s question: each query head must look for something different, so the queries must differ. But must the keys and values?', code: 'ask' },
        { id: 'mqa', say: 'His answer, multi-query attention, keeps all h query heads, but gives them one key head and one value head to share: many queries, one key and value.', code: 'mqa' },
        { id: 'small', say: 'Each token now keeps two, times one, times sixty four: {128|a hundred and twenty eight} numbers per block, h times fewer.', code: 'small' },
        { id: 'fast', say: 'In his tests, each new token came out more than ten times faster, with only a minor loss in quality.', code: 'small' },
      ],
    },
    {
      id: 'groups',
      title: 'Share within groups',
      codeTitle: 'gqa.py',
      code: `
        n_heads, n_kv = 8, 2      # h, g     #@g
        group = n_heads // n_kv   # 4        #@group
        q.shape   # (8, T, 64)               #@shape
        k.shape   # (2, T, 64)               #@shape
        k = np.repeat(k, group, axis=0)      #@rep
        v = np.repeat(v, group, axis=0)      #@rep
        cache = 2 * n_kv * d_head   # 256    #@cache
        # n_kv = n_heads: multi-head         #@ends
        # n_kv = 1: multi-query              #@ends
      `,
      beats: [
        { id: 'cost', say: 'One shared head can cost quality, though. In 2023, Joshua Ainslie and colleagues at Google Research found a middle way: grouped-query attention, or {GQA|G Q A}.' },
        { id: 'group', say: 'Split the query heads into groups, and give each group one key head and one value head. Write g for the number of key-value heads: with g at two, each serves a group of four.', code: ['g', 'group'] },
        { id: 'attend', say: 'Each query head still makes its own scores and its own blend, reading its group\'s keys and values. Grouped queries: hence the name.', code: ['group', 'rep'] },
        { id: 'shape', say: 'Stacked head first, for T tokens, the queries are eight, by T, by sixty four. The keys are only two, by T, by sixty four, and so are the values.', code: 'shape' },
        { id: 'shrink', say: 'The cache keeps two times g times sixty four: {256|two hundred and fifty six} numbers per token and block, four times fewer than multi-head: h over g.', code: 'cache' },
        { id: 'ends', say: 'So g sets the trade. At g equal to h, every query head has its own: plain multi-head attention. At g of one, it is multi-query.', code: 'ends' },
        { id: 'paper', say: 'In between, the paper found quality close to multi-head attention, at a speed close to multi-query.', code: 'ends' },
      ],
    },
    {
      id: 'model',
      title: 'Across the model',
      codeTitle: 'kv_size.py',
      code: `
        layers, d_head = 32, 64                #@p
        n_heads, n_kv = 8, 2                   #@p
        per_layer = 2 * n_kv * d_head  # 256   #@all
        per_token = layers * per_layer # 8,192 #@all
        n_bytes = per_token * 2      # 16,384  #@bytes
        n_bytes / 1024               # 16 KB   #@kb
      `,
      beats: [
        { id: 'p', say: 'Now a whole model: thirty two blocks, often called layers, each with h of eight, g of two, and heads sixty four wide.', code: 'p' },
        { id: 'all', say: 'Each layer keeps its own {256|two hundred and fifty six} numbers per token, so thirty two layers keep {8,192|eight thousand one hundred and ninety two}.', code: 'all' },
        { id: 'bytes', say: 'Each number takes two bytes of memory, so that is {16,384|sixteen thousand three hundred and eighty four} bytes per token.', code: 'bytes' },
        { id: 'kb', say: 'A kilobyte, or {KB|K B}, is {1,024|one thousand and twenty four} bytes, so that is sixteen {KB|K B} per token.', code: 'kb' },
        { id: 'mha', say: 'With a key head and a value head for every query head, it would be four times as much: sixty four {KB|K B} per token.', code: 'kb' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
