import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { pick } from '../../kit';
import { EHAT, EPS, big, shp, shuffled, straps, traps } from '../kit';

const Z = '\\sym{z}{z}';
const ZT = '\\sym{zt}{z_t}';

interface Setup {
  /** Image height and width in pixels. */
  h: number;
  w: number;
  /** How many times shorter each side gets. */
  f: number;
  /** Numbers at each spot of the latent. */
  c: number;
}

/** An image size and an encoder, larger and more varied with difficulty. */
function setup(rng: Rng, d: number): Setup {
  if (d < 0.35) {
    const s = pick(rng, [64, 128, 256]);
    const [f, c] = pick(rng, [[8, 4], [8, 4], [4, 3]]);
    return { h: s, w: s, f: f!, c: c! };
  }
  const [h, w] = d < 0.7 ? pick(rng, [[256, 256], [512, 512], [1024, 1024]]) : pick(rng, [[512, 512], [512, 768], [768, 512], [1024, 1024], [1024, 768]]);
  const [f, c] = d < 0.7 ? pick(rng, [[8, 4], [8, 4], [4, 3], [8, 16]]) : pick(rng, [[8, 4], [4, 3], [8, 16], [16, 16], [8, 8], [4, 4]]);
  return { h: h!, w: w!, f: f!, c: c! };
}

/** Setups whose latent is quick to count on paper: [height, width, f, c]. */
const COUNTABLE: [number, number, number, number][] = [
  [512, 512, 8, 4],
  [256, 256, 4, 3],
  [512, 512, 16, 16],
  [512, 512, 8, 16],
  [1024, 1024, 16, 16],
  [512, 768, 8, 4],
  [256, 512, 8, 4],
  [768, 768, 16, 8],
];

const latentOf = (s: Setup) => [s.h / s.f, s.w / s.f, s.c];
const encoderText = (s: Setup) => `Its encoder makes each side of the image ${s.f} times shorter and keeps ${s.c} numbers at each spot of the latent`;

export const generators: Generator[] = [
  {
    id: 'numbers',
    make(rng, d) {
      const kind = d < 0.35 ? pick(rng, ['latent', 'ratio', 'pixels'] as const) : pick(rng, ['latent', 'ratio', 'ratio'] as const);
      const counted = kind === 'latent' && d >= 0.35 ? pick(rng, COUNTABLE) : null;
      const s = counted ? { h: counted[0], w: counted[1], f: counted[2], c: counted[3] } : setup(rng, d);
      const [lh, lw] = latentOf(s);
      const pixels = s.h * s.w * 3;
      const latent = lh! * lw! * s.c;
      const ratio = pixels / latent;
      const lead = `A latent diffusion model makes $${s.h} \\times ${s.w}$ color images. ${encoderText(s)}.`;
      if (kind === 'pixels')
        return {
          prompt: `${lead} A diffusion model working on the pixels instead would handle how many numbers at every step?`,
          answer: { kind: 'number', value: pixels },
          traps: traps(pixels, [
            { value: s.h * s.w, why: 'That counts pixels. Each color pixel holds 3 numbers: red, green and blue.' },
            { value: latent, why: 'That is the latent. Working on the pixels means every number of the image.' },
          ]),
          solution: [`$${s.h} \\times ${s.w}$ pixels, 3 numbers each: $${s.h} \\cdot ${s.w} \\cdot 3 = ${big(pixels)}$.`, 'A pixel-space model runs over all of them at every step.'],
        };
      if (kind === 'latent')
        return {
          prompt: `${lead} How many numbers does the denoiser handle at every step?`,
          answer: { kind: 'number', value: latent },
          traps: traps(latent, [
            { value: lh! * lw! * 3, why: `That keeps 3 numbers per spot, as the pixels have. The latent has ${s.c}.` },
            { value: lh! * lw!, why: `That counts the spots of the latent. Each holds ${s.c} numbers.` },
            { value: (s.h * s.w * s.c) / s.f, why: `That divides once. Both sides shrink by ${s.f}, so the spots shrink by $${s.f} \\times ${s.f}$.` },
            { value: pixels, why: 'That is the image. The denoiser works on the latent.' },
            { value: ratio, why: 'That is how many times fewer numbers the latent has than the image. The question asks how many it has.' },
          ]),
          solution: [
            `The latent is $${s.h} / ${s.f} = ${lh}$ by $${s.w} / ${s.f} = ${lw}$ spots, with ${s.c} numbers at each.`,
            `$${lh} \\cdot ${lw} \\cdot ${s.c} = ${big(latent)}$ numbers, at every step.`,
          ],
        };
      return {
        prompt: `${lead} How many times fewer numbers does its denoiser handle at every step than a diffusion model working on the pixels?`,
        answer: { kind: 'number', value: ratio },
        traps: traps(ratio, [
          { value: s.f, why: `That is per side. Both sides shrink by ${s.f}, so there are $${s.f}^2 = ${s.f * s.f}$ times fewer spots.` },
          { value: s.f * s.f, why: `That counts spots. A pixel has 3 numbers and a spot of the latent ${s.c}: multiply by $3 / ${s.c}$.` },
          { value: (s.f * s.f * s.c) / 3, why: `That turns the channels upside down. Pixels hold 3 numbers each, the latent ${s.c}: the factor is $3 / ${s.c}$.` },
          { value: pixels - latent, why: 'That is how many fewer numbers. The question asks how many times fewer: divide.' },
        ]),
        solution: [
          `Each side is ${s.f} times shorter, so the latent has $${s.f} \\times ${s.f} = ${s.f * s.f}$ times fewer spots than the image has pixels.`,
          `Each pixel holds 3 numbers and each spot ${s.c}, so the count shrinks by $${s.f * s.f} \\times 3 / ${s.c} = ${big(ratio)}$.`,
          `Check: $${big(pixels)} / ${big(latent)} = ${big(ratio)}$.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const s = setup(rng, d);
      const lat = latentOf(s);
      const img = [s.h, s.w, 3];
      const kind = pick(rng, ['encode', 'decode', 'start', 'guess'] as const);
      const lead = `A latent diffusion model works with color images of shape $${shp(img)}$. ${encoderText(s)}.`;
      if (kind === 'decode')
        return {
          prompt: `A latent diffusion model's encoder makes each side of an image ${s.f} times shorter and keeps ${s.c} numbers at each spot. Generation ends with a latent of shape $${shp(lat)}$. What shape is the color image the decoder turns it into?`,
          answer: { kind: 'shape', value: img },
          traps: straps(img, [
            { value: [s.h, s.w, s.c], why: `That keeps the latent's ${s.c} channels. A color image has 3: red, green and blue.` },
            { value: [lat[0]! * s.f * s.f, lat[1]! * s.f * s.f, 3], why: `That grows each side by $${s.f}^2$. Each side grows by ${s.f}.` },
            { value: lat, why: 'That is the latent itself. The decoder turns it back into pixels.' },
          ]),
          solution: [`The decoder undoes the encoder's shrinking: each side ${s.f} times longer, $${lat[0]} \\cdot ${s.f} = ${s.h}$ and $${lat[1]} \\cdot ${s.f} = ${s.w}$.`, `With 3 color channels: $${shp(img)}$.`],
        };
      const ask =
        kind === 'encode'
          ? 'What shape is the latent the encoder makes from one image?'
          : kind === 'start'
            ? 'To make a new image, what shape is the pure noise the sampling starts from?'
            : `During training, what shape is the denoiser's noise guess $${EHAT}$?`;
      return {
        prompt: `${lead} ${ask}`,
        answer: { kind: 'shape', value: lat },
        traps: straps(lat, [
          { value: [lat[0]!, lat[1]!, 3], why: `That keeps the image's 3 channels. The latent has ${s.c} numbers at each spot.` },
          { value: img, why: kind === 'encode' ? 'That is the image itself. The encoder shrinks it.' : 'That is the image\'s shape. Latent diffusion noises and denoises the latent, never the pixels.' },
          { value: [s.h / (s.f * s.f), s.w / (s.f * s.f), s.c], why: `That shrinks each side by $${s.f}^2$. Each side shrinks by ${s.f}.` },
          { value: [s.c, lat[0]!, lat[1]!], why: 'That puts the channels first. Shapes here are (height, width, channels).' },
        ]),
        solution: [
          `Each side shrinks ${s.f} times: $${s.h} / ${s.f} = ${lat[0]}$ and $${s.w} / ${s.f} = ${lat[1]}$, with ${s.c} numbers at each spot.`,
          kind === 'encode' ? `The latent has shape $${shp(lat)}$.` : `Diffusion here runs on latents, so ${kind === 'start' ? 'the starting noise' : `$${EHAT}$, like $${EPS}$,`} has the latent's shape: $${shp(lat)}$.`,
        ],
      };
    },
  },
  {
    id: 'pipeline',
    make(rng, d) {
      const s = setup(rng, d);
      const steps = pick(rng, [20, 25, 30, 50, 100]);
      const kind = pick(rng, ['order', 'every', 'once'] as const);
      const lat = latentOf(s);
      const lead = `A latent diffusion model makes $${s.h} \\times ${s.w}$ color images from latents of shape $${shp(lat)}$, in ${steps} denoising steps.`;
      if (kind === 'order')
        return {
          prompt: `${lead} Put its life in order, from training to a finished image.`,
          answer: {
            kind: 'order',
            items: [
              'Train the autoencoder to rebuild images, then freeze it',
              `Encode the training images, and train the denoiser to find the noise in each noised latent $${ZT}$`,
              `Draw pure noise of shape $${shp(lat)}$ and denoise it, step after step`,
              'Run the decoder once on the finished latent',
            ],
          },
          solution: [
            'The autoencoder comes first: the latents have to mean something before diffusion can learn them.',
            `The denoiser is then trained on latents, with the usual noise loss, while the autoencoder stays frozen.`,
            `Generating starts from latent noise and runs ${steps} denoising steps; only the very end decodes to pixels.`,
          ],
        };
      if (kind === 'every')
        return {
          prompt: `${lead} What runs at every one of the ${steps} steps?`,
          answer: shuffled(rng, [
            { text: `The denoiser, on a latent of shape $${shp(lat)}$`, why: null },
            { text: `The denoiser, on an image of shape $${shp([s.h, s.w, 3])}$`, why: 'That is diffusion on pixels. Here every step works on the small latent.' },
            { text: 'The decoder, to check the image so far', why: `The decoder runs once, at the end. The ${steps} steps never leave the latent.` },
            { text: 'The encoder, to turn the image so far into a latent', why: 'Generation never has an image to encode: it starts from latent noise and stays there until the end.' },
          ]),
          solution: [`Each of the ${steps} steps runs the denoiser on the noisy latent $${ZT}$ and the step $t$.`, `That is $${big(lat[0]! * lat[1]! * lat[2]!)}$ numbers per step instead of $${big(s.h * s.w * 3)}$.`],
        };
      return {
        prompt: `${lead} What runs exactly once per image?`,
        answer: shuffled(rng, [
          { text: 'The decoder', why: null },
          { text: 'The denoiser', why: `The denoiser runs at every step: ${steps} times.` },
          { text: 'The encoder', why: 'The encoder never runs when making a new image: generation starts from noise in the latent\'s shape.' },
          { text: 'Both the encoder and the decoder', why: 'Only the decoder runs, once at the end. There is no image to encode.' },
        ]),
        solution: [
          `The ${steps} denoising steps all work on the latent.`,
          `Only at the end does the decoder run, once, turning the latent into a $${s.h} \\times ${s.w}$ image.`,
        ],
      };
    },
  },
  {
    id: 'roles',
    make(rng) {
      const kind = pick(rng, ['ae', 'denoiser', 'frozen'] as const);
      const size = pick(rng, [256, 512, 768, 1024]);
      const lead = `A latent diffusion model for ${size} by ${size} images has two parts: an autoencoder, and a denoiser that works on its latents.`;
      if (kind === 'ae')
        return {
          prompt: `${lead} What is the autoencoder trained to do?`,
          answer: shuffled(rng, [
            { text: 'Rebuild each image from its latent, trained on images alone', why: null },
            { text: `Find the noise mixed into a noised latent $${ZT}$`, why: 'That is the denoiser\'s job. The autoencoder only learns to squeeze images and rebuild them.' },
            { text: 'Turn pure noise into a new latent, step by step', why: 'That is what the denoiser does at generation. The autoencoder is trained only to rebuild its input.' },
            { text: 'Label each image with what it shows', why: 'No labels are used: an autoencoder\'s target is its own input.' },
          ]),
          solution: ['The autoencoder is trained first, as any autoencoder is: encode, decode, and match the input.', 'Its latents then give the denoiser a small space to work in.'],
        };
      if (kind === 'denoiser')
        return {
          prompt: `${lead} What is the denoiser trained on?`,
          answer: shuffled(rng, [
            { text: `Noised latents $${ZT}$ of encoded training images, to find their noise`, why: null },
            { text: 'Noised training images, pixel by pixel, to find their noise', why: 'That is diffusion on pixels. Here the denoiser never sees a pixel: only latents.' },
            { text: 'Clean latents, to rebuild the images they came from', why: 'Rebuilding images is the decoder\'s job. The denoiser learns to find noise in noised latents.' },
            { text: 'The decoder\'s outputs, to make them sharper', why: 'The denoiser works before the decoder, on latents. It never sees the decoder\'s images.' },
          ]),
          solution: [
            `Each training image is encoded to a latent $${Z}$, which takes the place of the clean image.`,
            `$${Z}$ is noised to a random step, $${ZT} = \\sqrt{\\sym{ab}{\\bar\\alpha}}\\,${Z} + \\sqrt{1 - \\sym{ab}{\\bar\\alpha}}\\,${EPS}$, and the denoiser learns to find $${EPS}$: the same loss, on far fewer numbers.`,
          ],
        };
      return {
        prompt: `${lead} While the denoiser is being trained, what happens to the autoencoder?`,
        answer: shuffled(rng, [
          { text: 'It is frozen, and its encoder turns each training image into a latent', why: null },
          { text: 'It keeps training, on the same loss as the denoiser', why: 'It is trained first and then frozen, so a latent keeps the same meaning while the denoiser learns it.' },
          { text: 'It is thrown away: the denoiser no longer needs it', why: 'Its encoder makes the training latents, and its decoder turns each generated latent into an image.' },
          { text: 'Its decoder turns each noised latent back into pixels for the loss', why: 'The loss compares noise with noise, in the latent. No pixels are needed.' },
        ]),
        solution: ['The autoencoder was trained first and is now frozen.', 'Its encoder makes the latents the denoiser trains on; its decoder is kept for the end of generation.'],
      };
    },
  },
];
