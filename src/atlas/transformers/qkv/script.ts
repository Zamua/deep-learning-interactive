import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-qkv',
  title: 'Queries, keys and values',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Daniluk, Rocktäschel, Welbl & Riedel', year: 2017, title: 'Frustratingly Short Attention Spans in Neural Language Modeling', url: 'https://arxiv.org/abs/1702.04521', scene: 'jobs' },
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'lookup' },
  ],
  scenes: [
    {
      id: 'jobs',
      title: 'One arrow, two jobs',
      codeTitle: 'attention.py',
      code: `
        e = enc @ q     # score each state  #@score
        a = softmax(e)  # the weights       #@score
        ctx = a @ enc   # blend the states  #@blend
        # enc[j]: scored, then handed over  #@both
      `,
      beats: [
        { id: 'recall', say: 'In attention over the encoder, the decoder\'s query, q, scored each encoder state with a dot product: how far that state\'s arrow reaches along q.', code: 'score' },
        { id: 'blend', say: 'Then the same arrows were shrunk by their weights and added up into the context vector.', code: 'blend' },
        { id: 'tug', say: 'So each arrow has two jobs. Turn suis toward q, and its score climbs. But what suis hands over turns with it.', code: 'both' },
        { id: 'clash', say: 'What makes a word easy to find need not be what it should hand over. One arrow cannot serve both.', code: 'both' },
        { id: 'daniluk', say: 'In 2017, Michał Daniluk and colleagues hit this in a language model: one vector had to predict the next word, be scored, and be handed over. One vector per job worked better.', code: 'both' },
      ],
    },
    {
      id: 'lookup',
      title: 'A soft lookup',
      codeTitle: 'lookup.py',
      code: `
        table = {'cats': [2, 0],    #@dict
                 'like': [0, 2],    #@dict
                 'fish': [1, 1]}    #@dict
        table['cats']   # [2, 0]    #@exact
        e = [q @ k for k in keys]   #@soft
        out = softmax(e) @ values   #@soft
      `,
      beats: [
        { id: 'dict', say: 'A Python dictionary keeps two such jobs apart: each entry pairs a key, to look it up by, with a value, to get back.', code: 'dict' },
        { id: 'exact', say: 'Ask for cats, and the key cats matches: out comes its value, two, zero. The value can be anything.', code: 'exact' },
        { id: 'names', say: 'Attention borrows the names. A query asks, the keys are what it is matched against, and the values are what come back.', code: 'soft' },
        { id: 'soft', say: 'But the match is soft: every key matches a little, by its dot product with the query, and back comes a blend of all the values.', code: 'soft' },
        { id: 'vaswani', say: 'In 2017, Ashish Vaswani and colleagues at Google defined attention in these terms: a query and key-value pairs, mapped to a weighted sum of the values.', code: 'soft' },
      ],
    },
    {
      id: 'make',
      title: 'Three maps of one token',
      codeTitle: 'qkv.py',
      code: `
        x = np.array([2, 1])  # a token  #@x
        Wq = np.array([[1, 1], [0, 1]])  #@q
        q = Wq @ x      # [3, 1]         #@q
        Wk = np.array([[1, -1], [0, -1]]) #@k
        k = Wk @ x      # [1, -1]        #@k
        Wv = np.array([[-1, 1], [1, 0]]) #@v
        v = Wv @ x      # [-1, 2]        #@v
        Wq.shape        # (d_k, d)       #@shape
      `,
      beats: [
        { id: 'maps', say: 'So give each token, x, three arrows of its own, each made by a learned matrix that every token shares: W, marked Q, K or V for its job.', code: ['x', 'q', 'k', 'v'] },
        { id: 'q', say: 'The query is {Wq|W Q} times x, one dot product per row: three, one. The arrow turns and stretches.', code: 'q' },
        { id: 'k', say: 'The key, k, is {Wk|W K} times x: one, minus one.', code: 'k' },
        { id: 'v', say: 'And the value, v, is {Wv|W V} times x: minus one, two. Three arrows, each free to point its own way.', code: 'v' },
        { id: 'rows', say: 'Each row is dotted with x to make one entry. So a matrix has one row per entry it makes, and one column per entry of x.', code: 'shape' },
        { id: 'd', say: 'Real tokens are much longer. Write d for how many numbers a token has.', code: 'shape' },
        { id: 'dk', say: 'And {dₖ|d k} for how many a query has. A key has as many, to be dotted with it. So {Wq|W Q} is {dₖ by d|d k by d}.', code: 'shape' },
        { id: 'big', say: 'Vaswani\'s model had a d of {512|five hundred twelve} and a {dₖ|d k} of {64|sixty four}, so {Wq|W Q} is {64 by 512|sixty four by five hundred twelve}.', code: 'shape' },
      ],
    },
    {
      id: 'match',
      title: 'A query meets the keys',
      codeTitle: 'attend.py',
      code: `
        q = Wq @ x2     # fish: [0, 1]    #@q
        keys = [Wk @ x for x in xs]       #@keys
        e = [q @ k for k in keys] # [2, 0, 1]  #@e
        a = softmax(e)  # [0.67, 0.09, 0.24] #@a
        out = a @ values  # [1.58, 0.42]  #@out
      `,
      beats: [
        { id: 'ask', say: 'Back to a sentence: cats like fish. Each token has its key, made by {Wk|W K}. Fish asks with its query: zero, one, straight up.', code: ['q', 'keys'] },
        { id: 'score', say: 'Its query is dotted with every key, its own included. As q points straight up, each score is how high a key reaches. Cats\' key scores two.', code: 'e' },
        { id: 'others', say: 'Like\'s key lies at a right angle to q, so it scores zero. Fish\'s own key reaches one.', code: 'e' },
        { id: 'weights', say: 'Softmax turns the scores into weights that add up to one: cats gets about two thirds.', code: 'a' },
        { id: 'mix', say: 'Fish\'s output blends the values by those weights: shrink each, then add them tip to tail. It lands near cats\' value.', code: 'out' },
        { id: 'roles', say: 'So the query and the keys decide how much each token counts, and the values what it brings: two jobs, two arrows.', code: ['e', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
