import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-transfer-learning',
  title: 'Transfer learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Deng, Dong, Socher, Li, Li & Fei-Fei', year: 2009, title: 'ImageNet: a large-scale hierarchical image database', url: 'https://doi.org/10.1109/CVPR.2009.5206848', scene: 'problem' },
    { who: 'Zeiler & Fergus', year: 2013, title: 'Visualizing and understanding convolutional networks', url: 'https://arxiv.org/abs/1311.2901', scene: 'layers' },
    { who: 'Yosinski, Clune, Bengio & Lipson', year: 2014, title: 'How transferable are features in deep neural networks?', url: 'https://arxiv.org/abs/1411.1792', scene: 'layers' },
    { who: 'Razavian, Azizpour, Sullivan & Carlsson', year: 2014, title: 'CNN features off-the-shelf: an astounding baseline for recognition', url: 'https://arxiv.org/abs/1403.6382', scene: 'swap' },
  ],
  scenes: [
    {
      id: 'problem',
      title: 'Few photos, millions of weights',
      codeTitle: 'problem.py',
      code: `
        labels = ['tulip', 'rose', ...]  #@label
        # yours: 500 photos, 10 kinds    #@label
        # a ConvNet: millions of weights #@many
        # ImageNet: 1.2 million photos   #@imagenet
        #   in 1,000 classes             #@imagenet
        model = load_pretrained('imagenet')  #@load
      `,
      beats: [
        { id: 'task', say: 'Say you want a network that tells ten kinds of flower apart, and you have a few hundred photos. Each comes with its label: the right answer, the flower\'s name, written down by a person.', code: 'label' },
        { id: 'many', say: 'But a ConvNet has millions of weights. Trained from scratch on so few photos, it memorizes them: the training loss falls while the validation loss climbs. It overfits.', code: 'many' },
        { id: 'imagenet', say: 'Far bigger sets exist. In 2009, Jia Deng, Fei-Fei Li and colleagues introduced ImageNet, a vast collection of labeled photos. Its yearly contest used about {1.2|one point two} million of them, in a thousand classes.', code: 'imagenet' },
        { id: 'pretrained', say: 'Networks trained on it are free to download. They are pretrained: trained before, on another task. Can one of them help with your flowers?', code: 'load' },
      ],
    },
    {
      id: 'layers',
      title: 'General first, specific last',
      codeTitle: 'layers.py',
      code: `
        # layer 1: edges, color blobs     #@l1
        # next: textures, then parts      #@mid
        # last: 512 features in,          #@last
        #   1,000 ImageNet scores out     #@last
        model.fc   # Linear(512, 1000)    #@last
      `,
      beats: [
        { id: 'l1', say: 'Look inside one, from the image up. The first layer\'s filters respond to edges at many angles, and to blobs of color.', code: 'l1' },
        { id: 'mid', say: 'In 2013, Matthew Zeiler and Rob Fergus pictured what the layers above respond to: combinations of those, then textures, then parts, such as eyes and legs.', code: 'mid' },
        { id: 'last', say: 'The last layer is a linear classifier. It reads {512|five hundred and twelve} features: numbers that describe the image, as before, only now computed by the layers below. It scores ImageNet\'s thousand classes.', code: 'last' },
        { id: 'yosinski', say: 'In 2014, Jason Yosinski and colleagues measured how well each layer carries over to a new task. The first layers are general, since edges and colors are in nearly every photo. Higher layers grow specific to their old classes.', code: ['l1', 'last'] },
        { id: 'asis', say: 'So the network cannot be used as it is: its last layer scores ImageNet\'s classes, not your ten.', code: 'last' },
      ],
    },
    {
      id: 'swap',
      title: 'Freeze the body, swap the head',
      codeTitle: 'transfer.py',
      code: `
        model = load_pretrained('imagenet')  #@load
        for q in model.parameters():     #@freeze
            q.requires_grad = False      #@freeze
        model.fc = nn.Linear(512, 10)    #@swap
        # 512 * 10 + 10 = 5,130          #@count
        opt = SGD(model.fc.parameters(), #@opt
                  lr=0.01)               #@opt
      `,
      beats: [
        { id: 'freeze', say: 'Instead, keep its layers, and freeze them. Setting requires grad to false means no gradient is computed for a weight, so gradient descent never moves it.', code: ['load', 'freeze'] },
        { id: 'swap', say: 'Then swap the last layer for a new one: {512|five hundred and twelve} features in, ten scores out, one per flower.', code: 'swap' },
        { id: 'count', say: 'It has {512|five hundred and twelve} times ten weights, plus ten biases: {5,130|five thousand one hundred and thirty} parameters. Only those are handed to gradient descent.', code: ['count', 'opt'] },
        { id: 'fit', say: 'Thousands of numbers, not millions: a few hundred photos can fit them without memorizing.', code: 'count' },
        { id: 'two', say: 'With two new layers, count each one the same way: its weights, plus one bias per output.', code: 'count' },
        { id: 'razavian', say: 'In 2014, Ali Sharif Razavian and colleagues did just this, with an ImageNet network and a linear classifier on top. On scenes, birds and flowers, it rivaled or beat methods built for each task.', code: ['freeze', 'swap'] },
        { id: 'name', say: 'This is transfer learning: what one task learned is carried over, or transferred, to another.', code: 'load' },
      ],
    },
    {
      id: 'howmuch',
      title: 'How much to retrain',
      codeTitle: 'finetune.py',
      code: `
        # 500 photos: the new layer only   #@small
        # 50,000: unfreeze every layer     #@more
        for q in model.parameters():       #@more
            q.requires_grad = True         #@more
        lr = 0.01 / 10   # 0.001           #@lr
        opt = SGD(model.parameters(), lr=lr) #@lr
      `,
      beats: [
        { id: 'more', say: 'A few hundred photos: train only the new layer. Tens of thousands: unfreeze every layer, and keep training, starting from the pretrained weights instead of random ones.', code: ['small', 'more'] },
        { id: 'tune', say: 'That is fine-tuning. The weights are nearly right already, and training only adjusts them a little, like tuning a guitar string that is almost in pitch.', code: 'more' },
        { id: 'lr', say: 'So fine-tune with a small learning rate, often a tenth of the one used from scratch: here, {0.01|zero point zero one} becomes {0.001|zero point zero zero one}.', code: 'lr' },
        { id: 'why', say: 'The pretrained weights already sit near the bottom of the loss. Big steps would overshoot, throwing away what was learned. Small steps keep them close.', code: 'lr' },
        { id: 'scratch', say: 'With a million photos, you could start from random weights. But Yosinski\'s team found that transferred weights gave a boost that lasted, even after fine-tuning.', code: 'more' },
        { id: 'xray', say: 'And when your images look nothing like photos, say chest X-rays, the early layers carry over best: edges are everywhere. Retrain the top layers, as far down as your data allows.', code: 'more' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
