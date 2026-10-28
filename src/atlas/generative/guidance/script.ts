import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-guidance',
  title: 'Classifier-free guidance',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Dhariwal & Nichol', year: 2021, title: 'Diffusion models beat GANs on image synthesis', url: 'https://arxiv.org/abs/2105.05233', scene: 'free' },
    { who: 'Ho & Salimans', year: 2021, title: 'Classifier-free diffusion guidance', url: 'https://arxiv.org/abs/2207.12598', scene: 'free' },
    { who: 'Nichol, Dhariwal, Ramesh, Shyam, Mishkin, McGrew, Sutskever & Chen', year: 2021, title: 'GLIDE: towards photorealistic image generation and editing with text-guided diffusion models', url: 'https://arxiv.org/abs/2112.10741', scene: 'free' },
  ],
  scenes: [
    {
      id: 'pull',
      title: 'Which image?',
      codeTitle: 'prompt.py',
      code: `
        prompt = 'a red bicycle'          #@prompt
        xt = np.random.randn(64, 64)      #@walk
        for t in range(1000, 0, -1):      #@walk
            eps_c = model(xt, t, prompt)  #@c
            xt = ...   # one step back    #@walk
      `,
      beats: [
        { id: 'walk', say: 'Sampling makes an image out of pure noise: a thousand steps back, each taking away the network\'s noise guess. But nothing in it says which image to make.', code: 'walk' },
        { id: 'prompt', say: 'To ask for one, give the network one more input, a prompt: a name or a few words, such as a red bicycle, turned into numbers it can read.', code: 'prompt' },
        { id: 'ec', say: 'Its noise guess now depends on the prompt. Call it {ε_c|epsilon c}: c for conditioned, since the guess is made on the condition of the prompt.', code: 'c' },
        { id: 'weak', say: 'The trouble is that the prompt changes the guess only a little. Most of the guess is about what any image looks like, so the guess with no prompt at all lands close by.', code: 'c' },
        { id: 'loose', say: 'So each step leans only slightly toward a red bicycle, and the pictures may look only vaguely like one.', code: 'walk' },
      ],
    },
    {
      id: 'free',
      title: 'No classifier needed',
      codeTitle: 'two_runs.py',
      code: `
        # before: a 2nd network, a classifier #@cls
        eps_c = model(xt, t, prompt)  #@c
        eps_u = model(xt, t, '')      #@u
        # train: '' about 1 time in 10  #@drop
        eps_c - eps_u   # the prompt's push #@diff
      `,
      beats: [
        { id: 'cls', say: 'One fix came in 2021, from Prafulla Dhariwal and Alex Nichol, for prompts that name a class, such as bicycle: a second network, a classifier, trained to name the class even in a noisy image.', code: 'cls' },
        { id: 'grad', say: 'At every step, its gradient showed how to change the image so the classifier grew surer, and the sampler leaned that way. It worked, but it took a whole second network.', code: 'cls' },
        { id: 'free', say: 'Later that year, Jonathan Ho and Tim Salimans showed that the second network is not needed. Train the one denoiser with its prompt blanked out about one time in ten, so it also learns to guess with no prompt.', code: 'drop' },
        { id: 'eu', say: 'That guess, the one with no prompt, is {ε_u|epsilon u}: u for unconditioned.', code: 'u' },
        { id: 'diff', say: 'Run the network both ways, and the difference, {ε_c|epsilon c} minus {ε_u|epsilon u}, is just what the prompt changes: the direction it points.', code: 'diff' },
        { id: 'name', say: 'The push toward the prompt comes from the same network, not from a classifier: hence the name, classifier-free guidance. Before the year was out, Alex Nichol and colleagues used it for text prompts, in a model called GLIDE.', code: 'diff' },
      ],
    },
    {
      id: 'push',
      title: 'Step further along the prompt',
      codeTitle: 'guide.py',
      code: `
        scale = 3   # w, the guidance scale  #@w
        diff = eps_c - eps_u   # [0.1, 0.1]  #@rule
        eps_hat = eps_u + scale * diff       #@rule
        # 0.2 + 3 * 0.1 = 0.5                #@three
        # -0.4 + 3 * 0.1 = -0.1              #@second
        # every step: 2 runs of the model    #@use
      `,
      beats: [
        { id: 'rule', say: 'So step further that way. The guess the sampler uses, {ε̂|epsilon hat}, starts at {ε_u|epsilon u} and adds the difference times w, one number you choose: the guidance scale. Here w is not a weight.', code: ['w', 'rule'] },
        { id: 'ends', say: 'At w equal to zero, that is just {ε_u|epsilon u}: the prompt is ignored. At a half, it lands halfway between. At one, it is exactly {ε_c|epsilon c}: the weak pull from before.', code: 'rule' },
        { id: 'three', say: 'Above one, it steps past {ε_c|epsilon c}, further the way the prompt points. At w equal to three, the first number is {0.2|zero point two}, plus three times {0.1|zero point one}: {0.5|zero point five}.', code: 'three' },
        { id: 'second', say: 'The second is minus {0.4|zero point four}, plus three times {0.1|zero point one}: minus {0.1|zero point one}. The prompt\'s small nudge, three times over.', code: 'second' },
        { id: 'use', say: 'The sampler uses this guess at every step, so each step runs the network twice, once with the prompt and once without. A thousand steps, two thousand runs.', code: 'use' },
      ],
    },
    {
      id: 'scale',
      title: 'How large a w',
      codeTitle: 'sweep.py',
      code: `
        for scale in [1, 3, 7.5, 15]:    #@sweep
            img = sample(prompt, scale)  #@sweep
        # 1: varied, loosely on prompt   #@low
        # 7.5: close, a common default   #@mid
        # 15: alike, saturated colors    #@big
      `,
      beats: [
        { id: 'sweep', say: 'So what does a larger w buy? Every step leans harder toward the prompt.', code: 'sweep' },
        { id: 'low', say: 'At w of one, plain {ε_c|epsilon c}, the pictures vary a lot, and some follow the prompt only loosely.', code: 'low' },
        { id: 'mid', say: 'Around seven, they follow it closely: {7.5|seven and a half} is a common default.', code: 'mid' },
        { id: 'big', say: 'With a much larger w, they look more and more alike. Ho and Salimans saw strongly guided samples turn to saturated, overdone colors.', code: 'big' },
        { id: 'trade', say: 'Guidance trades variety for faithfulness to the prompt, and w sets how far.', code: ['low', 'big'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
