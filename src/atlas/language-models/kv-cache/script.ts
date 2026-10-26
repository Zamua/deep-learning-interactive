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
        # keys per block: 1 + 2 + ... + 10        #@count
        # (1+10) + (2+9) + ... + (5+6) = 5 * 11   #@pair
        # T steps: T/2 pairs of T+1 = T(T+1)/2    #@formula
      `,
      beats: [
        { id: 'loop', say: 'A language model writes text one token at a time: run the model on the sequence so far, pick the next token, append it, and run again.', code: 'loop' },
        { id: 'redo', say: 'Done plainly, every step runs the whole sequence, so every block computes every token\'s key and value again, though only one token is new.', code: 'loop' },
        { id: 'same', say: 'And the old ones come out the same every time. With the causal mask, an earlier token never attends to a later one, so adding a token changes nothing before it.', code: 'loop' },
        { id: 'count', say: 'Count the keys. Step one computes one, step two computes two, and step ten computes ten: {1 + 2 + … + 10|one plus two, and so on up to ten}.', code: 'count' },
        { id: 'pair', say: 'To add that up, pair the ends. One plus ten is eleven, two plus nine is eleven, and so on to five plus six. Five pairs of eleven: fifty-five.', code: 'pair' },
        { id: 'formula', say: 'Over T steps, there are T over two pairs, each adding to T plus one: {T(T + 1) / 2|T times T plus one, over two}. For a thousand steps, five hundred times {1,001|one thousand and one}: {500,500|five hundred thousand, five hundred}.', code: 'formula' },
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
        # 4 blocks stacked: (4, t, d)              #@stack
        # 1 block: 2 * 7 * 6 = 84 numbers          #@memory
        # 4 blocks: 2 * 4 * 7 * 6 = 336            #@total
      `,
      beats: [
        { id: 'keep', say: 'So keep them. The KV cache stores the keys and values of every token so far, in every block.', code: 'keep' },
        { id: 'step', say: 'Each step now computes a query, key and value for the newest token only, adds its key and value to the cache, and attends over everything stored.', code: 'step' },
        { id: 'work', say: 'Ten steps compute ten keys instead of fifty-five. For a thousand tokens, a thousand instead of half a million.', code: 'work' },
        { id: 'shape', say: 'In one block, at step t, the cached keys form a t by d array, one row per token so far, and the values another. Each grows by one row per step.', code: 'shape' },
        { id: 'stack', say: 'Every block keeps a cache of its own. Stack the key caches of four blocks, block first, and they make one array of shape four, by t, by d. The values make another.', code: 'stack' },
        { id: 'memory', say: 'The price is memory. This block holds seven tokens, with d at six: seven rows of six numbers for the keys, and as many for the values. Two times seven times six: eighty-four numbers.', code: 'memory' },
        { id: 'total', say: 'Four blocks hold four times that: three hundred thirty-six. In general, two, times the blocks, times T, times d numbers, for every sequence being written.', code: 'total' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
