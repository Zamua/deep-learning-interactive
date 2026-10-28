import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-seq2seq',
  title: 'Encoder and decoder',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Cho, van Merriënboer, Gulcehre, Bahdanau, Bougares, Schwenk & Bengio', year: 2014, title: 'Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation', url: 'https://arxiv.org/abs/1406.1078', scene: 'lengths' },
    { who: 'Sutskever, Vinyals & Le', year: 2014, title: 'Sequence to Sequence Learning with Neural Networks', url: 'https://arxiv.org/abs/1409.3215', scene: 'lengths' },
    { who: 'Williams & Zipser', year: 1989, title: 'Experimental Analysis of the Real-time Recurrent Learning Algorithm', url: 'https://doi.org/10.1080/09540098908915631', scene: 'train' },
    { who: 'Cho, van Merriënboer, Bahdanau & Bengio', year: 2014, title: 'On the Properties of Neural Machine Translation: Encoder-Decoder Approaches', url: 'https://arxiv.org/abs/1409.1259', scene: 'squeeze' },
  ],
  scenes: [
    {
      id: 'lengths',
      title: 'Three words in, four out',
      codeTitle: 'translate.py',
      code: `
        src = ['je', 'suis', 'étudiant']  #@src
        tgt = ['I', 'am', 'a', 'student'] #@tgt
        # one RNN: 3 outputs, not 4       #@one
        # read it all, then write         #@two
      `,
      beats: [
        { id: 'task', say: 'Translate the French je suis étudiant, and you get I am a student: three words in, four out. No word-for-word rule can do that.', code: ['src', 'tgt'] },
        { id: 'one', say: 'A recurrent neural network, an {RNN|R N N}, makes one output per token it reads, like a language model guessing at every step. Three tokens in, three out: the fourth word has nowhere to go.', code: 'one' },
        { id: 'two', say: 'The way around it is two RNNs: the first reads the whole input, and only then does the second write the output, for as many steps as it needs.', code: 'two' },
        { id: 'teams', say: 'In 2014, two teams built this for translation: Kyunghyun Cho and colleagues, who called it an RNN encoder-decoder, and Ilya Sutskever, Oriol Vinyals and Quoc Le.', code: 'two' },
        { id: 'name', say: 'Sutskever\'s paper, Sequence to Sequence Learning, gave the idea its name: {seq2seq|seek two seek}, short for sequence to sequence.', code: ['src', 'tgt'] },
      ],
    },
    {
      id: 'readwrite',
      title: 'Read, then write',
      codeTitle: 'seq2seq.py',
      code: `
        h = encoder(src)  # H numbers     #@enc
        tok = '<start>'                   #@start
        while tok != '<end>':             #@loop
            h, p = decoder_step(h, tok)   #@loop
            tok = vocab[p.argmax()]       #@loop
        # I, am, a, student, <end>        #@out
      `,
      beats: [
        { id: 'enc', say: 'The first RNN, the encoder, reads the French one token per step, passing its memory, h, along.', code: 'enc' },
        { id: 'h', say: 'After the last token, h is the encoder\'s final state: {H|capital H} numbers, one per hidden unit, that must hold the whole sentence.', code: 'enc' },
        { id: 'code', say: 'To encode is to put into a code: the sentence becomes a code of {H|capital H} numbers. The second RNN, the decoder, turns that code back out as words.', code: 'enc' },
        { id: 'start', say: 'The decoder starts from h. Nothing is written yet, so its first input is a start token.', code: 'start' },
        { id: 'first', say: 'Like a language model, it gives every token in its vocabulary a probability, and writes the most likely one, the argmax: I.', code: 'loop' },
        { id: 'feed', say: 'Each word it writes becomes its next input. Reading I, it writes am; then the word a; then student.', code: 'loop' },
        { id: 'end', say: 'It stops when it writes the end token, which is in its vocabulary too. That is what lets the output be any length.', code: ['loop', 'out'] },
        { id: 'count', say: 'So count the decoder\'s steps: four words, plus the end token, makes five.', code: 'out' },
        { id: 'reads', say: 'It also reads five tokens: the start token and the four words. The start token is only read, and the end token only written.', code: 'loop' },
        { id: 'total', say: 'Add the encoder\'s three steps, and the whole translation takes eight.', code: ['enc', 'out'] },
      ],
    },
    {
      id: 'train',
      title: 'Teacher forcing',
      codeTitle: 'train.py',
      code: `
        ins  = '<start> I am a student'  #@ins
        outs = 'I am a student <end>'    #@outs
        # 5 steps, 5 targets, 5 losses   #@outs
        # training: read the true word   #@tf
        # test time: read its own guess  #@test
      `,
      beats: [
        { id: 'training', say: 'Now training: nudging every weight, a little at a time, downhill on the loss. The model learns from sentence pairs with known translations.', code: ['ins', 'outs'] },
        { id: 'targets', say: 'Every decoder step has a right answer, the next word of the true translation, and its guess is scored with cross-entropy: five losses for this pair.', code: 'outs' },
        { id: 'mistake', say: 'Count the steps from zero, and say step one guesses was, instead of am. That step pays its loss. But what should step two read?', code: 'outs' },
        { id: 'tf', say: 'In training, it reads the true word, am, not its own guess, so one early mistake cannot throw off the rest of the sentence.', code: 'tf' },
        { id: 'name', say: 'The true translation acts as a teacher, forcing the right word in at every step: so this is called teacher forcing. Ronald Williams and David Zipser named it in 1989.', code: 'tf' },
        { id: 'test', say: 'At test time, the trained model meets new sentences with no translation given, so the decoder reads its own last guess, right or wrong.', code: 'test' },
      ],
    },
    {
      id: 'squeeze',
      title: 'One vector for everything',
      codeTitle: 'bottleneck.py',
      code: `
        h = encoder(short)  # H numbers  #@short
        h = encoder(long)   # H numbers  #@long
        # 3 words or 50: the same size   #@same
      `,
      beats: [
        { id: 'squeeze', say: 'One weakness is left. All the decoder knows of the input comes through h: the same {H|capital H} numbers, for three words or fifty.', code: ['short', 'long'] },
        { id: 'cho', say: 'Later in 2014, Cho and colleagues measured the cost: their translations got rapidly worse as sentences grew longer.', code: 'same' },
        { id: 'bottle', say: 'Like the narrow neck of a bottle, that one vector limits what gets through: it is the bottleneck.', code: 'same' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
