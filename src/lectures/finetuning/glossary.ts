import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  '.complete': {
    is: 'continues the text the way a base model would',
    more: 'A base model has no notion of answering: it writes whatever most plausibly comes next on the web, here more questions.',
  },
  sft: {
    is: 'supervised fine-tuning on demonstrations',
    more: 'The pretraining loss, applied to (prompt, ideal answer) pairs with loss on the answer tokens only. "Supervised" because every example comes with the exact text to imitate.',
  },
  lora: {
    is: 'trains a low-rank adapter beside frozen weights',
    more: 'Learns a small update B A for chosen weight matrices, scaled by alpha / r, while the base model stays untouched. LoRA stands for Low-Rank Adaptation (Hu and colleagues, 2021).',
  },
  load: { is: 'loads a dataset by name', more: 'Here the demonstrations: a list of (prompt, ideal answer) pairs.' },
  '.logprob': {
    is: 'the log-probability of an answer given a prompt',
    more: 'The sum of the log-probabilities of the answer\'s tokens, each given the prompt and the tokens before it. Dividing by the answer length gives a per-token loss.',
  },
  '.apply_chat_template': {
    is: 'flattens a list of messages into one text',
    more: 'Wraps each message in the model\'s special tokens, <|im_start|> role ... <|im_end|> in ChatML. With add_generation_prompt=True it ends by opening an assistant message for the model to continue.',
  },
  render: {
    is: 'turns a conversation into token ids and a mask',
    more: 'Applies the chat template, tokenizes, and marks each position 1 if the assistant wrote it (end-of-turn token included), 0 otherwise.',
  },
  model: {
    is: 'a forward pass: token ids in, logits out',
    more: 'One row of next-token scores per position. The loss grades each row against the token that actually came next.',
  },
  log_softmax: {
    is: 'log-probabilities from logits, computed stably',
    more: 'Equal to log(softmax(z)) but computed as z minus logsumexp(z), so tiny probabilities never underflow to log 0. The last position is dropped because no token follows it.',
    eg: 'log_softmax(np.zeros(4))   # all -1.386',
  },
  pretrain: {
    is: 'trains the base model on web text',
    more: 'In the toy: 1,200 steps of next-token prediction on six hundred made-up pages, giving a model that continues documents.',
  },
  copy: { is: 'an independent copy of a model', more: 'Fine-tuning changes the copy and leaves the base model intact for comparison.' },
  sample: {
    is: 'draws a random batch of examples',
    more: 'sample(demos, 16) picks sixteen demonstration conversations. With replay, sample(web_pages, 16) adds sixteen web pages to the same batch.',
  },
  masked_xent: {
    is: 'cross-entropy on the masked-in tokens only',
    more: 'The average negative log-probability over positions whose mask is 1; replayed web pages count every token. "xent" is common shorthand for cross-entropy.',
  },
  adam_step: {
    is: 'one Adam update of the model\'s weights',
    more: 'Backpropagates the loss and moves every weight by Adam\'s rule at learning rate lr. Adam is short for adaptive moment estimation (Kingma and Ba, 2014).',
  },
  '.generate': {
    is: 'writes a continuation token by token',
    more: 'In the toy it shows what the model learned: a quiz question from the base model, an answer and the end token after SFT. In distillation, the teacher\'s answers become training data.',
  },
  log: {
    is: 'the natural logarithm, elementwise',
    more: 'Here inside the KL divergence: p_t times (log p_t minus log q), summed over the vocabulary at each position.',
  },
  qlora: {
    is: 'LoRA on top of a 4-bit quantized base',
    more: 'The frozen base is stored in NF4 and decoded to 16 bits on the fly; only the 16-bit adapters train. From Dettmers and colleagues, 2023.',
  },
  nf4: {
    is: 'quantizes weights to 4-bit NormalFloat',
    more: 'Each block of 64 weights is divided by its largest magnitude and snapped to one of 16 levels placed at quantiles of a normal distribution, dense near zero where trained weights crowd.',
  },
};
