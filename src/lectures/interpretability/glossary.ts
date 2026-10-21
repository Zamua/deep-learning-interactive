import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  layer: {
    is: 'one layer\'s write to the residual stream',
    more: 'Every attention or MLP layer reads x and adds its output back, so the stream ends as the embedding plus every layer\'s writes.',
  },
  '.attn': {
    is: 'the layer\'s attention, run on the normed stream',
    more: 'Its output a is the layer\'s first write: added to x, never overwriting it.',
  },
  ln: {
    is: 'layer norm: rescales the stream before a read',
    more: 'Every read is a layer norm, then a matrix. The two-layer toy model has none, which keeps its stream an exact sum.',
  },
  '.mlp': {
    is: 'the layer\'s MLP, run on each position separately',
    more: 'Its output m is the layer\'s second write, added to x like the attention\'s.',
  },
  ln_f: {
    is: 'the final layer norm, before the unembedding',
    more: 'ln_f(x) @ W_U turns the top of the stream into one logit per token in the vocabulary.',
  },
  head: {
    is: 'what attention head l writes into the stream',
    more: 'The toy has one head per layer: head(0, x0) is the previous-token head, head(1, x1) the head that copies. With no MLPs and no layer norm, x2 is exactly x0 plus the two writes.',
  },
  '.attention': {
    is: 'both heads\' attention weights on a sequence',
    more: 'model.attention(ids) returns A0 and A1, each 24 by 24 for twelve letters given twice. Each row sums to 1.',
  },
  mean: {
    is: 'the average of the values',
    more: 'Here it averages head one\'s attention on the letter after the earlier copy, over the twelve repeated positions: the induction score.',
    eg: 'mean([0.8, 0.9, 1.0])   # 0.9',
  },
  xent: {
    is: 'cross-entropy of the next-letter predictions',
    more: 'model(ids) scores every letter at every position, and ids[1:] are the letters that came next. It is the loss whose repeat half falls off a cliff during training.',
  },
  model: {
    is: 'the two-layer, attention-only toy transformer',
    more: 'One head per layer, a stream of 32 numbers and twenty letters. model(ids) returns next-letter logits at every position.',
  },
  LogisticRegression: {
    is: 'a linear classifier, used here as the probe',
    more: 'scikit-learn\'s logistic regression: one weight vector per class and a softmax. Despite the name it classifies; the name comes from the logistic function that turns its linear scores into probabilities.',
  },
  '.score': {
    is: 'the probe\'s accuracy on held-out data',
    more: 'The fraction of test vectors it labels correctly. For the previous letter, near chance on x0 and about 88% on x1, after head zero.',
  },
  rand: {
    is: 'random numbers between 0 and 1, in a given shape',
    more: 'rand(B, 5) > S keeps each feature with probability 1 − S, so at S = 0.95 a feature is on one time in twenty.',
    eg: 'rand(2, 3).shape   # (2, 3)',
  },
  unit_vectors: {
    is: 'random directions of length 1, one per column',
    more: 'unit_vectors(8, 16) gives the hidden truth D, 8 by 16: for each of 16 features, how it pushes each of 8 neurons.',
  },
  sparse_features: {
    is: 'samples of features that are mostly zero',
    more: 'sparse_features(3000, 16) gives 3,000 rows of 16 features, each on about 5% of the time. The names, like Korean or music, only make the pictures readable.',
  },
  argsort: {
    is: 'the indices that would sort an array, smallest first',
    more: 'argsort(-X[:, n])[:6] sorts by minus the activation, so it lists the six inputs where neuron n fires hardest.',
    eg: 'argsort([3, 1, 2])   # [1, 2, 0]',
  },
  norm: {
    is: 'the length of each column vector',
    more: 'Dividing W_dec by norm(W_dec, axis=0) keeps every decoder direction at length one, so the SAE cannot dodge the L1 penalty by shrinking f and growing W.',
    eg: 'norm(np.array([[3], [4]]), axis=0)   # [5.]',
  },
  '.encode': {
    is: 'an activation to the SAE\'s feature activations',
    more: 'f = relu(W_enc @ (x − b_dec) + b_enc): a vector much wider than x, mostly zero. At scale, shape (T, m), one row per position.',
  },
  '.decode': {
    is: 'feature activations back to an activation',
    more: 'x_hat = W_dec @ f + b_dec, a weighted sum of the decoder\'s columns. What it misses, x − x_hat, is the dark matter.',
  },
  splice: {
    is: 'runs the model with x_hat in place of x',
    more: 'Its loss is higher than the real model\'s, sometimes by a lot: a measure of what the reconstruction misses.',
  },
  fit_sae: {
    is: 'trains a sparse autoencoder with m features',
    more: 'Fitting it with 8, 16 or 32 features on the same activations X gives different dictionaries, so features are partly a choice. Dictionary learning goes back to sparse coding of natural images (Olshausen and Field, 1996).',
  },
};
