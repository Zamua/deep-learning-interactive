import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kv-memory',
  title: 'KV cache memory',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kwon et al.', year: 2023, title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention', url: 'https://arxiv.org/abs/2309.06180', scene: 'fill' },
  ],
  scenes: [
    {
      id: 'fill',
      title: 'Memory fills up',
      codeTitle: 'serve.py',
      code: `
        gpu = 80e9          # bytes: 80 GB  #@gpu
        weights = 8e9 * 2   # 16 GB, fixed  #@weights
        # one cache per sequence served     #@serve
        # each grows by one token a step    #@cache
        # 16 x 4,000 tokens: 33 GB          #@full
      `,
      beats: [
        { id: 'gpu', say: 'A model runs on a GPU, a graphics processing unit: a chip first built to draw graphics, and now used for the arithmetic of neural networks.', code: 'gpu' },
        { id: 'mem', say: 'Everything the model uses has to fit in the GPU\'s own memory: eighty gigabytes, on a large one.', code: 'gpu' },
        { id: 'weights', say: 'Load a model of eight billion parameters, at two bytes each, and its weights take sixteen gigabytes. That part stays fixed.', code: 'weights' },
        { id: 'serve', say: 'Now serve it: write text for many people at once. Each person\'s text is a sequence, and the tokens the model has read so far in it are its context.', code: 'serve' },
        { id: 'cache', say: 'Every sequence keeps a KV cache of its own, and each cache grows with every token the model writes.', code: 'cache' },
        { id: 'full', say: 'Sixteen sequences of four thousand tokens already hold twice as much as the weights, and soon the memory is full. It is the cache, not the weights, that fills it.', code: 'full' },
        { id: 'kwon', say: 'In 2023, Woosuk Kwon and colleagues, building a serving system called {vLLM|V L L M}, named this as the limit: each sequence\'s cache is huge and grows as it goes, so it caps how many sequences a GPU can serve at once.', code: 'full' },
      ],
    },
    {
      id: 'token',
      title: 'Two vectors per token, per layer',
      codeTitle: 'per_token.py',
      code: `
        layers, d = 32, 4000              #@model
        per_token = (2   # key and value  #@two
            * d          # 4,000 each     #@d
            * layers     # 32             #@layers
            * 2)         # bytes each     #@bytes
        per_token  # 512,000 bytes        #@mb
      `,
      beats: [
        { id: 'grid', say: 'So how big is one sequence\'s cache? It keeps, for every token so far, a key and a value in every block. A model\'s blocks are also called its layers.', code: 'model' },
        { id: 'two', say: 'Start with one token, in one layer: two vectors, its key and its value.', code: 'two' },
        { id: 'd', say: 'Each vector holds d numbers, the model\'s width: four thousand here. So two times four thousand: eight thousand numbers.', code: 'd' },
        { id: 'layers', say: 'Every layer keeps its own pair, so thirty two layers make thirty two times as many: {256,000|two hundred and fifty six thousand} numbers.', code: 'layers' },
        { id: 'bytes', say: 'At sixteen bits, each number takes two bytes: {512,000|five hundred and twelve thousand} bytes, for a single token.', code: 'bytes' },
        { id: 'mb', say: 'That is about half a megabyte, or MB, where a megabyte is a million bytes.', code: 'mb' },
        { id: 'opt', say: 'Kwon\'s team counted it the same way for a model of thirteen billion parameters, with forty layers and d of {5,120|five thousand one hundred and twenty}: over eight hundred thousand bytes per token.', code: 'mb' },
      ],
    },
    {
      id: 'grow',
      title: 'What it grows with',
      codeTitle: 'cache.py',
      code: `
        tokens, batch = 4000, 16          #@ctx
        cache = per_token * tokens # 2 GB #@ctx
        # 2 * layers * tokens * d * bytes #@formula
        cache * 2         # 4 GB          #@double
        cache * batch     # 33 GB         #@batch
        # not in it: vocab, MLP width     #@not
        # more heads: d split, same total #@heads
      `,
      beats: [
        { id: 'ctx', say: 'Now multiply by the tokens. A context of four thousand tokens, at half a megabyte each, needs about two gigabytes, for one sequence.', code: 'ctx' },
        { id: 'formula', say: 'All together: two, times the layers, times the tokens, times d, times the bytes per number.', code: 'formula' },
        { id: 'double', say: 'Each factor scales it in proportion. Twice the context, twice the cache.', code: 'double' },
        { id: 'batch', say: 'And every sequence being served keeps a cache of its own. Sixteen at once need about thirty three gigabytes: twice the weights.', code: 'batch' },
        { id: 'not', say: 'What is not in the product leaves the cache alone. The vocabulary and the MLP make no keys or values, so growing them changes nothing here.', code: 'not' },
        { id: 'heads', say: 'And more attention heads only split the same d numbers between them: each token still stores d numbers per key and per value, in every layer.', code: 'heads' },
      ],
    },
    {
      id: 'fit',
      title: 'How many tokens fit',
      codeTitle: 'fit.py',
      code: `
        free = 80e9 - 16e9  # 64 GB left  #@free
        per_token = 512_000 # bytes       #@per
        free / per_token    # 125,000     #@fit
        # = 64,000,000 / 512              #@fit
        125_000 / 4000      # about 31    #@share
      `,
      beats: [
        { id: 'free', say: 'Now run it backward. On the eighty gigabyte GPU, the weights leave sixty four gigabytes for the cache: sixty four billion bytes.', code: 'free' },
        { id: 'per', say: 'Each token costs {512,000|five hundred and twelve thousand} bytes, so the question is how many of those fit into sixty four billion.', code: 'per' },
        { id: 'fit', say: 'Divide. Cancel three zeros from each, and it is sixty four million over five hundred and twelve: {125,000|a hundred and twenty five thousand} tokens.', code: 'fit' },
        { id: 'share', say: 'That budget is shared by every sequence at once: one sequence of {125,000|a hundred and twenty five thousand} tokens, or about thirty one of four thousand each.', code: 'share' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
