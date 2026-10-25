import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kv-memory',
  title: 'KV cache memory',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'token',
      title: 'Two vectors per token, per layer',
      codeTitle: 'kv_memory.py',
      code: `
        layers, d = 32, 4000                      #@model
        per_token = 2 * layers * d * 2   # bytes  #@per
        # a key and a value; 2 bytes per number   #@per
        per_token        # 512,000: half a MB     #@kb
      `,
      beats: [
        { id: 'grid', say: 'The KV cache keeps, for every token seen so far, a key and a value at every layer.', code: 'model' },
        { id: 'vec', say: 'Each key and each value is a vector of d numbers, as wide as the model. Here d is four thousand, and there are thirty two layers.', code: 'model' },
        { id: 'per', say: 'So one token costs two vectors, times thirty two layers, times four thousand numbers. At sixteen bits, two bytes each, that is {512,000|five hundred and twelve thousand} bytes for a single token: half a megabyte, or MB, where a megabyte is a million bytes.', code: ['per', 'kb'] },
      ],
    },
    {
      id: 'grow',
      title: 'It grows with the context and the batch',
      codeTitle: 'kv_memory.py',
      code: `
        tokens, batch = 4000, 16                  #@ctx
        cache = per_token * tokens     # 2 GB     #@ctx
        cache * 2                      # 4 GB     #@double
        cache * batch                  # 33 GB    #@batch
        weights = 7e9 * 2              # 14 GB    #@weights
      `,
      beats: [
        { id: 'ctx', say: 'Now multiply by the tokens. A context of four thousand tokens needs about two gigabytes, for one sequence.', code: 'ctx' },
        { id: 'formula', say: 'All together: two, times the layers, times the tokens, times d, times the bytes per number.', code: 'ctx' },
        { id: 'double', say: 'It grows in a straight line. Twice the context, twice the cache.', code: 'double' },
        { id: 'batch', say: 'And every sequence being served keeps a cache of its own. Sixteen at once need about thirty three gigabytes.', code: 'batch' },
        { id: 'weights', say: 'That is more than the model\'s own weights: about seven billion parameters, fourteen gigabytes at two bytes each.', code: 'weights' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
