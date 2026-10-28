import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-embeddings',
  title: 'Embeddings',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Firth', year: 1957, title: 'A synopsis of linguistic theory, 1930-1955', url: 'https://archive.org/details/studiesinlinguis0000vari', scene: 'points' },
    { who: 'Bengio, Ducharme, Vincent & Jauvin', year: 2003, title: 'A neural probabilistic language model', url: 'https://www.jmlr.org/papers/v3/bengio03a.html', scene: 'table' },
  ],
  scenes: [
    {
      id: 'points',
      title: 'A point for every word',
      codeTitle: 'tokens.py',
      code: `
        vocab = ['cat', 'car', 'dog', 'bus']   #@vocab
        # ids:     0      1      2      3      #@ids
        cat = np.array([3, 1])                 #@vec
        dog = np.array([3, 2])                 #@vec
        car = np.array([-1, 3])                #@vec
        cat @ dog    # 9 + 2 = 11: alike       #@dot
        cat @ car    # -3 + 3 = 0: unalike     #@dot2
      `,
      beats: [
        { id: 'tokens', say: 'A model computes with numbers, so text has to become numbers first. Cut it into tokens, the pieces the model reads: here, whole words.', code: 'vocab' },
        { id: 'vocab', say: 'The list of every token a model knows is its vocabulary. Number the list from zero, and each token\'s number is its id.', code: 'ids' },
        { id: 'line', say: 'But an id is only a filing number. It puts car between cat and dog, as if a car were halfway from a cat to a dog, and says nothing about which words are alike.', code: 'ids' },
        { id: 'points', say: 'So give each token a vector instead: two numbers here, a point on a plane. Put cat and dog close together, and car and bus together, off in another direction.', code: 'vec' },
        { id: 'dot', say: 'Now the dot product says how alike two tokens are. Cat dot dog is three times three, plus one times two: eleven.', code: 'dot' },
        { id: 'dot2', say: 'Cat dot car is minus three, plus three: zero. A right angle: nothing in common.', code: 'dot2' },
        { id: 'name', say: 'A token\'s vector is called its embedding: the token is embedded, set in place, as a point in a space where nearness means something.', code: 'vec' },
        { id: 'firth', say: 'Why should nearness mean anything? In 1957, the linguist John Rupert Firth put it this way: you shall know a word by the company it keeps.', code: 'vec' },
      ],
    },
    {
      id: 'table',
      title: 'The embedding table',
      codeTitle: 'table.py',
      code: `
        E = np.array([[ 3, 1],    # cat 0   #@E
                      [-1, 3],    # car 1   #@E
                      [ 3, 2],    # dog 2   #@E
                      [-2, 3]])   # bus 3   #@E
        E.shape   # (4, 2): V rows, d cols  #@shape
        E[2]      # [3, 2]: dog's row       #@lookup
        E.size    # 8 = V * d               #@count
        # 17,000 * 100 = 1,700,000         #@big
      `,
      beats: [
        { id: 'stack', say: 'Stack every token\'s vector as a row, in order of id, and you have the embedding table, E. Row zero is cat\'s point: three, one.', code: 'E' },
        { id: 'V', say: 'It has one row per token: V rows, V for the size of the vocabulary. Here V is four.', code: 'shape' },
        { id: 'd', say: 'And one column per number in a vector: d columns, d for the embedding\'s size. Here d is two, so E is four by two.', code: 'shape' },
        { id: 'lookup', say: 'To embed a token, read its row. Dog has id two, so its embedding is row two: three, two. That is the third row down, because ids count from zero.', code: 'lookup' },
        { id: 'count', say: 'The table holds V times d numbers: four times two, eight.', code: 'count' },
        { id: 'bengio', say: 'In 2003, Yoshua Bengio and three colleagues gave each word a row like this, learned from text, so that words used alike, such as cat and dog, could land near each other.', code: 'E' },
        { id: 'big', say: 'Their vocabularies held about seventeen thousand words, with up to a hundred numbers each: {1.7|one point seven} million numbers.', code: 'big' },
      ],
    },
    {
      id: 'onehot',
      title: 'A lookup is a product',
      codeTitle: 'onehot.py',
      code: `
        x = np.array([1, 2, 0, 0])         #@x
        x @ E     # [1, 7]                 #@col
        # = 1 * E[0] + 2 * E[1]            #@rows
        onehot = np.array([0, 0, 1, 0])    #@oh
        onehot @ E   # [3, 2]: E[2]        #@picks
        E[2]         # same row, no math   #@same
      `,
      beats: [
        { id: 'x', say: 'There is a second way to reach a row. Put a vector, x, on the left of E, with one entry per row: one, two, zero, zero.', code: 'x' },
        { id: 'col', say: 'x times E dots x with each column of E. Down the first: one times three, plus two times minus one, is one. The second column gives seven.', code: 'col' },
        { id: 'rows', say: 'Read it by rows instead, and it is one times row zero, plus two times row one. x times E weighs each row of E by its entry, and adds them up.', code: 'rows' },
        { id: 'onehot', say: 'Now write dog\'s id, two, as a one-hot vector: all zeros except a one in place two. One entry is on, or hot, which gives it the name.', code: 'oh' },
        { id: 'picks', say: 'Times E, it weighs every row by zero except row two, which it weighs by one. So one-hot times E is exactly row two: dog\'s embedding.', code: 'picks' },
        { id: 'same', say: 'A lookup is a product with a one-hot vector. Reading the row directly gives the same answer, and skips every multiplication by zero.', code: 'same' },
      ],
    },
    {
      id: 'batch',
      title: 'Whole sequences',
      codeTitle: 'batch.py',
      code: `
        ids = np.array([2, 0, 3, 1])     #@seq
        E[ids].shape   # (4, 2): (n, d)  #@rows
        ids = np.array([[2, 0, 3, 1],    #@batch
                        [1, 3, 0, 0],    #@batch
                        [0, 2, 2, 3]])   #@batch
        ids.shape      # (3, 4): (m, n)  #@batch
        E[ids].shape   # (3, 4, 2): (m, n, d)  #@out
      `,
      beats: [
        { id: 'seq', say: 'Text comes as a sequence, tokens in order: dog, cat, bus, car is four ids, two, zero, three, one.', code: 'seq' },
        { id: 'rows', say: 'Look them all up at once, and every id becomes its row: four rows of two numbers, a shape of four by two.', code: 'rows' },
        { id: 'batch', say: 'Stack three such sequences, shape three by four, and the lookup gives three by four by two: the ids keep their shape, and gain a last axis of d numbers.', code: ['batch', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
