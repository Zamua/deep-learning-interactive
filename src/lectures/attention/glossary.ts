import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  cnn_fc: {
    is: 'one vector that summarizes the whole image',
    more: 'The last chapter\'s captioner reads a ConvNet up to a fully connected (fc) layer: a few hundred numbers, computed once, for every word.',
  },
  rnn_step: { is: 'one step of the caption RNN', more: 'It folds the previous word, and with attention the context z, into the hidden state h.' },
  sample: {
    is: 'picks the next word from the word scores',
    more: 'The hidden state gives a score for every word in the vocabulary (np.dot(Wout, h) in the full loop), and the next word is drawn from their softmax.',
  },
  cnn_conv: {
    is: 'the image as a grid of feature vectors',
    more: 'Stop the ConvNet at a conv layer, before the fully connected ones, and its output keeps the spatial grid: one feature vector v_i per region.',
  },
  attend: {
    is: 'looks at the grid and returns the context z',
    more: 'Three steps for every word: score each location against h, softmax the scores into weights, and take the weighted average of the features.',
  },
  encoder: { is: 'one step of the RNN that reads the English', more: 'It folds each word into the hidden state h. Plain seq2seq keeps only the last h; the fix keeps every one.' },
  decoder: { is: 'one step of the RNN that writes the French', more: 'Without attention, every step reads the same summary: one fixed-size vector for the whole sentence.' },
  conv5: {
    is: 'the last conv layer\'s grid of features',
    more: 'conv5 is the fifth and last stage of conv layers in VGG-style networks. Its output is still a grid, with one vector v per cell.',
  },
  vgg_conv5: {
    is: 'VGG features at conv5: 196 vectors of 512',
    more: 'Show, Attend and Tell stops VGG at its last conv layer, where the image is still a 14 by 14 grid. VGG is named after Oxford\'s Visual Geometry Group, where it was built.',
  },
  init_state: {
    is: 'the first hidden state, computed from the image',
    more: 'Show, Attend and Tell computes it from the average of the feature vectors, so the LSTM starts with a rough view of the whole picture.',
  },
  lstm: {
    is: 'one LSTM step: word, context and state in',
    more: 'It takes the embedded previous word and the context z, and returns the new hidden state h, which scores the locations again on the next step.',
  },
  embed: { is: 'the learned vector for a word', more: 'It turns the previous word into numbers the LSTM can read.' },
  f_att: {
    is: 'the score of source word j against h',
    more: 'A small learned network of the decoder state h and the encoder state v[j]. One score per source word, before the softmax.',
  },
  loc_net: {
    is: 'predicts the transform θ from the input U',
    more: 'The localization network: any small network, ending in 6 numbers for an affine transform. It is trained only by the final loss, never told the right transform.',
  },
  bilinear_sample: {
    is: 'reads U at fractional positions, smoothly',
    more: 'Each read blends the four nearest pixels, weighted by area, so V changes smoothly with both the pixel values and the positions. Bilinear means linear interpolation along x and then along y.',
  },
  spatial_transformer: {
    is: 'warps U into V with a learned transform',
    more: 'Localization net, grid generator and bilinear sampler in one differentiable layer (Jaderberg et al., 2015). It drops into any ConvNet and trains with ordinary backprop.',
  },
  convnet: { is: 'classifies the warped image V', more: 'An ordinary ConvNet after the spatial transformer. It gets an upright, centered input if the transformer has learned well.' },
  backprop: {
    is: 'every gradient of the loss, by name',
    more: 'Gradients reach the localization net\'s weights, theta_net, through the sampler. No label for theta is ever needed.',
  },
};
