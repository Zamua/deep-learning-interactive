import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-bpe',
  title: 'Byte-pair encoding',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'count',
      title: 'Count the neighbors',
      codeTitle: 'bpe.py',
      code: `
        ids = list(b'hughugspug')           #@bytes
        # [104, 117, 103, 104, ...]: 10      #@bytes
        counts = count_pairs(ids)           #@pairs
        # (u,g): 3  (h,u): 2  (g,h): 1 ...  #@pairs
        ids = merge(ids, (117, 103), 256)   #@merge
        len(ids)    # 7                     #@len
      `,
      beats: [
        { id: 'bytes', say: 'Computers store text as bytes, and a byte has only {256|two hundred fifty-six} possible values. So a vocabulary can start with {256|two hundred fifty-six} tokens, ids zero to {255|two hundred fifty-five}, and spell any text at all.', code: 'bytes' },
        { id: 'long', say: 'Here is a short text: hug, hugs, pug, run together. Ten bytes, so ten tokens. It works, but it is long.', code: 'bytes' },
        { id: 'pairs', say: 'Byte-pair encoding shortens it. Count every pair of neighboring tokens, left to right.', code: 'pairs' },
        { id: 'top', say: 'u followed by g comes up three times: more than any other pair.', code: 'pairs' },
        { id: 'merge', say: 'So merge it. u g becomes one new token, with the next free id, {256|two hundred fifty-six}, and every u g in the text is replaced.', code: 'merge' },
        { id: 'shorter', say: 'Each replacement turns two tokens into one. Three replacements save three tokens: ten become seven.', code: 'len' },
      ],
    },
    {
      id: 'repeat',
      title: 'Merge, and merge again',
      codeTitle: 'bpe.py',
      code: `
        for k in range(num_merges):             #@loop
            counts = count_pairs(ids)           #@loop
            pair = max(counts, key=counts.get)  #@loop
            ids = merge(ids, pair, 256 + k)     #@loop
        # k = 1: (104, 256) -> 257, 'hug'       #@hug
        vocab_size = 256 + num_merges           #@vocab
        # 256 + 50,000 = 50,256                 #@real
      `,
      beats: [
        { id: 'again', say: 'Then do it again, on the new text. Now h followed by u g is the top pair, twice.', code: 'loop' },
        { id: 'hug', say: 'It becomes token {257|two hundred fifty-seven}, the whole word hug, and seven tokens become five.', code: 'hug' },
        { id: 'grow', say: 'Every merge adds exactly one token to the vocabulary. Merge zero made {256|two hundred fifty-six} and merge one made {257|two hundred fifty-seven}, so after k merges there are {256|two hundred fifty-six} plus k.', code: 'vocab' },
        { id: 'real', say: 'Real tokenizers run tens of thousands of merges. Fifty thousand of them make a vocabulary of {50,256|fifty thousand two hundred fifty-six}, where common words are single tokens.', code: 'real' },
        { id: 'rows', say: 'And every new token gets an id of its own, so a row of its own in the embedding table.', code: 'vocab' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
