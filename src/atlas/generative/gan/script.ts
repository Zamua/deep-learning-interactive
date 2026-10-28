import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gan',
  title: 'Generative adversarial networks',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Goodfellow, Pouget-Abadie, Mirza, Xu, Warde-Farley, Ozair, Courville & Bengio', year: 2014, title: 'Generative adversarial nets', url: 'https://arxiv.org/abs/1406.2661', scene: 'idea' },
  ],
  scenes: [
    {
      id: 'idea',
      title: 'A judge for fakes',
      codeTitle: 'gan.py',
      code: `
        z = np.random.randn(100)  # noise  #@z
        fake = gen(z)    # a new image     #@gen
        d_fake = disc(fake)  # 0 to 1      #@disc
      `,
      beats: [
        { id: 'want', say: 'Say you want a network that draws new handwritten digits, not copies of the ones it has seen.', code: 'gen' },
        { id: 'z', say: 'Give it a list of random numbers, z, and let it turn them into a picture. Each new z gives a new picture.', code: 'z' },
        { id: 'stuck', say: 'But training needs a loss, and a new digit has no right answer to compare with: there is no formula for how real a picture looks.', code: 'gen' },
        { id: 'judge', say: 'In 2014, Ian Goodfellow and colleagues found a way: train a second network to be the judge.', code: 'disc' },
        { id: 'police', say: 'Their paper compares it to counterfeiters printing fake money and police learning to spot it: the contest drives both to improve, until the fakes pass for real.', code: ['gen', 'disc'] },
        { id: 'G', say: 'The network that draws is the generator, G: it generates the pictures.', code: 'gen' },
        { id: 'D', say: 'The judge is the discriminator, D, from discriminate: to tell apart. It gives the probability that a picture is real.', code: 'disc' },
        { id: 'name', say: 'Two networks as adversaries, opponents in a contest: a generative adversarial network, or GAN.', code: ['gen', 'disc'] },
      ],
    },
    {
      id: 'dstep',
      title: 'The judge\'s step',
      codeTitle: 'd_step.py',
      code: `
        d_real = disc(x)                #@real
        d_fake = disc(gen(z))           #@fake
        loss_real = -np.log(d_real)     #@real
        loss_fake = -np.log(1 - d_fake) #@fake
        loss_d = loss_real + loss_fake  #@sum
      `,
      beats: [
        { id: 'binary', say: 'D sorts pictures into two classes, real and fake: a binary classifier, binary meaning of two.', code: ['real', 'fake'] },
        { id: 'one', say: 'So one number is enough: a sigmoid at the end gives the probability of real, between zero and one, and fake gets the rest, one minus it.', code: ['real', 'fake'] },
        { id: 'labels', say: 'Each picture\'s right answer, called its label, is one for real and zero for fake.', code: ['real', 'fake'] },
        { id: 'real', say: 'Say D gives a real image {0.8|zero point eight}. Its cross-entropy is minus the log of the probability on the right answer: minus the log of {0.8|zero point eight}, about {0.22|zero point two two}.', code: 'real' },
        { id: 'fake', say: 'And it gives a fake {0.3|zero point three}. A fake\'s right answer is fake, whose probability is one minus {0.3|zero point three}: {0.7|zero point seven}.', code: 'fake' },
        { id: 'fakeloss', say: 'So its loss is minus the log of {0.7|zero point seven}: about {0.36|zero point three six}.', code: 'fake' },
        { id: 'sum', say: 'D\'s loss is the two together: {0.58|zero point five eight}. Its gradient step pushes the real score up and the fake score down, while G\'s weights stay fixed.', code: 'sum' },
      ],
    },
    {
      id: 'gstep',
      title: 'The generator\'s step',
      codeTitle: 'g_step.py',
      code: `
        d_fake = disc(gen(z))      # 0.3   #@flip
        loss_g = -np.log(d_fake)   # 1.20  #@flip
        # not np.log(1 - d_fake): flat     #@sat
        # backprop through disc into gen   #@back
        # update gen's weights only        #@back
      `,
      beats: [
        { id: 'flip', say: 'Then it is G\'s turn. G is trained as if its fake were labeled real: its loss is minus the log of {D(G(z))|D of G of z}, D\'s score on the fake G makes from z.', code: 'flip' },
        { id: 'gnum', say: 'At {0.3|zero point three}, that is about {1.20|one point two zero}: the lower D\'s score on the fake, the bigger G\'s loss.', code: 'flip' },
        { id: 'whynot', say: 'Why not just have G push D\'s loss up? The 2014 paper explains: early on, D rejects the poor fakes with confidence, far out on its sigmoid\'s flat end.', code: 'sat' },
        { id: 'flat', say: 'There, D\'s loss on a fake is flat, so G would get almost no gradient. Minus the log of D keeps a steady slope, so G learns from the start.', code: 'sat' },
        { id: 'back', say: 'The gradient flows back through D, held fixed, into G. Only G\'s weights change, so D\'s scores on real images, which never pass through G, stay put.', code: 'back' },
        { id: 'alternate', say: 'The steps alternate, one for D, then one for G, so neither gets far ahead of the other.', code: ['flip', 'back'] },
      ],
    },
    {
      id: 'collapse',
      title: 'Mode collapse',
      codeTitle: 'collapse.py',
      code: `
        # real digits: ten kinds, ten peaks  #@mode
        z = np.random.randn(100)  # one z   #@z
        fake = gen(z)        # a 7          #@fake
        z = np.random.randn(100)  # new z   #@z
        fake = gen(z)        # a 7 again    #@fake
      `,
      beats: [
        { id: 'modes', say: 'Real digits come in ten kinds: plot how often each kind turns up, and there are ten peaks. In statistics, the most common value is the mode, so ten peaks make ten modes.', code: 'mode' },
        { id: 'one', say: 'Now say G finds one fake that fools D: a convincing seven. Its loss asks only that each fake fool D, not for variety, so it draws that seven for every z.', code: ['z', 'fake'] },
        { id: 'name', say: 'Each picture looks real, but the variety is gone: the output has collapsed onto one mode. That is mode collapse.', code: 'fake' },
        { id: 'warned', say: 'The 2014 paper already warns of it: train G too much without updating D, and G collapses too many values of z onto the same picture.', code: 'z' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
