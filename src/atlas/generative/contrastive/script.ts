import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-contrastive',
  title: 'Contrastive learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'pairs',
      title: 'Two views of one image',
      codeTitle: 'views.py',
      code: `
        v1, v2 = crop(imgs), crop(imgs)  #@views
        z1 = unit(enc(v1))   # (N, d)    #@embed
        z2 = unit(enc(v2))   # (N, d)    #@embed
        sim = z1 @ z2.T      # (N, N)    #@sim
      `,
      beats: [
        { id: 'views', say: 'Here is a way to learn from images with no labels at all. Take an image and cut two random crops from it: two views of the same thing.', code: 'views' },
        { id: 'embed', say: 'An encoder turns each view into a vector, {z₁|z one} for the first view and {z₂|z two} for the second. Each is scaled to length one, so only its direction counts.', code: 'embed' },
        { id: 'sim', say: 'The similarity of two views is the dot product of their vectors: one when they point the same way, lower as they turn apart.', code: 'sim' },
        { id: 'batch', say: 'In a batch, view one of each image has one positive, the other view of the same image. The views of every other image are its negatives. In the grid of similarities, the positives sit on the diagonal.', code: 'sim' },
      ],
    },
    {
      id: 'loss',
      title: 'A softmax over each row',
      codeTitle: 'info_nce.py',
      code: `
        s = sim[0] / tau      # [2, 0, 1]  #@row
        p = softmax(s)                     #@soft
        loss = -np.log(p[0])  # 0.41       #@loss
        # = log(7.39 + 1 + 2.72) - 2       #@loss
      `,
      beats: [
        { id: 'row', say: 'Take row zero: view one of image zero, against the second view of every image. The row is a classification problem: which of these candidates is my partner?', code: 'row' },
        { id: 'soft', say: 'So run a softmax over the row, and take the cross-entropy with the positive as the right answer. With scores two, zero and one, the exponentials are {7.39|seven point three nine}, one, and {2.72|two point seven two}: a total of {11.11|eleven point one one}.', code: ['row', 'soft'] },
        { id: 'loss', say: 'The loss is the log of the total, minus the positive\'s score: {2.41|two point four one} minus two, which is {0.41|zero point four one}.', code: 'loss' },
        { id: 'push', say: 'Lowering it pulls the positive pair together and pushes the negatives away. Every row takes its turn, and their losses are averaged.', code: 'loss' },
      ],
    },
    {
      id: 'temperature',
      title: 'The temperature',
      codeTitle: 'temperature.py',
      code: `
        sim[0]        # [0.9, 0.1, 0.5]        #@sims
        sim[0] / 1.0  # p = [0.47, 0.21, 0.32] #@warm
        sim[0] / 0.1  # p = [0.98, 0.00, 0.02] #@cold
      `,
      beats: [
        { id: 'range', say: 'Similarities of unit vectors stay between minus one and one: too narrow a range for a softmax to be confident.', code: 'sims' },
        { id: 'divide', say: 'So the scores are similarities divided by a temperature, written {τ|tau}, the Greek letter tau: a small number such as {0.1|zero point one}. Dividing by it stretches the gaps between them.', code: 'cold' },
        { id: 'sharp', say: 'Here the similarities are {0.9|zero point nine}, {0.1|zero point one} and {0.5|zero point five}. Divided by one, the softmax stays soft: {0.47|zero point four seven} for the top. Divided by {0.1|zero point one}, the top takes {0.98|zero point nine eight}.', code: ['warm', 'cold'] },
        { id: 'hard', say: 'A small temperature also aims the push. The negatives most similar to the anchor hold most of the probability, so they are pushed away hardest.', code: 'cold' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
