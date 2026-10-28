import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-latent-attention',
  title: 'Latent attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shazeer', year: 2019, title: 'Fast transformer decoding: one write-head is all you need', url: 'https://arxiv.org/abs/1911.02150', scene: 'cache' },
    { who: 'Ainslie, Lee-Thorp, de Jong, Zemlyanskiy, Lebrón & Sanghai', year: 2023, title: 'GQA: training generalized multi-query transformer models from multi-head checkpoints', url: 'https://arxiv.org/abs/2305.13245', scene: 'cache' },
    { who: 'DeepSeek-AI', year: 2024, title: 'DeepSeek-V2: a strong, economical, and efficient mixture-of-experts language model', url: 'https://arxiv.org/abs/2405.04434', scene: 'cache' },
  ],
  scenes: [
    {
      id: 'cache',
      title: 'The cache fills up',
      codeTitle: 'cache.py',
      code: `
        n_heads, d_head = 4, 8          #@mha
        2 * n_heads * d_head   # 64     #@mha
        n_kv = 1   # multi-query        #@mqa
        2 * n_kv * d_head      # 16     #@mqa
        n_kv = 2   # grouped-query      #@gqa
        2 * n_kv * d_head      # 32     #@gqa
      `,
      beats: [
        { id: 'grow', say: 'While a model writes, its KV cache keeps a key and a value from every head, for every token so far, at every layer. The longer the text, the more memory it takes.', code: 'mha' },
        { id: 'mha', say: 'With four heads, each eight numbers wide, one token costs two times four times eight: sixty four numbers per layer.', code: 'mha' },
        { id: 'mqa', say: 'The first fix was to share. In 2019, Noam Shazeer had every head read one key and one value: multi-query attention. The cache drops to sixteen numbers, at some cost in quality.', code: 'mqa' },
        { id: 'gqa', say: 'In 2023, Joshua Ainslie and colleagues took the middle road, grouped-query attention: one key and value per group of heads. With two groups, thirty two numbers, and quality close to multi-head.', code: 'gqa' },
        { id: 'ask', say: 'Both save memory the same way: heads give up keys and values of their own. Could the cache shrink, with every head keeping its own?' },
        { id: 'mla', say: 'In 2024, the {DeepSeek-V2|DeepSeek V two} paper did just that, with multi-head latent attention.' },
      ],
    },
    {
      id: 'latent',
      title: 'Squeeze, then rebuild',
      codeTitle: 'latent.py',
      code: `
        c = W_dkv @ x     # 16 numbers    #@down
        cache.append(c)   # only c        #@store
        k = W_uk[i] @ c   # head i's key  #@up
        v = W_uv[i] @ c   # and value     #@uv
      `,
      beats: [
        { id: 'idea', say: 'The idea: squeeze each token\'s vector, x, into a much shorter one, and cache only that. When attention runs, every head rebuilds its own key and value from it.', code: ['down', 'store', 'up', 'uv'] },
        { id: 'latent', say: 'The short vector is the latent, c. Latent means hidden, from the Latin for lying hidden: nothing reads c itself, the heads only rebuild from it.', code: 'down' },
        { id: 'down', say: 'One matrix makes it: {W_DKV|W D K V}. A matrix that turns a vector into one of a new length is called a projection, and this one projects down: D for down, K V for keys and values.', code: 'down' },
        { id: 'dc', say: 'The latent\'s length is {d_c|d c}, here sixteen, and that is all the cache keeps: sixteen numbers per token, per layer.', code: 'store' },
        { id: 'up', say: 'To rebuild, each head multiplies c by its own part of {W_UK|W U K}, U for up, and gets its key: eight numbers made from sixteen.', code: 'up' },
        { id: 'uv', say: 'Its part of {W_UV|W U V} makes its value from the same c: one latent serves keys and values alike.', code: 'uv' },
        { id: 'own', say: 'Each head\'s parts are its own, so each head gets its own key and value: nothing is shared.', code: ['up', 'uv'] },
        { id: 'count', say: 'And those matrices are weights, stored once with the model, not per token. So the cache is as small as multi-query attention\'s, yet no head shares.', code: 'store' },
      ],
    },
    {
      id: 'shapes',
      title: 'The shapes',
      codeTitle: 'shapes.py',
      code: `
        # rows: the numbers it makes      #@rule
        # columns: the numbers it reads   #@rule
        W_dkv.shape     # (16, d)         #@down
        W_uk[i].shape   # (8, 16)         #@head
        W_uk.shape      # (32, 16)        #@all
        W_uv.shape      # (32, 16)        #@all
      `,
      beats: [
        { id: 'rule', say: 'The shapes follow the rule for any matrix: a row for each number it makes, a column for each number it reads.', code: 'rule' },
        { id: 'down', say: '{W_DKV|W D K V} reads a token\'s d numbers and makes sixteen, so it is sixteen by d: {d_c|d c} by d.', code: 'down' },
        { id: 'head', say: 'One head\'s part of {W_UK|W U K} reads the sixteen numbers of c and makes an eight-number key: eight by sixteen, {d_head|d head} by {d_c|d c}.', code: 'head' },
        { id: 'all', say: 'Stack all four heads\' parts, and the whole {W_UK|W U K} has four times eight rows: thirty two by sixteen. {W_UV|W U V} has the same shape.', code: 'all' },
      ],
    },
    {
      id: 'real',
      title: 'At DeepSeek-V2\'s size',
      codeTitle: 'deepseek_v2.py',
      code: `
        n_heads, d_head = 128, 128         #@big
        2 * n_heads * d_head   # 32,768    #@big
        d_c, d_pos = 512, 64               #@small
        d_c + d_pos            # 576       #@small
        32768 / 576            # about 57  #@ratio
        576 * 60      # 60 layers: 34,560  #@layers
      `,
      beats: [
        { id: 'big', say: '{DeepSeek-V2|DeepSeek V two} has a hundred and twenty eight heads, each a hundred and twenty eight wide. Multi-head attention would cache {32,768|thirty two thousand seven hundred sixty eight} numbers per token, per layer.', code: 'big' },
        { id: 'small', say: 'Its latent has {512|five hundred twelve} numbers, plus one small key of sixty four, shared by every head, that carries the token\'s position: {576|five hundred seventy six} in all.', code: 'small' },
        { id: 'ratio', say: 'That is about fifty seven times smaller. And each of its sixty layers keeps a cache like that, so the whole model stores sixty times as much.', code: ['ratio', 'layers'] },
        { id: 'paper', say: 'Its authors report a cache as small as grouped-query attention with only two and a quarter groups, yet better results than full multi-head attention.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
