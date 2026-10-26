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
        v1, v2 = crop(img), crop(img)  #@views
        z1 = enc(v1)       # [6, 8]    #@embed
        z2 = enc(v2)                   #@embed
        n1 = np.sqrt(np.sum(z1**2))    #@size
        # = sqrt(36 + 64) = 10.0       #@size
        z1 = z1 / n1     # [0.6, 0.8]  #@unit
        z2 = z2 / np.sqrt(np.sum(z2**2))  #@unit
        z1 @ z2            # 0.9       #@sim
        sim = Z1 @ Z2.T    # (N, N)    #@batch
      `,
      beats: [
        { id: 'views', say: 'Here is a way to learn from images with no labels at all. Take an image and cut two random crops from it: two views of the same thing.', code: 'views' },
        { id: 'embed', say: 'An encoder turns each view into a vector, {z₁|z one} for the first view and {z₂|z two} for the second. Say {z₁|z one} comes out as six, eight.', code: 'embed' },
        { id: 'size', say: 'Picture it as an arrow from the origin. Its length as an arrow, not its count of entries, is the square root of its squared entries added up: thirty six plus sixty four is a hundred, whose square root is ten.', code: 'size' },
        { id: 'unit', say: 'Divide each entry by ten, and {z₁|z one} becomes {0.6|zero point six}, {0.8|zero point eight}: an arrow of length one, a unit vector. Both views are scaled this way, so only their directions count.', code: 'unit' },
        { id: 'sim', say: 'The similarity of two views is the dot product of their unit vectors: one when they point the same way, lower as they turn apart. These two give {0.9|zero point nine}.', code: 'sim' },
        { id: 'batch', say: 'In a batch, view one of each image has one positive, the other view of the same image. The views of every other image are its negatives. In the grid of similarities, the positives sit on the diagonal.', code: 'batch' },
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
        # s[2] enters only via e^1 = 2.72  #@nudge
        ds = p.copy()  # [0.67, 0.09, 0.24]  #@share
        ds[0] -= 1     # [-0.33, 0.09, 0.24] #@push
      `,
      beats: [
        { id: 'row', say: 'Take row zero: view one of image zero, against the second view of every image. The row is a classification problem: which of these candidates is my partner?', code: 'row' },
        { id: 'soft', say: 'So run a softmax over the row, and take the cross-entropy with the positive as the right answer. With scores two, zero and one, the exponentials are {7.39|seven point three nine}, one, and {2.72|two point seven two}: a total of {11.11|eleven point one one}.', code: ['row', 'soft'] },
        { id: 'loss', say: 'The loss is the log of the total, minus the positive\'s score: {2.41|two point four one} minus two, which is {0.41|zero point four one}.', code: 'loss' },
        { id: 'nudge', say: 'How hard does the loss push each negative? Candidate two\'s score enters the loss only through the total, as e to the one. e to the x is its own slope, so the total grows {2.72|two point seven two} times as fast as that score.', code: 'nudge' },
        { id: 'share', say: 'The log of the total grows one over the total as fast. So the loss\'s slope on that score is {2.72|two point seven two} over {11.11|eleven point one one}: {0.24|zero point two four}, its probability. Candidate one\'s slope is its probability too: {0.09|zero point zero nine}.', code: 'share' },
        { id: 'push', say: 'The positive\'s score is also subtracted on its own, so its slope is {0.67|zero point six seven} minus one. Lowering the loss pulls the positive in and pushes each negative away by its probability, the closer negative hardest. Every row takes its turn, and their losses are averaged.', code: 'push' },
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
        { id: 'hard', say: 'A small temperature also aims the push. Each negative is pushed by its probability. Divided by one, the negatives hold {0.21|zero point two one} and {0.32|zero point three two}, close to even. Divided by {0.1|zero point one}, the one at {0.5|zero point five} holds {0.02|zero point zero two} and the other almost none: nearly all the push lands on the negative most like the anchor.', code: ['warm', 'cold'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
