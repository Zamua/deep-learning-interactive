import type { SymbolMap } from '../core/symbols';

/** Shared by the attention chapter and its lecture, so a symbol keeps its color across both. */
export const ATTENTION_SYMBOLS: SymbolMap = {
  v: {
    color: 'orange',
    name: 'v_i: the feature vector at location i (what the ConvNet saw there)',
    code: ['v', 'feats'],
    about: 'Show, Attend and Tell has 196 of them, 512 numbers each, from a 14 by 14 conv grid; the toy uses 64 cells of 5 hand-made numbers. In translation, v_j is the encoder state after source word j.',
  },
  h: {
    color: 'green',
    name: 'h: the RNN hidden state, which decides where to look',
    code: ['h'],
    about: 'It changes every step, so the query np.dot(Wa, h) changes too, and attention moves somewhere new for each word. In the bottleneck scene, the encoder\'s h is the one vector that has to carry the whole sentence.',
  },
  e: {
    color: 'purple',
    name: 'e_i: the attention score of location i',
    code: ['e', 'scores'],
    about: 'A dot product of each feature vector with the query: high where the features match the wish list, negative where they clash. Like class scores, they can be any real numbers until the softmax.',
  },
  alpha: {
    color: 'teal',
    name: 'α_i: attention weights, positive and summing to 1',
    tex: '\\alpha',
    code: ['alpha'],
    about: 'The softmax of the scores: a budget of attention spread over the locations, peaked or spread out depending on a sharpness factor on the scores. Hard attention treats alpha as a loaded die and picks one location.',
  },
  z: {
    color: 'gold',
    name: 'z: the context vector, the attention-weighted average of features',
    code: ['z', 'z_soft', 'z_hard'],
    about: 'The same size as one feature vector (5 numbers in the toy), but mostly describing the high-attention places. It is the expected feature vector under alpha, which hard attention estimates with one random pick.',
  },
  theta: {
    color: 'blue',
    name: 'θ: the transform parameters predicted by the localization net',
    tex: '\\theta',
    code: ['theta'],
    about: 'For an affine transform, 6 numbers as a 2 by 3 matrix: zoom, rotation, shear and shift. The identity leaves the input unchanged, and halving the diagonal zooms in two times.',
  },
  U: {
    color: 'slate',
    name: 'U: the input image or feature map being read',
    code: ['U'],
    about: 'Any image or intermediate feature map. A spatial transformer reads U at the positions its grid asks for, and DRAW reads a 6 by 6 glimpse of it through Gaussian filters.',
  },
  V: {
    color: 'red',
    name: "V: the spatial transformer's output",
    code: ['V'],
    about: 'Each output pixel is a bilinear read of U at the position theta maps it to, so V is a cropped, zoomed or straightened region of U. A ConvNet then classifies V as usual.',
  },
};
