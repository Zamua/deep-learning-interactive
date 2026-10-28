import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gpt',
  title: 'A decoder-only language model',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'job' },
    { who: 'Liu, Saleh, Pot, Goodrich, Sepassi, Kaiser & Shazeer', year: 2018, title: 'Generating Wikipedia by Summarizing Long Sequences', url: 'https://arxiv.org/abs/1801.10198', scene: 'job' },
    { who: 'Radford, Narasimhan, Salimans & Sutskever', year: 2018, title: 'Improving Language Understanding by Generative Pre-Training', url: 'https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf', scene: 'job' },
  ],
  scenes: [
    {
      id: 'job',
      title: 'Predict every next token',
      codeTitle: 'gpt.py',
      code: `
        text = 'cats like fresh fish daily'  #@text
        toks = text.split()     # 5 tokens   #@text
        xs, ys = toks[:-1], toks[1:]         #@shift
        # xs: cats like fresh fish           #@shift
        # ys: like fresh fish daily          #@shift
        # position t sees 0 to t, never t+1  #@causal
      `,
      beats: [
        { id: 'job', say: 'A language model reads text and predicts what comes next. Take the text cats like fresh fish daily.', code: 'text' },
        { id: 'shift', say: 'After cats comes like. After cats like comes fresh. The targets are the text itself, shifted by one.', code: 'shift' },
        { id: 'once', say: 'A recurrent network worked through this one step at a time. This model makes all four predictions at once, in a single pass.', code: 'shift' },
        { id: 'peek', say: 'But at once, the answers sit right there in the input. Position one, reading like, could simply look ahead at fresh and copy it.', code: 'shift' },
        { id: 'causal', say: 'So each position may see only itself and what came before. That rule is called causal, as in cause and effect: a later token can never change what an earlier position says.', code: 'causal' },
        { id: 'decoder', say: 'The Transformer, in 2017, was built for translation, with an encoder and a decoder like the recurrent ones before it. The encoder read the source sentence, and the decoder wrote the translation one token at a time, under exactly this rule.', code: 'causal' },
        { id: 'only', say: 'A language model has no source sentence to read, so it keeps only the decoder. In 2018, Peter Liu and colleagues used such a decoder-only model to write Wikipedia articles.', code: 'causal' },
        { id: 'gpt', say: 'That same year, Alec Radford and colleagues at OpenAI trained one on over seven thousand unpublished books. It came to be called GPT, for generative pre-trained transformer: a transformer, trained on plain text, that generates more of it.', code: 'text' },
      ],
    },
    {
      id: 'stack',
      title: 'Built from the bottom up',
      codeTitle: 'gpt.py',
      code: `
        ids = [3, 8, 5, 2]   # (T,) = (4,)   #@ids
        x = E[ids]           # (4, d)        #@embed
        x = x + pos[:4]      # still (4, d)  #@pos
        for block in blocks: # N blocks      #@blocks
            x = block(x)     # (4, d) again  #@blocks
        # position 2 sees 0, 1, 2; never 3   #@causal
      `,
      beats: [
        { id: 'ids', say: 'Now build it, from the bottom up. The four tokens come in as ids: a list of T numbers, and here T is four.', code: 'ids' },
        { id: 'embed', say: 'Each id becomes its row of the embedding table, E. That gives x: T vectors of d numbers, T by d.', code: 'embed' },
        { id: 'pos', say: 'Attention cannot tell where a token sits, so each position adds a learned vector of its own. The shape stays T by d.', code: 'pos' },
        { id: 'blocks', say: 'Then come N transformer blocks, one after another. Each takes T by d and hands back T by d, so they stack.', code: 'blocks' },
        { id: 'causal', say: 'In every block, attention is causal: the mask hides every later position. Position two looks back at zero and one, and at itself, but never ahead at three.', code: 'causal' },
        { id: 'why', say: 'So no position can see the token it must predict, and all T positions still run at once.', code: 'causal' },
      ],
    },
    {
      id: 'out',
      title: 'A prediction at every position',
      codeTitle: 'gpt.py',
      code: `
        s = x @ W_U.T    # (4, V): scores   #@unembed
        p = softmax(s)   # (4, V): probs    #@probs
        # row t predicts token t + 1        #@shift
        # 4 tokens in, 4 predictions out    #@count
        p_y = [0.5, 0.4, 0.6, 0.8]          #@py
        L = -np.log(p_y).sum()   # 2.34     #@loss
      `,
      beats: [
        { id: 'unembed', say: 'At the top, the unembedding scores every vocabulary token at every position: T by d becomes T by V.', code: 'unembed' },
        { id: 'softmax', say: 'A softmax on each row turns its scores into probabilities for the next token.', code: 'probs' },
        { id: 'shift', say: 'Row zero has read only cats, and puts the most on like. Row one puts it on fresh, and row two on fish.', code: 'shift' },
        { id: 'last', say: 'Row three has read all four, so it predicts the token after fish: here, daily. At the end of a text, that last row is the next word to write.', code: 'shift' },
        { id: 'count', say: 'So T tokens in give T predictions out, all from one pass through the model. A batch of B texts gives B times T.', code: 'count' },
        { id: 'loss', say: 'Every prediction has a target, so every one gets a cross-entropy loss. Training adds up all four: four lessons from a single pass.', code: ['py', 'loss'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
