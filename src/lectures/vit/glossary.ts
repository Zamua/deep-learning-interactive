import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  load_image: { is: 'loads one photo as an array of pixels', more: 'Its shape is (H, W, C): height, width, and three color channels.' },
  cut: {
    is: 'cuts an image into P by P patches, each flattened',
    more: 'Patches are read left to right, top to bottom, like words on a page, and each becomes one row of P·P·C numbers. The patches scene spells it out with reshape and transpose.',
    eg: 'cut(img, P=16).shape   # (196, 768)',
  },
  embed: {
    is: 'turns each flattened patch into a token vector',
    more: 'One learned matrix E maps every patch to a vector of length D, the model width. The tokens scene writes it as patches @ E.',
  },
  transformer: {
    is: 'a standard transformer encoder with a classifier on top',
    more: 'It reads the sequence of patch tokens and returns a label. ViT takes the encoder built for language and changes as little as possible.',
  },
  msa: {
    is: 'multi-head self-attention over all the tokens',
    more: 'Each token takes an average of every token\'s values, weighted by how well its query matches their keys. It is the only step where patches see each other. MSA is the ViT paper\'s own abbreviation.',
  },
  mlp: {
    is: 'a small two-layer network applied to each token',
    more: 'The same weights run on every token separately, so nothing moves between patches here. In ViT it widens each token four times, then projects back to D.',
  },
  block: {
    is: 'one encoder layer: attention, then an MLP',
    more: 'Each half has a layer norm in front and a residual connection around it. ViT stacks L of them; the base model has twelve.',
  },
  vit: {
    is: 'runs the trained vision transformer on an image',
    more: 'The tiny model here uses 4 pixel patches on 32 by 32 CIFAR-10 images, six layers and four heads. It returns class probabilities (with A, the attention weights, when asked), or in the DeiT scene the final tokens z. ViT is short for vision transformer, from the 2020 Google paper "An Image is Worth 16x16 Words".',
  },
  vit_nopos: {
    is: 'the same tiny ViT, trained without position embeddings',
    more: 'Its encoder sees a set of patches, so no shuffle ever changes its answer. It still gets 73% of test images right, from colors and textures alone.',
  },
  norm: {
    is: 'the length of each row vector',
    more: 'Dividing E_pos by norm(E_pos, axis=1) makes every row length one, so U @ U.T holds the cosine similarity of every pair of slots.',
    eg: 'norm(np.array([[3, 4]]), axis=1)   # [5.]',
  },
  conv: {
    is: 'slides the filter w over an image (a convolution)',
    more: 'The same small filter is applied at every position, which is why shifting the input only shifts the output. Here w picks out vertical edges.',
  },
  gray: { is: 'turns a color image into one brightness channel', more: 'The edge filter w then has one channel to read instead of three.' },
  pretrain: {
    is: 'trains a model on a large dataset first',
    more: 'Each model is pretrained on one of the three datasets, then tested on ImageNet, to see how the amount of data changes the winner.',
  },
  ViT: {
    is: 'a fresh, untrained vision transformer',
    more: 'The paper compared several sizes. Names like ViT-B/16 record the size (B for base) and the patch size, 16 pixels.',
  },
  ResNet: {
    is: 'a fresh, untrained ResNet, the ConvNet baseline',
    more: 'ResNet is short for residual network (He et al., 2015), whose blocks add their input back to their output. With ImageNet alone it beat ViT.',
  },
  augment: {
    is: 'random crops, color changes, Mixup and CutMix',
    more: 'Mixup blends two images and their labels; CutMix pastes a patch of one image into another and mixes the labels by area. Augmentation is inductive bias delivered through data.',
  },
  teacher: {
    is: 'a trained ConvNet whose top guess the student copies',
    more: 'teacher(img).argmax() is the target y_t for the distillation token. The teacher and student terms come from knowledge distillation, where a small model learns to match a larger one; DeiT is short for data-efficient image transformer.',
  },
  ce: {
    is: 'cross-entropy between scores and a label',
    more: 'Softmax the scores, then take minus the log probability of the given class. DeiT averages two: the class token against the true label y, and the distillation token against the teacher\'s guess y_t.',
  },
  windows: {
    is: 'splits the token grid into M by M windows',
    more: 'A 14 by 14 grid with M = 7 gives four windows of 49 tokens, shape (4, 49, D). Swin is short for shifted windows (Liu et al., 2021).',
  },
  attention: {
    is: 'self-attention inside each window separately',
    more: 'A token sees only the M·M tokens of its own window, so the cost grows like N·M·M instead of N·N.',
  },
  merge_2x2: {
    is: 'merges each 2 by 2 group of tokens into one',
    more: 'Swin calls it patch merging: the four tokens are joined end to end and projected. The grid halves on each side, building a pyramid of feature maps like a ConvNet\'s.',
  },
  stack: { is: 'puts the class token on top of the patch tokens', more: 'The result has N + 1 rows, with the class token in row 0; the tokens scene writes it np.vstack([cls, tokens]).' },
  encoder: {
    is: 'the stack of L transformer blocks',
    more: 'Each block is attention then an MLP, with layer norms and residual connections. The output keeps the input\'s shape, (N + 1, D).',
  },
  head: {
    is: 'the linear classifier on the class token',
    more: 'It turns the class token\'s final vector, after a layer norm, into one score per class. The encoder scene writes it y @ W_head.',
  },
};
