import type { SymbolDef, SymbolMap } from '../core/symbols';
import type { Glossary } from '../lecture/glossary';

/**
 * One map for the whole course, so a symbol keeps its color from concept to concept. A key with a
 * digit (W1) has no `\symW1` shorthand, since TeX command names are letters: write `\sym{W1}{W_1}`.
 */
export const ATLAS_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input',
    about: 'What goes in: a vector of numbers, or the variable of a function.',
  },
  X: {
    color: 'orange',
    name: 'X: a batch of inputs, one per row',
    code: ['X', 'X_batch'],
    about: 'N examples stacked as the rows of a matrix of shape (N, D). X @ W.T scores the whole batch at once, one row of scores per example.',
  },
  w: {
    color: 'blue',
    name: 'w: a vector of weights',
    about: 'One weight per entry of x. Its dot product with x multiplies each entry by its weight and adds them up.',
  },
  W: {
    color: 'blue',
    name: 'W: a matrix of weights',
    about: 'A grid of numbers in rows and columns. W times x takes one dot product per row, so it has one column per entry of x. Vectors are written across the page, but the vector a matrix multiplies counts as a column.',
  },
  b: {
    color: 'green',
    name: 'b: the biases, one per class',
    about: 'Added after the multiply: a class\'s built-in lean before any evidence, which is where the name comes from. With an all-zero input the scores are exactly b; without b they would all be 0.',
  },
  s: {
    color: 'purple',
    name: 's: the class scores',
    code: ['s', 'scores'],
    about: 'One number per class, s = Wx + b. The prediction is the class with the largest score; softmax turns the scores into probabilities.',
  },
  y: {
    color: 'gold',
    name: 'y: the index of the correct class',
    about: 'An integer label: which class the example really is. The loss looks at how the model scored that class.',
  },
  p: {
    color: 'teal',
    name: 'p: probabilities from the softmax',
    code: ['p', 'probs'],
    about: 'Positive and summing to 1: exponentiate each score, then divide by the total. p[y] is the probability the model gives the right answer.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['L', 'loss'],
    about: 'One number that says how bad the predictions are; 0 is perfect. Training moves the parameters downhill on L.',
  },
  f: {
    color: 'purple',
    name: 'f: a function of x',
    about: 'Any rule that turns an input into an output. Its derivative says how fast the output changes when x is nudged.',
  },
  g: {
    color: 'red',
    name: 'g: the gradient of the loss',
    code: ['g', 'grad', 'dW', 'ds', 'dh', 'dz', 'dW1', 'dW2', 'db1', 'db2'],
    about: 'One partial derivative per parameter, the same shape as what it is the gradient of. It points uphill on the loss, so training steps the other way.',
  },
  D: {
    color: 'slate',
    name: 'D: the number of input features',
    about: 'How many numbers describe one example: 3,072 for a 32 by 32 color image. It is the number of columns of W.',
  },
  C: {
    color: 'slate',
    name: 'C: the number of classes',
    about: 'How many answers the classifier chooses between: 10 for CIFAR-10. It is the number of rows of W and the length of s.',
  },
  H: {
    color: 'slate',
    name: 'H: the number of hidden units',
    about: 'The width of a hidden layer: how many numbers the first layer hands to the next. A choice, not something the data fixes.',
  },
  N: {
    color: 'slate',
    name: 'N: the number of training examples',
    about: 'The size of the whole training set. One pass over all N examples is an epoch.',
  },
  B: {
    color: 'slate',
    name: 'B: the batch size',
    code: ['B', 'batch_size'],
    about: 'How many examples go into one gradient estimate. Smaller batches are cheaper and noisier; larger ones are smoother and cost more per step.',
  },
  h: {
    color: 'gold',
    name: 'h: the hidden layer\'s activations',
    code: ['h', 'hidden'],
    about: 'What the first layer hands to the second: h = ReLU(W1 x + b1). Each entry is one hidden unit, and the second layer scores h exactly as a linear classifier scores an image.',
  },
  W1: {
    color: 'blue',
    name: 'W1: the first layer\'s weights',
    tex: 'W_1',
    about: 'Shape (H, D): one row per hidden unit, each a template over the input. Its output, through the activation, is h.',
  },
  W2: {
    color: 'blue',
    name: 'W2: the second layer\'s weights',
    tex: 'W_2',
    about: 'Shape (C, H): one row per class, scoring the hidden activations h instead of the raw input.',
  },
  b1: {
    color: 'green',
    name: 'b1: the first layer\'s biases',
    tex: 'b_1',
    about: 'One per hidden unit, added before the activation, so a unit can fire even when its weighted sum is small.',
  },
  b2: {
    color: 'green',
    name: 'b2: the second layer\'s biases',
    tex: 'b_2',
    about: 'One per class, added to the scores, as in a linear classifier.',
  },
  lam: {
    color: 'slate',
    name: 'λ: the regularization strength',
    tex: '\\lambda',
    code: ['lam', 'reg'],
    about: 'How much the penalty on large weights counts against fitting the data. A hyperparameter: chosen on validation data, never learned.',
  },
  v: {
    color: 'orange',
    name: 'v: a vector',
    about: 'A list of numbers in a fixed order, like [3, -1, 2]. Written across the page, but a matrix that multiplies it treats it as a column.',
  },
  gamma: {
    color: 'purple',
    name: 'γ: the learned scale',
    tex: '\\gamma',
    about: 'Batch norm multiplies each normalized feature by γ, learned like any weight, so the network can undo the normalization where it helps.',
  },
  beta: {
    color: 'green',
    name: 'β: the learned shift',
    tex: '\\beta',
    about: 'Batch norm adds β after scaling by γ: a learned offset per feature, playing the role a bias would.',
  },
  F: {
    color: 'slate',
    name: 'F: the filter size',
    about: 'A filter covers F × F positions of the input, through every channel. 3 is the usual choice; stacking small filters sees as far as one big one.',
  },
  S: {
    color: 'slate',
    name: 'S: the stride',
    about: 'How far the filter moves between positions. Stride 2 halves the output\'s width and height.',
  },
  P: {
    color: 'slate',
    name: 'P: the padding',
    about: 'Zeros added around the border. With stride 1, P = (F − 1) / 2 keeps the output the same size as the input.',
  },
  K: {
    color: 'slate',
    name: 'K: the number of filters',
    about: 'Each filter makes one output channel, so a layer with K filters outputs K channels.',
  },
  Whh: {
    color: 'blue',
    name: 'W_hh: the hidden-to-hidden weights',
    tex: 'W_{hh}',
    code: ['Whh', 'W_hh'],
    about: 'Carries the memory from one step to the next. The same matrix is used at every step.',
  },
  Wxh: {
    color: 'blue',
    name: 'W_xh: the input-to-hidden weights',
    tex: 'W_{xh}',
    code: ['Wxh', 'W_xh'],
    about: 'Mixes the current input into the hidden state. Shared across every step of the sequence.',
  },
  T: {
    color: 'slate',
    name: 'T: the temperature',
    about: 'Scores are divided by T before the softmax. Below 1 sharpens the choice toward the top token; above 1 flattens it toward random.',
  },
  Nparams: {
    color: 'blue',
    name: 'N: the number of parameters',
    tex: 'N',
    about: 'Every weight and bias in the model.',
  },
  Dtokens: {
    color: 'orange',
    name: 'D: the number of training tokens',
    tex: 'D',
    about: 'How many tokens the model trains on, counting repeats.',
  },
  Cflops: {
    color: 'purple',
    name: 'C: the training compute',
    tex: 'C',
    about: 'The total arithmetic a training run does, counted in FLOPs: about 6ND.',
  },
  alpha: {
    color: 'teal',
    name: 'α: the scaling exponent',
    tex: '\\alpha',
    code: [],
    about: 'How fast the loss falls with compute: L = aC^(−α), a straight line of slope −α on log-log axes.',
  },
  WU: {
    color: 'purple',
    name: 'W_U: the unembedding',
    tex: 'W_U',
    code: ['W_U', 'WU'],
    about: 'One row per token in the vocabulary. W_U times a vector scores every token.',
  },
  eta: {
    color: 'slate',
    name: 'η: the learning rate',
    tex: '\\eta',
    code: ['lr'],
    about: 'How far each gradient step goes. Too small and training crawls; too large and the steps overshoot the minimum and can blow up.',
  },
};

const step: SymbolDef = { color: 'gold', name: 'h: the step', code: ['h'], about: 'How far x moves: the run in rise over run.' };
const scores: SymbolDef = { color: 'purple', name: 's: the scores', code: ['s', 'scores'], about: 'One number per option. A bigger score is a stronger vote for that option.' };
const answer: SymbolDef = { color: 'gold', name: 'y: the right answer', about: 'The position of the correct option, counting from 0.' };
const probs: SymbolDef = { color: 'teal', name: 'p: the probabilities', code: ['p', 'probs'], about: 'One per option, each positive, together summing to 1.' };
const loss: SymbolDef = { color: 'red', name: 'L: the loss', code: ['L', 'loss'], about: 'One number that says how wrong the scores are: 0 is perfect, bigger is worse.' };
const grad: SymbolDef = { ...ATLAS_SYMBOLS.g!, name: 'g: the gradient', about: 'One partial derivative per input, in the input\'s shape. It points uphill, so a step against it goes down.' };

/** Attention's symbols, shared by the concepts that use them. */
const att: SymbolMap = {
  q: { color: 'teal', name: 'q: a query', about: 'What a token is looking for: q = W_Q x. Its dot product with every key scores how well each token matches.' },
  k: { color: 'purple', name: 'k: a key', about: 'What a token offers to a query that comes looking: k = W_K x. A query dotted with it gives one score.' },
  v: { color: 'gold', name: 'v: a value', about: 'What a token hands over when it is attended to: v = W_V x. The output is a weighted sum of values.' },
  Q: { color: 'teal', name: 'Q: the queries, one row per token', about: 'Every token\'s query stacked as a row: shape (T, d_k).' },
  K: { color: 'purple', name: 'K: the keys, one row per token', about: 'Every token\'s key stacked as a row: shape (T, d_k). Q times K transposed scores every query against every key.' },
  V: { color: 'gold', name: 'V: the values, one row per token', about: 'Every token\'s value stacked as a row: shape (T, d_v). The weights A times V mixes them.' },
  Wq: { color: 'blue', name: 'W_Q: the query weights', tex: 'W_Q', code: ['Wq', 'W_Q'], about: 'A learned (d_k, d) matrix, the same for every token: it turns a token x into its query.' },
  Wk: { color: 'blue', name: 'W_K: the key weights', tex: 'W_K', code: ['Wk', 'W_K'], about: 'A learned (d_k, d) matrix, the same for every token: it turns a token x into its key.' },
  Wv: { color: 'blue', name: 'W_V: the value weights', tex: 'W_V', code: ['Wv', 'W_V'], about: 'A learned (d_v, d) matrix, the same for every token: it turns a token x into its value.' },
  Wo: { color: 'blue', name: 'W_O: the output weights', tex: 'W_O', code: ['Wo', 'W_O'], about: 'A learned (d, d) matrix that mixes the heads\' joined outputs into one vector per token.' },
  d: { color: 'slate', name: 'd: the model width', about: 'How many numbers describe each token: the length of every token vector between blocks.' },
  dk: { color: 'slate', name: 'd_k: the query and key length', tex: 'd_k', code: ['d_k', 'dk'], about: 'How many entries a query and a key have. Scores are divided by its square root.' },
  dv: { color: 'slate', name: 'd_v: the value length', tex: 'd_v', code: ['d_v', 'dv'], about: 'How many entries each value has, and so each row of attention\'s output.' },
  T: { color: 'slate', name: 'T: the number of tokens', about: 'How many tokens attention reads at once. The score matrix is T by T.' },
  A: { color: 'green', name: 'A: the attention weights', about: 'softmax(QKᵀ/√d_k), shape (T, T). Row i is how token i splits its attention; every row adds up to 1.' },
  heads: { color: 'slate', name: 'h: the number of heads', tex: 'h', code: ['n_heads'], about: 'How many attentions run side by side. Each works in d / h dimensions.' },
  dhead: { color: 'slate', name: 'd_head: one head\'s width', tex: 'd_{\\text{head}}', code: ['d_head'], about: 'd / h: the length of each head\'s queries, keys and values.' },
  X: { color: 'orange', name: 'X: the tokens, one per row', about: 'T token vectors stacked as rows: shape (T, d).' },
  x: { color: 'orange', name: 'x: one token', about: 'A token\'s vector of d numbers. Attention reads it through W_Q, W_K and W_V.' },
};
const adamMoments: SymbolMap = {
  m: { color: 'orange', name: 'm: the first moment', about: 'A running average of the gradient, as momentum keeps: it points where the gradients have been pointing lately.' },
  v: { color: 'teal', name: 'v: the second moment', about: 'A running average of the squared gradient: how large this parameter\'s gradients usually are.' },
};
/** ε where it only keeps a division away from zero. */
const tiny: SymbolDef = { color: 'slate', name: 'ε: a tiny constant', tex: '\\epsilon', about: 'Added so nothing is ever divided by zero, around 10⁻⁸. Too small to matter in arithmetic by hand.' };
const adamAll: SymbolMap = {
  ...adamMoments,
  epstiny: tiny,
  beta1: { color: 'slate', name: 'β₁: the first moment\'s decay', tex: '\\beta_1', about: 'The share of m kept each step, usually 0.9.' },
  beta2: { color: 'slate', name: 'β₂: the second moment\'s decay', tex: '\\beta_2', about: 'The share of v kept each step, usually 0.999: a longer memory than m\'s.' },
  mhat: { color: 'orange', name: 'm̂: the corrected first moment', tex: '\\hat m', code: ['m_hat'], about: 'm divided by 1 − β₁ᵗ, undoing the pull toward its zero start.' },
  vhat: { color: 'teal', name: 'v̂: the corrected second moment', tex: '\\hat v', code: ['v_hat'], about: 'v divided by 1 − β₂ᵗ; Adam divides each step by its square root.' },
};
const pick = (m: SymbolMap, keys: string): SymbolMap => Object.fromEntries(keys.split(' ').map((k) => [k, m[k]!]));
const mlpW: SymbolMap = {
  W1: { color: 'blue', name: 'W1: the MLP\'s first weights', tex: 'W_1', about: 'Shape (4d, d): widens each token to 4d numbers.' },
  W2: { color: 'blue', name: 'W2: the MLP\'s second weights', tex: 'W_2', about: 'Shape (d, 4d): brings each token back to d numbers.' },
};

/** Reinforcement learning's symbols, shared across post-training. */
const rl: SymbolMap = {
  pi: { color: 'teal', name: 'π: the model\'s probability', tex: '\\pi', code: ['pi'], about: 'How likely the model is to write a given answer, or a given token.' },
  R: { color: 'gold', name: 'R: the reward', about: 'One number for a whole answer: how good it was judged to be.' },
  theta: { color: 'blue', name: 'θ: the parameters', tex: '\\theta', code: ['theta'], about: 'Every weight of the model. The gradient says how to change them.' },
  piref: { color: 'slate', name: 'π_ref: the reference model', tex: '\\pi_{\\text{ref}}', code: ['pi_ref'], about: 'A frozen copy of the model as it was before this training started.' },
  piold: { color: 'slate', name: 'π_old: the sampling model', tex: '\\pi_{\\text{old}}', code: ['pi_old'], about: 'The model as it was when it sampled this batch of answers.' },
  beta: { color: 'slate', name: 'β: the KL strength', tex: '\\beta', code: ['beta'], about: 'How much drifting away from π_ref costs.' },
  A: { color: 'green', name: 'A: the advantage', code: ['A', 'adv'], about: 'How much better an answer did than expected. Positive pushes it up, negative pushes it down.' },
};

/** Diffusion's symbols. */
const dif: SymbolMap = {
  x0: { color: 'orange', name: 'x₀: the clean image', tex: 'x_0', code: ['x0'], about: 'The image before any noise is added.' },
  xt: { color: 'purple', name: 'x_t: the noised image', tex: 'x_t', code: ['xt', 'x_t'], about: 'The clean image blended with noise at step t.' },
  eps: { color: 'slate', name: 'ε: the noise', tex: '\\epsilon', code: ['eps', 'noise'], about: 'Standard normal noise: mean 0, variance 1, one number per pixel.' },
  ab: { color: 'teal', name: 'ᾱ: the share of signal left', tex: '\\bar\\alpha', code: ['ab', 'alpha_bar'], about: 'The share of x_t\'s variance that is still image. It falls from near 1 to near 0 across the schedule.' },
  epshat: { color: 'red', name: 'ε̂: the network\'s noise guess', tex: '\\hat\\epsilon', code: ['eps_hat'], about: 'What the network predicts was added to the image.' },
  tstep: { color: 'slate', name: 't: the noise step', tex: 't', code: [], about: 'Which step of the schedule: step 0 is the clean image, and each later step holds more noise.' },
};

const fGrad: SymbolDef = { ...grad, name: 'g: a gradient of f', about: 'One partial derivative of f per entry, laid out in the shape of what it is the gradient of.' };
const expTotal: SymbolDef = { color: 'slate', name: 'T: the total', code: ['T'], about: 'e to every score, added up: the bottom of the softmax.' };
const softmaxGrad: SymbolMap = { s: scores, y: answer, p: probs, L: loss, T: { ...expTotal, about: `${expTotal.about} Only the term e^sⱼ moves with sⱼ, so ∂T/∂sⱼ = e^sⱼ.` }, g: { ...grad, about: 'One partial derivative per score: how fast L changes as that score is nudged.' } };
const lrEta: SymbolMap = { g: grad, eta: { ...ATLAS_SYMBOLS.eta!, about: 'The step size: each step moves η times the gradient. Too small crawls; too large overshoots.' } };
const termVar: SymbolDef = { color: 'orange', name: 'v: the variance of one term', about: 'How spread out each product w x is. A sum of n such terms has variance n v.' };
const flops: SymbolDef = { ...ATLAS_SYMBOLS.Cflops!, about: 'The total arithmetic a training run does, counted in floating point operations, or FLOPs.' };
const rho: SymbolDef = { color: 'purple', name: 'ρ: the probability ratio', tex: '\\rho', code: ['rho', 'ratio'], about: 'π / π_old: how much more likely the answer has become since it was sampled.' };
const baseline: SymbolMap = { ...pick(rl, 'pi R theta A'), b: { color: 'gold', name: 'b: the baseline', code: ['baseline'], about: 'The reward expected before seeing the answer. A = R − b.' } };
const temperature: SymbolMap = {
  tau: { color: 'slate', name: 'τ: the temperature', tex: '\\tau', code: ['tau'], about: 'Similarities are divided by τ before the softmax. Small τ sharpens the contest.' },
  s: { color: 'purple', name: 's: the row\'s scores', code: ['s', 'scores'], about: 'Each similarity divided by τ: one per candidate in the row.' },
};
const secondInput: SymbolDef = { color: 'orange', name: 'v: the second input', about: 'f takes two numbers, u and v. ∂f/∂v holds u still and moves only v.' };
/** A linear recurrence's letters: hₜ = a hₜ₋₁ + b xₜ, yₜ = c hₜ. */
const ssm: SymbolMap = {
  h: { color: 'gold', name: 'h: the state', about: 'What the recurrence carries from step to step: hₜ = a hₜ₋₁ + b xₜ. Unrolled, a weighted sum of every input so far.' },
  a: { color: 'teal', name: 'a: the decay', about: 'Multiplies the state at every step, so an input k steps back is weighted by aᵏ: it fades when |a| < 1 and blows up when |a| > 1.' },
  b: { color: 'green', name: 'b: the input weight', about: 'Scales each input as it enters the state. A weight, not a bias.' },
  c: { color: 'red', name: 'c: the output weight', about: 'Reads the state out: yₜ = c hₜ.' },
  y: { color: 'purple', name: 'y: the output', about: 'What the recurrence reads out at each step: yₜ = c hₜ.' },
};

const sig: SymbolDef = { color: 'teal', name: 'σ: the sigmoid', tex: '\\sigma', code: [], about: 'σ(z) = 1 / (1 + e⁻ᶻ) squashes any number into the range 0 to 1, with σ(0) = 0.5.' };

/**
 * Where a concept needs a symbol to mean something else, or to say only what its prerequisites
 * teach. Keys missing from ATLAS_SYMBOLS work too, through \sym{key}{tex}.
 */
export const SCOPED: Record<string, SymbolMap> = {
  seq2seq: { h: { color: 'gold', name: 'h: the encoder\'s final state', code: ['h'], about: 'H numbers that carry the whole input to the decoder, the same size for three words or fifty.' } },
  'char-lm': {
    h: { color: 'gold', name: 'h: the hidden state', code: ['h'], about: 'The memory after each character: it tells apart steps that read the same letter.' },
    V: { color: 'slate', name: 'V: the vocabulary size', about: 'How many tokens the model knows: each step outputs V scores, then V probabilities.' },
    Why: { color: 'blue', name: 'W_hy: the hidden-to-output weights', tex: 'W_{hy}', code: ['W_hy', 'Why'], about: 'Shape (V, H): turns the memory h into one score per token.' },
  },
  'rnn-step': {
    h: { color: 'gold', name: 'h: the hidden state', code: ['h'], about: 'The memory carried from token to token: hₜ = tanh(W_hh hₜ₋₁ + W_xh xₜ + b). H numbers, each between −1 and 1, starting at all zeros.' },
    b: { color: 'green', name: 'b: the hidden bias', about: 'One number per hidden unit, added before the tanh at every step: shape (H,).' },
  },
  'sgd-linear': { eta: { color: 'slate', name: 'η: the step size', tex: '\\eta', code: ['lr'], about: 'How far each gradient step goes: every weight and bias moves by η times its gradient.' } },
  'receptive-field': { F: { ...ATLAS_SYMBOLS.F!, about: 'A filter covers F × F pixels, or units of the layer below. With stride 1, each layer of size F widens what a unit sees by F − 1.' } },
  convolution: { w: { color: 'blue', name: 'w: the filter', about: 'A few weights slid along x. At each position, its dot product with the patch under it gives one output; the same weights are used everywhere.' } },
  'lr-schedule': { T: { color: 'slate', name: 'T: the length of the decay, in steps', about: 'How many steps the glide from the top rate to the bottom one takes. After a warmup it starts counting where the warmup ends.' } },
  embeddings: {
    E: { color: 'blue', name: 'E: the embedding table', about: 'One row per token in the vocabulary, one column per number in its vector: shape (V, d).' },
    V: { color: 'slate', name: 'V: the vocabulary size', about: 'How many tokens the model knows: the number of rows of E.' },
    d: { color: 'slate', name: 'd: the embedding size', about: 'How many numbers describe each token: the number of columns of E.' },
  },
  derivative: { h: step },
  'derivative-rules': { h: step },
  'grad-check': { h: { ...step, about: 'The small nudge for the numerical slope: (f(x + h) - f(x - h)) / 2h.' } },
  slope: { h: step },
  'power-rule': { h: step },
  'chain-slopes': { v: { color: 'orange', name: 'v: a value in the middle', about: 'The output of one function and the input of the next.' } },
  partials: { v: secondInput },
  gradient: {
    v: secondInput,
    W: { color: 'blue', name: 'W: a grid of numbers', about: 'Numbers in rows and columns, all of them inputs to f.' },
    w: { color: 'blue', name: 'w: a vector of inputs', about: 'Several numbers fed to f at once.' },
  },
  'matrix-shape': { W: { color: 'blue', name: 'W: a matrix', about: 'A grid of numbers in rows and columns. Its shape is (rows, columns), and W[i, j] is the entry in row i, column j, both counted from zero.' } },
  'matmul-shapes': {
    B: { color: 'orange', name: 'B: a matrix', about: 'A second grid of numbers, whose columns are the vectors A multiplies. The product AB needs A\'s columns to match B\'s rows.' },
    C: { color: 'teal', name: 'C: a third matrix', about: 'Four by five here: it turns five numbers into the four that B takes, so A B C is two by five.' },
  },
  argmax: { s: scores, y: answer },
  softmax: { s: scores, p: probs },
  'cross-entropy': { s: scores, y: answer, p: probs, L: loss, T: expTotal },
  'score-grad': softmaxGrad,
  'softmax-grad': softmaxGrad,
  'hinge-loss': { L: loss },
  'gd-step': { g: grad, eta: { ...ATLAS_SYMBOLS.eta!, name: 'η: the step size', about: 'How far each step goes, as a multiple of the gradient.' } },
  'grad-clipping': {
    g: grad,
    eta: { ...ATLAS_SYMBOLS.eta!, name: 'η: the step size', code: ['eta'], about: 'How far each step goes, as a multiple of the gradient.' },
    c: { color: 'slate', name: 'c: the clipping threshold', code: ['c'], about: 'The longest gradient allowed. A longer one is scaled down to length c, keeping its direction.' },
  },
  'step-factor': { g: grad, eta: { ...ATLAS_SYMBOLS.eta!, name: 'η: the step size', about: 'How far each step goes, as a multiple of the gradient. On a bowl a x², it sets the step factor 1 − 2aη.' } },
  'learning-rate': lrEta,
  'lr-decay': {
    g: grad,
    T: { color: 'slate', name: 'T: the length of the decay, in steps', about: 'How many steps the straight-line fall from ηₘₐₓ to ηₘᵢₙ takes; at step t the run is t / T of the way down.' },
  },
  minibatch: { g: grad, N: { color: 'slate', name: 'N: the number of examples', about: 'How many examples the function averages over. One pass through all N is an epoch.' } },
  'param-count': {
    h: { color: 'gold', name: 'h: the middle numbers', about: 'What the first map hands to the second: h = W1 x + b1, H numbers.' },
    D: { color: 'slate', name: 'D: the number of input features', about: 'How many numbers make up one input: 3,072 for a 32 by 32 color image. It is the number of columns of W.' },
    H: { color: 'slate', name: 'H: the size of the middle', about: 'How many numbers the first map hands to the second: a choice, not fixed by the data.' },
    W1: { color: 'blue', name: 'W1: the first map\'s weights', tex: 'W_1', about: 'Shape (H, D): one row per number in the middle.' },
    b1: { color: 'green', name: 'b1: the first map\'s biases', tex: 'b_1', about: 'One per number in the middle.' },
    W2: { color: 'blue', name: 'W2: the second map\'s weights', tex: 'W_2', about: 'Shape (C, H): one row per class.' },
    b2: { color: 'green', name: 'b2: the second map\'s biases', tex: 'b_2', about: 'One per class.' },
  },
  qkv: { ...pick(att, 'q k v Wq Wk Wv d dk x'), q: { ...att.q!, about: 'What is being looked for: first the decoder\'s state, then each token\'s own q = W_Q x. Its dot product with every key scores how well each matches.' } },
  'scaled-attention': pick(att, 'q k dk'),
  'self-attention': pick(att, 'q k v Q K V Wq Wk Wv d dk dv T A X x'),
  'causal-mask': pick(att, 'Q K dk T'),
  'multi-head': pick(att, 'q Q K V Wq Wk Wv Wo d T A X x heads dhead'),
  positions: {
    d: att.d!,
    P: { color: 'slate', name: 'P: the position table', about: 'One learned vector per position, T_max rows of d numbers. Row i is added to the token at position i.' },
    Tmax: { color: 'slate', name: 'T_max: the longest input', tex: 'T_{\\max}', about: 'How many positions the table has rows for: the most tokens the model can read at once.' },
  },
  'layer-norm': {
    d: { color: 'slate', name: 'd: the number of features', about: 'How many numbers make up one example; layer norm averages over them.' },
    gamma: { color: 'purple', name: 'γ: the learned scale', tex: '\\gamma', about: 'Layer norm multiplies each normalized feature by its own γ: one entry per feature.' },
    beta: { color: 'green', name: 'β: the learned shift', tex: '\\beta', about: 'Layer norm adds β after scaling: one entry per feature.' },
    epstiny: tiny,
    mu: { color: 'orange', name: 'μ: the mean', tex: '\\mu', about: 'The average of one example\'s features.' },
    sigma: { color: 'teal', name: 'σ: the standard deviation', tex: '\\sigma', about: 'How spread out one example\'s features are: the square root of their variance, σ².' },
  },
  'batch-norm': {
    y: { color: 'gold', name: 'y: the batch-norm output', about: 'γx̂ + β: the normalized feature, scaled and shifted; what the activation receives.' },
    mu: { color: 'orange', name: 'μ: the batch mean', tex: '\\mu', about: 'The average of one feature over the examples in the batch.' },
    sigma: { color: 'teal', name: 'σ: the standard deviation', tex: '\\sigma', about: 'How spread out one feature is over the batch: the square root of its variance, σ².' },
    epstiny: tiny,
  },
  'transformer-block': { ...pick(att, 'd T x'), ...mlpW },
  'transformer-params': {
    ...pick(att, 'd Wq Wk Wv Wo'),
    W1: { ...mlpW.W1!, about: 'Shape (4d, d): 4d² weights.' },
    W2: { ...mlpW.W2!, about: 'Shape (d, 4d): 4d² weights.' },
    nblocks: { color: 'slate', name: 'N: the number of blocks', tex: 'N', code: ['n_blocks'], about: 'How many transformer blocks are stacked. The blocks hold about 12Nd² weights.' },
    vocab: { color: 'slate', name: 'V: the vocabulary size', tex: 'V', code: ['vocab'], about: 'How many tokens the embedding table has rows for: V × d numbers.' },
  },
  'attention-cost': pick(att, 'Q K Wq Wk Wv T heads'),
  'training-memory': adamMoments,
  zero: { ...adamMoments, G: { color: 'slate', name: 'G: the number of GPUs', about: 'How many GPUs share the work. Sharding splits the memory G ways.' } },
  'data-parallel': { G: { color: 'slate', name: 'G: the number of GPUs', about: 'How many copies of the model train side by side, each on its own slice of the batch.' } },
  'model-parallel': {
    W1: { color: 'blue', name: 'W1: the first weights', tex: 'W_1', about: 'Shape (d, 4d), applied as x @ W1: one column per output, so a column split gives each GPU some of the outputs.' },
    W2: { color: 'blue', name: 'W2: the second weights', tex: 'W_2', about: 'Shape (4d, d), applied as h @ W2: a row split gives each GPU a part of every output, to be added up.' },
  },
  'adam-moments': pick(adamAll, 'm v beta1 beta2'),
  adam: adamAll,
  adamw: adamAll,
  moe: {
    E: { color: 'slate', name: 'E: the number of experts', about: 'How many MLPs the layer holds. Each token uses only a few of them.' },
    topk: { color: 'slate', name: 'k: experts per token', tex: 'k', code: ['k'], about: 'How many experts the router picks for each token.' },
    p: { color: 'teal', name: 'p: the router\'s probabilities', code: ['p', 'probs'], about: 'A softmax over the experts: how strongly the router favors each one for this token.' },
  },
  rmsnorm: { d: { color: 'slate', name: 'd: the number of features', about: 'How many numbers each vector has; the mean square is taken over them.' }, gamma: { color: 'purple', name: 'γ: the learned gain', tex: '\\gamma', about: 'One entry per feature, multiplied in after normalizing.' }, beta: { color: 'green', name: 'β: the learned shift', tex: '\\beta', about: 'Layer norm adds it after scaling; RMSNorm leaves it out.' } },
  swiglu: { d: att.d!, h: { color: 'slate', name: 'h: the hidden width', code: ['h'], about: 'How wide the MLP is inside: each of its three matrices has d × h weights.' }, sig },
  gqa: { ...pick(att, 'q k v d heads dhead'), kvheads: { color: 'slate', name: 'g: the number of key-value heads', tex: 'g', code: ['n_kv'], about: 'How many key and value heads the query heads share. The cache shrinks by h / g.' } },
  'residual-stream': {
    x: { color: 'orange', name: 'x: the residual stream', about: 'One running vector per token: the embedding x₀ plus everything each block has added.' },
    x0: { color: 'orange', name: 'x₀: the embedding', tex: 'x_0', code: ['x0'], about: 'Where the stream starts: the token\'s embedding, before any block writes to it.' },
    d: att.d!,
  },
  'logit-lens': { x: { color: 'orange', name: 'x: the residual stream', about: 'One running vector per token: the embedding x₀ plus everything each block has added.' }, s: { color: 'purple', name: 's: the scores', code: ['s', 'scores'], about: 'One per token in the vocabulary: W_U times the stream.' } },
  'linear-probe': {
    h: { color: 'gold', name: 'h: the activations probed', code: ['h'], about: 'The hidden vector the probe reads, taken from partway through the model.' },
    w: { color: 'blue', name: 'w: the probe\'s weights', about: 'One weight per entry of h, fitted on labeled examples.' },
    b: { color: 'green', name: 'b: the probe\'s bias', about: 'Added to the score before reading off the class.' },
    s: { color: 'purple', name: 's: the probe\'s score', about: 's = w·h + b; its sign, or its largest entry, gives the class.' },
  },
  superposition: {
    f: { color: 'purple', name: 'f: the feature values', about: 'How strongly each feature is present. Most are zero for any one token.' },
    W: { color: 'blue', name: 'W: the feature directions', about: 'One row per feature: the direction in the stream that stores it.' },
    x: { color: 'orange', name: 'x: the residual stream', about: 'One running vector per token: the embedding x₀ plus everything each block has added.' }, d: att.d!,
  },
  sae: {
    f: { color: 'purple', name: 'f: the feature activations', about: 'The wide, mostly zero code the encoder makes from x.' },
    lam: { color: 'slate', name: 'λ: the sparsity strength', tex: '\\lambda', code: ['lam'], about: 'How much the L1 penalty on f counts against reconstructing x.' },
    v: { color: 'gold', name: 'v_j: a feature\'s direction', about: 'Row j of the decoder: what feature j adds back to the reconstruction.' },
    x: { color: 'orange', name: 'x: the residual stream', about: 'One running vector per token: the embedding x₀ plus everything each block has added.' }, d: att.d!,
  },
  sft: { m: { color: 'slate', name: 'm: the loss mask', code: ['mask'], about: '1 on the tokens the assistant wrote, its end token included; 0 everywhere else.' } },
  lora: {
    B: { color: 'green', name: 'B: the up-projection', about: 'Shape (d, r). It starts at zero, so BA adds nothing at first.' },
    A: { color: 'orange', name: 'A: the down-projection', about: 'Shape (r, k), starting random.' },
    r: { color: 'slate', name: 'r: the rank', about: 'How narrow the change BA is: it has r(d + k) parameters instead of dk.' },
  },
  'log-trick': pick(rl, 'pi R theta'),
  'policy-gradient': pick(rl, 'pi R theta'),
  baseline,
  advantage: baseline,
  'sigmoid-grad': { sig: { ...sig, about: 'σ(x) = 1 / (1 + e⁻ˣ) squashes any number into the range 0 to 1, with σ(0) = 0.5. Sigmoid means S-shaped: it is Verhulst\'s growth curve, levelling off at 1.' } },
  activations: { sig },
  gan: {
    gen: { color: 'green', name: 'G: the generator', tex: 'G', code: [], about: 'G(z) is the fake image it makes from the noise z.' },
    disc: { color: 'purple', name: 'D: the discriminator', tex: 'D', code: [], about: 'D(x) is its score for an image x: the probability it gives that x is real.' },
    znoise: { color: 'slate', name: 'z: the noise', tex: 'z', code: [], about: 'A random draw that the generator turns into a fake. A new z gives a new fake.' },
  },
  lstm: {
    cell: { color: 'teal', name: 'c: the cell state', tex: 'c', code: [], about: 'The LSTM\'s second memory, carried from step to step. c_t is its value at step t.' },
    fgate: { color: 'red', name: 'f: the forget gate', tex: 'f', code: [], about: 'A sigmoid, between 0 and 1: how much of the old cell state to keep.' },
    igate: { color: 'green', name: 'i: the input gate', tex: 'i', code: [], about: 'A sigmoid, between 0 and 1: how much of the candidate to add to the cell.' },
    ogate: { color: 'purple', name: 'o: the output gate', tex: 'o', code: [], about: 'A sigmoid, between 0 and 1: how much of the cell, through a tanh, to show as h.' },
    cand: { color: 'gold', name: 'g: the candidate', tex: 'g', code: [], about: 'A tanh, between −1 and 1: the new content proposed for the cell.' },
    h: { color: 'gold', name: 'h: the hidden state', code: ['h'], about: 'What each step shows and feeds back to every gate: h = o · tanh(c).' },
    b: { color: 'green', name: 'b: the bias', about: 'Added inside the step, one number per hidden unit.' },
  },
  'preference-loss': { r: { color: 'gold', name: 'r: the reward model\'s score', about: 'One number per answer. Only differences between two answers\' scores matter.' }, sig },
  'reward-model': { r: { color: 'gold', name: 'r: the reward model\'s score', about: 'One number per answer. Only differences between two answers\' scores matter.' }, sig },
  'kl-penalty': pick(rl, 'pi R theta piref beta'),
  distillation: {
    s: { ...scores, name: 's: the teacher\'s scores', about: 'The large network\'s scores for one input, one per class.' },
    q: { color: 'green', name: 'q: the soft targets', code: ['q'], about: 'The teacher\'s probabilities at temperature T: softmax(s / T). The student is trained to match them.' },
    p: { ...probs, name: 'p: the student\'s probabilities', about: 'The small network\'s softmax at the same temperature T.' },
    L: { ...loss, name: 'L: the distillation loss', about: 'Cross-entropy against the soft targets: −Σ q ln p.' },
  },
  'prob-ratio': { ...pick(rl, 'pi piold A'), rho },
  ppo: { ...pick(rl, 'pi piold A'), rho, eps: { color: 'slate', name: 'ε: the clip range', tex: '\\epsilon', code: ['eps'], about: 'How far ρ may move from 1 before the objective stops rewarding it, often 0.2.' } },
  dpo: { ...pick(rl, 'pi piref beta'), yw: { color: 'green', name: 'y_w: the chosen answer', tex: 'y_w', about: 'The answer people preferred.' }, yl: { color: 'red', name: 'y_l: the rejected answer', tex: 'y_l', about: 'The answer people passed over.' }, sig },
  grpo: { A: rl.A!, G: { color: 'slate', name: 'G: the group size', about: 'How many answers are sampled for one prompt.' }, r: { color: 'gold', name: 'r: an answer\'s reward', about: '1 when the answer checks out, 0 when it does not.' } },
  unembedding: {
    h: { color: 'gold', name: 'h: the last vector at one position', code: ['h'], about: 'What the model has computed for this position: d numbers, about to be scored against every token.' },
    s: { color: 'purple', name: 's: the scores', code: ['s', 'scores', 'logits'], about: 'One per token in the vocabulary, the logits: the argmax, the position of the highest, names the token the model picks.' },
  },
  gpt: {
    ...pick(att, 'd T'),
    x: { color: 'orange', name: 'x: the vectors between blocks', about: 'One row per position, shape (T, d).' },
    h: { color: 'gold', name: 'h: the last vector at one position', code: ['h'], about: 'What the blocks hand to the unembedding: d numbers per position.' },
    s: { color: 'purple', name: 's: the scores', code: ['s', 'scores', 'logits'], about: 'One per token in the vocabulary, at every position.' },
  },
  'kv-cache': pick(att, 'q k v d T'),
  'kv-memory': pick(att, 'd'),
  perplexity: { L: { color: 'red', name: 'L: the average next-token loss', code: ['L', 'loss'], about: 'The mean of −ln p over the tokens; perplexity is e to this.' } },
  autoencoder: { z: { color: 'purple', name: 'z: the code', about: 'The narrow middle: what the encoder keeps of x for the decoder to rebuild it from.' } },
  vae: {
    mu: { color: 'orange', name: 'μ: the code\'s mean', tex: '\\mu', about: 'Where the encoder centers one dimension of the code.' },
    sigma: { color: 'teal', name: 'σ: the code\'s spread', tex: '\\sigma', about: 'How far the sampled code may land from μ in that dimension.' },
    eps: { ...dif.eps!, about: 'Standard normal noise: mean 0, spread 1.' },
    z: { color: 'purple', name: 'z: the sampled code', about: 'z = μ + σε: a code drawn near μ, which the decoder turns back into an input.' },
  },
  'contrastive-loss': temperature,
  contrastive: temperature,
  clip: { N: { color: 'slate', name: 'N: the pairs in the batch', about: 'N images and their N captions. Each row has 1 right caption and N − 1 wrong ones.' } },
  'diffusion-noise': pick(dif, 'x0 xt eps ab tstep'),
  'diffusion-loss': pick(dif, 'x0 xt eps ab epshat tstep'),
  rotation: {
    ...pick(att, 'q k'),
    b: { color: 'gold', name: 'b: the pair\'s second entry', about: 'How far up the pair goes. Turned, it adds b·[−sin, cos].' },
    s: { color: 'gold', name: 's: the sine of the angle', about: 'How far up an arrow of length 1 lands when turned by the angle: sin 60° ≈ 0.87.' },
  },
  rope: {
    ...pick(att, 'q k dk'),
    theta: { color: 'orange', name: 'θ: the turn per position', tex: '\\theta', code: ['theta'], about: 'The angle a pair turns for each step of position: at position m it turns by mθ. Each pair has its own θ.' },
    R: { color: 'blue', name: 'R: the rotation', about: 'The 2 by 2 matrix [[cos, −sin], [sin, cos]] for one angle. R times a pair turns it by that angle.' },
  },
  'online-softmax': {
    ...pick(att, 'q T dv'),
    s: { ...scores, name: 's: a score', about: 'One query against one key, read one at a time.' },
    m: { color: 'orange', name: 'm: the running max', code: ['m'], about: 'The largest score read so far. Every e^(s − m) is taken against it, so none overflows.' },
    l: { color: 'green', name: 'ℓ: the running sum', tex: '\\ell', code: ['l'], about: 'The sum of e^(s − m) over the scores read so far. When m grows, ℓ is multiplied by e^(old m − new m).' },
    o: { color: 'gold', name: 'o: the running output', code: ['o'], about: 'The values weighted by e^(s − m) so far, rescaled like ℓ. At the end, o / ℓ is attention\'s output.' },
    c: { color: 'slate', name: 'c: the rescale factor', code: ['c'], about: 'e^(old m − new m): what ℓ and o are multiplied by when a bigger score arrives.' },
  },
  saliency: { g: { ...grad, name: 'g: the gradient of one class score', about: 'One partial derivative per pixel: how fast s_c moves when that pixel is nudged. Its absolute value is the saliency map.' }, s: { color: 'purple', name: 's: a class score', about: 'The number the classifier gives one class; the saliency map is the size of its gradient with respect to the pixels.' } },
  upsampling: { w: { color: 'blue', name: 'w: the filter\'s weights', about: 'F weights. Each input value stamps a copy of them, scaled by that value, into the output.' } },
  'ddpm-sampling': {
    ...pick(dif, 'xt eps epshat tstep'),
    x0: { ...dif.x0!, name: 'x̂₀: the clean-image estimate', tex: '\\hat x_0', code: ['x0_hat', 'x0'], about: 'What the image would be if the noise guess were exactly right: (x_t − √(1 − ᾱ_t) ε̂) / √ᾱ_t.' },
    ab: { ...dif.ab!, code: ['ab', 'ab_prev', 'alpha_bar'] },
    sigma: { color: 'slate', name: 'σ: the fresh-noise scale', tex: '\\sigma', code: ['sigma', 's2'], about: 'How much new noise each step adds back; σ² is the share of variance set aside for it. It is 0 at the last step.' },
    z: { color: 'slate', name: 'z: fresh noise', code: ['z'], about: 'A new standard normal draw at each step, scaled by σ.' },
  },
  'flow-matching': {
    ...pick(dif, 'x0 xt eps'),
    ttime: { color: 'slate', name: 't: the time', tex: 't', code: [], about: 'How far along the line from the image to the noise: x_t is the image at t = 0 and pure noise at t = 1.' },
    v: { color: 'green', name: 'v: the velocity', code: ['v'], about: 'ε − x₀: the direction and speed along the straight line from the image to the noise. It is the same at every t.' },
    vhat: { color: 'red', name: 'v̂: the network\'s velocity guess', tex: '\\hat v', code: ['v_hat'], about: 'What the network predicts the velocity is, from x_t and t. Training makes it match ε − x₀.' },
  },
  'latent-diffusion': {
    ...pick(dif, 'eps epshat ab tstep'),
    z: { color: 'green', name: 'z: the latent', code: ['z'], about: 'The encoder\'s small version of the image. Diffusion runs on it instead of on the pixels.' },
    zt: { color: 'purple', name: 'z_t: the noised latent', tex: 'z_t', code: ['zt', 'z_t'], about: 'The latent blended with noise at step t, as x_t was for an image.' },
  },
  guidance: {
    epshat: dif.epshat!,
    epsu: { color: 'slate', name: 'ε_u: the guess without the prompt', tex: '\\epsilon_u', code: ['eps_u'], about: 'The network\'s noise guess when it is shown no prompt.' },
    epsc: { color: 'orange', name: 'ε_c: the guess with the prompt', tex: '\\epsilon_c', code: ['eps_c'], about: 'The network\'s noise guess when it is shown the prompt.' },
    wg: { color: 'gold', name: 'w: the guidance scale', tex: 'w', code: ['scale'], about: 'How far to step along ε_c − ε_u. 1 is the plain prompted guess; larger follows the prompt harder.' },
  },
  quantization: { w: { color: 'blue', name: 'w: the weights to store', about: 'Each one is kept as an integer q times the scale s.' } },
  'variance-sum': { v: termVar },
  momentum: {
    v: { color: 'orange', name: 'v: the velocity', about: 'A running blend of past gradients. Momentum steps along v instead of the latest gradient, so steady directions build speed and noise cancels out.' },
    mu: { color: 'orange', name: 'μ: the momentum coefficient', tex: '\\mu', about: 'The share of the velocity that survives each step, often 0.9: one minus friction.' },
  },

  'weight-grad': { g: fGrad },
  'backprop-graph': { g: fGrad },
  'matmul-grad': { g: fGrad },
  gates: { g: { ...grad, name: 'dx, dz, dq: gradients of f', code: ['dq', 'dx', 'dz'], about: 'd before a name holds ∂f/∂ of that value: how far the final output f moves per unit of it. dq arrives from above; dx and dz are what the gate sends back.' } },
  'log-log': { Cflops: flops },
  'power-laws': { Cflops: flops },
  neuron: { b: { color: 'green', name: 'b: the bias', about: 'One number added to the weighted sum. It shifts where the neuron switches on.' } },
  residual: { g: { ...grad, name: 'g: the gradient arriving at y', about: 'How much the final output moves per nudge of the block\'s output y.' } },
  'conv-output-size': { F: { ...ATLAS_SYMBOLS.F!, about: 'A filter covers F positions along each side of the input. 3 is the usual choice.' } },
  'rnn-attention': {
    s: { ...scores, name: 's: the attention scores', about: 'One per encoder state: the decoder\'s state q dotted with that state.' },
    alpha: { color: 'teal', name: 'α: the attention weights', tex: '\\alpha', code: ['a', 'alpha', 'weights'], about: 'The softmax of the scores: positive, adding up to one.' },
    q: { color: 'teal', name: 'q: the decoder\'s state', about: 'What the decoder is looking for at this step. Its dot product with each encoder state hⱼ gives that state\'s score.' },
  },
  sampling: { s: { ...scores, name: 's: the next-token scores', about: 'One number per token in the vocabulary. Softmax turns them into probabilities.' } },
  'linear-recurrence': ssm,
  'selective-ssm': {
    ...ssm,
    a: { color: 'teal', name: 'aₜ: the decay at step t', about: 'aₜ = e^(−Δₜ), set by each input: near 0 forgets the old state, near 1 keeps it.' },
    Delta: { color: 'slate', name: 'Δ: the step size', tex: '\\Delta', code: ['dt'], about: 'Computed from each input by a small learned layer, always positive. A big step gives a decay near 0, a small one a decay near 1.' },
    d: att.d!,
  },
  'latent-attention': {
    ...pick(att, 'q k v d heads dhead x'),
    kvheads: { color: 'slate', name: 'g: the number of key-value heads', tex: 'g', code: ['n_kv'], about: 'How many key and value heads grouped-query attention keeps; the query heads share them.' },
    dc: { color: 'slate', name: 'd_c: the latent\'s size', tex: 'd_c', code: ['d_c'], about: 'How many numbers the latent c holds: all the cache keeps per token per layer, far fewer than 2 h d_head.' },
    latent: { color: 'green', name: 'c: the latent', tex: 'c', code: ['c'], about: 'A short vector, c = W_DKV x, made once per token per layer and cached. Every head rebuilds its key and value from it.' },
    Wdkv: { color: 'blue', name: 'W_DKV: the down-projection', tex: 'W_{DKV}', code: ['W_dkv'], about: 'A learned (d_c, d) matrix that squeezes a token\'s d numbers into the latent c. D for down, KV for the keys and values it serves.' },
    Wuk: { color: 'blue', name: 'W_UK: the key up-projection', tex: 'W_{UK}', code: ['W_uk'], about: 'A learned (h d_head, d_c) matrix. Head i\'s part, (d_head, d_c), rebuilds that head\'s key from c.' },
    Wuv: { color: 'blue', name: 'W_UV: the value up-projection', tex: 'W_{UV}', code: ['W_uv'], about: 'A learned (h d_head, d_c) matrix. Head i\'s part rebuilds that head\'s value from c.' },
  },
  'rope-scaling': {
    theta: { color: 'orange', name: 'θ: the turn per position', tex: '\\theta', code: ['theta'], about: 'The angle a pair turns for each step of position: at position m it turns by mθ, or mθ / s after interpolation.' },
    stretch: { color: 'gold', name: 's: the stretch', tex: 's', code: ['scale'], about: 'The new length over L_train. Position interpolation divides every position by s, so every angle stays in the trained range.' },
    Ltrain: { color: 'slate', name: 'L_train: the trained length', tex: 'L_{\\text{train}}', code: ['train_len'], about: 'The longest text the model was trained on. Its positions run from 0 to L_train − 1.' },
  },
  'vision-language': {
    d: { ...att.d!, name: 'd: the language model\'s width', about: 'How many numbers each token\'s vector has inside the language model.' },
    W: { color: 'blue', name: 'W: the projection', about: 'One matrix, shared by every patch: it maps a patch vector to the language model\'s width d.' },
    b: { color: 'green', name: 'b: the projection\'s biases', about: 'One per output number, added after W.' },
    N: { color: 'slate', name: 'N: the number of patches', about: '(H / P)²: each patch becomes one image token.' },
    x: { color: 'orange', name: 'x: the prompt\'s vectors', about: 'One per token: the image tokens first, then the text.' },
    Tmax: { color: 'slate', name: 'T_max: the longest input', tex: 'T_{\\max}', code: ['T_max'], about: 'The most tokens the language model reads at once. Image tokens and text share it.' },
  },
  'verifiable-rewards': {
    A: rl.A!,
    G: { color: 'slate', name: 'G: the group size', about: 'How many answers are sampled for one prompt.' },
    r: { color: 'gold', name: 'r: the checker\'s reward', about: '1 when the final answer checks out, or every test passes; 0 when it does not.' },
  },
};

/** Library notes that would name later topics, said only in general terms. */
export const ATLAS_GLOSSARY: Glossary = {
  'np.argmax': { is: 'the index of the largest value', more: 'With no axis it searches the flattened array; with axis=1 it returns one index per row. Ties go to the first.', eg: 'np.argmax([2.1, -0.4, 5.7])   # 2' },
  'np.radians': { is: 'converts degrees to radians', more: 'A full turn of 360 degrees is 2π radians.', eg: 'np.radians(180)   # 3.14159...' },
  'np.exp': { is: 'e to the power of every element', more: 'Every result is positive. It overflows to inf past about 709.', eg: 'np.exp(0.0)   # 1.0' },
  'np.log': { is: 'the natural logarithm of every element', more: 'Base e, the inverse of np.exp. np.log(0) is -inf.', eg: 'np.log(np.e)   # 1.0' },
  'np.ones': { is: 'an array of ones of a given shape', more: 'The shape is one number or a tuple; the default dtype is float64.', eg: 'np.ones((2, 3)).shape   # (2, 3)' },
  'np.outer': { is: 'every product a[i] * b[j], as a matrix', more: 'The result has shape (len(a), len(b)).', eg: 'np.outer([1, 2], [3, 4])   # [[3 4] [6 8]]' },
  'np.random.choice': { is: 'random picks from a range or an array', more: 'np.random.choice(N, B) picks B integers below N, with replacement unless replace=False. p gives each option\'s probability.', eg: 'np.random.choice(3, p=[0, 0, 1])   # 2' },
  'np.random.randn': { is: 'samples from the standard normal distribution', more: 'Mean 0, standard deviation 1, with the arguments giving the shape. The n stands for normal.', eg: 'np.random.randn(10, 3072).shape  # (10, 3072)' },
  'np.var': { is: 'the variance: the mean squared distance from the mean', eg: 'np.var([1, 3])   # 1.0' },
  'np.zeros_like': { is: 'zeros with the same shape and dtype as x', eg: 'np.zeros_like(np.ones(3))   # [0. 0. 0.]' },
  'np.random.permutation': { is: 'the numbers 0 to n - 1 in a random order', more: 'Slicing the result splits a dataset at random with no example in two parts.', eg: 'np.random.permutation(4)   # e.g. [2 0 3 1]' },

  // PyTorch, as the ConvNet listings use it.
  'torch.tensor': { is: 'an array, as PyTorch stores it', eg: 'torch.tensor([1., 2.]).shape   # torch.Size([2])' },
  'torch.randn': { is: 'standard normal random numbers of a given shape', eg: 'torch.randn(3, 32, 32).shape   # (3, 32, 32)' },
  'nn.Conv2d': { is: 'a convolution layer: in channels, out channels, filter size', more: 'Optional stride and padding arguments; it holds one bias per output channel.', eg: 'nn.Conv2d(3, 8, 3)   # 8 filters of shape (3, 3, 3)' },
  'nn.Linear': { is: 'a fully connected layer: inputs, outputs', more: 'A weight matrix of shape (outputs, inputs) and one bias per output.', eg: 'nn.Linear(512, 10)   # 5,130 parameters' },
  'nn.MaxPool2d': { is: 'max pooling over square windows', more: 'With one argument, the window size is also the stride.', eg: 'nn.MaxPool2d(2)   # halves height and width' },
  'nn.AvgPool2d': { is: 'average pooling over square windows', eg: 'nn.AvgPool2d(2)' },
  'nn.ReLU': { is: 'the ReLU activation as a layer', eg: 'nn.ReLU()' },
  'nn.Flatten': { is: 'lays each example out as one long vector', eg: '(32, 8, 8) -> 2048' },
  'nn.Sequential': { is: 'layers applied one after another', eg: 'nn.Sequential(nn.Linear(4, 3), nn.ReLU())' },
  '.numel': { is: 'how many numbers a tensor holds', eg: 'torch.zeros(8, 3, 3, 3).numel()   # 216' },
  '.Compose': { is: 'chains image transforms into one', eg: 'transforms.Compose([crop, flip])' },
  '.RandomCrop': { is: 'cuts a random square of the given size', eg: 'transforms.RandomCrop(28)' },
  '.RandomHorizontalFlip': { is: 'mirrors the image left to right half the time', eg: 'transforms.RandomHorizontalFlip()' },
  '.ColorJitter': { is: 'shifts brightness, contrast and color at random', eg: 'transforms.ColorJitter(0.2, 0.2)' },
  '.CenterCrop': { is: 'cuts the middle square of the given size', eg: 'transforms.CenterCrop(28)' },
  SGD: { is: 'a plain gradient descent optimizer over the parameters it is given', eg: 'SGD(params, lr=1e-3)' },

  // Functions and layers the listings define or name for the example.
  out_size: { is: 'the output width for a given input width, filter, stride and padding' },
  conv: { is: 'the convolution layer defined just above' },
  conv1: { is: 'the block\'s first convolution layer' },
  conv2: { is: 'the block\'s second convolution layer' },
  pool: { is: 'the max pooling layer defined just above' },
  avg: { is: 'the average pooling layer defined just above' },
  encoder: { is: 'runs the encoder over the input words and returns its last state' },
  decoder_step: { is: 'one decoder step: the next state and the next word\'s probabilities' },
  load_pretrained: { is: 'loads a network already trained on a large dataset' },
  train_one_epoch: { is: 'one pass of gradient steps over the training split' },
  train: { is: 'trains a model with the given settings and returns it' },
  run: { is: 'one training run with the given settings' },
};

/** Notes on calls whose names mean something only inside one concept's listings. */
export const SCOPED_GLOSSARY: Record<string, Glossary> = {
  'e-and-ln': {
    'np.exp': { is: 'e to the power of every element', more: 'np.exp(x) is eˣ: x years of growth that never stops. np.exp(a) * np.exp(b) equals np.exp(a + b).', eg: 'np.exp(1)   # 2.718' },
    'np.log': { is: 'the natural logarithm of every element', more: 'The inverse of np.exp: the power of e that gives y. Negative below 1; no real log at 0 or below.', eg: 'np.log(np.exp(2))   # 2.0' },
  },
  'exp-log': {
    'np.log': { is: 'the natural logarithm of every element', more: 'The power of e that gives y. np.log(a * b) equals np.log(a) + np.log(b).', eg: 'np.log(6)   # 1.79' },
  },
  vit: { block: { is: 'one transformer block: (N + 1, d) in, (N + 1, d) out' } },
  autoencoder: { decode: { is: 'the decoder: turns a code back into an input-sized output' } },
  vae: {
    encode: { is: 'the encoder: a mean and a spread for each code dimension' },
    decode: { is: 'the decoder: turns a code back into an input-sized output' },
  },
  gan: {
    gen: { is: 'the generator: turns random noise into a fake image' },
    disc: { is: 'the discriminator: the probability that an image is real' },
  },
  'contrastive-loss': {
    crop: { is: 'a random crop of the image, recolored: one view' },
    enc: { is: 'the encoder: one vector per image' },
  },
  clip: {
    unit: { is: 'scales each row to length 1, so a dot product compares only directions' },
    img_enc: { is: 'the image encoder: one vector per image' },
    txt_enc: { is: 'the text encoder: one vector per caption' },
    cross_entropy: { is: 'the average of −ln softmax(row)[right column] over the rows' },
  },
  'diffusion-loss': { model: { is: 'the denoising network: from x_t and t, its guess of the noise' } },
  'box-iou': { area: { is: 'the area of a box: width times height' } },
  iou: { iou: { is: 'intersection over union of two boxes' } },
  upsampling: { up_size: { is: 'the output width of a transposed convolution: S(W − 1) + F − 2P' } },
  'ddpm-sampling': { model: { is: 'the denoising network: from x_t and t, its guess of the noise' } },
  'flow-matching': { model: { is: 'the network: from x_t and t, its guess of the velocity' } },
  'latent-diffusion': {
    model: { is: 'the denoising network, run on latents: from z_t and t, its guess of the noise' },
    encode: { is: 'the encoder: turns an image into its small latent' },
    decode: { is: 'the decoder: turns a latent back into an image' },
  },
  guidance: {
    model: { is: 'the denoising network: its noise guess, with or without the prompt' },
    sample: { is: 'generates an image by removing the predicted noise step by step' },
  },
  bpe: {
    count_pairs: { is: 'how often each neighboring pair of ids occurs' },
    merge: { is: 'replaces every (a, b) side by side, left to right, with one new id' },
  },
  gpt: { block: { is: 'one causal transformer block: (T, d) in, (T, d) out' } },
  'in-context': { complete: { is: 'runs the model on a prompt and returns its continuation' } },
  rotation: { rotate: { is: 'turns a pair by an angle in degrees: [a cos − b sin, a sin + b cos]' } },
  rope: { rotate: { is: 'turns a pair by an angle in degrees: the rotation matrix times the pair' } },
  retrieval: {
    embed: { is: 'turns a text into a vector of length 1' },
    complete: { is: 'runs the model on a prompt and returns its continuation' },
  },
  'kv-cache': {
    model: { is: 'one row of next-token probabilities per position' },
    pick: { is: 'chooses the next token from a row of probabilities' },
    qkv: { is: 'one token\'s query, key and value' },
    attend: { is: 'one query over every cached key and value' },
  },
  sft: { model: { is: 'runs the model and returns each token\'s probability' } },
  'policy-gradient': { grad_logp: { is: 'the gradient of ln π for a sampled answer, with respect to θ' } },
  baseline: { grad_logp: { is: 'the gradient of ln π for a sampled answer, with respect to θ' } },
  'preference-loss': { rm: { is: 'the reward model: one score for an answer' } },
  'kl-penalty': { frozen_copy: { is: 'a copy of the model that never trains' } },
  distillation: {
    teacher: { is: 'the large trained network: its scores for an input' },
    student: { is: 'the small network being trained: its scores for an input' },
  },
  'prob-ratio': {
    sample: { is: 'draws answers from a model' },
    pi: { is: 'a token\'s probability under the model being trained' },
    pi_old: { is: 'a token\'s probability under the model that sampled the batch' },
  },
  grpo: { sample: { is: 'draws answers from a model' } },
  rmsnorm: { rms_norm: { is: 'divides x by its root mean square, then multiplies by the gains' } },
  swiglu: { swish: { is: 'z times sigmoid(z): near 0 for very negative z, near z for large z' } },
  'residual-stream': {
    '.attn': { is: 'the block\'s attention: reads the stream and returns what to add' },
    '.mlp': { is: 'the block\'s MLP: reads the stream and returns what to add' },
    ln: { is: 'a layer norm on the stream before each branch reads it' },
  },
  'induction-heads': { '.index': { is: 'the position of the first item equal to the one given', eg: "['K', 'D', 'K'].index('K')   # 0" } },
  positions: { attend: { is: 'self-attention over these tokens, with no position information' } },
  'transformer-block': {
    attention: { is: 'the block\'s multi-head attention: every token attends to every token' },
    ln1: { is: 'the block\'s first layer norm, before attention' },
    ln2: { is: 'the block\'s second layer norm, before the MLP' },
    mlp: { is: 'the block\'s MLP, applied to each token on its own' },
  },
  'attention-cost': { score_bytes: { is: 'the bytes one score matrix takes for n tokens, at 2 bytes per score' } },
  'chain-of-thought': {
    generate: { is: 'writes a reply to the prompt, one token per pass' },
  },
  'majority-vote': {
    solve: { is: 'samples one chain of thought and returns its final answer' },
    Counter: { is: 'counts each distinct item', more: '.most_common(1) gives the top item and its count.', eg: 'Counter([3, 5, 3]).most_common(1)   # [(3, 2)]' },
  },
  'best-of-n': {
    solve: { is: 'samples one answer to the problem' },
    passes: { is: 'runs the checker: True when the answer passes its tests' },
  },
  'prefill-decode': {
    tokens: { is: 'splits text into token ids' },
    model: { is: 'one forward pass: next-token scores at every position, and the updated KV cache' },
    sample: { is: 'draws a token from the probabilities' },
  },
  'power-rule': { df: { is: 'the derivative, written as a function: df(2) is the slope of f at x = 2' } },
  'derivative-rules': { df: { is: 'the derivative, written as a function: df(2) is the slope of f at x = 2' } },
  'chain-rule': { dz_dx: { is: 'dz/dx written as a function of x: dz_dx(1) is the slope at x = 1' } },
  'lr-schedule': { cosine: { is: 'the cosine schedule: the rate at step t of T, from hi down to lo' } },
  'res-block': { cut: { is: 'the shortcut: a 1 × 1 conv that matches x to F(x)\'s shape' } },
  residual: {
    layer1: { is: 'the first layer inside F: weights times x, plus a bias' },
    layer2: { is: 'the second layer inside F: its output is F(x)' },
    block1: { is: 'the first residual block: x + F₁(x)' },
    block2: { is: 'the second residual block: h + F₂(h)' },
  },
  'tool-calls': {
    generate: { is: 'runs the model on a context, one token at a time, until it writes the stop text' },
    parse_call: { is: 'reads the tool name and argument between the call markers' },
    weather: { is: 'the tool: looks up a city\'s forecast' },
  },
  'agent-loop': {
    generate: { is: 'runs the model on a context, one token at a time, until it writes the stop text' },
    run_tool: { is: 'reads the call between the markers, runs that tool and returns its result' },
  },
  'vision-language': {
    vit: { is: 'the trained vision transformer: one vector per patch, plus the class token' },
    gpt: { is: 'the decoder-only language model: reads the vectors and writes the reply' },
  },
  speculative: {
    draft: { is: 'the small model\'s next k tokens, one at a time' },
    large: { is: 'one pass of the large model over the text plus the guesses: its own pick at each guess, and one more' },
  },
};

/** Every key any concept uses, for page-wide `\sym` macros and colors. */
export const ALL_SYMBOLS: SymbolMap = Object.assign({}, ...Object.values(SCOPED), ATLAS_SYMBOLS);

/** The symbols and library notes an explainer shows, from its script id, atlas-<concept>. */
export function lookupFor(scriptId: string): { symbols: SymbolMap; glossary: Glossary } {
  const id = scriptId.replace(/^atlas-/, '');
  return { symbols: { ...ATLAS_SYMBOLS, ...SCOPED[id] }, glossary: { ...ATLAS_GLOSSARY, ...SCOPED_GLOSSARY[id] } };
}
