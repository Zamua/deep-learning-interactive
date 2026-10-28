import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sampling',
  title: 'Sampling and temperature',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Holtzman, Buys, Du, Forbes & Choi', year: 2019, title: 'The curious case of neural text degeneration', url: 'https://arxiv.org/abs/1904.09751', scene: 'pick' },
    { who: 'Shannon', year: 1948, title: 'A mathematical theory of communication', url: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x', scene: 'pick' },
    { who: 'Karpathy', year: 2015, title: 'The unreasonable effectiveness of recurrent neural networks', url: 'https://karpathy.github.io/2015/05/21/rnn-effectiveness/', scene: 'limits' },
  ],
  scenes: [
    {
      id: 'write',
      title: 'One token at a time',
      codeTitle: 'generate.py',
      code: `
        text = ['I', 'fed', 'my']      #@text
        for step in range(2):          #@loop
            # the model reads text: s  #@p
            p = softmax(s)             #@p
            i = ...      # pick: how?  #@pick
            text.append(VOCAB[i])      #@add
      `,
      beats: [
        { id: 'predict', say: 'A language model only predicts. Given “I fed my”, it gives every token in its vocabulary a probability of coming next.', code: ['text', 'p'] },
        { id: 'loop', say: 'To write, pick one token, add it to the end, and feed the longer text back in. Then predict again, one token at a time. That loop is called generating.', code: ['loop', 'add'] },
        { id: 'decode', say: 'Each turn rests on one choice: which token to take. Making it is called decoding, reading the model\'s numbers back out as words.', code: 'pick' },
      ],
    },
    {
      id: 'pick',
      title: 'Greedy, or sample',
      codeTitle: 'pick.py',
      code: `
        VOCAB = ['cat', 'dog', 'fish']   #@s
        s = np.array([2, 1, 0])          #@s
        p = softmax(s)  # [0.67 0.24 0.09] #@s
        p.argmax()      # 0: cat, always #@greedy
        np.random.choice(3, p=p) # 0, 1, 2 #@sample
      `,
      beats: [
        { id: 'scores', say: 'Say the model weighs three tokens: cat, dog and fish, with ids zero, one and two, and scores two, one and zero. Softmax gives cat about two thirds.', code: 's' },
        { id: 'greedy', say: 'The simplest decoding takes the tallest bar, the argmax: cat, every time. It is called greedy because it grabs what looks best right now, with no thought for later.', code: 'greedy' },
        { id: 'dull', say: 'So greedy text repeats itself. In 2019, Ari Holtzman and colleagues showed that decoding for the most likely words gives text that is bland and strangely repetitive.', code: 'greedy' },
        { id: 'sample', say: 'The other way is to sample: pick at random, with those probabilities. Lay the bars end to end, so together they span exactly one, and throw a dart. It lands on cat about two times in three.', code: 'sample' },
        { id: 'shannon', say: 'That is how Claude Shannon wrote fake English in 1948, in A Mathematical Theory of Communication: each word picked at random, by how often it follows the word before.', code: 'sample' },
        { id: 'book', say: 'His dart was a book: open it anywhere, read on to the last word written, and copy the word after it.', code: 'sample' },
      ],
    },
    {
      id: 'temp',
      title: 'A temperature dial',
      codeTitle: 'temperature.py',
      code: `
        p = softmax(s / T)                 #@formula
        s / 0.5           # [4, 2, 0]      #@double
        softmax(s / 0.5)  # [0.87 0.12 0.02] #@low
        softmax(s / 1)    # [0.67 0.24 0.09] #@one
        softmax(s / 2)    # [0.51 0.31 0.19] #@high
      `,
      beats: [
        { id: 'dial', say: 'Between safe and varied, a temperature, T, sets where to stand: divide every score by T before the softmax.', code: 'formula' },
        { id: 'name', say: 'The name comes from physics, where the chance of a state goes as e to the minus its energy, over the temperature: softmax, with the score as minus the energy. Heated, a system spreads over many states. Cooled, it settles into the lowest.', code: 'formula' },
        { id: 'gaps', say: 'Dividing matters because softmax only sees the gaps between the scores, and dividing stretches or shrinks every gap.', code: 'formula' },
        { id: 'cold', say: 'Cool it to T equals one half, and the scores double: four, two and zero.', code: 'double' },
        { id: 'cold-p', say: 'e to the four, about fifty five, out of a total near sixty three, gives cat {0.87|zero point eight seven}: sharper, closer to greedy.', code: 'low' },
        { id: 'hot', say: 'Heat it to T equals two, and the scores halve. The bars flatten, and cat falls to about a half.', code: 'high' },
        { id: 'order', say: 'Either way, cat stays on top. Dividing by the same positive T keeps the order, so greedy still picks id zero.', code: ['low', 'one', 'high'] },
      ],
    },
    {
      id: 'limits',
      title: 'Freezing and boiling',
      codeTitle: 'limits.py',
      code: `
        softmax(s / 0.01)  # [1. 0. 0.]    #@zero
        # T toward 0: greedy, the argmax   #@zero
        softmax(s / 1000) # [0.33 0.33 0.33] #@inf
        # T without limit: 1/3 each        #@inf
      `,
      beats: [
        { id: 'freeze', say: 'Push T toward zero, and the gaps stretch without limit. Cat takes everything: greedy, again.', code: 'zero' },
        { id: 'karpathy', say: 'In 2015, Andrej Karpathy did this to a model that wrote one character at a time, trained on Paul Graham\'s essays. It wrote “is that they were all the same thing that was a startup”, over and over.', code: 'zero' },
        { id: 'boil', say: 'Push T up without limit, and every gap shrinks to nothing. Each token gets a third: uniform, all equally likely, like a fair die.', code: 'inf' },
        { id: 'between', say: 'In between, Karpathy found, a lower T writes more cautiously, and a higher one with more variety and more mistakes.', code: ['zero', 'inf'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
