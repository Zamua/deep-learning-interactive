import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kv-cache',
  title: 'The KV cache',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Liptay', year: 1968, title: 'Structural aspects of the System/360 Model 85, II: The cache', url: 'https://doi.org/10.1147/sj.71.0015', scene: 'cache' },
  ],
  scenes: [
    {
      id: 'again',
      title: 'Writing, the slow way',
      codeTitle: 'generate.py',
      code: `
        for t in range(1, 11):  # 10 steps #@loop
            out = model(toks)   # t tokens #@loop
            toks.append(pick(out[-1]))     #@loop
        # keys: 1 + 2 + ... + 10           #@count
        # 2 staircases: 10 x 11            #@area
        # one: 10 * 11 / 2 = 55            #@area
        # T steps: T(T + 1) / 2            #@formula
        # T = 1,000: 500,500               #@thousand
      `,
      beats: [
        { id: 'loop', say: 'A language model writes one token at a time. Run it on the text so far, pick a next token from the last position, add it to the end, and run it again.', code: 'loop' },
        { id: 'redo', say: 'Each run starts from scratch. Attention in every block needs a key and a value for every token, so each run computes them all again, though only the last token is new.', code: 'loop' },
        { id: 'same', say: 'And the old ones come out the same every time. The causal mask lets a token read only itself and the tokens before it, so a token added at the end changes nothing earlier, in any block.', code: 'loop' },
        { id: 'count', say: 'Count the keys one block computes. Step one computes one key, step two computes two, and step ten computes ten.', code: 'count' },
        { id: 'area', say: 'Together they fill a staircase. Turn a copy upside down and fit it on top, and the two make a rectangle, ten by eleven. One staircase is half of it: fifty-five keys.', code: 'area' },
        { id: 'formula', say: 'That works for any number of steps, T. The rectangle is T by T plus one, and the staircase is half of it: {T(T + 1) / 2|T times T plus one, over two}.', code: 'formula' },
        { id: 'thousand', say: 'So writing a thousand tokens computes {500,500|five hundred thousand five hundred} keys in each block: about half a million.', code: 'thousand' },
      ],
    },
    {
      id: 'cache',
      title: 'Keep them instead',
      codeTitle: 'generate.py',
      code: `
        cache = []       # one per block  #@keep
        for t in range(1, 11):            #@step
            q, k, v = qkv(new_tok)        #@step
            cache.append((k, v))          #@step
            out = attend(q, cache)        #@step
        # q: used once, not kept          #@q
        # 10 keys, not 55                 #@work
      `,
      beats: [
        { id: 'keep', say: 'So compute each key and value once, and keep it. That store is the KV cache: K for keys, and V for values. Every block keeps one.', code: 'keep' },
        { id: 'name', say: 'Cache was French Canadian trappers\' word for a hidden store of supplies. In 1968, {J. S. Liptay|J S Liptay} described the cache of an {IBM|I B M} computer: a small, fast memory that keeps data close at hand, to use again.', code: 'keep' },
        { id: 'step', say: 'Now each step computes a query, a key and a value for the newest token only. Its key and value join the cache, and its query attends over everything stored there.', code: 'step' },
        { id: 'slide', say: 'Each row is the row above, carried down unchanged, plus one new token.', code: 'step' },
        { id: 'q', say: 'Queries are not kept. A query is used once, by its own token, at its own step. Later tokens need only the earlier keys, to score against, and values, to blend.', code: 'q' },
        { id: 'work', say: 'So ten steps compute ten keys instead of fifty-five, one per token. A thousand tokens take a thousand keys, not half a million.', code: 'work' },
      ],
    },
    {
      id: 'size',
      title: 'What it costs',
      codeTitle: 'cache.py',
      code: `
        # one block, after 7 tokens:   #@shape
        # keys (7, d), values (7, d)   #@shape
        # 1 more token: (8, d)         #@grow
        # 4 blocks: (4, 7, d)          #@stack
        # d = 6: 7 * 6 = 42 keys       #@memory
        # + 42 values = 84             #@pair
        # 4 blocks: 4 * 84 = 336       #@total
        # 2 * blocks * T * d           #@general
      `,
      beats: [
        { id: 'shape', say: 'Look inside one block\'s cache after seven tokens. The keys are seven rows, one per token, each a vector of d numbers: a seven by d array. The values make another.', code: 'shape' },
        { id: 'grow', say: 'Write one more token, and each gains a row: eight by d. The width stays d.', code: 'grow' },
        { id: 'stack', say: 'Every block keeps a cache of its own. Stack four blocks\' key caches, block first, and they make one array: four, by seven, by d. The values make another.', code: 'stack' },
        { id: 'memory', say: 'The price is memory. Say d is six. Then one block\'s keys hold seven rows of six: forty-two numbers.', code: 'memory' },
        { id: 'pair', say: 'Its values hold forty-two more, so one block keeps eighty-four.', code: 'pair' },
        { id: 'total', say: 'Four blocks keep four times that: three hundred thirty-six numbers.', code: 'total' },
        { id: 'general', say: 'In general, two, for keys and values, times the blocks, times the tokens, times d. And every sequence being written keeps a cache of its own.', code: 'general' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
