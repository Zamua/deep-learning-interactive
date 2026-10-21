import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  ffn: {
    is: 'a feed-forward block applied to one token',
    more: 'In a dense model every token runs through the same ffn. In DeepSeekMoE each shared expert is one, run on every token with no routing.',
  },
  FFN: {
    is: 'builds a fresh feed-forward block: one expert',
    more: 'Each call creates its own weights, so the list holds E independent experts of the same shape. FFN is short for feed-forward network.',
  },
  moe_layer: {
    is: 'routes one token to its top-k experts',
    more: 'The router scores every expert, the top k run, and their outputs are summed with the gates as weights. The idea goes back to the adaptive mixtures of local experts of Jacobs, Jordan, Nowlan and Hinton (1991).',
  },
  '.softmax': {
    is: 'softmax along an axis, as a tensor method',
    more: 'PyTorch\'s softmax(-1) normalizes over the last axis, here the experts, so each token\'s row of router probabilities sums to one.',
  },
  comb: {
    is: 'the number of ways to choose k of n',
    more: 'Python\'s math.comb, the binomial coefficient "n choose k". Splitting experts finely raises the number of possible teams from 120 to over four billion.',
    eg: 'comb(16, 2)   # 120',
  },
  all_to_all: {
    is: 'every GPU sends a different slice to every other',
    more: 'counts says how many tokens go to each GPU, so every token lands where its expert lives; a second all_to_all sends the results home. The name is the MPI collective of the same kind.',
  },
  local_experts: {
    is: 'runs this GPU\'s experts on the tokens it received',
    more: 'Here each GPU holds two experts. Its work depends on how many tokens arrived, so a GPU with popular experts makes everyone wait.',
  },
};
