import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-unembedding',
  title: 'From vectors back to tokens',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Press & Wolf', year: 2017, title: 'Using the Output Embedding to Improve Language Models', url: 'https://arxiv.org/abs/1608.05859', scene: 'tie' },
    { who: 'Inan, Khosravi & Socher', year: 2017, title: 'Tying Word Vectors and Word Classifiers: A Loss Framework for Language Modeling', url: 'https://arxiv.org/abs/1611.01462', scene: 'tie' },
  ],
  scenes: [
    {
      id: 'mean',
      title: 'Which token does h mean?',
      codeTitle: 'unembed.py',
      code: `
        h = np.array([2, 1])   # d = 2   #@h
        cats  = np.array([-1,  2])       #@rows
        chase = np.array([-1, -1])       #@rows
        mice  = np.array([ 3,  1])       #@rows
        dogs  = np.array([ 1,  0])       #@rows
        mice @ h   # 3*2 + 1*1 = 7       #@mice
        # cats 0, chase -3, dogs 2       #@rest
      `,
      beats: [
        { id: 'answer', say: 'An embedding table turns tokens into vectors, so that a model can compute with text. But in the end, it has to answer in tokens.' },
        { id: 'pick', say: 'Say it has read cats chase, and must write the next word. It has to pick one token from its vocabulary: here just four, cats, chase, mice and dogs.' },
        { id: 'h', say: 'Whatever it has worked out about that next word sits in one vector, h, with d numbers, just like an embedding. Here d is two, so h is an arrow: two, one.', code: 'h' },
        { id: 'rows', say: 'Now give every token an arrow of its own, too: a row of d weights for each token.', code: 'rows' },
        { id: 'agree', say: 'Which token does h mean? The one whose arrow points most the way h does. The dot product measures exactly that: positive when two arrows agree, zero at a right angle, negative when they point apart.', code: 'rows' },
        { id: 'mice', say: 'Mice\'s row is three, one, close to h. Three times two, plus one times one, makes seven.', code: 'mice' },
        { id: 'rest', say: 'Dogs scores two. Cats, at a right angle, scores zero, and chase, pointing away, minus three.', code: 'rest' },
        { id: 'win', say: 'The highest score wins, so the model writes mice. It is the linear classifier again, with one class for every token.', code: 'rest' },
      ],
    },
    {
      id: 'matrix',
      title: 'One row per token',
      codeTitle: 'unembed.py',
      code: `
        W_U = np.array([[-1,  2],  # cats    #@WU
                        [-1, -1],  # chase   #@WU
                        [ 3,  1],  # mice    #@WU
                        [ 1,  0]]) # dogs    #@WU
        W_U.shape     # (4, 2): (V, d)       #@shape
        s = W_U @ h   # [0, -3, 7, 2]        #@s
        s.argmax()    # 2: mice              #@top
        H.shape       # (3, 2): 3 positions  #@H
        [W_U @ h for h in H]   # (3, 4)      #@many
      `,
      beats: [
        { id: 'stack', say: 'To score every token at once, stack the rows into one matrix, {W_U|W U}: one row per token, and one column per number in h.', code: 'WU' },
        { id: 'name', say: 'The U is for unembedding. The embedding table turned a token into a vector, and this matrix turns a vector back into tokens.', code: 'WU' },
        { id: 'shape', say: 'Its shape is V by d, with V for the size of the vocabulary: here, four by two.', code: 'shape' },
        { id: 'all', say: '{W_U|W U} times h dots every row with h at once. Out comes s, one score per token: zero, minus three, seven and two.', code: 's' },
        { id: 'logits', say: 'Raw scores like these, of any size and either sign, are often called logits. The highest still wins: mice, at seven.', code: 's' },
        { id: 'argmax', say: 'Picking the top score this way has a name: the argmax. It is not the score itself, seven, but where it sits: position two, which is mice.', code: 'top' },
        { id: 'many', say: 'A model often has a vector like h at every position in the text. Stack three of them, three by d, and each row is scored on its own: three by V, a row of scores per position.', code: ['H', 'many'] },
      ],
    },
    {
      id: 'tie',
      title: 'The embedding table, used twice',
      codeTitle: 'tied.py',
      code: `
        E.shape       # (4, 2): (V, d)      #@E
        W_U = E       # tied: one matrix    #@tie
        s = E @ h     # s[j] = E[j] · h     #@score
        V, d = 50_000, 768                  #@save
        2 * V * d     # untied: 76,800,000  #@both
        V * d         # tied: 38,400,000    #@save
      `,
      beats: [
        { id: 'compare', say: 'Now set {W_U|W U} beside the embedding table, E. Both have a row for every token, with d numbers in each: the same shape, V by d.', code: 'E' },
        { id: 'same', say: 'And they hold the same tokens. The words a model reads and the words it writes come from one vocabulary.', code: 'E' },
        { id: 'papers', say: 'So in 2017, two papers used one matrix for both jobs: one by Ofir Press and Lior Wolf, and one by Hakan Inan and his colleagues.', code: 'tie' },
        { id: 'tied', say: 'Tie them, and {W_U|W U} is E. Each token is scored with its own row of E: its own embedding.', code: 'tie' },
        { id: 'Ej', say: 'Write {Eⱼ|E j} for row j of E, the embedding of token j.', code: 'score' },
        { id: 'sj', say: 'Then token j\'s score, {sⱼ|s j}, is {Eⱼ|E j} dotted with h. It is high when h points the way that token\'s embedding does.', code: 'score' },
        { id: 'better', say: 'Both papers found that tied models predicted text better than untied ones, with far fewer numbers to learn.', code: 'tie' },
        { id: 'both', say: 'Untied, the two matrices hold two times V times d learned numbers. With fifty thousand tokens and d of {768|seven hundred sixty-eight}, that is {76.8|seventy-six point eight} million.', code: ['save', 'both'] },
        { id: 'save', say: 'Tied, they are one V by d table, so tying saves half: {38.4|thirty-eight point four} million.', code: 'save' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
