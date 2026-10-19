/** Published model sizes for the scale figure and the lecture. Parameters N, training tokens D. */
export interface ModelSize {
  name: string;
  /** Fractional year of release, for placing the dot. */
  t: number;
  N: number;
  /** Active parameters per token, for a mixture of experts. */
  active?: number;
  D?: number;
  /** A ConvNet, from the CS231n era. */
  conv?: boolean;
  note: string;
}

export const MODELS: ModelSize[] = [
  { name: 'AlexNet', t: 2012.7, N: 60e6, conv: true, note: 'The 2012 ImageNet winner, trained on about 1.2 million labeled photos on two GPUs.' },
  { name: 'ResNet-152', t: 2015.9, N: 60e6, conv: true, note: 'The 2015 winner: 152 layers, yet about as many parameters as AlexNet.' },
  { name: 'Transformer', t: 2017.45, N: 65e6, note: 'The base translation model of *Attention Is All You Need*.' },
  { name: 'BERT-large', t: 2018.8, N: 340e6, note: 'An encoder pretrained on books and Wikipedia.' },
  { name: 'GPT-2', t: 2019.1, N: 1.5e9, note: 'A decoder pretrained on about 40 GB of web text.' },
  { name: 'T5', t: 2019.8, N: 11e9, note: 'An encoder-decoder that casts every task as text to text.' },
  { name: 'GPT-3', t: 2020.4, N: 175e9, D: 300e9, note: 'Under 2 tokens per parameter: large, and as Chinchilla later showed, under-trained.' },
  { name: 'Gopher', t: 2021.95, N: 280e9, D: 300e9, note: 'DeepMind\'s large model; Chinchilla was trained with about the same compute.' },
  { name: 'Chinchilla', t: 2022.2, N: 70e9, D: 1.4e12, note: 'A quarter of Gopher\'s size on more than four times the data, for about the same compute, and better on nearly every benchmark.' },
  { name: 'PaLM', t: 2022.3, N: 540e9, D: 780e9, note: 'Google\'s large dense model, trained across two TPU pods.' },
  { name: 'LLaMA', t: 2023.15, N: 65e9, D: 1.4e12, note: 'Openly shared weights, trained on publicly available data.' },
  { name: 'Llama 3.1', t: 2024.55, N: 405e9, D: 15.6e12, note: 'A dense 405B model on about 15.6 trillion tokens, nearly 40 tokens per parameter.' },
  { name: 'DeepSeek-V3', t: 2024.95, N: 671e9, active: 37e9, D: 14.8e12, note: 'A mixture of experts: 671B parameters stored, 37B used per token. The compute counts only the active ones.' },
];
