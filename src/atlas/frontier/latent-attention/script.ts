import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-latent-attention',
  title: 'Latent attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'cache',
      title: 'What the cache holds',
      codeTitle: 'cache.py',
      code: `
        n_heads, d_head = 4, 8                     #@mha
        cache = 2 * n_heads * d_head   # 64        #@mha
        n_kv = 2                       # g = 2     #@gqa
        cache = 2 * n_kv * d_head      # 32        #@gqa
      `,
      beats: [
        { id: 'mha', say: 'While generating, each layer caches a key and a value per head for every token. With h of four heads, each eight numbers wide, that is two times four times eight: sixty four numbers per token.', code: 'mha' },
        { id: 'gqa', say: 'Grouped-query attention, with g of two key-value heads, halves that to thirty two, but heads in a group then read the very same keys and values.', code: 'gqa' },
        { id: 'own', say: 'Latent attention, from DeepSeek in 2024, makes the cache smaller still, while every head keeps keys and values of its own.' },
      ],
    },
    {
      id: 'latent',
      title: 'Cache a latent, rebuild the rest',
      codeTitle: 'latent.py',
      code: `
        c = W_dkv @ x      # 16 numbers: the latent      #@down
        W_dkv.shape        # (d_c, d) = (16, d)          #@shape
        cache.append(c)    # all that is stored          #@store
        k = W_uk[i] @ c    # head i's key: 8 numbers     #@up
        v = W_uv[i] @ c    # head i's value: 8 numbers   #@up
        W_uk[i].shape      # (d_head, d_c) = (8, 16)     #@up
        W_uk.shape         # (h * d_head, d_c) = (32, 16)  #@all
        # per token: 64, then 32, now d_c = 16          #@count
      `,
      beats: [
        { id: 'down', say: 'It sends each token\'s vector, x, of d numbers, through one matrix, {W_DKV|W D K V}: D for down, K V for keys and values.', code: 'down' },
        { id: 'latent', say: 'Out comes a short vector, c, the latent, of {d_c|d c} numbers: here sixteen. A row per number it makes, a column per entry of x: {W_DKV|W D K V} is {d_c|d c} by d.', code: ['down', 'shape'] },
        { id: 'store', say: 'Only c goes into the cache: sixteen numbers per token, per layer.', code: 'store' },
        { id: 'up', say: 'When attention runs, head i rebuilds its key from c with its part of an up-projection, {W_UK|W U K}, U for up: {d_head|d head} by {d_c|d c}, eight by sixteen. Its part of {W_UV|W U V} rebuilds its value.', code: 'up' },
        { id: 'own', say: 'Each head has its own part, so each still gets its own key and value. Stacked, the four parts make {W_UK|W U K} h times {d_head|d head} by {d_c|d c}: thirty two by sixteen.', code: 'all' },
        { id: 'count', say: 'These matrices are weights, stored once, not per token. So per token and layer: sixty four numbers, then thirty two, and now only {d_c|d c}, sixteen.', code: 'count' },
      ],
    },
    {
      id: 'real',
      title: 'At DeepSeek\'s size',
      codeTitle: 'deepseek_v2.py',
      code: `
        n_heads, d_head = 128, 128                #@big
        2 * n_heads * d_head      # 32,768        #@big
        d_c, d_pos = 512, 64                      #@small
        d_c + d_pos               # 576           #@small
        32768 / 576               # about 57      #@ratio
      `,
      beats: [
        { id: 'big', say: 'DeepSeek-V2 has a hundred and twenty eight heads, each a hundred and twenty eight wide. Multi-head attention would cache {32,768|thirty two thousand seven hundred sixty eight} numbers per token, per layer.', code: 'big' },
        { id: 'small', say: 'Its latent has {512|five hundred twelve} numbers, plus one small key of sixty four, shared by every head, that carries the token\'s position: {576|five hundred seventy six} in all.', code: 'small' },
        { id: 'ratio', say: 'About fifty seven times smaller.', code: 'ratio' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        n_heads, d_head, d_c = 16, 64, 256          #@p
        2 * n_heads * d_head   # 2,048: multi-head  #@mha
        d_c                    # 256: latent        #@lat
        2048 / 256             # 8 times smaller    #@ratio
        W_uk[i].shape          # (64, 256)          #@shape
      `,
      beats: [
        { id: 'p', say: 'Try one: sixteen heads, each sixty four wide, and a latent of {d_c|d c} {256|two hundred fifty six}. How many numbers per token are cached, against multi-head attention?', code: 'p' },
        { id: 'mha', say: 'Multi-head would cache two times sixteen times sixty four: {2,048|two thousand and forty eight}.', code: 'mha' },
        { id: 'lat', say: 'Latent attention caches only c, {256|two hundred fifty six}: eight times smaller.', code: ['lat', 'ratio'] },
        { id: 'shape', say: 'And one head\'s part of {W_UK|W U K} makes sixty four numbers from {256|two hundred fifty six}: sixty four by {256|two hundred fifty six}.', code: 'shape' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
