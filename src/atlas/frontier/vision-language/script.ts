import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vision-language',
  title: 'Vision-language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Alayrac et al.', year: 2022, title: 'Flamingo: a Visual Language Model for Few-Shot Learning', url: 'https://arxiv.org/abs/2204.14198', scene: 'join' },
    { who: 'Liu, Li, Wu & Lee', year: 2023, title: 'Visual Instruction Tuning', url: 'https://arxiv.org/abs/2304.08485', scene: 'join' },
    { who: 'Liu, Li, Li & Lee', year: 2023, title: 'Improved Baselines with Visual Instruction Tuning', url: 'https://arxiv.org/abs/2310.03744', scene: 'patches' },
  ],
  scenes: [
    {
      id: 'join',
      title: 'Two trained models',
      codeTitle: 'join.py',
      code: `
        v = vit(img)    # pixels -> vectors  #@vit
        reply = gpt(x)  # vectors -> words   #@gpt
        # 2022: new layers inside gpt        #@flamingo
        # 2023: v goes into x, the prompt    #@llava
      `,
      beats: [
        { id: 'two', say: 'A trained vision transformer turns a picture into vectors, and a trained language model reads vectors and writes text. Join them, and you have a vision-language model, one that reads a picture and writes about it. But how?', code: ['vit', 'gpt'] },
        { id: 'flamingo', say: 'In 2022, Jean-Baptiste Alayrac and colleagues built Flamingo. They froze both models, holding their weights fixed, and trained new attention layers between the language model\'s own, so its text could look at the picture.', code: 'flamingo' },
        { id: 'llava', say: 'In 2023, Haotian Liu and colleagues tried something simpler, in {LLaVA|Lava}: the Large Language and Vision Assistant.', code: 'llava' },
        { id: 'prompt', say: 'Leave the language model alone, and turn the picture into tokens for its prompt: the tokens it reads before it writes its reply.', code: 'llava' },
      ],
    },
    {
      id: 'patches',
      title: 'An image as patch vectors',
      codeTitle: 'image.py',
      code: `
        img.shape             # (336, 336, 3)  #@img
        per_side = 336 // 14  # 24             #@cut
        N = per_side ** 2     # 576            #@N
        v = vit(img)          # (577, 1024)    #@vit
        v = v[1:]             # (576, 1024)    #@drop
      `,
      beats: [
        { id: 'img', say: 'Take an image of {336 by 336|three thirty six by three thirty six} pixels, as in {LLaVA|Lava}\'s follow-up, later in 2023.', code: 'img' },
        { id: 'cut', say: 'The vision transformer cuts it into patches of fourteen by fourteen pixels: {336 / 14|three thirty six over fourteen} is twenty four per side.', code: 'cut' },
        { id: 'N', say: 'They tile a grid, twenty four by twenty four: five hundred and seventy six patches. Call that N.', code: 'N' },
        { id: 'vit', say: 'Each patch becomes a vector of {1,024|one thousand and twenty four} numbers, with the class token in front: {577|five hundred and seventy seven} vectors.', code: 'vit' },
        { id: 'drop', say: 'Only the five hundred and seventy six patch vectors go on. The class token stays behind.', code: 'drop' },
      ],
    },
    {
      id: 'project',
      title: 'Into the prompt',
      codeTitle: 'prompt.py',
      code: `
        W = np.random.randn(1024, 4096)  #@W
        b = np.zeros(4096)               #@W
        tok = v @ W + b   # (576, 4096)  #@tok
        1024 * 4096       # 4,194,304    #@count
        1024 * 4096 + 4096  # 4,198,400  #@bias
        # or: map, activation, map       #@mlp
        x = np.vstack([tok, E[ids]])     #@prompt
        reply = gpt(x)    # next tokens  #@read
        T_max - N         # 2048 - 576   #@left
      `,
      beats: [
        { id: 'width', say: 'The language model\'s tokens are vectors of d numbers, here {4,096|four thousand and ninety six}. A patch vector, at {1,024|one thousand and twenty four}, does not fit.', code: 'tok' },
        { id: 'W', say: 'So a learned matrix, W, plus a bias, maps each one across: {1,024|one thousand and twenty four} numbers in, {4,096|four thousand and ninety six} out.', code: 'W' },
        { id: 'name', say: 'A learned linear map from one width to another is called a projection. What comes out are the image tokens, one per patch.', code: 'tok' },
        { id: 'count', say: 'Every patch shares the same W, so its weights count once: {1,024|one thousand and twenty four} times {4,096|four thousand and ninety six}, about {4.2|four point two} million.', code: 'count' },
        { id: 'bias', say: 'Plus {4,096|four thousand and ninety six} biases, one per output: {4,198,400|four million, one hundred and ninety eight thousand, four hundred} parameters in all.', code: 'bias' },
        { id: 'mlp', say: 'The follow-up used a small MLP instead: a map into the model\'s width, an activation, then a map from that width to itself, each counted the same way.', code: 'mlp' },
        { id: 'prompt', say: 'The image tokens go first in the prompt, and the text\'s embeddings follow. From there it is a plain decoder-only model: every text token attends back to every image token.', code: ['prompt', 'read'] },
        { id: 'left', say: 'Image tokens take room. If the model reads at most {Tₘₐₓ|T max} tokens, say {2,048|two thousand and forty eight}, this image leaves {1,472|one thousand, four hundred and seventy two} for the question and the answer.', code: 'left' },
      ],
    },
    {
      id: 'train',
      title: 'Two stages of training',
      codeTitle: 'train.py',
      code: `
        # stage 1: images with captions      #@s1
        params = [W, b]   # vit, gpt frozen  #@s1
        # loss: cross-entropy on the caption #@loss
        # stage 2: image, question, answer   #@s2
        params = [W, b] + gpt.params         #@s2
      `,
      beats: [
        { id: 's1', say: '{LLaVA|Lava} trained in two stages. In stage one, both large models stay frozen, and only the projection learns, from images and their captions.', code: 's1' },
        { id: 'loss', say: 'The language model predicts each caption from the image tokens, with the usual cross-entropy. Only W and b can move, so they learn to make vectors it already reads as meaning.', code: 'loss' },
        { id: 's2', say: 'In stage two, the language model trains too, with the projection, on instructions: an image, a question, and a good answer. The vision transformer stays frozen.', code: 's2' },
        { id: 'tuning', say: 'Training on instructions like this is called instruction tuning: hence the paper\'s title, Visual Instruction Tuning.', code: 's2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
