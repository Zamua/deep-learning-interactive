import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  encode: {
    is: 'squeezes x into a small code z',
    more: 'The autoencoder\'s encoder. The toy squeezes 2 numbers into 1, first with one linear layer, then with a hidden layer of 16 tanh units; after training it is kept as a feature extractor.',
  },
  decode: {
    is: 'expands a code z back into a data point',
    more: 'The autoencoder\'s decoder, whose output x_hat should match the input. In a VAE, decoding a code drawn from the prior makes new data.',
  },
  cnn: {
    is: 'a ConvNet on one frame or a stack of frames',
    more: 'For single-frame and early fusion it gives class scores. In the LSTM model it turns each frame into a feature vector.',
  },
  tower: {
    is: 'one ConvNet tower, shared by both frames',
    more: 'Late fusion runs the same weights on two frames 15 apart, so the frames meet only in the fully connected layer on top.',
  },
  fc: {
    is: 'a fully connected layer',
    more: 'In late and slow fusion it turns features into class scores. In the DCGAN generator it projects the 100 numbers of z up to 1024 x 4 x 4.',
  },
  conv3d: {
    is: 'a 3-D convolution: it slides over time too',
    more: 'The filter spans t frames as well as a patch of pixels, so it can see motion. stride_t=2 roughly halves the frames, so slow fusion merges time a little per layer.',
  },
  spatial_net: {
    is: 'the appearance stream: a ConvNet on one RGB frame',
    more: 'One half of Simonyan and Zisserman\'s two-stream network. Its class scores are averaged with the temporal stream\'s.',
  },
  optical_flow: {
    is: 'how far each pixel moved between frames',
    more: 'Two numbers per pixel, a horizontal and a vertical step, for each pair of neighboring frames. It is computed before the network runs, not learned by it.',
  },
  temporal_net: { is: 'the motion stream: a ConvNet on stacked flow', more: 'It reads the flow of 10 frames as 20 channels. On its own, it beat the appearance stream.' },
  lstm_step: {
    is: 'one LSTM step over the next frame\'s features',
    more: 'It updates the hidden state h and the memory cell c from the frame features f_t, so the final h can sum up the whole video.',
  },
  conv_gru_step: {
    is: 'one GRU step whose state is a feature map',
    more: 'Its matrix multiplies are convolutions, so h keeps its (C, H, W) shape and the memory stays spatial (Ballas et al.).',
  },
  fit: { is: 'learns a mapping from x to y', more: 'Supervised learning: every x comes paired with a label y, and someone had to write each y.' },
  sample: { is: 'draws new data points from a model', more: 'Generation: once the model has learned the data\'s distribution, sampling from it makes new examples.' },
  model_of: { is: 'learns the distribution of the data', more: 'A generative model fit to X alone, with no labels, well enough to make new samples.' },
  backprop_and_adam: {
    is: 'computes the gradients and takes an Adam step',
    more: 'Shorthand for the training machinery of earlier chapters: backprop through decoder and encoder, then update every weight with Adam.',
  },
  encoder: {
    is: 'maps x to the mean and spread of its code',
    more: 'A VAE encoder outputs a distribution, not one code. In the training loop it returns the log variance, and sigma = np.exp(0.5 * logvar).',
  },
  decoder: {
    is: 'turns a code z into a data point',
    more: 'During training it decodes the sampled codes. To generate, it decodes codes drawn from the standard normal prior.',
  },
  kl_to_prior: {
    is: 'the KL penalty: the code\'s distance from the prior',
    more: 'The Kullback-Leibler divergence (Kullback and Leibler, 1951) between the encoder\'s bell and the standard normal, in closed form. It is zero only when mu = 0 and sigma = 1.',
    eg: 'kl_to_prior(1.2, 0.6)   # 0.91',
  },
  sample_data: { is: 'draws n real examples from the data', more: 'In the two-bump GAN each real example is a single number. D sees these alongside G\'s fakes.' },
  adam_step: {
    is: 'one Adam update to one network\'s weights',
    more: 'adam_step(D, loss_D) changes only D, with G frozen, and adam_step(G, loss_G) only G. Training alternates the two.',
  },
  bn: {
    is: 'batch norm: normalizes each channel over the batch',
    more: 'After normalizing, it rescales with learned parameters. DCGAN uses it in both G and D to keep training stable.',
  },
  conv_t: {
    is: 'a transposed convolution: doubles height and width',
    more: 'The generator\'s learned upsampling: 4 by 4 grows to 64 by 64 in four steps. The name comes from multiplying by the transpose of a strided convolution\'s matrix.',
  },
};
