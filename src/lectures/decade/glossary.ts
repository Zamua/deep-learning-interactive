import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  ConvNet: { is: 'a convolutional network, the 2016 model for images', more: 'In 2016 every task got its own model, and images went through ConvNets.' },
  LSTM: {
    is: 'a recurrent network, the 2016 model for text',
    more: 'It reads tokens in order, one at a time. LSTM stands for long short-term memory (Hochreiter and Schmidhuber, 1997): gates let its memory last longer than a plain RNN\'s.',
  },
  Transformer: {
    is: 'one attention-based model for any kind of data',
    more: 'Introduced in 2017 by Attention Is All You Need, it replaced recurrence with attention. Shift one of the decade: the same architecture for text, images and more.',
  },
  '.pretrain': {
    is: 'trains the model on huge amounts of raw text',
    more: 'Shift two of the decade: predict the next token of web text, which labels itself, at a scale of trillions of words.',
  },
  '.post_train': {
    is: 'finishes the model with feedback',
    more: 'Shift three: fine-tuning on good answers, then reinforcement learning from human preferences, and later from rewards a program can check.',
  },
  mlp: {
    is: 'the small network applied to each token',
    more: 'The second half of a Transformer block, after attention. MLP stands for multilayer perceptron, the plain fully connected network of CS231n.',
  },
  norm: {
    is: 'normalizes each token\'s vector',
    more: 'It keeps the numbers in range before each sublayer, and once more before the output layer. Unlike 2016\'s batch norm, it works on each token alone.',
  },
  patches: {
    is: 'cuts an image into square patches, one row each',
    more: 'patches(img, 16) cuts a 224 by 224 color image into 196 patches of 16 by 16 pixels, each flattened to 768 numbers. Each patch becomes one token.',
  },
  transformer: { is: 'the same Transformer blocks, on image tokens', more: 'Once the patches are projected to vectors, the vision transformer runs exactly the blocks used for text.' },
  tokenize: {
    is: 'splits text into token ids',
    more: 'Each piece of text, often a word or part of a word, becomes an integer id. The model then predicts each id from the ones before it.',
  },
  model: {
    is: 'the language model: next-token scores',
    more: 'Given ids[:-1], it returns logits of shape (T, vocab): a score for every token in the vocabulary, at every position.',
  },
  finetune: {
    is: 'trains the model to imitate written answers',
    more: 'Supervised fine-tuning, the first step of RLHF: ordinary next-token training, on demonstrations of good answers.',
  },
  fit_reward_model: {
    is: 'learns to predict which answer people prefer',
    more: 'Trained on pairs where a person picked the better of two answers. The result, rm, gives any answer one score.',
  },
  '.sample': { is: 'generates an answer to the prompt', more: 'The model writes one token at a time, each drawn from the softmax of its scores.' },
  rm: {
    is: 'the reward model: one score for an answer',
    more: 'Its guess of how much people would like answer y to the prompt. It is a learned guess, so a model optimized hard against it finds its blind spots: reward hacking.',
  },
  ppo_update: {
    is: 'one RL step toward higher-reward answers',
    more: 'It makes answers with high r more likely and low r less likely. PPO, proximal policy optimization (Schulman et al., 2017), keeps each update close to the current policy.',
  },
  extract: {
    is: 'pulls the final answer out of the text',
    more: 'The model writes out its reasoning; extract finds the final answer, so the program can compare it with the known one, 722 here.',
  },
  reward: {
    is: '1.0 if the answer is right, else 0.0',
    more: 'A verifiable reward: a program checks the answer, so there is no learned reward model to fool.',
  },
  GPT: {
    is: 'a Transformer language model',
    more: 'Set by the vocabulary size, the width d and the number of layers. GPT stands for generative pre-trained transformer (OpenAI, 2018).',
  },
  AdamW: {
    is: 'Adam with decoupled weight decay',
    more: 'The Adam-family optimizer that language models train with today. It only changes how weight decay is applied: weights shrink directly, instead of through the gradient.',
  },
  '.attn': { is: 'the block\'s attention sublayer', more: 'Every token scores every other token and mixes in their values. Its output is added back to h: the residual connection.' },
  '.norm1': { is: 'the normalization before attention', more: 'Each sublayer normalizes its own input, while h itself passes along the residual path unchanged.' },
  '.mlp': { is: 'the block\'s per-token feed-forward network', more: 'The same small MLP runs on every token separately, and its output is added back to h.' },
  '.norm2': { is: 'the normalization before the MLP' },
  cross_entropy: {
    is: 'softmax cross-entropy, averaged over tokens',
    more: 'The loss from Assignment one, with the whole vocabulary as the classes: minus the log probability of each target token.',
  },
};
