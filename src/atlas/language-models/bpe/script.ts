import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-bpe',
  title: 'Byte-pair encoding',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Sennrich, Haddow & Birch', year: 2016, title: 'Neural Machine Translation of Rare Words with Subword Units', url: 'https://arxiv.org/abs/1508.07909', scene: 'cut' },
    { who: 'Gage', year: 1994, title: 'A New Algorithm for Data Compression', url: 'https://jacobfilipp.com/DrDobbs/articles/CUJ/1994/9402/gage/gage.htm', scene: 'count' },
    { who: 'Radford, Wu, Child, Luan, Amodei & Sutskever', year: 2019, title: 'Language Models are Unsupervised Multitask Learners', url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf', scene: 'repeat' },
  ],
  scenes: [
    {
      id: 'cut',
      title: 'Words or bytes',
      codeTitle: 'cut.py',
      code: `
        text = 'hughugspug'            #@text
        vocab = ['hug', 'hugs', 'pug']  #@words
        # as words: hug|hugs|pug: 3     #@words
        # 'pugs': not in vocab          #@unk
        ids = list(b'hughugspug')       #@bytes
        # [104, 117, 103, 104, ...]     #@bytes
        # 256 ids, 0 to 255: any text   #@any
        len(ids)    # 10 tokens         #@long
        # BPE: hug|hug|s|p|ug: 5        #@middle
      `,
      beats: [
        { id: 'tokens', say: 'A model reads text as tokens: the pieces the text is cut into, each with an id and a row of its own in the embedding table. The rule that does the cutting is called a tokenizer.', code: 'text' },
        { id: 'words', say: 'One rule is whole words. Take hug, hugs, pug, run together: cut into words, that is just three tokens.', code: 'words' },
        { id: 'unk', say: 'But a word missing from the vocabulary, such as pugs, has no token at all, so the model cannot read it.', code: 'unk' },
        { id: 'bytes', say: 'The other extreme is bytes, the units a computer stores text in. A byte is eight bits, binary digits that are each a one or a zero, so it has two to the eight possible values: {256|two hundred fifty-six}.', code: 'bytes' },
        { id: 'any', say: 'So a vocabulary of just {256|two hundred fifty-six} tokens, ids zero through {255|two hundred fifty-five}, can spell any text at all, pugs included.', code: 'any' },
        { id: 'long', say: 'The price is length. Spelled in bytes, hug, hugs, pug is ten tokens instead of three.', code: 'long' },
        { id: 'middle', say: 'Byte-pair encoding, {BPE|B P E} for short, lands in between. It starts from the bytes and glues the most frequent neighbors into longer tokens, so common words end up as single tokens, and rare ones are spelled from pieces.', code: 'middle' },
        { id: 'sennrich', say: 'Rico Sennrich, Barry Haddow and Alexandra Birch proposed it in 2016, for translation models whose vocabularies held thirty to fifty thousand words, and kept meeting words outside them.', code: 'middle' },
      ],
    },
    {
      id: 'count',
      title: 'Glue the top pair',
      codeTitle: 'bpe.py',
      code: `
        ids = list(b'hughugspug')          #@bytes
        counts = count_pairs(ids)          #@pairs
        # (u,g): 3  (h,u): 2  (g,h): 1 ... #@pairs
        ids = merge(ids, (117, 103), 256)  #@merge
        len(ids)    # 10 - 3 = 7           #@len
      `,
      beats: [
        { id: 'pairs', say: 'Start from the ten bytes. Count every pair of neighbors, in order, left to right: u then g is one pair, and g then u would be another.', code: 'pairs' },
        { id: 'top', say: 'u followed by g comes up three times: more than any other pair.', code: 'pairs' },
        { id: 'merge', say: 'So merge it. u g becomes one new token, with the next free id, {256|two hundred fifty-six}, and every u g in the text is replaced.', code: 'merge' },
        { id: 'shorter', say: 'Each replacement turns two tokens into one. Three replacements save three tokens: ten become seven.', code: 'len' },
        { id: 'gage', say: 'The trick began as file compression. In 1994, Philip Gage shrank files by replacing their most frequent pair of bytes with a single unused byte, again and again. A pair of bytes, encoded as one: byte-pair encoding.', code: 'merge' },
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
        { id: 'hug', say: 'It becomes token {257|two hundred fifty-seven}, the whole word hug. Two replacements this time, so seven tokens become five.', code: 'hug' },
        { id: 'grow', say: 'Each merge adds exactly one token. Merge zero made {256|two hundred fifty-six}, and merge one made {257|two hundred fifty-seven}, so merge number k makes {256 + k|two hundred fifty-six plus k}.', code: 'loop' },
        { id: 'V', say: 'After k merges, then, the vocabulary holds the {256|two hundred fifty-six} bytes plus k new tokens. Its size, V, as in the embedding table, is {256 + k|two hundred fifty-six plus k}.', code: 'vocab' },
        { id: 'radford', say: 'Starting from bytes was the choice of Alec Radford and colleagues at OpenAI, in 2019. Starting from every character, in every script, would have taken over a hundred and thirty thousand tokens before a single merge.', code: 'vocab' },
        { id: 'real', say: 'They ran fifty thousand merges: {256|two hundred fifty-six} plus fifty thousand is {50,256|fifty thousand two hundred fifty-six} tokens, and common words became single tokens.', code: 'real' },
        { id: 'rows', say: 'And every new token gets an id of its own, so a row of its own in the embedding table.', code: 'vocab' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
