import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-unembedding',
  title: 'From vectors back to tokens',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'score',
      title: 'One score per token',
      codeTitle: 'unembed.py',
      code: `
        h = np.array([2, 1])        # d = 2   #@h
        W_U = np.array([[ 1, 0],    # cat     #@WU
                        [ 3, 1],    # dog     #@WU
                        [-1, 2],    # sat     #@WU
                        [-1,-1]])   # mat     #@WU
        W_U.shape     # (4, 2): (V, d)        #@shape
        s = W_U @ h   # [2, 7, 0, -3]         #@s
        s.argmax()    # 1: dog                #@top
      `,
      beats: [
        { id: 'vector', say: 'An embedding table turns each token into a vector. At the other end of a model, after all its work, there is a vector again: h, with d numbers. Here d is two.', code: 'h' },
        { id: 'need', say: 'To turn it back into a token, the model needs a score for every token in the vocabulary. Four tokens here: cat, dog, sat and mat.', code: 'WU' },
        { id: 'matrix', say: 'That is a linear layer, just like class scores, with one class per token. Its matrix, {W_U|W U}, has one row per token and one column per number in h: V by d, four by two.', code: ['WU', 'shape'] },
        { id: 'row', say: 'Each token scores h with its own row. Dog\'s row is three, one: three times two, plus one times one, makes seven.', code: 's' },
        { id: 'all', say: 'All four at once: s equals {W_U|W U} times h, one score per token. Two, seven, zero and minus three. These scores are often called logits, and dog scores highest.', code: ['s', 'top'] },
      ],
    },
    {
      id: 'tie',
      title: 'The embedding table, used twice',
      codeTitle: 'tied.py',
      code: `
        E.shape        # (4, 2): (V, d)        #@E
        W_U = E        # tied: one matrix      #@tie
        s = E @ h      # s[j] = E[j] · h       #@tie
        V, d = 50_000, 768                     #@save
        V * d          # 38,400,000 saved      #@save
      `,
      beats: [
        { id: 'compare', say: 'Now put {W_U|W U} next to the embedding table, E. E also has one row per token, with d numbers in each: the same shape, V by d.', code: 'E' },
        { id: 'tie', say: 'So many models use one matrix for both jobs. {W_U|W U} is E, and a token\'s score is h dotted with that token\'s own embedding.', code: 'tie' },
        { id: 'point', say: 'With d at two, every row is an arrow. A token scores high when its embedding points the way h does: dog, at seven. Sat is at right angles, zero, and mat points away, minus three.', code: 'tie' },
        { id: 'save', say: 'Tying saves a whole V by d matrix. With fifty thousand tokens and d of {768|seven hundred sixty-eight}, that is {38.4|thirty-eight point four} million parameters.', code: 'save' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
