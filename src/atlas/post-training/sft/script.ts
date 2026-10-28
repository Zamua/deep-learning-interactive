import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sft',
  title: 'Supervised fine-tuning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ouyang et al.', year: 2022, title: 'Training language models to follow instructions with human feedback', url: 'https://arxiv.org/abs/2203.02155', scene: 'ask' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'A model that only continues',
      codeTitle: 'prompt.py',
      code: `
        prompt = 'capital of peru ?'  #@prompt
        # pretrained, it continues:   #@cont
        #   capital of chile ? ...    #@cont
        # an assistant answers:       #@want
        #   lima .                    #@want
      `,
      beats: [
        { id: 'pretrained', say: 'Start from a pretrained language model, such as GPT. Trained on plain text to predict the next token, it does one thing: it continues the text it is given.' },
        { id: 'prompt', say: 'That text is called the prompt: it prompts the model to go on, the way a cue prompts an actor. Give it the prompt {capital of peru ?|capital of Peru?}', code: 'prompt' },
        { id: 'quiz', say: 'On the web, a question like that often sits in a list of quiz questions. So the model may simply carry on the list: {capital of chile ?|capital of Chile?}', code: 'cont' },
        { id: 'assistant', say: 'We want an assistant instead: a model that answers the person asking, here with Lima. Continuing web text is a different job from doing what someone asks.', code: 'want' },
        { id: 'ouyang', say: 'In 2022, Long Ouyang and colleagues at OpenAI made that point, and hired labelers to write the reply they wanted for each of about thirteen thousand prompts.', code: 'want' },
        { id: 'tune', say: 'Then they fine-tuned GPT-3, a much larger GPT, on those replies: they kept training it from its pretrained weights, just as with an image network.' },
        { id: 'name', say: 'Each reply is a right answer that a person wrote down, like the label on a photo, and learning from given right answers is called supervised. So this is supervised fine-tuning: {SFT|S F T}.' },
      ],
    },
    {
      id: 'sequence',
      title: 'One conversation, one sequence',
      codeTitle: 'sft.py',
      code: `
        chat = '<user> capital of peru ?' #@user
        chat += ' <asst> lima . <end>'    #@asst
        tokens = chat.split()  # 9        #@split
        p = model(tokens)  # p per token  #@p
        nll = -np.log(p)   # each loss    #@nll
      `,
      beats: [
        { id: 'write', say: 'To train on a conversation, write it out as one sequence of tokens: the question, then the reply. Nine tokens in all.', code: ['user', 'asst', 'split'] },
        { id: 'markers', say: 'Marker tokens say who is speaking. User, for the person asking, opens the question; assistant opens the reply; and end closes it. They come from a fixed template.', code: ['user', 'asst'] },
        { id: 'predict', say: 'Run the model over all nine, as in pretraining: it predicts each token from the ones before it.', code: 'p' },
        { id: 'bars', say: 'So every token after the first gets a loss, minus the log of the probability it was given, drawn here as a bar.', code: 'nll' },
        { id: 'problem', say: 'The tallest bars are the question\'s: nobody can guess what will be asked. Grade them all, and much of the lesson teaches the model to write questions: exactly the habit to break.', code: 'nll' },
      ],
    },
    {
      id: 'mask',
      title: 'Grade only the reply',
      codeTitle: 'sft.py',
      code: `
        mask = [0, 0, 0, 0, 0, 0, 1, 1, 1] #@mask
        kept = mask * nll                  #@kept
        # 0.69, 0.22, 0.11 are left        #@kept
        loss = kept.sum() / mask.sum()     #@loss
        # 1.02 / 3 = 0.34                  #@loss
      `,
      beats: [
        { id: 'mask', say: 'So give each token a mask, m: a one if the assistant wrote it, and a zero if not.', code: 'mask' },
        { id: 'markers', say: 'The question gets zeros, and so do both markers: the template put them there, not the assistant.', code: 'mask' },
        { id: 'end', say: 'The end token gets a one. The assistant writes it when its reply is done, and predicting it is how the model learns to stop.', code: 'mask' },
        { id: 'off', say: 'Multiply each loss by its mask, and the question\'s bars switch off. Three are left: the reply\'s.', code: 'kept' },
        { id: 'context', say: 'The question stays in the input: the model reads it in order to answer, and is just not graded on it.', code: 'mask' },
        { id: 'lima', say: 'Lima was given a probability of {0.5|zero point five}, so its loss is minus ln {0.5|zero point five}: about {0.69|zero point six nine}.', code: 'kept' },
        { id: 'rest', say: 'The full stop\'s loss is {0.22|zero point two two}, and the end token\'s is {0.11|zero point one one}. The three add up to {1.02|one point oh two}.', code: 'kept' },
        { id: 'mean', say: 'The loss, L, is their average: divide by three, the number of ones in the mask, and not by all nine tokens. That gives about {0.34|zero point three four}.', code: 'loss' },
        { id: 'why', say: 'Dividing by the ones makes L the average cost of one reply token, however long the question was.', code: 'loss' },
        { id: 'formula', say: 'In symbols: L is the sum, over every position t, of {mₜ|m t} times minus ln {pₜ|p t}, divided by the sum of the mask.', code: 'loss' },
      ],
    },
    {
      id: 'longer',
      title: 'Every reply, and only replies',
      codeTitle: 'count.py',
      code: `
        turns = [                    #@sys
          ('system', 24, 0),         #@sys
          ('user',   12, 0),         #@u
          ('reply',  20, 1),         #@a
          ('user',    8, 0),         #@u
          ('reply',  10, 1)]         #@a
        graded = 20 + 10  # 30 of 74 #@count
      `,
      beats: [
        { id: 'system', say: 'Some conversations open with a system prompt: instructions written before the first question, such as be brief. It is context too, so its tokens all get zeros.', code: 'sys' },
        { id: 'turns', say: 'A longer conversation takes turns: question, reply, question, reply. The assistant wrote every reply, so every reply gets ones, its own end token included.', code: ['u', 'a'] },
        { id: 'count', say: 'Here the replies have twenty tokens and ten. Twenty plus ten: thirty of the seventy-four tokens carry loss.', code: 'count' },
        { id: 'lr', say: 'Then train as when fine-tuning any pretrained network: with a small learning rate, so the model keeps what pretraining taught it.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
