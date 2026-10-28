import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-prefill-decode',
  title: 'Prefill and decode',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Pope et al.', year: 2022, title: 'Efficiently Scaling Transformer Inference', url: 'https://arxiv.org/abs/2211.05102', scene: 'feel' },
  ],
  scenes: [
    {
      id: 'feel',
      title: 'A pause, then a stream',
      codeTitle: 'generate.py',
      code: `
        prompt = tokens('The cat sat on the')  #@prompt
        out, cache = model(prompt)  # prefill  #@prefill
        tok = sample(out[-1])       # 'mat'    #@prefill
        for _ in range(6):          # decode   #@loop
            out, cache = model([tok], cache)   #@loop
            tok = sample(out[-1])              #@loop
      `,
      beats: [
        { id: 'feel', say: 'Give a language model a prompt, and there is a pause. Then its answer streams in, one token after another, at a steady pace.', code: 'prompt' },
        { id: 'two', say: 'That rhythm has two causes. The pause is the model reading your prompt. The stream is the model writing, with one pass of the model for each new token.', code: ['prefill', 'loop'] },
        { id: 'names', say: 'The two phases are called prefill and decode. Prefill fills the KV cache with the whole prompt before a single token is written. Decode then writes the output, one token at a time.', code: ['prefill', 'loop'] },
        { id: 'pope', say: 'In 2022, Reiner Pope and colleagues at Google, working out how to serve very large models quickly, split the work into these two phases and studied each on its own, because they behave so differently.', code: ['prefill', 'loop'] },
      ],
    },
    {
      id: 'prefill',
      title: 'Prefill: the prompt in one pass',
      codeTitle: 'generate.py',
      code: `
        prompt = tokens('The cat sat on the')  #@prompt
        out, cache = model(prompt)  # 1 pass   #@prefill
        tok = sample(out[-1])       # 'mat'    #@first
        for _ in range(3):                     #@loop
            out, cache = model([tok], cache)   #@loop
            tok = sample(out[-1])              #@loop
      `,
      beats: [
        { id: 'prompt', say: 'Take a prompt of five tokens, all known before the model starts.', code: 'prompt' },
        { id: 'prefill', say: 'So the model runs all five in a single pass. The causal mask lets every position be computed side by side, and the pass stores each token\'s keys and values in the cache.', code: 'prefill' },
        { id: 'first', say: 'The same pass gives the next-token probabilities at the last position. Sample from them, picking a token at random with those odds, and out comes the first new token: mat.', code: 'first' },
      ],
    },
    {
      id: 'decode',
      title: 'Decode: one pass per token',
      codeTitle: 'generate.py',
      code: `
        prompt = tokens('The cat sat on the')  #@prompt
        out, cache = model(prompt)  # 1 pass   #@prefill
        tok = sample(out[-1])       # 'mat'    #@first
        for _ in range(3):                     #@loop
            out, cache = model([tok], cache)   #@loop
            tok = sample(out[-1])              #@loop
        # 4 new tokens: 1 prefill + 3 decode   #@count
        # 100 new: 1 prefill + 99 decode       #@hundred
        # 40 ms + 99 * 25 ms = 2,515 ms        #@time
      `,
      beats: [
        { id: 'one', say: 'Every token after that depends on the one just before it, so each needs a pass of its own. Feed in mat, and one pass gives one token: and.', code: 'loop' },
        { id: 'cache', say: 'A decode pass holds just one token. It reads the earlier keys and values from the cache, adds its own, and writes the next: it, then slept.', code: 'loop' },
        { id: 'count', say: 'Four new tokens took four passes: the prefill, which wrote the first, then three decode passes.', code: 'count' },
        { id: 'hundred', say: 'So a hundred new tokens take one prefill and ninety nine decode passes.', code: 'hundred' },
        { id: 'time', say: 'Now put times on them. Say the prefill takes forty milliseconds, or thousandths of a second, and each decode pass takes twenty five.', code: 'time' },
        { id: 'dtime', say: 'Ninety nine decode passes, at twenty five each, take {2,475|two thousand four hundred seventy five} milliseconds.', code: 'time' },
        { id: 'total', say: 'Add the prefill\'s forty, and the last token arrives after {2,515|two thousand five hundred fifteen} milliseconds.', code: 'time' },
        { id: 'secs', say: 'A thousand milliseconds make a second, so that is {2.515|two point five one five} seconds.', code: 'time' },
      ],
    },
    {
      id: 'memory',
      title: 'Decoding waits on memory',
      codeTitle: 'decode_speed.py',
      code: `
        # GPU: memory, then arithmetic         #@gpu
        weights = 8e9 * 2        # 16 GB      #@bytes
        read = 3200e9            # bytes / s  #@bw
        weights / read           # 5 ms       #@time
        read / weights           # 200 tok/s  #@rate
        2 * 8e9 / 1000e12        # 0.016 ms   #@math
      `,
      beats: [
        { id: 'gpu', say: 'Why does a decode pass take as long as it does? The model runs on a {GPU|G P U}, short for graphics processing unit: the chip that does the arithmetic, with the weights kept in its own memory.', code: 'gpu' },
        { id: 'read', say: 'Every pass must carry every weight from that memory to the arithmetic. And memory is measured in bytes.', code: 'gpu' },
        { id: 'bytes', say: 'Say the model has eight billion parameters, its weights, stored at two bytes each. That is sixteen billion bytes.', code: 'bytes' },
        { id: 'gb', say: 'A billion bytes is a gigabyte, so every pass reads sixteen gigabytes.', code: 'bytes' },
        { id: 'bw', say: 'Suppose the {GPU|G P U} reads its memory at {3,200|three thousand two hundred} gigabytes per second. Then sixteen gigabytes take five milliseconds.', code: ['bw', 'time'] },
        { id: 'rate', say: 'One pass per five milliseconds is two hundred tokens per second, at best: the memory speed over the model\'s bytes.', code: 'rate' },
        { id: 'ops', say: 'Now the arithmetic. Each weight takes part in one multiply and one add: sixteen billion operations.', code: 'math' },
        { id: 'math', say: 'At a thousand trillion operations per second, those take {0.016|zero point zero one six} milliseconds: tiny next to the five spent reading.', code: 'math' },
        { id: 'bound', say: 'So a decode pass spends nearly all its time waiting on memory, as Pope\'s team found: with few sequences at once, loading the weights dominates. Faster arithmetic would barely help.', code: ['time', 'rate'] },
        { id: 'pre', say: 'Prefill is different. Each weight it reads is used for every prompt token at once, so five hundred prompt tokens share a single read of the weights.', code: 'bytes' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
