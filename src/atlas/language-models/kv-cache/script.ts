import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kv-cache',
  title: 'The KV cache',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'again',
      title: 'Generating, the slow way',
      codeTitle: 'generate.py',
      code: `
        for t in range(1, 11):      # 10 steps     #@loop
            out = model(toks)       # all t tokens #@loop
            toks.append(pick(out[-1]))             #@loop
        # keys per block: 1 + 2 + ... + 10 = 55   #@count
      `,
      beats: [
        { id: 'loop', say: 'A language model writes text one token at a time: run the model on the sequence so far, pick the next token, append it, and run again.', code: 'loop' },
        { id: 'redo', say: 'Done plainly, every step runs the whole sequence, so every block computes every token\'s key and value again, though only one token is new.', code: 'loop' },
        { id: 'same', say: 'And the old ones come out the same every time. With the causal mask, an earlier token never attends to a later one, so adding a token changes nothing before it.', code: 'loop' },
        { id: 'count', say: 'Over T steps, step one computes one key, step two computes two, and step T computes T. That sum, {1 + 2 + … + T|one plus two, and so on up to T}, is {T(T + 1) / 2|T times T plus one, over two}: for ten steps, fifty-five.', code: 'count' },
      ],
    },
    {
      id: 'cache',
      title: 'Keep them instead',
      codeTitle: 'generate.py',
      code: `
        cache = []                # one per block  #@keep
        for t in range(1, 11):                     #@step
            q, k, v = qkv(new_tok)  # newest only  #@step
            cache.append((k, v))                   #@step
            out = attend(q, cache)  # all t        #@step
        # 10 keys, not 55                          #@work
        # keys: (t, d), values: (t, d)             #@shape
      `,
      beats: [
        { id: 'keep', say: 'So keep them. The KV cache stores the keys and values of every token so far, in every block.', code: 'keep' },
        { id: 'step', say: 'Each step now computes a query, key and value for the newest token only, adds its key and value to the cache, and attends over everything stored.', code: 'step' },
        { id: 'work', say: 'Ten steps compute ten keys instead of fifty-five. For a thousand tokens, a thousand instead of half a million.', code: 'work' },
        { id: 'shape', say: 'In one block, at step t, the cached keys form a t by d array, one row per token so far, and the values another. Each grows by one row per step.', code: 'shape' },
        { id: 'memory', say: 'The price is memory: two times the blocks, times T, times d numbers, for every sequence being written.', code: 'shape' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
