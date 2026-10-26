import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-contrastive-loss',
  title: 'The contrastive loss',
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
        z1 @ z2            # 0.8       #@sim
        sim = Z1 @ Z2.T    # (N, N)    #@batch
      `,
      beats: [
        { id: 'views', say: 'Here is a way to learn from images with no labels at all. Take an image and cut two random crops from it: two views of the same thing.', code: 'views' },
        { id: 'embed', say: 'An encoder turns each view into a vector, {z₁|z one} for the first view and {z₂|z two} for the second. Say {z₁|z one} comes out as six, eight.', code: 'embed' },
        { id: 'size', say: 'Picture it as an arrow from the origin. Its length as an arrow, not its count of entries, is the square root of its squared entries added up: thirty six plus sixty four is a hundred, whose square root is ten.', code: 'size' },
        { id: 'unit', say: 'Divide each entry by ten, and {z₁|z one} becomes {0.6|zero point six}, {0.8|zero point eight}: an arrow of length one, a unit vector. Both views are scaled this way, so only their directions count.', code: 'unit' },
        { id: 'sim', say: 'The similarity of two views is the dot product of their unit vectors: one when they point the same way, lower as they turn apart. These two give {0.8|zero point eight}.', code: 'sim' },
        { id: 'batch', say: 'In a batch, view one of each image has one positive, the other view of the same image. The views of every other image are its negatives. In the grid of similarities, the positives sit on the diagonal.', code: 'batch' },
      ],
    },
    {
      id: 'loss',
      title: 'A softmax over each row',
      codeTitle: 'info_nce.py',
      code: `
        sim[0]                # [0.8, 0.0, 0.4]  #@range
        tau = 0.4                                #@divide
        s = sim[0] / tau      # [2, 0, 1]        #@row
        p = softmax(s)                           #@soft
        loss = -np.log(p[0])  # 0.41             #@loss
        # = log(7.39 + 1 + 2.72) - 2             #@loss
      `,
      beats: [
        { id: 'range', say: 'Similarities of unit vectors stay between minus one and one: too narrow a range for a softmax to be confident.', code: 'range' },
        { id: 'divide', say: 'So the scores are similarities divided by a temperature, written {τ|tau}, the Greek letter tau: a small number, here {0.4|zero point four}. Dividing by it stretches the gaps between them.', code: 'divide' },
        { id: 'row', say: 'Take row zero: view one of image zero against the second view of every image. Its similarities, {0.8|zero point eight}, zero and {0.4|zero point four}, divided by {0.4|zero point four}, give scores of two, zero and one. Which of these candidates is my partner?', code: ['range', 'row'] },
        { id: 'soft', say: 'That is a classification problem. So run a softmax over the row, and take the cross-entropy with the positive as the right answer. The exponentials are {7.39|seven point three nine}, one, and {2.72|two point seven two}: a total of {11.11|eleven point one one}.', code: 'soft' },
        { id: 'loss', say: 'The loss is the log of the total, minus the positive\'s score: {2.41|two point four one} minus two, which is {0.41|zero point four one}.', code: 'loss' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
