import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gan',
  title: 'Generative adversarial networks',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'players',
      title: 'A generator and a discriminator',
      codeTitle: 'gan.py',
      code: `
        z = np.random.randn(100)         #@gen
        fake = gen(z)        # an image  #@gen
        d_fake = disc(fake)  # in (0, 1) #@disc
        d_real = disc(x)                 #@disc
      `,
      beats: [
        { id: 'gen', say: 'A generative adversarial network, or GAN, is two networks. The generator, G, turns random noise, z, into an image: a fake.', code: 'gen' },
        { id: 'disc', say: 'The discriminator, D, is a classifier with a sigmoid at the end. Its output is the probability that its input is a real image, not a fake.', code: 'disc' },
        { id: 'game', say: 'They train against each other. D tries to tell real images from fakes, and G tries to make fakes that D calls real.', code: ['gen', 'disc'] },
      ],
    },
    {
      id: 'dstep',
      title: 'The discriminator\'s step',
      codeTitle: 'd_step.py',
      code: `
        d_real = disc(x)                #@real
        d_fake = disc(gen(z))           #@fake
        loss_real = -np.log(d_real)     #@real
        loss_fake = -np.log(1 - d_fake) #@fake
        loss_d = loss_real + loss_fake  #@sum
      `,
      beats: [
        { id: 'labels', say: 'D is trained like any binary classifier: real images are labeled one, and fakes are labeled zero.', code: ['real', 'fake'] },
        { id: 'real', say: 'Say D gives a real image {0.8|zero point eight}. Its cross-entropy is minus the log of {0.8|zero point eight}: {0.22|zero point two two}.', code: 'real' },
        { id: 'fake', say: 'And it gives a fake {0.3|zero point three}. A fake\'s right answer is zero, whose probability is one minus {0.3|zero point three}, {0.7|zero point seven}. Minus the log of {0.7|zero point seven} is {0.36|zero point three six}.', code: 'fake' },
        { id: 'sum', say: 'D\'s loss is the two together: {0.58|zero point five eight}. Its step pushes the real score up and the fake score down, while G\'s weights stay fixed.', code: 'sum' },
      ],
    },
    {
      id: 'gstep',
      title: 'The generator\'s step',
      codeTitle: 'g_step.py',
      code: `
        d_fake = disc(gen(z))      # 0.3   #@flip
        loss_g = -np.log(d_fake)   # 1.20  #@flip
        # backprop through disc into gen   #@back
        # update gen's weights only        #@back
      `,
      beats: [
        { id: 'flip', say: 'Then it is G\'s turn. G is trained as if its fake were labeled real, so its loss is minus the log of {D(G(z))|D of G of z}: D\'s score on the fake that G makes from z. At {0.3|zero point three}, that is {1.20|one point two zero}.', code: 'flip' },
        { id: 'back', say: 'The gradient flows back through D, which is held fixed, and into G. G\'s step changes its fakes so that D\'s score on them rises.', code: 'back' },
        { id: 'alternate', say: 'The steps alternate, D then G, and each network keeps improving against the other.', code: ['flip', 'back'] },
        { id: 'collapse', say: 'One way it fails: G finds a few fakes that fool D, and makes only those, whatever z it is given. Each sample looks real, but the variety is gone. That is mode collapse.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
