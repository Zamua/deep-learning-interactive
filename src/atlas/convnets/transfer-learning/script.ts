import type { LectureScript } from '../../../lecture/types';

const code = `
  model = load_pretrained('imagenet')        #@load
  for q in model.parameters():                #@freeze
      q.requires_grad = False                 #@freeze
  model.fc = nn.Linear(512, 10)   # 5,130     #@swap
  opt = SGD(model.fc.parameters(), lr=1e-3)   #@lr
`;

export const script: LectureScript = {
  id: 'atlas-transfer-learning',
  title: 'Transfer learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'reuse',
      title: 'Reuse a trained network',
      codeTitle: 'transfer.py',
      code,
      beats: [
        { id: 'pretrained', say: 'Training a ConvNet from scratch takes a lot of labeled data. But networks already trained on ImageNet, over a million photos in a thousand classes, are free to download.', code: 'load' },
        { id: 'layers', say: 'Their first layers hold filters for edges and colors. Later layers combine those into textures and parts, and the last layer scores the thousand classes.', code: 'load' },
        { id: 'swap', say: 'To reuse one, keep its layers fixed and replace only the last layer with a new one for your own classes. Here, ten.', code: ['freeze', 'swap'] },
        { id: 'count', say: 'With five hundred and twelve features in and ten classes out, the new layer has {5,130|five thousand one hundred and thirty} parameters. Only those are trained.', code: 'swap' },
      ],
    },
    {
      id: 'howmuch',
      title: 'How much to retrain',
      codeTitle: 'transfer.py',
      code,
      beats: [
        { id: 'small', say: 'With a few hundred images, train just that last layer. Changing millions of weights on so few images would memorize them: overfitting.', code: 'swap' },
        { id: 'more', say: 'With tens of thousands of images, you can afford more: start from the pretrained weights and fine-tune every layer.', code: 'freeze' },
        { id: 'lr', say: 'Fine-tune with a small learning rate, often ten times smaller than from scratch, so the good pretrained weights move only a little.', code: 'lr' },
        { id: 'different', say: 'And when your images look nothing like photos, say X-rays, the early layers carry over best: edges are everywhere, while the last layers belong to the old classes.', code: 'load' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
