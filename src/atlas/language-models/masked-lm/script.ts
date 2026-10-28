import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-masked-lm',
  title: 'Masked language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Taylor', year: 1953, title: '"Cloze procedure": a new tool for measuring readability', url: 'https://doi.org/10.1177/107769905303000401', scene: 'bert' },
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'bert' },
    { who: 'Devlin, Chang, Lee & Toutanova', year: 2018, title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', url: 'https://arxiv.org/abs/1810.04805', scene: 'bert' },
  ],
  scenes: [
    {
      id: 'blank',
      title: 'Fill the blank',
      codeTitle: 'blank.py',
      code: `
        toks = 'the cat sat on a mat'.split()  #@toks
        # causal: 'sat' from 'the cat'         #@causal
        # no causal mask: sat sees sat         #@peek
        toks[2] = '[MASK]'    # hide it        #@mask
        # loss: 'sat', at position 2           #@recover
      `,
      beats: [
        { id: 'blank', say: 'Here is a sentence with a word missing: the cat, blank, on a mat. You can fill it in at once: sat. And to do it, you used the words on both sides of the gap.', code: 'toks' },
        { id: 'causal', say: 'A causal model like GPT cannot do that. Each position sees only itself and what came before it, so at the gap it has two words to go on: the, and cat. On a mat, the best clue, stays hidden.', code: 'causal' },
        { id: 'peek', say: 'So why not drop the causal mask, and let every position read both sides? Then the answer sits right there in the input: the position that must predict sat can read sat itself, and copy it.', code: 'peek' },
        { id: 'mask', say: 'The fix is to hide the answer in the input instead. Swap sat for a special token, {[MASK]|the mask token}, which says only: a word goes here. Now every position can read both sides, and the answer is nowhere in sight.', code: 'mask' },
        { id: 'recover', say: 'Then train the model to recover the hidden word from everything around it. That is a masked language model: masked, because its training hides words behind that token.', code: 'recover' },
      ],
    },
    {
      id: 'bert',
      title: 'From a reading test to BERT',
      codeTitle: 'bert.py',
      code: `
        # 1953: blank out words, then    #@cloze
        # count how many readers fill    #@cloze
        # 2018, BERT: hide 15% at random #@bert
        # B: bidirectional, both sides   #@name
        # E: encoder, no causal mask     #@enc
      `,
      beats: [
        { id: 'cloze', say: 'Filling blanks is an old test. In 1953, Wilson Taylor blanked out words in a passage, and counted how many of them readers could fill back in, to measure how easy the passage was to read.', code: 'cloze' },
        { id: 'closure', say: 'He called it a cloze test, from closure: the way the eye completes a circle that has a gap in it.', code: 'cloze' },
        { id: 'bert', say: 'In 2018, Jacob Devlin and colleagues at Google turned the test into training, and said it was their inspiration. Their model, BERT, picked fifteen percent of the tokens in each sequence at random, hid them, and learned to recover them.', code: 'bert' },
        { id: 'name', say: 'BERT stands for bidirectional encoder representations from transformers. Bidirectional, because every position reads in both directions, left and right.', code: 'name' },
        { id: 'enc', say: 'Encoder, because it is the encoder half of the 2017 Transformer: the half that read the whole source sentence, with no causal mask. GPT kept the other half, the decoder.', code: 'enc' },
      ],
    },
    {
      id: 'jobs',
      title: 'Fewer losses, different jobs',
      codeTitle: 'jobs.py',
      code: `
        int(0.15 * 200)  # masked: 30 losses #@count
        200              # causal: 200       #@fewer
        # position 2 of 6 attends to:        #@attend
        causal = 3       # 0, 1 and 2        #@attend
        masked = 6       # all six           #@all
        # write left to right: causal        #@generate
        # fill a blank: masked               #@fill
      `,
      beats: [
        { id: 'count', say: 'Only the hidden tokens are scored. In a sequence of two hundred tokens, fifteen percent is thirty: thirty losses.', code: 'count' },
        { id: 'fewer', say: 'A causal model predicts every next token, so the same sequence gives it two hundred.', code: 'fewer' },
        { id: 'attend', say: 'In attention terms: in a sequence of six, position two of a causal model attends to three positions, itself and the two before it.', code: 'attend' },
        { id: 'all', say: 'In a masked model, it attends to all six.', code: 'all' },
        { id: 'generate', say: 'Generating text means writing one token at a time, with nothing yet on the right. That is exactly the causal model\'s training task, so causal models are the ones that write.', code: 'generate' },
        { id: 'fill', say: 'Filling a blank in the middle, with words on both sides, is the masked model\'s task: the cat, blank, on a mat.', code: 'fill' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
