import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  encode: {
    is: 'text to token ids, with the trained tokenizer',
    more: 'It splits the text into chunks, turns each into bytes, and replays the learned BPE merges in the order they were learned. A leading space gives a different token.',
    eg: 'encode(" the"), encode("the")  # [258], [116, 256]',
  },
  transformer: {
    is: 'the chapter 2 stack: vectors in, vectors out',
    more: 'It returns one hidden vector h per position, the same shape as its input x. This lecture is about what goes in below it and what comes out above it.',
  },
  decode: {
    is: 'token ids back to text',
    more: 'Each id stands for fixed bytes: look them up, join them, and read the bytes as UTF-8.',
  },
  '.encode': {
    is: 'text to its UTF-8 bytes',
    more: 'In the BPE scenes it gives the starting ids, one per byte, each below 256. On a tokenizer object, as in bpe.encode(s), it returns token ids instead.',
    eg: 'len("καλημέρα".encode())   # 16',
  },
  get_stats: {
    is: 'counts every pair of neighboring ids',
    more: 'It returns a dict from each adjacent pair to how often it occurs, and training merges the most frequent one. Given a dict as a second argument, it adds one chunk\'s counts to it.',
    eg: 'get_stats([1, 2, 1, 2])  # {(1,2): 2, (2,1): 1}',
  },
  merge: {
    is: 'replaces every occurrence of a pair with a new id',
    more: 'Each merge shortens the sequence. In training the new id is 256 + k; when encoding, it comes from the learned merges table.',
    eg: 'merge([1,2,3,1,2], (1,2), 256)  # [256,3,256]',
  },
  '.decode': {
    is: 'bytes back to a string',
    more: 'Here it reads the joined token bytes as UTF-8. errors="replace" turns an invalid byte sequence, such as a character cut in half, into a placeholder instead of raising an error.',
    eg: 'b"\\xce\\xba".decode("utf-8")   # \'κ\'',
  },
};
