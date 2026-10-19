import type { Color } from '../core/symbols';

/** The five threads of the decade, one per part of the course. */
export type Lane = 'attn' | 'scale' | 'see' | 'post' | 'serve';

export interface LaneDef {
  id: Lane;
  /** The course part this thread is taught in. */
  part: string;
  /** Short legend label. */
  label: string;
  color: Color;
}

export const LANES: LaneDef[] = [
  { id: 'attn', part: 'Attention and transformers', label: 'attention', color: 'blue' },
  { id: 'scale', part: 'Scale', label: 'scale', color: 'orange' },
  { id: 'see', part: 'Seeing and generating', label: 'images', color: 'teal' },
  { id: 'post', part: 'Post-training', label: 'feedback', color: 'green' },
  { id: 'serve', part: 'Serving and understanding', label: 'serving and inside', color: 'purple' },
];

export interface Milestone {
  year: number;
  lane: Lane;
  /** Chip label, at most about 11 characters. */
  short: string;
  /** Who and when, e.g. "Vaswani et al., Google, June". */
  who: string;
  /** What appeared and why it mattered (markdown). */
  why: string;
  /** The DL26 chapter that teaches it. */
  ch: string;
  /** A description of the present, not a dated event. */
  now?: boolean;
}

export const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

/** One line per year: why that year mattered. */
export const YEAR_SUMMARY: Record<number, string> = {
  2017: 'Attention replaces recurrence. Tools the later years lean on (PPO, learning from preferences, mixture of experts, AdamW) appear the same year.',
  2018: 'Pretraining: train a transformer on raw text first, then adapt it to each task.',
  2019: 'A bigger language model starts doing tasks from a prompt alone, and training spreads across many GPUs.',
  2020: 'Scale becomes a science (scaling laws, GPT-3), and images get their modern methods: contrastive learning, diffusion and the vision transformer.',
  2021: 'Text and images meet in one space (CLIP); fine-tuning gets cheap (LoRA); positions become rotations (RoPE).',
  2022: 'The year of the assistant: compute-optimal training, RLHF in InstructGPT, FlashAttention, and in November, ChatGPT.',
  2023: 'Open weights and simpler post-training: the LLaMA block, DPO, process rewards, paged KV caches, sparse autoencoders.',
  2024: 'Rewards a program can check: GRPO and RLVR, and o1, a model trained to think before it answers. Muon arrives.',
  2025: 'DeepSeek-R1 publishes a reasoning recipe in the open, and models that think before answering become the norm.',
  2026: 'Today: the recipe this course teaches, end to end. Each ring below is one part of it.',
};

export const MILESTONES: Milestone[] = [
  { year: 2017, lane: 'attn', short: 'Transformer', who: 'Vaswani et al., Google, June', why: '*Attention Is All You Need*: a translation model with no recurrence, only attention. It trained in a fraction of the time and translated better.', ch: 'transformer' },
  { year: 2017, lane: 'scale', short: 'MoE', who: 'Shazeer et al., Google, January', why: 'Sparsely-gated mixture of experts: many feed-forward experts, and a router that sends each token to a few. Parameters grow while the compute per token does not.', ch: 'moe' },
  { year: 2017, lane: 'scale', short: 'AdamW', who: 'Loshchilov and Hutter, November', why: 'Weight decay applied directly to the weights instead of through the gradient, which under Adam is not the same thing. The default optimizer of the decade.', ch: 'optimizers' },
  { year: 2017, lane: 'post', short: 'Preferences', who: 'Christiano et al., OpenAI and DeepMind, June', why: 'Deep RL from human preferences: people compare two behaviors, a reward model learns their choices, and RL optimizes it. The seed of RLHF.', ch: 'rlhf' },
  { year: 2017, lane: 'post', short: 'PPO', who: 'Schulman et al., OpenAI, July', why: 'Proximal policy optimization: a policy-gradient method whose clipped objective keeps each update small. The RL algorithm of RLHF.', ch: 'policy-gradients' },

  { year: 2018, lane: 'attn', short: 'GPT', who: 'Radford et al., OpenAI, June', why: 'A transformer decoder pretrained to predict the next token of books, then fine-tuned on each task. Pretraining did most of the work.', ch: 'pretraining' },
  { year: 2018, lane: 'attn', short: 'BERT', who: 'Devlin et al., Google, October', why: 'A transformer encoder pretrained to fill in masked-out words. Fine-tuned, it set new records on a broad set of language-understanding benchmarks.', ch: 'pretraining' },

  { year: 2019, lane: 'attn', short: 'GPT-2', who: 'Radford et al., OpenAI, February', why: '1.5 billion parameters, byte-level BPE and pre-norm blocks. Given only a prompt, it could attempt tasks it was never trained for.', ch: 'pretraining' },
  { year: 2019, lane: 'scale', short: 'Megatron', who: 'Shoeybi et al., NVIDIA, September', why: 'Megatron-LM: split each layer\'s matrices across GPUs (tensor parallelism) to train models too big for one device.', ch: 'parallelism' },
  { year: 2019, lane: 'scale', short: 'ZeRO', who: 'Rajbhandari et al., Microsoft, October', why: 'Shard the optimizer state, gradients and parameters across data-parallel GPUs instead of copying them to every one.', ch: 'parallelism' },

  { year: 2020, lane: 'scale', short: 'Scaling laws', who: 'Kaplan et al., OpenAI, January', why: 'Test loss falls as a smooth power law in parameters, data and compute over many orders of magnitude, so small runs predict big ones.', ch: 'scaling-laws' },
  { year: 2020, lane: 'see', short: 'SimCLR', who: 'Chen et al., Google, February', why: 'Contrastive self-supervised learning: two augmented views of one image should match, and differ from every other image. Labels optional.', ch: 'contrastive' },
  { year: 2020, lane: 'attn', short: 'GPT-3', who: 'Brown et al., OpenAI, May', why: '175 billion parameters. Show it a few examples in the prompt and it continues the pattern: in-context learning, with no gradient step.', ch: 'pretraining' },
  { year: 2020, lane: 'see', short: 'DDPM', who: 'Ho, Jain and Abbeel, Berkeley, June', why: 'Denoising diffusion: destroy images with noise in small steps, train a network to predict the noise, then generate by undoing it.', ch: 'diffusion' },
  { year: 2020, lane: 'see', short: 'ViT', who: 'Dosovitskiy et al., Google, October', why: 'An image as a sequence of 16 by 16 patches, fed to a plain transformer. With enough data it matches the best ConvNets.', ch: 'vit' },

  { year: 2021, lane: 'see', short: 'CLIP', who: 'Radford et al., OpenAI, January', why: 'An image encoder and a text encoder trained so that matching pairs land close together. Classify any image by comparing it with written prompts.', ch: 'contrastive' },
  { year: 2021, lane: 'scale', short: 'Switch', who: 'Fedus, Zoph and Shazeer, Google, January', why: 'Switch Transformer: route each token to a single expert, which made mixture of experts simple enough to train at very large scale.', ch: 'moe' },
  { year: 2021, lane: 'scale', short: 'RoPE', who: 'Su et al., April', why: 'Rotary position embeddings: rotate queries and keys by their position, so attention scores depend on relative offset. Standard today.', ch: 'modern-transformer' },
  { year: 2021, lane: 'post', short: 'LoRA', who: 'Hu et al., Microsoft, June', why: 'Low-rank adapters: freeze the model and train a small product B A beside each weight matrix, a tiny fraction of the parameters.', ch: 'finetuning' },
  { year: 2021, lane: 'see', short: 'Latent diff.', who: 'Rombach et al., December', why: 'Run diffusion in the small latent space of an autoencoder instead of on pixels. The basis of Stable Diffusion (2022).', ch: 'diffusion' },

  { year: 2022, lane: 'post', short: 'CoT', who: 'Wei et al., Google, January', why: 'Chain-of-thought prompting: examples that show their working make large models write steps, and accuracy on multi-step problems jumps.', ch: 'reasoning' },
  { year: 2022, lane: 'scale', short: 'Chinchilla', who: 'Hoffmann et al., DeepMind, March', why: 'For a fixed compute budget, grow parameters and data together, about 20 tokens per parameter. Earlier large models were under-trained.', ch: 'scaling-laws' },
  { year: 2022, lane: 'post', short: 'InstructGPT', who: 'Ouyang et al., OpenAI, March', why: 'The RLHF recipe: fine-tune on demonstrations, train a reward model on comparisons, optimize with PPO. Labelers preferred the 1.3B model to the 175B GPT-3.', ch: 'rlhf' },
  { year: 2022, lane: 'scale', short: 'FlashAttn', who: 'Dao et al., Stanford, May', why: 'FlashAttention: compute attention in tiles with a running softmax, so the full score matrix never touches slow GPU memory. Exact, and much faster.', ch: 'modern-transformer' },
  { year: 2022, lane: 'serve', short: 'Induction', who: 'Olsson et al., Anthropic', why: 'Induction heads: a two-head circuit that copies what followed the last time a token appeared, linked to in-context learning.', ch: 'interpretability' },
  { year: 2022, lane: 'serve', short: 'Speculative', who: 'Leviathan et al., Google, November', why: 'Speculative decoding: a small model drafts several tokens, the big one checks them in one pass. Faster, with exactly the same output distribution.', ch: 'inference' },
  { year: 2022, lane: 'post', short: 'ChatGPT', who: 'OpenAI, November 30', why: 'A sibling of InstructGPT, tuned for conversation with the same recipe and released free as a research preview. The decade\'s public turning point.', ch: 'finetuning' },

  { year: 2023, lane: 'scale', short: 'LLaMA', who: 'Touvron et al., Meta, February', why: 'Weights up to 65B parameters shared with researchers, trained compute-optimally and beyond. Its block (pre-norm RMSNorm, SwiGLU, RoPE) became the open standard.', ch: 'modern-transformer' },
  { year: 2023, lane: 'post', short: 'DPO', who: 'Rafailov et al., Stanford, May', why: 'Direct preference optimization: the RLHF objective rearranged into a simple loss on preference pairs. No reward model, no RL loop.', ch: 'dpo' },
  { year: 2023, lane: 'post', short: 'Process RM', who: 'Lightman et al., OpenAI, May', why: '*Let\'s verify step by step*: a reward model that grades every step of a solution beats one that grades only the final answer.', ch: 'reasoning' },
  { year: 2023, lane: 'serve', short: 'vLLM', who: 'Kwon et al., Berkeley, September', why: 'PagedAttention: store the KV cache in fixed-size pages, like virtual memory, so a server can batch many more requests.', ch: 'inference' },
  { year: 2023, lane: 'serve', short: 'SAEs', who: 'Bricken et al., Anthropic, October', why: '*Towards Monosemanticity*: a sparse autoencoder splits a layer\'s activations into many features that each mean one thing.', ch: 'interpretability' },
  { year: 2023, lane: 'scale', short: 'Mixtral', who: 'Mistral AI, December', why: 'An open mixture-of-experts model: 8 experts per layer, 2 used per token.', ch: 'moe' },

  { year: 2024, lane: 'post', short: 'GRPO', who: 'Shao et al., DeepSeek, February', why: 'Introduced in DeepSeekMath: PPO without a value network. Sample a group of answers and use the group\'s mean reward as the baseline.', ch: 'grpo' },
  { year: 2024, lane: 'post', short: 'o1', who: 'OpenAI, September', why: 'A model trained with RL to reason at length before answering. Accuracy kept rising with more training and with more thinking at test time.', ch: 'reasoning' },
  { year: 2024, lane: 'scale', short: 'Muon', who: 'Keller Jordan and collaborators, late 2024', why: 'Orthogonalized momentum for weight matrices, computed with a few Newton-Schulz steps. It set training-speed records on small benchmarks.', ch: 'optimizers' },
  { year: 2024, lane: 'post', short: 'Tülu 3', who: 'Lambert et al., AI2, November', why: 'An open post-training recipe that named RL from verifiable rewards (RLVR): reward 1 when a checker accepts the answer.', ch: 'grpo' },
  { year: 2024, lane: 'scale', short: 'DeepSeek-V3', who: 'DeepSeek, December', why: 'A mixture of experts with 671B parameters in total but only 37B active per token, trained on 14.8 trillion tokens.', ch: 'moe' },

  { year: 2025, lane: 'post', short: 'DeepSeek-R1', who: 'DeepSeek, January', why: 'R1-Zero: pure RL with verifiable rewards grows long chains of thought and self-checking. R1 adds a cold start; distillation hands it to small models.', ch: 'grpo' },
  { year: 2025, lane: 'scale', short: 'Muon, scaled', who: 'Moonshot AI, February', why: 'Muon with weight decay and matched update sizes, shown to train large language models with less compute than AdamW.', ch: 'optimizers' },
  { year: 2025, lane: 'post', short: 'DAPO', who: 'ByteDance and Tsinghua, March', why: 'DAPO and Dr. GRPO find and fix GRPO\'s biases: length bias, groups with no signal, entropy collapse.', ch: 'grpo' },
  { year: 2025, lane: 'post', short: 'Reasoners', who: 'many labs', why: 'Models that think before they answer, trained with RL on checkable tasks, become a standard product.', ch: 'reasoning' },

  { year: 2026, lane: 'attn', short: 'pretrain', now: true, who: 'today', why: 'A decoder-only transformer, pretrained on next-token prediction over trillions of tokens.', ch: 'pretraining' },
  { year: 2026, lane: 'scale', short: 'scale', now: true, who: 'today', why: 'The modern block, often with mixture-of-experts layers, trained with AdamW or Muon across thousands of GPUs, sized by scaling laws.', ch: 'scaling-laws' },
  { year: 2026, lane: 'see', short: 'images', now: true, who: 'today', why: 'The same transformer reads images as patches; diffusion and flow models generate them.', ch: 'vit' },
  { year: 2026, lane: 'post', short: 'post-train', now: true, who: 'today', why: 'Supervised fine-tuning, preference optimization, then RL on verifiable rewards for reasoning.', ch: 'grpo' },
  { year: 2026, lane: 'serve', short: 'serve', now: true, who: 'today', why: 'KV caches, batching, quantization and speculative decoding to serve it; interpretability tools to look inside.', ch: 'inference' },
];

export const laneOf = (id: Lane): LaneDef => LANES.find((l) => l.id === id)!;
