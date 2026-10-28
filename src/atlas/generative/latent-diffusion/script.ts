import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-latent-diffusion',
  title: 'Latent diffusion',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rombach, Blattmann, Lorenz, Esser & Ommer', year: 2021, title: 'High-Resolution Image Synthesis with Latent Diffusion Models', url: 'https://arxiv.org/abs/2112.10752', scene: 'cost' },
  ],
  scenes: [
    {
      id: 'cost',
      title: 'Every step, every number',
      codeTitle: 'pixels.py',
      code: `
        x.shape           # (512, 512, 3)  #@px
        x.size            # 786,432        #@px
        for t in steps:   # say 50         #@walk
            eps_hat = model(x, t)          #@walk
            x = ...       # less noise     #@walk
        x[:8, :8].size    # 192: a patch   #@patch
      `,
      beats: [
        { id: 'walk', say: 'A diffusion model makes an image by walking back from pure noise. At every step, its network reads every number of the picture, and guesses the noise in it.', code: 'walk' },
        { id: 'px', say: 'A {512 by 512|five twelve by five twelve} color image has three numbers per pixel, for red, green and blue: {786,432|seven hundred and eighty six thousand, four hundred and thirty two} in all. The network goes through every one of them again, at each of fifty steps.', code: 'px' },
        { id: 'patch', say: 'Look closely at one small patch of sky, eight pixels by eight. That is {192|a hundred and ninety two} numbers, and they nearly all repeat one another.', code: 'patch' },
        { id: 'rombach', say: 'In 2021, Robin Rombach and colleagues made the point: most of an image\'s numbers carry detail the eye barely notices. Yet a diffusion model on pixels works through every one of them, at every step.', code: 'walk' },
      ],
    },
    {
      id: 'squeeze',
      title: 'Squeeze the image first',
      codeTitle: 'latent.py',
      code: `
        z = encode(x)      # (64, 64, 4)   #@enc
        512 // 64          # 8x shorter    #@spots
        z.size             # 16,384        #@count
        8 * 8 * 3 / 4      # 48.0          #@ratio
        x.size / z.size    # 48.0          #@ratio
      `,
      beats: [
        { id: 'enc', say: 'Their fix was to squeeze the image first, with an autoencoder, and run the diffusion on the squeezed version instead.', code: 'enc' },
        { id: 'grid', say: 'This encoder keeps the picture\'s layout. Out comes a small grid, and each spot of it sits over one patch of eight by eight pixels, described in just four numbers.', code: 'enc' },
        { id: 'z', say: 'That grid is the autoencoder\'s code, z. For a {512 by 512|five twelve by five twelve} image, it is {64 by 64|sixty four by sixty four} spots: the sizes Stable Diffusion used, in 2022.', code: 'enc' },
        { id: 'name', say: 'Here the code is called the latent, from the Latin for lying hidden: nobody looks at these numbers as a picture. Only the decoder turns them back into pixels.', code: 'enc' },
        { id: 'spots', say: 'Each side is eight times shorter, so the grid has eight times eight: sixty four times fewer spots than the image has pixels.', code: 'spots' },
        { id: 'count', say: 'But each spot holds four numbers, where a pixel holds three. That makes {16,384|sixteen thousand, three hundred and eighty four} numbers in all.', code: 'count' },
        { id: 'ratio', say: 'Sixty four times fewer spots, with four numbers for every three: sixty four times three, over four, is forty eight. Forty eight times fewer numbers, at every step.', code: 'ratio' },
      ],
    },
    {
      id: 'train',
      title: 'Two networks, in turn',
      codeTitle: 'train.py',
      code: `
        x_hat = decode(encode(x))      #@ae
        # then frozen: no more updates #@frozen
        z = encode(x)                  #@dn
        zt = (np.sqrt(ab) * z          #@zt
              + np.sqrt(1 - ab) * eps) #@zt
        eps_hat = model(zt, t)         #@loss
        np.mean((eps - eps_hat)**2)    #@loss
      `,
      beats: [
        { id: 'ae', say: 'So two networks are trained, one after the other. First the autoencoder, on images alone, as before: encode, decode, and match the input.', code: 'ae' },
        { id: 'frozen', say: 'Then it is frozen: its weights never change again. That way, a latent keeps the same meaning while the second network learns from it.', code: 'frozen' },
        { id: 'dn', say: 'The second network is the denoiser. Each training image is encoded, and its latent, z, takes the place of the clean image.', code: 'dn' },
        { id: 'zt', say: 'Blend z with noise to a random step t, exactly as with pixels, and you get {z_t|z t}: a noised latent.', code: 'zt' },
        { id: 'loss', say: 'The denoiser learns to find that noise, with the same squared error as before. It never sees a pixel: its guess, {ε̂|epsilon hat}, has the latent\'s shape.', code: 'loss' },
      ],
    },
    {
      id: 'make',
      title: 'Decode once, at the end',
      codeTitle: 'make.py',
      code: `
        zt = np.random.randn(64, 64, 4)  #@start
        for t in steps:      # say 50    #@loop
            eps_hat = model(zt, t)       #@loop
            zt = ...         # less noise #@loop
        img = decode(zt)     # just once #@decode
        img.shape     # (512, 512, 3)    #@decode
      `,
      beats: [
        { id: 'start', say: 'To make a new image, start from pure noise in the latent\'s shape, {64 by 64 by 4|sixty four by sixty four by four}. There is no image to encode, so the encoder does not run at all.', code: 'start' },
        { id: 'loop', say: 'Then walk back, step after step. Each step runs the denoiser on just {16,384|sixteen thousand, three hundred and eighty four} numbers: fifty steps, fifty calls.', code: 'loop' },
        { id: 'decode', say: 'Only at the very end does the decoder run, once, turning the finished latent into a {512 by 512|five twelve by five twelve} image.', code: 'decode' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
