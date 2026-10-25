import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-latent-diffusion',
  title: 'Latent diffusion',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'squeeze',
      title: 'Squeeze the image first',
      codeTitle: 'latent.py',
      code: `
        x = img            # (512, 512, 3)  #@px
        x.size             # 786,432        #@px
        z = encode(x)      # (64, 64, 4)    #@enc
        z.size             # 16,384         #@count
        x.size / z.size    # 48.0           #@count
      `,
      beats: [
        { id: 'px', say: 'A {512 by 512|five twelve by five twelve} color image holds {786,432|seven hundred and eighty six thousand, four hundred and thirty two} numbers. Diffusion on pixels runs its network over every one of them, at every step.', code: 'px' },
        { id: 'enc', say: 'Latent diffusion squeezes the image first, with an autoencoder. Its encoder turns x into a latent, z: a {64 by 64|sixty four by sixty four} grid, with four numbers at each spot.', code: 'enc' },
        { id: 'count', say: 'That is {16,384|sixteen thousand, three hundred and eighty four} numbers. Each side is eight times shorter, so there are sixty four times fewer spots, with four numbers each instead of three. Sixty four times three over four: forty eight times fewer numbers.', code: 'count' },
      ],
    },
    {
      id: 'train',
      title: 'Two networks, in turn',
      codeTitle: 'train.py',
      code: `
        # 1: train the autoencoder, then freeze  #@ae
        x_hat = decode(encode(x))                #@ae
        # 2: train the denoiser on latents       #@dn
        z = encode(x)                            #@dn
        zt = np.sqrt(ab) * z + np.sqrt(1-ab) * eps #@loss
        loss = np.mean((eps - model(zt, t))**2)  #@loss
      `,
      beats: [
        { id: 'ae', say: 'Two networks are trained, one after the other. First the autoencoder, on images alone: encode, decode, and match the input. Then it is frozen.', code: 'ae' },
        { id: 'dn', say: 'Then the denoiser. Each training image is encoded, and its latent, z, takes the place of the clean image.', code: 'dn' },
        { id: 'loss', say: 'Noise z to a random step t, giving {z_t|z t}, and train the network to find that noise, with the same squared error as before. It never sees a pixel: only {z_t|z t} and t, and its guess has the latent\'s shape.', code: 'loss' },
      ],
    },
    {
      id: 'make',
      title: 'Decode once, at the end',
      codeTitle: 'make.py',
      code: `
        zt = np.random.randn(64, 64, 4)  # noise  #@start
        for t in steps:                # say 50   #@loop
            eps_hat = model(zt, t)     # 16,384   #@loop
            zt = ...                   # less noise #@loop
        img = decode(zt)     # once: (512, 512, 3) #@decode
      `,
      beats: [
        { id: 'start', say: 'To make an image, start from pure noise in the latent\'s shape, {64 by 64 by 4|sixty four by sixty four by four}. The encoder is not needed at all.', code: 'start' },
        { id: 'loop', say: 'Take the guessed noise away a little at a time, step after step. Each step runs the denoiser on just {16,384|sixteen thousand, three hundred and eighty four} numbers: fifty steps, fifty calls.', code: 'loop' },
        { id: 'decode', say: 'Only at the very end does the decoder run, once, turning the finished latent into a {512 by 512|five twelve by five twelve} image.', code: 'decode' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
