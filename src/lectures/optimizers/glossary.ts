import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  Adam: {
    is: 'momentum plus a step size for every parameter',
    more: 'It keeps m, a smoothed gradient, and v, a smoothed squared gradient, and steps by m / sqrt(v). The name is short for adaptive moment estimation (Kingma and Ba, 2014).',
  },
  AdamW: {
    is: 'Adam with weight decay applied outside the step',
    more: 'Loshchilov and Hutter (2017) decoupled the decay from the normalization, so every weight shrinks by the same fraction; the W marks that weight decay. With Muon, it takes the embeddings, output layer, biases and gains.',
  },
  warmup_then_cosine: {
    is: 'the learning rate for step t',
    more: 'It ramps up from near zero over the warmup steps, then follows half a cosine wave from the peak down to a small value. lr_at in the schedules scene spells it out.',
  },
  clip_grad_norm_: {
    is: 'scales the gradient down to a maximum norm',
    more: 'Above max_norm (1.0 here), every gradient entry is multiplied by the same factor, so the direction is kept. The trailing underscore is the PyTorch mark of a function that changes its argument in place.',
  },
  autocast: {
    is: 'runs the code inside it in 16-bit floats',
    more: 'Inside the with block, the forward pass computes in bf16 for speed and memory. The master weights and Adam\'s m and v stay in fp32.',
  },
  model: { is: 'the forward pass, returning the loss', more: 'model(x, y) runs the network on the inputs x and scores it against the targets y, inside autocast.' },
  Muon: {
    is: 'the optimizer for the hidden weight matrices',
    more: 'It keeps momentum as a matrix M and steps along its orthogonalized version, every singular value set to 1. The name stands for MomentUm Orthogonalized by Newton-Schulz (Keller Jordan and collaborators, 2024).',
  },
  cos: {
    is: 'the cosine, from Python\'s math module',
    more: 'As p runs from 0 to 1, (1 + cos(pi*p)) / 2 falls smoothly from 1 to 0: half a cosine wave.',
    eg: 'cos(0), cos(pi)   # 1.0, -1.0',
  },
  newton_schulz5: {
    is: 'orthogonalizes a matrix with matrix multiplies only',
    more: 'It approximates U Vᵀ without an SVD, which GPUs run slowly. Each step applies one polynomial in X, X³ and X⁵ to every singular value at once, pushing them all toward 1.',
  },
  adam_dir: {
    is: 'the direction Adam steps in',
    more: 'm divided by the square root of v, entry by entry. Rescaling each entry on its own is why Adam cannot isolate a direction that is not along an axis.',
  },
};
