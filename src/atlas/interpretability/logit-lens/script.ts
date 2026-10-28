import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-logit-lens',
  title: 'The logit lens',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'nostalgebraist', year: 2020, title: 'interpreting GPT: the logit lens', url: 'https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens', scene: 'ask' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'What would it say so far?',
      codeTitle: 'lens.py',
      code: `
        x = embed[tok]         # x₀         #@x0
        guess = [W_U @ x]      # lens at x₀ #@lens
        for write in writes:   # per block  #@loop
            x = x + write                   #@loop
            guess.append(W_U @ x)  # lens   #@lens
        scores = W_U @ x       # the top    #@top
      `,
      beats: [
        { id: 'read', say: 'A language model reads “the capital of Italy is”, and has to guess the next word. Follow the last word up through the model: its vector, the residual stream, rises past one block after another.', code: ['x0', 'loop'] },
        { id: 'top', say: 'Only at the very top does the model answer. The unembedding, {W_U|W U}, gives every token a score, its logit, and Rome\'s is the highest.', code: 'top' },
        { id: 'ask', say: 'In between, the stream is just a list of numbers, with no labels on them. So ask a simpler question: if the model stopped halfway up, what would it say?', code: 'loop' },
        { id: 'same', say: 'The stream halfway up is the same kind of vector as at the top: {x₀|x zero} plus the writes so far, just as wide. Only the later blocks\' writes are missing.', code: 'loop' },
        { id: 'lens', say: 'So read it with the same {W_U|W U}. Do that at every height, and you see the model\'s guess so far, block by block.', code: 'lens' },
        { id: 'name', say: 'This is the logit lens. Logit, because what it reads out is logits. A lens, because it is a way of looking inside the model.', code: 'lens' },
        { id: 'borrow', say: 'Nothing new is trained: the lens borrows the model\'s own {W_U|W U}, just as it is.', code: ['lens', 'top'] },
        { id: 'history', say: 'A writer known online as nostalgebraist named it, in a 2020 post about {GPT-2|G P T two}, a model with {48|forty-eight} blocks. Read after its twelfth block, or its thirty-third, the stream already made sense as a guess.', code: 'lens' },
        { id: 'forms', say: 'The early guesses were generally wrong, but often sensible in some way, and they sharpened, block by block, toward the final answer. Here: a capital, then a city in Italy, then Rome.', code: 'lens' },
      ],
    },
    {
      id: 'example',
      title: 'Watch a guess form',
      codeTitle: 'example.py',
      code: `
        W_U = np.array([[2, 0],  # Paris  #@wu
                        [1, 1],  # Milan  #@wu
                        [0, 2]]) # Rome   #@wu
        x = np.array([1, 0])     # x₀     #@x0
        W_U @ x   # [2, 1, 0]: Paris      #@s0
        x = x + [-1, 2]          # [0, 2] #@x1
        W_U @ x   # [0, 2, 4]: Rome       #@s1
      `,
      beats: [
        { id: 'setup', say: 'Now with numbers. A tiny model reads the same words. Its stream is two numbers wide, and three tokens matter: Paris, Milan and Rome. Here is each one\'s row of {W_U|W U}.', code: 'wu' },
        { id: 'x0', say: 'At the bottom, the stream is {x₀|x zero}: one, zero.', code: 'x0' },
        { id: 'dot', say: 'Paris\'s row is two, zero. Dotted with the stream: two times one, plus zero times zero, makes two.', code: 's0' },
        { id: 'rest', say: 'Milan scores one, and Rome zero. So at the bottom, the lens says Paris: a capital, but the wrong one.', code: 's0' },
        { id: 'write', say: 'Block zero writes minus one, two. Added in, the stream becomes zero, two.', code: 'x1' },
        { id: 'again', say: 'Read it again with the same rows. Now Paris scores zero, Milan two, and Rome four. After block zero, the lens says Rome.', code: 's1' },
        { id: 'later', say: 'Every write still to come can change which token is on top. So a lens partway up shows the prediction so far, and only so far.', code: 'x1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
