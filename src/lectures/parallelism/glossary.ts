import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  checkpoint: {
    is: 'runs a block, saving only its input',
    more: 'When the backward pass reaches the block, it reruns the forward to rebuild the activations, then backpropagates through it: about a third more compute for over ten times less memory. Also called gradient checkpointing.',
  },
  model: {
    is: 'the network, returning the loss on a batch',
    more: 'model(x_i, y_i) runs forward on this GPU\'s slice and returns its loss, ready for .backward(). After model = DDP(model), the same call also syncs gradients during backward.',
  },
  DDP: {
    is: 'wraps a model for data-parallel training',
    more: 'PyTorch\'s DistributedDataParallel. During backward it groups gradients into buckets of about 25 MB and starts each bucket\'s all-reduce as soon as it is ready, hiding the traffic behind the rest of backward.',
  },
  gelu: {
    is: 'a smooth ReLU: x times Φ(x)',
    more: 'Φ is the standard normal CDF; GELU stands for Gaussian error linear unit. It acts on each number separately, so a column-split hidden layer needs no communication before it.',
    eg: 'gelu(1.0)   # 0.841',
  },
  all_reduce: {
    is: 'sums an array across GPUs; every GPU gets the sum',
    more: 'Here it adds the partial sums Z_i of the row-split W2, so every GPU in the tensor group ends with the full output Z. The name comes from MPI, the message-passing standard for parallel programs.',
  },
};
