import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vision-language',
  title: 'Vision-language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'patches',
      title: 'An image as patch vectors',
      codeTitle: 'image.py',
      code: `
        img.shape             # (336, 336, 3)   #@img
        per_side = 336 // 14  # 24              #@count
        N = per_side ** 2     # 576             #@count
        v = vit(img)          # (577, 1024)     #@vit
        v = v[1:]             # (576, 1024)     #@drop
      `,
      beats: [
        { id: 'img', say: 'A language model reads one vector per token. To show it a picture, make the picture vectors too. Take an image of {336 × 336|three thirty six by three thirty six} pixels.', code: 'img' },
        { id: 'count', say: 'Cut it into patches of fourteen pixels: {336 / 14|three thirty six over fourteen} is twenty four per side, and twenty four times twenty four is five hundred and seventy six patches.', code: 'count' },
        { id: 'vit', say: 'A vision transformer, already trained, turns each patch into a vector, here of {1,024|one thousand and twenty four} numbers.', code: 'vit' },
        { id: 'drop', say: 'Keep only the patch vectors, all five hundred and seventy six, and leave out the class token.', code: 'drop' },
      ],
    },
    {
      id: 'project',
      title: 'Into the prompt',
      codeTitle: 'prompt.py',
      code: `
        W = np.random.randn(1024, 4096)        #@W
        b = np.zeros(4096)                     #@W
        tok = v @ W + b       # (576, 4096)    #@W
        # 1024 * 4096 + 4096 = 4,198,400       #@count
        x = np.vstack([tok, E[ids]])  # image first  #@prompt
        reply = gpt(x)        # next tokens    #@read
      `,
      beats: [
        { id: 'width', say: 'The language model has its own width, d: here {4,096|four thousand and ninety six}. Its word vectors are that long, and the patch vectors are not.' },
        { id: 'W', say: 'So a projection maps each one across: a learned matrix, W, of {1,024 × 4,096|one thousand and twenty four by four thousand and ninety six}, plus a bias.', code: 'W' },
        { id: 'count', say: 'Every patch shares it: {1,024 × 4,096|one thousand and twenty four times four thousand and ninety six} weights, plus {4,096|four thousand and ninety six} biases. About {4.2|four point two} million parameters.', code: 'count' },
        { id: 'mlp', say: 'Some models use a small MLP instead, two maps with an activation between, counted like any MLP.', code: 'count' },
        { id: 'prompt', say: 'The projected vectors are the image tokens. They go into the prompt first, and the text\'s embeddings follow.', code: 'prompt' },
        { id: 'read', say: 'From there it is a plain decoder-only model. Each text token attends back to every image token, and the reply comes one token at a time.', code: 'read' },
      ],
    },
    {
      id: 'train',
      title: 'Two stages of training',
      codeTitle: 'train.py',
      code: `
        # stage 1: images with captions             #@s1
        params = [W, b]       # vit and gpt frozen  #@s1
        # loss: next-token cross-entropy on caption #@loss
        # stage 2: images, questions, answers       #@s2
        params = [W, b] + gpt.params  # vit frozen  #@s2
      `,
      beats: [
        { id: 's1', say: 'Training comes in two stages. In stage one, both models are frozen, and only the projection learns, on images paired with captions.', code: 's1' },
        { id: 'loss', say: 'The language model must predict each caption from the image tokens, with the usual cross-entropy. Only W can move, so it learns to make vectors the language model already understands.', code: 'loss' },
        { id: 's2', say: 'In stage two, the language model trains with the projection, on instructions: an image, a question, and a good answer. The vision transformer stays frozen.', code: 's2' },
      ],
    },
    {
      id: 'try',
      title: 'The cost in context, then try one',
      codeTitle: 'budget.py',
      code: `
        T_max = 2048                    #@window
        T_max - 576       # 1472 for text  #@window
        img.shape         # (224, 224, 3)  #@p1
        (224 // 14) ** 2  # 16 * 16 = 256  #@a1
        T_max - 256       # 1792           #@a2
      `,
      beats: [
        { id: 'window', say: 'Image tokens take room. If the model reads at most {Tₘₐₓ|T max} tokens, say {2,048|twenty forty eight}, this image leaves {1,472|fourteen seventy two} for text.', code: 'window' },
        { id: 'p1', say: 'Try one. A {224 × 224|two twenty four by two twenty four} image comes in fourteen pixel patches. How many image tokens does it give?', code: 'p1' },
        { id: 'a1', say: 'Two twenty four over fourteen is sixteen per side, and sixteen times sixteen is two hundred and fifty six.', code: 'a1' },
        { id: 'a2', say: 'With {2,048|twenty forty eight} at most, that leaves {1,792|seventeen ninety two} tokens for text.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
