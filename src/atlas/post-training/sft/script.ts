import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sft',
  title: 'Supervised fine-tuning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'chat',
      title: 'A conversation is one sequence',
      codeTitle: 'sft.py',
      code: `
        chat = '<user> capital of peru ?'   #@user
        chat += ' <asst> lima . <end>'      #@asst
        tokens = chat.split()   # 9 tokens  #@user,asst
        p_tok = model(tokens)   # p of each #@p
      `,
      beats: [
        { id: 'model', say: 'Start from a pretrained language model: at every position of a text, it predicts the next token.', code: 'p' },
        { id: 'chat', say: 'To turn it into an assistant, train it further on conversations, each written out as one sequence of tokens.', code: ['user', 'asst'] },
        { id: 'markers', say: 'A marker opens each turn: user, then the question; assistant, then the reply. An end token closes the reply.', code: ['user', 'asst'] },
        { id: 'predict', say: 'Run the model over all of it, and it predicts every token from the ones before, exactly as in pretraining.', code: 'p' },
        { id: 'problem', say: 'Grade every one of those predictions, and the model also learns to write the user\'s questions. We only want it to learn the replies.' },
      ],
    },
    {
      id: 'mask',
      title: 'Grade only the reply',
      codeTitle: 'sft.py',
      code: `
        mask = [0, 0, 0, 0, 0, 0, 1, 1, 1]           #@mask
        # a system prompt, if any: mask 0            #@system
        nll = -np.log(p_tok)   # one loss per token  #@nll
        # graded: 0.69, 0.22, 0.11                   #@nll
        loss = (mask * nll).sum() / mask.sum()       #@loss
        # 1.02 / 3 = 0.34                            #@loss
      `,
      beats: [
        { id: 'mask', say: 'So give every token a mask, m: one on the tokens the assistant wrote, and zero on everything else, both markers included.', code: 'mask' },
        { id: 'end', say: 'The end token gets a one too. It is part of the reply, and predicting it is how the model learns when to stop.', code: 'mask' },
        { id: 'context', say: 'The masked tokens stay in the input. The model still reads the question; it is just not graded on predicting it.', code: 'mask' },
        { id: 'system', say: 'Some conversations open with a system prompt: instructions for the assistant, such as be brief, written before the first user turn. It is context too, so like the user\'s words, its tokens get a zero.', code: 'system' },
        { id: 'nll', say: 'Each graded token adds minus the log of the probability the model gave it. Lima got {0.5|zero point five}, the full stop {0.8|zero point eight}, and the end token {0.9|zero point nine}: losses of {0.69|zero point six nine}, {0.22|zero point two two} and {0.11|zero point one one}.', code: 'nll' },
        { id: 'mean', say: 'The loss, L, is their average: add up {mₜ|m t} times minus log {pₜ|p t} over every position t, and divide by the number of ones in the mask, three, not by all nine tokens: {0.34|zero point three four}.', code: 'loss' },
        { id: 'lr', say: 'Then train as when fine-tuning any pretrained network, with a small learning rate, so the model keeps what it already knows.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
