import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-contrastive-loss',
  title: 'The contrastive loss',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Chen, Kornblith, Norouzi & Hinton', year: 2020, title: 'A simple framework for contrastive learning of visual representations', url: 'https://arxiv.org/abs/2002.05709', scene: 'views' },
    { who: 'van den Oord, Li & Vinyals', year: 2018, title: 'Representation learning with contrastive predictive coding', url: 'https://arxiv.org/abs/1807.03748', scene: 'loss' },
  ],
  scenes: [
    {
      id: 'views',
      title: 'Two views of one photo',
      codeTitle: 'views.py',
      code: `
        v1, v2 = crop(img), crop(img)  #@views
        z1, z2 = enc(v1), enc(v2)      #@embed
        # z1, z2: point the same way   #@goal
        # other photos: point apart    #@goal
      `,
      beats: [
        { id: 'problem', say: 'Labels cost people\'s time: someone has to write down what each photo shows. Can a network learn to describe photos from the photos alone?', code: 'views' },
        { id: 'views', say: 'Here is a way. Cut two random crops from one photo: two views. They look different, yet they show the same thing.', code: 'views' },
        { id: 'embed', say: 'An encoder, an ordinary network, turns each view into a vector: {z₁|z one} for the first, and {z₂|z two} for the second.', code: 'embed' },
        { id: 'goal', say: 'Train it so that two views of one photo point the same way, and views of different photos point apart. Each view is contrasted with the others, hence the name: contrastive.', code: 'goal' },
        { id: 'simclr', say: 'In 2020, Ting Chen, Geoffrey Hinton and colleagues showed how well this works, with a recipe they called {SimCLR|sim C L R}: two random crops of every photo, recolored.', code: 'views' },
      ],
    },
    {
      id: 'circle',
      title: 'Arrows on a circle',
      codeTitle: 'unit.py',
      code: `
        z1 = enc(v1)        # [6, 8]   #@embed
        np.sqrt(36 + 64)    # 10.0     #@size
        z1 = z1 / 10      # [0.6, 0.8] #@unit
        z1 @ z2             # 0.8      #@sim
      `,
      beats: [
        { id: 'arrow', say: 'Say {z₁|z one} comes out as six, eight. Draw it as an arrow from the origin.', code: 'embed' },
        { id: 'size', say: 'Its size as an arrow, not its count of entries, is the square root of its squared entries added up: thirty six plus sixty four is a hundred, whose square root is ten.', code: 'size' },
        { id: 'unit', say: 'Divide each entry by ten: {0.6|zero point six}, {0.8|zero point eight}, an arrow of length one, called a unit vector. Every view is scaled this way, so every tip lands on one circle, and only directions count.', code: 'unit' },
        { id: 'sim', say: 'The similarity of two views is the dot product of their unit vectors. Pointing the same way, it is one. At a right angle, zero. Opposite, minus one.', code: 'sim' },
        { id: 'pair', say: 'Our two views sit close together, at a similarity of {0.8|zero point eight}.', code: 'sim' },
      ],
    },
    {
      id: 'batch',
      title: 'Positives and negatives',
      codeTitle: 'batch.py',
      code: `
        # N photos, 2 views each: 2N    #@views
        # anchor: one view              #@anchor
        # positive: its own pair        #@pos
        # negatives: the other 2N - 2   #@neg
        sim = Z1 @ Z2.T     # (N, N)    #@grid
      `,
      beats: [
        { id: 'batch', say: 'Training works on a batch: a few photos at a time, each cropped twice. Here, three photos give six views.', code: 'views' },
        { id: 'anchor', say: 'Pick one view, and call it the anchor: the one everything is measured against.', code: 'anchor' },
        { id: 'pos', say: 'Its positive is the other crop of the same photo, fixed by the cropping, before anything is measured.', code: 'pos' },
        { id: 'neg', say: 'Every view of every other photo is a negative: here, four of them. Even another photo of a boat would be one: nothing says what any photo shows.', code: 'neg' },
        { id: 'grid', say: 'To keep the picture small, score each photo\'s first view against every second view: the positives sit on the diagonal.', code: 'grid' },
        { id: 'row', say: 'Row zero, on the circle: its anchor points straight up, the positive sits close, at {0.8|zero point eight}, and two negatives at zero and {0.4|zero point four}.', code: 'grid' },
      ],
    },
    {
      id: 'loss',
      title: 'Which one is the partner?',
      codeTitle: 'info_nce.py',
      code: `
        sim[0]           # [0.8, 0, 0.4]   #@row
        tau = 0.4                          #@tau
        s = sim[0] / tau     # [2, 0, 1]   #@s
        e = np.exp(s)  # [7.39, 1, 2.72]   #@e
        loss = np.log(e.sum()) - s[0]      #@loss
        # = ln 11.11 - 2 = 0.41            #@loss
      `,
      beats: [
        { id: 'ask', say: 'Now ask the anchor: of these candidates, which is your partner? It is a classification, with the positive as the right answer.', code: 'row' },
        { id: 'range', say: 'But similarities stay between minus one and one. That is too narrow for a softmax: on this row, it gives the positive less than half.', code: 'row' },
        { id: 'tau', say: 'So divide every similarity by a small number, the temperature, written {τ|tau}, a Greek letter: here, {0.4|zero point four}.', code: 'tau' },
        { id: 's', say: 'Divide by {0.4|zero point four}, and {0.8|zero point eight} becomes two, while {0.4|zero point four} becomes one. Zero stays zero: the gaps have stretched.', code: 's' },
        { id: 'heat', say: 'The name comes from physics, where this same softmax gives the odds of each state at a temperature. Hot, the odds even out; cold, one state takes nearly all.', code: 'tau' },
        { id: 'soft', say: 'Then it is the cross-entropy of a softmax, as before. e to the scores gives {7.39|seven point three nine}, one, and {2.72|two point seven two}.', code: 'e' },
        { id: 'loss', say: 'The loss is the log of their total, {11.11|eleven point one one}, minus the positive\'s score, two: about {0.41|zero point four one}.', code: 'loss' },
        { id: 'oord', say: 'Aaron van den Oord and colleagues named this loss {InfoNCE|info N C E} in 2018, and read it the same way: a cross-entropy for picking out the positive.', code: 'loss' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
