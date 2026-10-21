import type { SymbolMap } from '../core/symbols';

/** Shared by the modern-transformer chapter and its lecture, so a symbol keeps its color across both. */
export const MODERN_TRANSFORMER_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: "x: a token's vector in the residual stream",
    code: ['x'],
    about: 'Every sub-block reads a normalized copy of x and adds its output back. Under pre-norm the top of the stack is a plain sum of every write, so x grows with depth and one final norm sits on top.',
  },
  q: {
    color: 'teal',
    name: 'q: a query vector, what a token is looking for',
    code: ['q', 'Q', 'q_m'],
    about: 'In the modern block q is projected, normalized by QK-norm, then rotated by RoPE at its position, so q · k depends on the offset between the two tokens. Each query head has its own, 128 numbers wide in Llama.',
  },
  k: {
    color: 'green',
    name: 'k: a key vector, what a token can be found by',
    code: ['k', 'K', 'k_n'],
    about: 'Rotated by RoPE like the queries, and stored in the KV cache during generation. Under grouped-query attention several query heads share one key head: Llama 3 8B has 32 query heads and 8 key-value heads.',
  },
  v: {
    color: 'gold',
    name: 'v: a value vector, what a token hands over',
    code: ['v', 'V'],
    about: 'Attention returns a weighted average of these. Values sit in the KV cache beside the keys and are shared across a query group under GQA, but RoPE never rotates them.',
  },
  W: {
    color: 'blue',
    name: 'W: learned weight matrices (Wq, Wk, Wv, Wo, and the MLP weights W1, W2, W3)',
    code: ['Wq', 'Wk', 'Wv', 'Wo', 'W1', 'W2', 'W3'],
    about: 'Modern blocks drop their biases. SwiGLU uses three MLP matrices instead of two, W1 and W3 in and W2 out, so the hidden width shrinks from 4d to 8/3 d to keep the parameter count.',
  },
  g: {
    color: 'blue',
    name: 'g: the learned gain of a norm, one number per channel',
    code: ['g', 'g_q', 'g_k'],
    about: 'RMSNorm divides by the root mean square, then multiplies by g, so the model can still pick each channel\'s scale. In QK-norm, g_q and g_k are how attention can still sharpen on purpose.',
  },
  theta: {
    color: 'red',
    name: 'θ: the rotation speeds of RoPE, one per pair of dimensions',
    tex: '\\theta',
    code: ['theta'],
    about: 'θ_j = 10000^(−j/d): one radian per token for the first pair, down to about a ten thousandth for the last. Position interpolation, NTK-aware scaling and YaRN stretch the context by rescaling these speeds.',
  },
  S: {
    color: 'purple',
    name: 'S: attention scores (logits), one per query and key pair',
    code: ['S', 'scores'],
    about: 'S = q kᵀ / √d, a T by T grid per head: 128 MB at eight thousand tokens. FlashAttention never writes it to HBM, and QK-norm keeps it bounded so the softmax does not saturate.',
  },
  d: {
    color: 'slate',
    name: 'd: a vector length (the model width, or one head\'s width)',
    code: ['d', 'd_head'],
    about: 'Usually one head\'s width here, 128 in Llama. It sets RoPE\'s speeds, the √d in the score scaling, and the KV cache\'s bytes per token.',
  },
};
