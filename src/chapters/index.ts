import type { Page } from '../core/page';
import type { SymbolMap } from '../core/symbols';

export interface ChapterDef {
  symbols: SymbolMap;
  render(p: Page): void;
}

export interface CourseMeta {
  /** Route (`#/<id>`) and key; must not collide with a chapter id. */
  id: string;
  /** Short course code shown in the top bar and on cards, e.g. "CS231n". */
  code: string;
  title: string;
  /** The front page's heading, HTML with one `<em>` accent. */
  headline: string;
  /** A few words for the course's tile on the index. */
  tagline: string;
  /** When and where, e.g. "Stanford · Winter 2016". */
  era: string;
  blurb: string;
  parts: readonly string[];
}

export const COURSES: CourseMeta[] = [
  {
    id: 'cs231n',
    code: 'CS231n',
    title: 'Convolutional Neural Networks for Visual Recognition',
    headline: 'Teaching machines <em>to see</em>.',
    tagline: 'Teaching machines to see',
    era: 'Stanford · Winter 2016',
    blurb: 'The classic: images as numbers, linear classifiers, backpropagation, neural networks and ConvNets, built from scratch in NumPy, with the course Karpathy, Johnson and Fei-Fei Li taught at Stanford.',
    parts: ['Start here', 'Neural networks', 'Convolutional networks', 'Beyond still images', 'Assignments'],
  },
  {
    id: 'dl26',
    code: 'DL26',
    title: 'A Decade Later: Transformers, Scale and Learning from Feedback',
    headline: 'Transformers, <em>scale</em> and feedback.',
    tagline: 'Transformers and scale',
    era: 'The continuation · 2017 to 2026',
    blurb: 'Everything that changed after CS231n: attention and transformers, tokens and pretraining, scaling laws, AdamW to Muon, mixture of experts, ViT, CLIP and diffusion, then post-training with RLHF, PPO, DPO, RLVR and GRPO, reasoning models and fast inference.',
    parts: ['Start here', 'Attention and transformers', 'Scale', 'Seeing and generating', 'Post-training', 'Serving and understanding'],
  },
];

export interface ChapterMeta {
  id: string;
  /** The course this chapter belongs to (`CourseMeta.id`). */
  course: string;
  /** Shown as the big numeral; assignments use "A1" etc. */
  num: string;
  title: string;
  part: string;
  blurb: string;
  /** Which original lectures this covers, e.g. "Lectures 2-3". */
  lectures?: string;
  /** Reading: the original course notes, or the papers the chapter follows. */
  notes?: { title: string; url: string }[];
  /** The third layer after the lecture and the chapter: an assignment to link (`id`) or a note. */
  practice?: { id?: string; text: string };
}


const N = 'https://cs231n.github.io';
const X = 'https://arxiv.org/abs';

export const CHAPTERS: ChapterMeta[] = [
  { id: 'welcome', course: 'cs231n', num: '0', part: 'Start here', title: 'How this course works', blurb: 'What CS231n is, how the figures and color-coded symbols work, and a map of everything ahead.', practice: { text: 'Nothing to build yet. The math survival kit is a good next stop.' } },
  { id: 'math-kit', course: 'cs231n', num: '1', part: 'Start here', title: 'Math survival kit', blurb: 'Vectors, matrices, sums, slopes, gradients and the chain rule, rebuilt from scratch with code next to every idea.', practice: { text: 'No assignment for this one: these are the tools every assignment uses.' } },
  { id: 'numpy', course: 'cs231n', num: '2', part: 'Start here', title: 'Python and NumPy', blurb: 'Arrays, shapes, indexing, broadcasting and vectorization: the language every assignment is written in.', notes: [{ title: 'Python / NumPy tutorial', url: `${N}/python-numpy-tutorial/` }], practice: { id: 'a1', text: 'Assignment 1 is written in vectorized NumPy from its first line.' } },

  { id: 'image-classification', course: 'cs231n', num: '3', part: 'Neural networks', title: 'Image classification and nearest neighbors', blurb: 'Images as grids of numbers, the data-driven approach, kNN, distances, and honest evaluation with validation sets.', lectures: 'Lecture 2', notes: [{ title: 'Image classification', url: `${N}/classification/` }], practice: { id: 'a1', text: 'Assignment 1 starts here: a kNN classifier on CIFAR-10, tuned with cross-validation.' } },
  { id: 'linear-classification', course: 'cs231n', num: '4', part: 'Neural networks', title: 'Linear classifiers: SVM and Softmax', blurb: 'One matrix multiply that scores every class, two ways to grade those scores, and the templates it learns from CIFAR-10.', lectures: 'Lectures 2-3', notes: [{ title: 'Linear classification', url: `${N}/linear-classify/` }], practice: { id: 'a1', text: 'Assignment 1: the SVM and Softmax losses and their gradients, first with loops, then vectorized.' } },
  { id: 'optimization', course: 'cs231n', num: '5', part: 'Neural networks', title: 'Optimization and gradient descent', blurb: 'Loss landscapes, numerical vs analytic gradients, and walking downhill one mini-batch at a time.', lectures: 'Lecture 3', notes: [{ title: 'Optimization', url: `${N}/optimization-1/` }], practice: { id: 'a1', text: 'Assignment 1: check gradients numerically, then train both classifiers with minibatch SGD.' } },
  { id: 'backprop', course: 'cs231n', num: '6', part: 'Neural networks', title: 'Backpropagation', blurb: 'Computational graphs and the chain rule: how every gradient in deep learning actually gets computed.', lectures: 'Lecture 4', notes: [{ title: 'Backpropagation, intuitions', url: `${N}/optimization-2/` }], practice: { id: 'a1', text: 'Assignment 1: write the forward and backward pass of a two-layer network by hand.' } },
  { id: 'nn-architecture', course: 'cs231n', num: '7', part: 'Neural networks', title: 'Neural networks: the architecture', blurb: 'Neurons, activation functions, layers, and why stacking simple pieces can bend a decision boundary into any shape.', lectures: 'Lectures 4-5', notes: [{ title: 'Neural Networks Part 1', url: `${N}/neural-networks-1/` }], practice: { id: 'a1', text: 'Assignment 1: build, train and tune a two-layer network on CIFAR-10.' } },
  { id: 'nn-data-loss', course: 'cs231n', num: '8', part: 'Neural networks', title: 'Data, initialization and regularization', blurb: 'Preprocessing, weight initialization, batch normalization, dropout and the losses that tie it together.', lectures: 'Lectures 5-6', notes: [{ title: 'Neural Networks Part 2', url: `${N}/neural-networks-2/` }], practice: { id: 'a2', text: 'Assignment 2: batch normalization and dropout as modular layers.' } },
  { id: 'nn-learning', course: 'cs231n', num: '9', part: 'Neural networks', title: 'Training: updates, monitoring, tuning', blurb: 'Gradient checks, reading loss curves, momentum, Adam and friends, learning-rate schedules and hyperparameter search.', lectures: 'Lectures 5-6', notes: [{ title: 'Neural Networks Part 3', url: `${N}/neural-networks-3/` }], practice: { id: 'a2', text: 'Assignment 2: momentum, RMSProp and Adam, and a deep network tuned to work.' } },
  { id: 'case-study', course: 'cs231n', num: '10', part: 'Neural networks', title: 'Putting it together: the spiral', blurb: 'A complete softmax classifier and a two-layer network trained from scratch, line by line, live.', notes: [{ title: 'Minimal neural network case study', url: `${N}/neural-networks-case-study/` }], practice: { id: 'a1', text: 'Assignment 1: the same two-layer network, now on real images.' } },

  { id: 'convnets', course: 'cs231n', num: '11', part: 'Convolutional networks', title: 'Convolutional networks', blurb: 'Filters that slide, pooling that shrinks, the arithmetic of output sizes, and the architectures that won ImageNet.', lectures: 'Lectures 6-7', notes: [{ title: 'Convolutional networks', url: `${N}/convolutional-networks/` }], practice: { id: 'a2', text: 'Assignment 2: convolution and pooling layers, then a ConvNet trained on CIFAR-10.' } },
  { id: 'visualizing', course: 'cs231n', num: '12', part: 'Convolutional networks', title: 'Understanding and visualizing ConvNets', blurb: 'Looking inside a trained network: filters, activations, saliency, occlusion, adversarial examples, DeepDream and style.', lectures: 'Lecture 9', notes: [{ title: 'Understanding and visualizing', url: `${N}/understanding-cnn/` }], practice: { id: 'a3', text: 'Assignment 3: saliency maps, fooling images, class visualization and DeepDream.' } },
  { id: 'convnets-practice', course: 'cs231n', num: '13', part: 'Convolutional networks', title: 'ConvNets in practice', blurb: 'Data augmentation, transfer learning, fast convolution, hardware and the deep learning software stack.', lectures: 'Lectures 11-12', notes: [{ title: 'Transfer learning', url: `${N}/transfer-learning/` }], practice: { id: 'a2', text: 'Assignment 2 ends with an open challenge: the best ConvNet you can train on CIFAR-10.' } },
  { id: 'detection', course: 'cs231n', num: '14', part: 'Convolutional networks', title: 'Localization, detection and segmentation', blurb: 'From one label per image to boxes and pixel masks: IoU, non-max suppression, R-CNN, YOLO and upsampling.', lectures: 'Lectures 8 and 13', practice: { text: 'No 2016 assignment covers detection: the figures in the chapter are the exercises.' } },

  { id: 'rnn', course: 'cs231n', num: '15', part: 'Beyond still images', title: 'Recurrent networks and image captioning', blurb: 'Networks with memory: vanilla RNNs, character models, vanishing gradients, LSTMs, and describing images in words.', lectures: 'Lecture 10', notes: [{ title: 'Recurrent neural networks', url: `${N}/rnn/` }], practice: { id: 'a3', text: 'Assignment 3: image captioning with a vanilla RNN, then an LSTM.' } },
  { id: 'attention', course: 'cs231n', num: '16', part: 'Beyond still images', title: 'Attention and spatial transformers', blurb: 'Letting a network choose where to look: soft attention over image regions and differentiable cropping.', lectures: 'Lecture 13', practice: { text: 'No 2016 assignment covers attention. The DL26 course picks it up from here.' } },
  { id: 'unsupervised', course: 'cs231n', num: '17', part: 'Beyond still images', title: 'Video and unsupervised learning', blurb: 'ConvNets over time, then learning without labels: autoencoders, variational autoencoders and GANs.', lectures: 'Lecture 14', practice: { text: 'No 2016 assignment covers this: the figures in the chapter are the exercises.' } },

  { id: 'a1', course: 'cs231n', num: 'A1', part: 'Assignments', title: 'Assignment 1: the image classification pipeline', blurb: 'kNN, SVM, Softmax, a two-layer network and image features, all on CIFAR-10 in vectorized NumPy.' },
  { id: 'a2', course: 'cs231n', num: 'A2', part: 'Assignments', title: 'Assignment 2: deep networks and ConvNets', blurb: 'Modular layers, update rules, batch normalization, dropout and a ConvNet trained on CIFAR-10.' },
  { id: 'a3', course: 'cs231n', num: 'A3', part: 'Assignments', title: 'Assignment 3: RNNs and image gradients', blurb: 'Captioning with RNNs and LSTMs, saliency maps, fooling images, class visualization, inversion and DeepDream.' },

  { id: 'decade', course: 'dl26', num: '0', part: 'Start here', title: 'What changed after 2016', blurb: 'A map of the decade: from ConvNets and RNNs to transformers, scale, and models trained by feedback, and how this course walks through it.', practice: { id: 'decade/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },

  { id: 'seq2seq', course: 'dl26', num: '1', part: 'Attention and transformers', title: 'From recurrence to attention', blurb: 'Why squeezing a sentence into one vector breaks, and how attention turned into a soft lookup with queries, keys and values.', notes: [{ title: 'Sequence to sequence (2014)', url: `${X}/1409.3215` }, { title: 'Bahdanau attention (2014)', url: `${X}/1409.0473` }], practice: { id: 'seq2seq/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'transformer', course: 'dl26', num: '2', part: 'Attention and transformers', title: 'The Transformer', blurb: 'Self-attention, scaled dot products, multiple heads, causal masks, positions, residuals and layer norm: the block every modern model is built from.', notes: [{ title: 'Attention Is All You Need (2017)', url: `${X}/1706.03762` }], practice: { id: 'transformer/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'tokenization', course: 'dl26', num: '3', part: 'Attention and transformers', title: 'Tokens and embeddings', blurb: 'How text becomes numbers: characters, words and byte-pair encoding, vocabularies, embedding tables and the unembedding that turns vectors back into words.', notes: [{ title: 'BPE for neural MT (2015)', url: `${X}/1508.07909` }], practice: { id: 'tokenization/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'pretraining', course: 'dl26', num: '4', part: 'Attention and transformers', title: 'Language models and pretraining', blurb: 'Next-token prediction, cross-entropy and perplexity, sampling with temperature and top-p, GPT versus BERT, and in-context learning.', notes: [{ title: 'BERT (2018)', url: `${X}/1810.04805` }, { title: 'GPT-3 (2020)', url: `${X}/2005.14165` }], practice: { id: 'pretraining/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },

  { id: 'scaling-laws', course: 'dl26', num: '5', part: 'Scale', title: 'Scaling laws and compute', blurb: 'Loss falls as a power law in parameters, data and compute. FLOPs as 6ND, Kaplan versus Chinchilla, and choosing a model size for a budget.', notes: [{ title: 'Kaplan et al. (2020)', url: `${X}/2001.08361` }, { title: 'Chinchilla (2022)', url: `${X}/2203.15556` }], practice: { id: 'scaling-laws/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'modern-transformer', course: 'dl26', num: '6', part: 'Scale', title: 'The modern transformer block', blurb: 'What changed inside the block: pre-norm and RMSNorm, rotary positions, SwiGLU, grouped-query attention, the KV cache and FlashAttention.', notes: [{ title: 'RoPE (2021)', url: `${X}/2104.09864` }, { title: 'GLU variants (2020)', url: `${X}/2002.05202` }, { title: 'FlashAttention (2022)', url: `${X}/2205.14135` }], practice: { id: 'modern-transformer/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'optimizers', course: 'dl26', num: '7', part: 'Scale', title: 'Optimizers at scale: AdamW to Muon', blurb: 'Decoupled weight decay, warmup and cosine schedules, clipping and mixed precision, then Muon: orthogonalized momentum for matrix weights.', notes: [{ title: 'AdamW (2017)', url: `${X}/1711.05101` }, { title: 'Muon at scale (2025)', url: `${X}/2502.16982` }], practice: { id: 'optimizers/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'parallelism', course: 'dl26', num: '8', part: 'Scale', title: 'Training across many GPUs', blurb: 'Where the memory goes, then data, tensor and pipeline parallelism, ZeRO and FSDP sharding, and activation checkpointing.', notes: [{ title: 'Megatron-LM (2019)', url: `${X}/1909.08053` }, { title: 'ZeRO (2019)', url: `${X}/1910.02054` }], practice: { id: 'parallelism/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'moe', course: 'dl26', num: '9', part: 'Scale', title: 'Mixture of experts', blurb: 'Many feed-forward experts, a router that picks a few per token, load balancing, and why total and active parameters differ.', notes: [{ title: 'Sparsely-gated MoE (2017)', url: `${X}/1701.06538` }, { title: 'Switch Transformer (2021)', url: `${X}/2101.03961` }], practice: { id: 'moe/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },

  { id: 'vit', course: 'dl26', num: '10', part: 'Seeing and generating', title: 'Vision transformers', blurb: 'An image as a sequence of patches: ViT, what it gives up compared to convolutions, and why it wins with enough data.', notes: [{ title: 'ViT (2020)', url: `${X}/2010.11929` }], practice: { id: 'vit/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'contrastive', course: 'dl26', num: '11', part: 'Seeing and generating', title: 'Self-supervised learning and CLIP', blurb: 'Learning without labels: contrastive losses, SimCLR, CLIP\'s shared space for images and text, masked autoencoders and DINO.', notes: [{ title: 'SimCLR (2020)', url: `${X}/2002.05709` }, { title: 'CLIP (2021)', url: `${X}/2103.00020` }, { title: 'MAE (2021)', url: `${X}/2111.06377` }], practice: { id: 'contrastive/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'diffusion', course: 'dl26', num: '12', part: 'Seeing and generating', title: 'Diffusion models', blurb: 'Destroy an image with noise, learn to undo it step by step. DDPM, the noise-prediction loss, sampling, guidance, latent diffusion and flow matching.', notes: [{ title: 'DDPM (2020)', url: `${X}/2006.11239` }, { title: 'Latent diffusion (2021)', url: `${X}/2112.10752` }, { title: 'Flow matching (2022)', url: `${X}/2210.02747` }], practice: { id: 'diffusion/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },

  { id: 'finetuning', course: 'dl26', num: '13', part: 'Post-training', title: 'Fine-tuning, instruction tuning and LoRA', blurb: 'From a text predictor to an assistant: supervised fine-tuning on conversations, loss masking, and low-rank adapters that train a sliver of the weights.', notes: [{ title: 'InstructGPT (2022)', url: `${X}/2203.02155` }, { title: 'LoRA (2021)', url: `${X}/2106.09685` }], practice: { id: 'finetuning/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'policy-gradients', course: 'dl26', num: '14', part: 'Post-training', title: 'Reinforcement learning for language models', blurb: 'Generation as a policy, rewards for whole answers, the policy gradient and the log-derivative trick, baselines, advantages and the KL leash.', notes: [{ title: 'PPO (2017)', url: `${X}/1707.06347` }], practice: { id: 'policy-gradients/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'rlhf', course: 'dl26', num: '15', part: 'Post-training', title: 'RLHF and PPO', blurb: 'Human preferences become a reward model; PPO\'s clipped objective, value functions and GAE turn that reward into a better model, and reward hacking pushes back.', notes: [{ title: 'RL from human preferences (2017)', url: `${X}/1706.03741` }, { title: 'InstructGPT (2022)', url: `${X}/2203.02155` }, { title: 'GAE (2015)', url: `${X}/1506.02438` }], practice: { id: 'rlhf/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'dpo', course: 'dl26', num: '16', part: 'Post-training', title: 'Direct preference optimization', blurb: 'Skip the reward model and the RL loop: DPO derives a simple classification loss on preference pairs from the same objective.', notes: [{ title: 'DPO (2023)', url: `${X}/2305.18290` }], practice: { id: 'dpo/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'grpo', course: 'dl26', num: '17', part: 'Post-training', title: 'RL from verifiable rewards and GRPO', blurb: 'Rewards a program can check, group-relative advantages without a critic, and how R1-style training grows long chains of thought.', notes: [{ title: 'DeepSeekMath / GRPO (2024)', url: `${X}/2402.03300` }, { title: 'DeepSeek-R1 (2025)', url: `${X}/2501.12948` }], practice: { id: 'grpo/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'reasoning', course: 'dl26', num: '18', part: 'Post-training', title: 'Reasoning and test-time compute', blurb: 'Chain of thought, self-consistency, verifiers and process rewards, and trading inference compute for accuracy.', notes: [{ title: 'Chain of thought (2022)', url: `${X}/2201.11903` }, { title: "Let's verify step by step (2023)", url: `${X}/2305.20050` }], practice: { id: 'reasoning/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },

  { id: 'inference', course: 'dl26', num: '19', part: 'Serving and understanding', title: 'Fast inference', blurb: 'Prefill and decode, why decoding is memory-bound, the KV cache and paged attention, batching, quantization and speculative decoding.', notes: [{ title: 'Speculative decoding (2022)', url: `${X}/2211.17192` }, { title: 'PagedAttention (2023)', url: `${X}/2309.06180` }], practice: { id: 'inference/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
  { id: 'interpretability', course: 'dl26', num: '20', part: 'Serving and understanding', title: 'Looking inside language models', blurb: 'The residual stream, attention heads and induction heads, superposition, and sparse autoencoders that pull features apart.', notes: [{ title: 'Induction heads (2022)', url: `${X}/2209.11895` }, { title: 'Toy models of superposition (2022)', url: `${X}/2209.10652` }], practice: { id: 'interpretability/exercises', text: 'Exercises, from a NumPy warm-up to a small project.' } },
];

const modules = import.meta.glob<{ default: ChapterDef }>(['./*.ts', '!./index.ts']);

/** Loads a chapter's module, or null if it has not been written yet. */
export function loadChapter(id: string): Promise<ChapterDef> | null {
  const loader = modules[`./${id}.ts`];
  return loader ? loader().then((m) => m.default) : null;
}

export function hasChapter(id: string): boolean {
  return `./${id}.ts` in modules;
}
