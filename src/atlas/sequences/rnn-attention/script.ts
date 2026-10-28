import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rnn-attention',
  title: 'Attention over the encoder',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bahdanau, Cho & Bengio', year: 2014, title: 'Neural Machine Translation by Jointly Learning to Align and Translate', url: 'https://arxiv.org/abs/1409.0473', scene: 'squeeze' },
    { who: 'Luong, Pham & Manning', year: 2015, title: 'Effective Approaches to Attention-based Neural Machine Translation', url: 'https://arxiv.org/abs/1508.04025', scene: 'look' },
  ],
  scenes: [
    {
      id: 'squeeze',
      title: 'One vector for a whole sentence',
      codeTitle: 'seq2seq.py',
      code: `
        src = ['je', 'suis', 'étudiant']  #@src
        h = encoder(src)  # last state     #@one
        # 3 words or 50: h, same size      #@long
        # attention keeps every state:     #@keep
        # enc[j]: the state after word j   #@keep
      `,
      beats: [
        { id: 'recall', say: 'A sequence-to-sequence model reads, je suis étudiant, with an encoder, and writes, I am a student, with a decoder. Everything it read reaches the decoder through one vector: the encoder\'s final state.', code: ['src', 'one'] },
        { id: 'long', say: 'That vector has a fixed size. Three words or fifty, the whole sentence must squeeze into the same few numbers, and long sentences came out translated worse.', code: 'long' },
        { id: 'bahdanau', say: 'In 2014, Dzmitry Bahdanau, Kyunghyun Cho and Yoshua Bengio called that fixed-length vector a bottleneck. Their fix: let the decoder look back at every encoder state, not just the last.', code: 'keep' },
        { id: 'keep', say: 'The encoder already makes one state per input word as it reads. Keep them all, and call them {hⱼ|h j}: the state after word j, counting from zero.', code: 'keep' },
      ],
    },
    {
      id: 'look',
      title: 'Which state matters now?',
      codeTitle: 'attention.py',
      code: `
        enc = np.array([[2, 1],   # je       #@enc
                        [0, 2],   # suis     #@enc
                        [1, -1]]) # étudiant #@enc
        q = np.array([1, 0])   # decoder     #@q
        s = enc @ q        # [2, 0, 1]       #@s
        a = softmax(s)     # the α's         #@a
        # [0.67, 0.09, 0.24]                 #@a
      `,
      beats: [
        { id: 'need', say: 'To write its first word, I, the decoder needs je far more than suis or étudiant. So it needs a way to score each encoder state for the word at hand.', code: 'enc' },
        { id: 'arrows', say: 'Picture the states as arrows. Real ones hold hundreds of numbers; these hold two, so they fit on a page.', code: 'enc' },
        { id: 'q', say: 'The decoder has a state of its own, an arrow too. Call it q, for query: what the decoder is looking for right now.', code: 'q' },
        { id: 'score', say: 'Score each encoder state by its dot product with q, which is big when two arrows point the same way. This q lies along the first axis, so each score is how far a state reaches along it: two for je, one for étudiant, and zero for suis, at a right angle.', code: 's' },
        { id: 'sj', say: 'Those are the scores, {sⱼ = q · hⱼ|s j equals q dot h j}: biggest for the state that lines up best with q.', code: 's' },
        { id: 'luong', say: 'In 2015, Minh-Thang Luong, Hieu Pham and Christopher Manning found that this plain dot product works well as the score. The first attention model had used a small learned network instead.', code: 's' },
        { id: 'weights', say: 'Softmax turns the scores into weights, positive and adding up to one: about {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}. The highest score still gets the most.', code: 'a' },
        { id: 'alpha', say: 'These are the attention weights, {αⱼ|alpha j}: how much attention the decoder pays to each input word. The word comes from Bahdanau\'s paper: the decoder decides which parts of the sentence to pay attention to.', code: 'a' },
      ],
    },
    {
      id: 'mix',
      title: 'Blend them: the context vector',
      codeTitle: 'context.py',
      code: `
        a = np.array([0.67, 0.09, 0.24])  #@a
        0.67 * enc[0]   # [1.34, 0.67]     #@scale
        0.09 * enc[1]   # [0, 0.18]        #@small
        0.24 * enc[2]   # [0.24, -0.24]    #@small
        ctx = a @ enc   # [1.58, 0.61]     #@add
      `,
      beats: [
        { id: 'blend', say: 'Now blend the states into one vector, each counting as much as its weight says: shrink every arrow by its weight, then add them up.', code: 'a' },
        { id: 'scale', say: 'Je\'s state, two, one, times {0.67|zero point six seven}, shrinks to {1.34|one point three four}, {0.67|zero point six seven}. The other two, with small weights, shrink almost away.', code: ['scale', 'small'] },
        { id: 'add', say: 'Add them by laying the arrows tip to tail. The sum ends at {1.58|one point five eight}, {0.61|zero point six one}: mostly je, a little of the rest.', code: 'add' },
        { id: 'context', say: 'This weighted sum is called the context vector, {Σⱼ αⱼ hⱼ|the sum over j of alpha j times h j}: the part of the input that matters for the word being written now.', code: 'add' },
        { id: 'use', say: 'The decoder reads the context vector along with its own state, and predicts its next word: I.', code: 'add' },
      ],
    },
    {
      id: 'every',
      title: 'A fresh look at every step',
      codeTitle: 'attention.py',
      code: `
        for t in range(len(out)):      #@loop
            s = enc @ q[t]             #@loop
            a[t] = softmax(s)  # row t #@row
            ctx = a[t] @ enc           #@loop
        # no one vector to squeeze into #@free
      `,
      beats: [
        { id: 'again', say: 'At the next step the decoder\'s state has moved on, so q points somewhere new, and the weights shift: for the words am and a, mostly to suis; for student, to étudiant.', code: 'loop' },
        { id: 'grid', say: 'Stack each step\'s weights as a row, and you see which input words each output word drew on. Bahdanau\'s paper drew grids like this, and called them alignments: which words line up across the two languages.', code: 'row' },
        { id: 'free', say: 'Nothing has to squeeze through one fixed-size vector any more: at every step, the decoder can read every input state directly.', code: 'free' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
