import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-seq2seq',
  title: 'Encoder and decoder',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'readwrite',
      title: 'Read, then write',
      codeTitle: 'seq2seq.py',
      code: `
        h = encoder(['je', 'suis', 'étudiant'])  #@enc
        tok = '<start>'                          #@start
        while tok != '<end>':                    #@loop
            h, p = decoder_step(h, tok)          #@loop
            tok = vocab[p.argmax()]              #@loop
        # I, am, a, student, <end>               #@out
      `,
      beats: [
        { id: 'task', say: 'Some tasks turn one sequence into another of a different length. Translation, say: je suis étudiant becomes I am a student.', code: 'out' },
        { id: 'enc', say: 'An encoder RNN reads the input, one token per step. Its final state sums up the whole sentence in a single vector.', code: 'enc' },
        { id: 'dec', say: 'A second RNN, the decoder, starts from that vector. It reads a start token and predicts the first word: I.', code: ['start', 'loop'] },
        { id: 'feed', say: 'Each predicted word is fed back in to predict the next one: am, a, student.', code: 'loop' },
        { id: 'end', say: 'Until it predicts the end token. Four words, plus the end: five decoder steps.', code: 'out' },
      ],
    },
    {
      id: 'train',
      title: 'Teacher forcing, and a bottleneck',
      codeTitle: 'train.py',
      code: `
        xs = ['<start>', 'I', 'am', 'a', 'student']   #@tf
        ys = ['I', 'am', 'a', 'student', '<end>']     #@tf
        # 5 predictions, each scored on its target   #@loss
        # test time: read back its own guesses        #@test
      `,
      beats: [
        { id: 'tf', say: 'In training, the decoder reads the true previous word, not its own guess. That is teacher forcing: one early mistake cannot derail the rest of the sentence.', code: 'tf' },
        { id: 'loss', say: 'Every step has a right answer, the next word of the target, so one sentence pair gives five predictions to score.', code: 'loss' },
        { id: 'test', say: 'At test time there is no true word to read, so the decoder reads its own last prediction instead.', code: 'test' },
        { id: 'bottleneck', say: 'One weakness remains: everything about the input must squeeze through that one final vector, whether the sentence has three words or fifty.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
