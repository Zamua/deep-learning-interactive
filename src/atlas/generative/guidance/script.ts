import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-guidance',
  title: 'Classifier-free guidance',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'two',
      title: 'With and without the prompt',
      codeTitle: 'two_runs.py',
      code: `
        eps_c = model(xt, t, prompt)  # [0.5, -0.1] #@c
        eps_u = model(xt, t, empty)   # [0.2, -0.4] #@u
        # training: prompt emptied 10% of the time  #@drop
      `,
      beats: [
        { id: 'prompt', say: 'A denoiser can take a text prompt as an extra input, such as a red bicycle, and guess the noise with it in mind. Call that guess {ε_c|epsilon c}: c for conditioned, shown the prompt.', code: 'c' },
        { id: 'drop', say: 'Train it with the prompt replaced by an empty one part of the time. Then the same network can also guess without the prompt: {ε_u|epsilon u}, u for unconditioned.', code: ['u', 'drop'] },
        { id: 'diff', say: 'The difference, {ε_c|epsilon c} minus {ε_u|epsilon u}, is what the prompt changes: the direction the prompt points.', code: ['c', 'u'] },
      ],
    },
    {
      id: 'push',
      title: 'Step further along the prompt',
      codeTitle: 'guide.py',
      code: `
        scale = 3                                  #@w
        eps_hat = eps_u + scale * (eps_c - eps_u)  #@rule
        # [0.2, -0.4] + 3 * [0.3, 0.3] = [1.1, 0.5] #@three
      `,
      beats: [
        { id: 'rule', say: 'Guidance mixes the two. The guess it uses, {ε̂|epsilon hat}, is {ε_u|epsilon u}, plus w times the difference. Here w is not a weight but one number, the guidance scale.', code: ['w', 'rule'] },
        { id: 'ends', say: 'At w equal to zero, that is just {ε_u|epsilon u}: the prompt is ignored. At w equal to one, it is exactly {ε_c|epsilon c}.', code: 'rule' },
        { id: 'three', say: 'Above one, it steps past {ε_c|epsilon c}, further the way the prompt points. At w equal to three: {0.2|zero point two} plus three times {0.3|zero point three} is {1.1|one point one}, and minus {0.4|zero point four} plus {0.9|zero point nine} is {0.5|zero point five}.', code: 'three' },
        { id: 'use', say: 'An image is made by taking the guessed noise away a little at a time, over many steps. Guidance swaps in this guess at every step, so each step runs the network twice: once with the prompt, once without.', code: 'rule' },
      ],
    },
    {
      id: 'scale',
      title: 'How large a w',
      codeTitle: 'sweep.py',
      code: `
        for scale in [1, 3, 7.5, 15]:     #@sweep
            img = sample(prompt, scale)   #@sweep
        # 1: varied, loosely on prompt    #@low
        # 7.5: on prompt, a common default #@mid
        # 15: all alike, overdone         #@big
      `,
      beats: [
        { id: 'sweep', say: 'So what does a larger w buy? Every step leans harder toward what the prompt asks for.', code: 'sweep' },
        { id: 'low', say: 'At w of one, the pictures vary a lot, and some follow the prompt only loosely.', code: 'low' },
        { id: 'mid', say: 'Around seven, they follow it closely. Values like this are a common default.', code: 'mid' },
        { id: 'big', say: 'Push w much higher, and the pictures look more and more alike, with colors and contrast overdone. Guidance trades variety for faithfulness to the prompt.', code: 'big' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
