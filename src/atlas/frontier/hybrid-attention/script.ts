import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-hybrid-attention',
  title: 'Hybrid attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Yang, Kautz & Hatamizadeh', year: 2024, title: 'Gated delta networks: improving Mamba2 with delta rule', url: 'https://arxiv.org/abs/2412.06464', scene: 'limit' },
    { who: 'Yang, Wang, Zhang, Shen & Kim', year: 2024, title: 'Parallelizing linear transformers with the delta rule over sequence length', url: 'https://arxiv.org/abs/2406.06484', scene: 'mix' },
    { who: 'Qwen Team', year: 2025, title: 'Qwen3-Next: towards ultimate training & inference efficiency', url: 'https://qwen.ai/blog?id=3425e8f58e31e252f5c53dd56ec47363045a3f6b', scene: 'mix' },
    { who: 'Qwen Team', year: 2025, title: 'Qwen3-Next-80B-A3B-Instruct model card', url: 'https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct', scene: 'mix' },
  ],
  scenes: [
    {
      id: 'limit',
      title: 'What a fixed state cannot do',
      codeTitle: 'limit.py',
      code: `
        d_k = 128                              #@dk
        # S: d_k by d_v numbers, at any length #@S
        # at most d_k keys at right angles     #@cap
        # 100,000 tokens: most pairs share     #@share
        # KV cache: every key and value, kept  #@cache
      `,
      beats: [
        { id: 'fixed', say: 'Gated DeltaNet keeps a state of fixed size however long the text, and that is its strength.', code: 'S' },
        { id: 'cap', say: 'It is also its limit. With keys of {d_k|d k} numbers, at most {d_k|d k} of them can be at right angles, so only that many pairs can be held perfectly apart.', code: ['dk', 'cap'] },
        { id: 'share', say: 'Across a hundred thousand tokens, most pairs must share the state: the gates and the delta rule choose what to keep, and some facts are lost.', code: 'share' },
        { id: 'drop', say: 'In the needle test with real essays, even Gated DeltaNet found the needle less than a third of the time at eight thousand tokens.', code: 'share' },
        { id: 'cache', say: 'Softmax attention keeps every key and value in its cache, so a query can still find a token from far back, at the price of a cache that grows with the text.', code: 'cache' },
        { id: 'gap', say: 'On real tasks that look facts up in long documents, Yang\'s team found pure recurrent models well behind transformers, while models that mixed in some attention beat both.', code: 'cache' },
      ],
    },
    {
      id: 'mix',
      title: 'A few attention layers',
      codeTitle: 'mix.py',
      code: `
        group = ['gdn', 'gdn', 'gdn', 'attn']  #@group
        stack = group * 12     # 48 layers     #@stack
        stack.count('attn')    # 12            #@count
        # gdn:  fixed state, most of the work  #@roles
        # attn: KV cache, exact recall         #@roles
      `,
      beats: [
        { id: 'idea', say: 'So mix them. Keep most layers recurrent, with fixed states, and make every few layers full softmax attention, with a cache of every token.', code: ['group', 'roles'] },
        { id: 'yang', say: 'In 2024, Yang\'s team tried it with DeltaNet: swapping just two of its layers for full attention gave a model that beat a transformer of the same size.', code: 'group' },
        { id: 'qwen', say: 'In 2025, the Qwen team at Alibaba built a large model this way, {Qwen3-Next|Qwen three Next}: forty eight layers, in twelve groups of three Gated DeltaNet layers and one attention layer.', code: 'stack' },
        { id: 'why', say: 'Their reason: linear attention is fast but weak at recall, and standard attention is expensive and slow when generating. Three to one did better than either kind alone.', code: 'roles' },
        { id: 'count', say: 'So only twelve of the forty eight layers keep a KV cache.', code: 'count' },
      ],
    },
    {
      id: 'memory',
      title: 'The memory bill',
      codeTitle: 'memory.py',
      code: `
        layers, d, nbytes = 48, 4000, 2         #@model
        tokens = 100_000                         #@T
        2 * 48 * tokens * d * nbytes  # 77 GB    #@full
        2 * 12 * tokens * d * nbytes  # 19 GB    #@hybrid
        36 * 1_000_000   # 36 states: 36 MB      #@state
        # 2x tokens: cache 2x, states the same   #@grow
      `,
      beats: [
        { id: 'full', say: 'Now the memory, for a made-up model with the same pattern: forty eight layers, d of four thousand, two bytes a number. As a transformer, it would need about seventy seven gigabytes of cache for a hundred thousand tokens.', code: ['model', 'T', 'full'] },
        { id: 'formula', say: 'That is two, for keys and values, times forty eight layers, a hundred thousand tokens, four thousand numbers each, and two bytes.', code: 'full' },
        { id: 'hybrid', say: 'In the hybrid, only twelve layers keep a cache: a quarter of it, about nineteen gigabytes.', code: 'hybrid' },
        { id: 'state', say: 'The other thirty six keep states. At half a million numbers each, a megabyte, that is thirty six megabytes, at any length.', code: 'state' },
        { id: 'grow', say: 'Double the context, and the cache doubles: it still grows in proportion to the tokens, four times slower than the transformer\'s. The states stay the same.', code: 'grow' },
        { id: 'trade', say: 'Fewer attention layers would shrink the cache further, but leave more of the recall to fixed states: the ratio is the trade-off.', code: ['hybrid', 'grow'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
