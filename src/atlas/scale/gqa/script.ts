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
      `,
      beats: [
        { id: 'mha', say: 'In multi-head attention, each of h query heads has its own key head and value head. Here h is eight, each head sixty four numbers wide.', code: 'heads' },
        { id: 'cache', say: 'While generating, the KV cache keeps every earlier token\'s keys and values. Per token and layer, that is two, times h, times the head width: {1,024|one thousand and twenty four} numbers.', code: 'cache' },
        { id: 'big', say: 'Across every layer and every token of a long context, that adds up to gigabytes, all read again for every new token.' },
      ],
    },
    {
      id: 'share',
      title: 'Share them across a group',
      codeTitle: 'gqa.py',
      code: `
        n_heads, n_kv = 8, 2          # h = 8, g = 2  #@g
        group = n_heads // n_kv       # 4 per kv head #@group
        k = np.repeat(k, group, axis=0)   # shared    #@rep
        v = np.repeat(v, group, axis=0)               #@rep
        cache = 2 * n_kv * d_head     # 256           #@cache
      `,
      beats: [
        { id: 'group', say: 'Grouped-query attention keeps all eight query heads, but only g key-value heads, each a key head and a value head shared by one group of query heads. With g at two, each is shared by four.', code: ['g', 'group'] },
        { id: 'attend', say: 'Each query head still makes its own scores and its own mix. It just reads the keys and values of its group.', code: 'rep' },
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
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
