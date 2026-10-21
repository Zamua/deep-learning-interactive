import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  attention: {
    is: 'scaled dot-product attention, as in 2017',
    more: 'It takes queries, keys and values already projected and returns softmax(q kᵀ / √d) times v. The modern block computes the same thing with flash_attention.',
  },
  rms_norm: {
    is: 'divides a vector by its root mean square',
    more: 'Square every entry, average, take the square root, divide, then multiply by the gain g: layer norm without the mean and the bias. Zhang and Sennrich proposed it in 2019, and LLaMA made it standard.',
    eg: 'rms_norm(np.array([3., 4.]))   # [0.85, 1.13]',
  },
  rope: {
    is: 'rotates pairs of dimensions by position',
    more: 'Pair i of a query or key at position pos turns by the angle pos × θ_i, so q · k depends only on the offset between the two tokens. RoPE stands for rotary position embedding, from Su and colleagues in 2021.',
  },
  flash_attention: {
    is: 'exact attention, computed tile by tile on chip',
    more: 'It runs the online softmax inside one kernel and never writes the T by T score matrix to HBM, so memory grows linearly with length. Tri Dao and colleagues, 2022.',
  },
  swiglu: {
    is: 'the gated MLP of modern blocks',
    more: 'silu(x @ W1) scales x @ W3 elementwise, then W2 projects back. The name joins Swish, another name for SiLU, with GLU, the gated linear unit; Shazeer compared such variants in 2020.',
  },
  F: {
    is: 'a sub-block: attention or the MLP',
    more: 'Passed in as a function so one wrapper serves both. Post-norm normalizes x + F(x); pre-norm feeds F a normalized copy and leaves the stream a plain sum.',
  },
  silu: {
    is: 'z times the sigmoid of z',
    more: 'A smooth ReLU that dips slightly below zero for negative inputs. SiLU stands for sigmoid linear unit; the same function is also called Swish.',
    eg: 'silu(-1.0)   # -0.269',
  },
  project: {
    is: 'the new token\'s query, key and value',
    more: 'Only the newest token is projected at each step. Earlier keys and values never change in a causal model, so they come from the cache.',
  },
  attend: {
    is: 'attention for one query over the cache',
    more: 'The new token\'s query attends over every stored key and value. Each step reads the whole KV cache from memory, so the cache\'s size sets the decode speed.',
  },
  blocks: {
    is: 'splits matrices into tiles that fit in SRAM',
    more: 'blocks(Q) yields blocks of query rows; blocks(K, V) yields matching blocks of key and value rows.',
  },
  update: {
    is: 'folds one tile into the running softmax',
    more: 'For its block of queries it updates the running max m, sum l and output o, rescaling the old terms when the max grows. Nothing of size T by T is written out.',
  },
};
