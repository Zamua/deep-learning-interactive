import type { SymbolMap } from '../core/symbols';

/** Shared by the contrastive chapter and its lecture, so a symbol keeps its color across both. */
export const CONTRASTIVE_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: an image, or one augmented view of it',
    code: ['x', 'x1', 'x2', 'images'],
    about: 'Two random views, x1 and x2, of one image form the positive pair; views of the other images in the batch are the negatives. In the toy scenes, an item is six numbers: two of content and four of style.',
  },
  f: {
    color: 'blue',
    name: 'f: the encoder network being trained (MoCo: f_q, and its slow copy f_k)',
    code: ['f', 'f_q', 'f_k', 'encoder'],
    about: 'The part worth keeping: every pretext task and loss exists only to train it, and a linear probe on its frozen features grades it. In SimCLR it is a ResNet giving 2,048 numbers; in MAE, a ViT that sees only the visible quarter of the patches.',
  },
  z: {
    color: 'purple',
    name: 'z: an embedding, a unit-length vector from the encoder (MoCo calls them q and k)',
    code: ['z', 'z1', 'z2', 'q', 'k'],
    about: 'Normalized to length 1, so a dot product of two is a cosine and every z lies on a sphere; SimCLR\'s has 128 numbers. MoCo\'s query and key names come from treating contrastive learning as a dictionary lookup: a query should find its matching key.',
  },
  t: {
    color: 'green',
    name: "t: a text embedding from CLIP's text encoder, in the same space as z",
    code: ['t'],
    about: 'Also unit length, so z @ t.T scores every image against every caption. For zero-shot classification, the t of one prompt per class become the classifier\'s weights. CLIP is short for contrastive language-image pre-training.',
  },
  S: {
    color: 'teal',
    name: 'S: the similarity matrix: every embedding against every candidate partner, divided by τ',
    code: ['S', 'logits'],
    about: 'N by N for a batch of N pairs, with the positives on the diagonal; row i is a softmax classifier over N candidates. SimCLR\'s is 2N by 2N with each view\'s similarity to itself masked out; CLIP reads it along rows and down columns.',
  },
  tau: {
    color: 'slate',
    name: 'τ: the temperature, which sharpens (small) or flattens (large) the softmax',
    tex: '\\tau',
    code: ['tau'],
    about: 'Cosines span only -1 to 1, so a small τ widens the gaps (at 0.1, a gap of one becomes ten) and aims the push at the hardest negatives; MoCo used 0.07, and CLIP learns it. The name comes from physics, where temperature sets how peaked the Boltzmann distribution is.',
  },
  y: {
    color: 'gold',
    name: "y: the targets, which column holds each row's true partner (the diagonal)",
    code: ['labels'],
    about: 'labels = np.arange(N): row i\'s partner is column i. No person supplies them; they follow from how the batch was built.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss'],
    about: 'For contrastive methods and CLIP, InfoNCE: cross-entropy over each row of S, averaged; a collapsed encoder scores exactly log N. MAE uses squared error on hidden patches, DINO cross-entropy against the teacher. NCE stands for noise-contrastive estimation (Gutmann and Hyvärinen, 2010).',
  },
  m: {
    color: 'slate',
    name: "m: the momentum of a moving average (MoCo's key encoder, DINO's teacher)",
    code: ['m'],
    about: 'Each step the slow copy moves 1 - m of the way toward the trained network, so at 0.999 it remembers roughly the last thousand steps. At m = 0, a plain copy, MoCo failed to train. MoCo is short for momentum contrast.',
  },
};
