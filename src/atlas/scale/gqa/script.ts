import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gqa',
  title: 'Grouped-query attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'heads',
      title: 'A key and a value per head',
      codeTitle: 'cache.py',
      code: `
        n_heads, d_head = 8, 64                    #@heads
        # per token and layer: a key and a value
        cache = 2 * n_heads * d_head   # 1,024     #@cache
        cache * 32   # 32 layers: 32,768 per token #@big
      `,
      beats: [
        { id: 'mha', say: 'In multi-head attention, each of h query heads has its own key head and value head. Here h is eight, each head sixty four numbers wide.', code: 'heads' },
        { id: 'cache', say: 'While generating, the KV cache keeps every earlier token\'s keys and values. Per token and layer, that is two, times h, times the head width: {1,024|one thousand and twenty four} numbers.', code: 'cache' },
        { id: 'big', say: 'Every layer keeps its own, so across thirty two layers, that is {32,768|thirty two thousand seven hundred sixty eight} numbers for every token of the context, all read again for every new token.', code: 'big' },
      ],
    },
    {
      id: 'share',
      title: 'Share them across a group',
      codeTitle: 'gqa.py',
      code: `
        n_heads, n_kv = 8, 2      # h = 8, g = 2  #@g
        group = n_heads // n_kv   # 4 per kv head #@group
        k = np.repeat(k, group, axis=0)  # shared #@rep
        v = np.repeat(v, group, axis=0)           #@rep
        q.shape   # (8, T, 64): per query head    #@shape
        k.shape   # (2, T, 64): per kv head       #@shape
        cache = 2 * n_kv * d_head     # 256       #@cache
      `,
      beats: [
        { id: 'group', say: 'Grouped-query attention keeps all eight query heads, but only g key-value heads, each a key head and a value head shared by one group of query heads. With g at two, each is shared by four.', code: ['g', 'group'] },
        { id: 'attend', say: 'Each query head still makes its own scores and its own mix. It just reads the keys and values of its group.', code: 'rep' },
        { id: 'shape', say: 'Stack each kind into one array, head first. For T tokens, the queries are eight heads of T by sixty four: shape eight, by T, by sixty four. The keys are only two, by T, by sixty four, and the values the same.', code: 'shape' },
        { id: 'shrink', say: 'The cache now holds two times g times sixty four: two hundred and fifty six numbers per token, four times smaller. It shrinks by h over g.', code: 'cache' },
      ],
    },
    {
      id: 'extremes',
      title: 'From multi-head to multi-query',
      codeTitle: 'extremes.py',
      code: `
        # g = h: multi-head, nothing shared            #@mha
        # g = 1: multi-query, one key and value head   #@mqa
        # between: grouped-query, often g = 8          #@gqa
      `,
      beats: [
        { id: 'mha', say: 'At one extreme, g equals h: every query head has its own key and value head. That is ordinary multi-head attention, with the largest cache.', code: 'mha' },
        { id: 'mqa', say: 'At the other, g is one: all the query heads share a single key head and value head, and the cache is h times smaller. That is multi-query attention, and it can cost some quality.', code: 'mqa' },
        { id: 'between', say: 'Grouped-query attention sits in between, close to multi-head quality at a fraction of the cache. Many large models keep eight key-value heads.', code: 'gqa' },
      ],
    },
    {
      id: 'try',
      title: 'The cache per token, in KB',
      codeTitle: 'kv_size.py',
      code: `
        layers, d_head = 32, 64                #@p
        n_heads, n_kv = 8, 2                   #@p
        bytes_per_number = 2   # 1 KB = 1,024  #@ask
        per_layer = 2 * n_kv * d_head  # 256   #@one
        per_token = layers * per_layer # 8,192 #@all
        n_bytes = per_token * 2      # 16,384  #@bytes
        n_bytes / 1024               # 16 KB   #@kb
      `,
      beats: [
        { id: 'p', say: 'Try one. A model has thirty two layers, each with eight query heads and two key-value heads, each head sixty four numbers wide.', code: 'p' },
        { id: 'ask', say: 'Memory is counted in bytes, and this model stores each number in two. How many kilobytes, or KB, of {1,024|one thousand and twenty four} bytes each, does its cache take per token?', code: 'ask' },
        { id: 'one', say: 'One layer stores a key and a value for each of the two key-value heads: two times two times sixty four, {256|two hundred fifty six} numbers. The query heads add nothing.', code: 'one' },
        { id: 'all', say: 'Every layer keeps its own: thirty two times {256|two hundred fifty six} is {8,192|eight thousand one hundred ninety two} numbers per token.', code: 'all' },
        { id: 'bytes', say: 'At two bytes each, that is {16,384|sixteen thousand three hundred eighty four} bytes.', code: 'bytes' },
        { id: 'kb', say: 'Divide by {1,024|one thousand and twenty four} bytes per kilobyte: sixteen KB per token. With every query head keeping its own key and value, it would be sixty four.', code: 'kb' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
