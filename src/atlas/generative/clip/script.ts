import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-clip',
  title: 'CLIP',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'space',
      title: 'Images and captions in one space',
      codeTitle: 'clip.py',
      code: `
        z = unit(img_enc(images))   # (N, d) #@img
        t = unit(txt_enc(captions)) # (N, d) #@txt
        sim = z @ t.T               # (N, N) #@sim
      `,
      beats: [
        { id: 'pairs', say: 'The web is full of images with text written beside them. CLIP trains on such pairs: a photo, and its caption.', code: 'img' },
        { id: 'encoders', say: 'It has two encoders. An image encoder turns each photo into a vector. A text encoder, starting from the embeddings of the caption\'s tokens, turns each caption into a vector of the same width, d. Both are scaled to length one.', code: ['img', 'txt'] },
        { id: 'sim', say: 'Stack a batch of N images, and their N captions. One matrix product gives every image\'s dot product with every caption: an N by N grid of similarities.', code: 'sim' },
      ],
    },
    {
      id: 'diagonal',
      title: 'Each image picks its own caption',
      codeTitle: 'clip_loss.py',
      code: `
        labels = np.arange(N)    # 0, 1, 2   #@diag
        loss_i = cross_entropy(sim, labels)  #@rows
        loss_t = cross_entropy(sim.T, labels) #@cols
        loss = (loss_i + loss_t) / 2         #@cols
      `,
      beats: [
        { id: 'diag', say: 'Pair i is image i with the caption written for it, so the right pairs sit on the diagonal.', code: 'diag' },
        { id: 'rows', say: 'Each row is a contrastive problem: a softmax over the captions, and a cross-entropy that wants image i to pick caption i. The other N minus one captions in the row are its negatives: here, two.', code: 'rows' },
        { id: 'cols', say: 'The columns get the same treatment: each caption should pick its own image. The loss averages the two directions.', code: 'cols' },
        { id: 'count', say: 'With three pairs, the grid holds nine similarities. Training pushes the three on the diagonal up, and the six negatives down.', code: ['rows', 'cols'] },
      ],
    },
    {
      id: 'zeroshot',
      title: 'Classes written in words',
      codeTitle: 'zero_shot.py',
      code: `
        names = ["tree", "boat", "sunset"]       #@names
        caps = ["a photo of a " + n for n in names] #@names
        t = unit(txt_enc(caps))  # (3, d)        #@embed
        scores = t @ z  # [0.31, 0.12, 0.05]     #@pick
        names[np.argmax(scores)]  # "tree"       #@pick
      `,
      beats: [
        { id: 'names', say: 'After training, CLIP can sort images into classes it was never trained on. Write one caption per class: a photo of a tree, a photo of a boat, a photo of a sunset.', code: 'names' },
        { id: 'embed', say: 'Embed the captions with the text encoder, and the image with the image encoder.', code: 'embed' },
        { id: 'pick', say: 'Score the image against each caption by the dot product: {0.31|zero point three one}, {0.12|zero point one two}, and {0.05|zero point zero five}. The highest wins: tree. No labeled tree images were needed. The classifier was written in words.', code: 'pick' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
