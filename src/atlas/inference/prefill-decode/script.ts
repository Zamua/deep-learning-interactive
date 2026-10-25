import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-prefill-decode',
  title: 'Prefill and decode',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'prefill',
      title: 'Prefill: the prompt in one pass',
      codeTitle: 'generate.py',
      code: `
        prompt = tokens('The cat sat on the')  #@prompt
        out, cache = model(prompt)    # 1 pass #@prefill
        tok = sample(out[-1])         # 'mat'  #@first
        for _ in range(3):                     #@loop
            out, cache = model([tok], cache)   #@loop
            tok = sample(out[-1])              #@loop
      `,
      beats: [
        { id: 'prompt', say: 'Text is written in two phases. First, the prompt: here five tokens, all known before the model starts.', code: 'prompt' },
        { id: 'prefill', say: 'So the model runs all five in a single pass. The causal mask lets every position be computed side by side, and the pass stores each token\'s keys and values in the cache.', code: 'prefill' },
        { id: 'first', say: 'The same pass gives the probabilities at the last position. Sample from them, and out comes the first new token: mat. This phase is the prefill.', code: 'first' },
      ],
    },
    {
      id: 'decode',
      title: 'Decode: one pass per token',
      codeTitle: 'generate.py',
      code: `
        prompt = tokens('The cat sat on the')  #@prompt
        out, cache = model(prompt)    # 1 pass #@prefill
        tok = sample(out[-1])         # 'mat'  #@first
        for _ in range(3):                     #@loop
            out, cache = model([tok], cache)   #@loop
            tok = sample(out[-1])              #@loop
        # 4 new tokens: 1 prefill + 3 decode   #@count
      `,
      beats: [
        { id: 'one', say: 'After that, each new token depends on the one just before it, so each needs a pass of its own. Feed in mat, and one pass gives one token: and.', code: 'loop' },
        { id: 'cache', say: 'A decode pass holds one token. It reads the earlier keys and values from the cache, adds its own, and writes the next: it, then slept.', code: 'loop' },
        { id: 'count', say: 'Four new tokens took four passes: the prefill, which wrote the first, then three decode passes. A hundred new tokens take one prefill and ninety nine decode passes.', code: 'count' },
        { id: 'wait', say: 'The prefill sets how long you wait for the first token. The decode passes set how fast the rest stream in.', code: ['prefill', 'loop'] },
      ],
    },
    {
      id: 'memory',
      title: 'Decoding waits on memory',
      codeTitle: 'decode_speed.py',
      code: `
        weights = 8e9 * 2        # 16 GB      #@bytes
        read = 3200e9            # bytes / s  #@bw
        weights / read           # 5 ms       #@time
        read / weights           # 200 tok/s  #@time
        2 * 8e9 / 1000e12        # 0.016 ms   #@math
      `,
      beats: [
        { id: 'bytes', say: 'How long does a decode pass take? A model of eight billion parameters at two bytes each holds sixteen gigabytes of weights, and every pass must read all of them.', code: 'bytes' },
        { id: 'bw', say: 'A GPU reads its memory at about {3,200|three thousand two hundred} gigabytes per second. Sixteen gigabytes take five milliseconds, so two hundred tokens per second at best.', code: ['bw', 'time'] },
        { id: 'math', say: 'The arithmetic is tiny by comparison: one multiply and one add per weight, sixteen billion operations, at a thousand trillion per second. {0.016|Zero point zero one six} milliseconds.', code: 'math' },
        { id: 'bound', say: 'So decoding spends its time waiting on memory: tokens per second is the memory speed over the model\'s bytes. Faster arithmetic would barely help.', code: 'time' },
        { id: 'pre', say: 'Prefill is different. Each weight it reads is used for every prompt token at once, so five hundred tokens share one read of the weights.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
