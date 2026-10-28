import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, fmt, type Ink, NOISE, noised, rich, shades, SMILEY, stroke } from '../draw';

const AB = 0.64;
const SHADE = { lo: -2.2, hi: 2.2 };
/** The three pixels the loss scene follows, with their noise and the network's guess. */
const PIX: [number, number][] = [[3, 10], [10, 3], [11, 10]];
const EPS3 = [0.5, -1, 2];
const HAT3 = [0.3, -0.6, 1.5];
const MISS3 = EPS3.map((v, i) => +(v - HAT3[i]!).toFixed(2));
const SQ3 = MISS3.map((v) => +(v * v).toFixed(2));

const EPS = NOISE.map((r) => [...r]);
PIX.forEach(([i, j], k) => (EPS[i]![j] = EPS3[k]!));
const XT = noised(AB, EPS);
const rng = new Rng(9);
/** A good guess: the true noise, slightly off. Pixel (7, 7) is guessed exactly: -0.5. */
const GUESS = EPS.map((r) => r.map((v) => v + 0.25 * rng.randn()));
GUESS[7]![7] = -0.5;
PIX.forEach(([i, j], k) => (GUESS[i]![j] = HAT3[k]!));
/** A poor guess: only partly the true noise. */
const POOR = EPS.map((r) => r.map((v) => 0.2 * v + rng.randn()));
const estimate = (g: number[][]) => XT.map((r, i) => r.map((v, j) => (v - Math.sqrt(1 - AB) * g[i]![j]!) / Math.sqrt(AB)));
const X0HAT = estimate(GUESS);
const X0POOR = estimate(POOR);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** An outline around pixel (i, j) of a picture drawn by `shades` at (cx, cy) with `px` units per pixel. */
function ring(s: Scene, cx: number, cy: number, px: number, i: number, j: number, k: Ink) {
  const p = px * s.u;
  const l = cx - 7 * p + j * p;
  const t = cy - 7 * p + i * p;
  s.rrect(l - 0.3 * s.u, t - 0.3 * s.u, p + 0.6 * s.u, p + 0.6 * s.u, 0.3, { stroke: s.c(k), lw: 0.45 });
}

const lab = { size: 3.2, font: 'mono', weight: 650 } as const;

// ---- the task: the network sees x_t and t, and guesses the noise

const task: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const px = 1.2;
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.6;
    const cy = s.h * 0.9;
    const parts = s.ease('easy', 0.6);
    const hide = 1 - 0.75 * s.ease('hard', 0.6);
    s.alpha(hide, () => {
      shades(s, X(0.2), y1, px, SMILEY, '--ink', SHADE);
      s.text('x₀', X(0.2), y1 + 11.5 * u, { ...lab, color: s.c('orange') });
    });
    s.alpha(parts * hide, () => {
      s.text('+', X(0.335), y1, { size: 6, font: 'mono', color: s.c('--ink-3') });
      shades(s, X(0.47), y1, px, EPS, '--ink', SHADE);
      s.text('ε', X(0.47), y1 + 11.5 * u, { ...lab, color: s.c('slate') });
    });
    s.alpha(s.ease('easy', 0.6, 1.4), () => {
      s.text('→', X(0.6), y1, { size: 6, font: 'mono', color: s.c('--ink-3') });
      shades(s, X(0.75), y1, px, XT, '--ink', SHADE);
      s.text('xₜ', X(0.75), y1 + 11.5 * u, { ...lab, color: s.c('purple') });
    });
    // Going back: which part was the image, and which the noise?
    s.alpha(s.win('hard', 'sees'), () => {
      for (const f of [0.2, 0.47]) s.text('?', X(f), y1, { size: 9, font: 'mono', weight: 700, color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('sees', 0.6, 6.5), () => s.text('hidden from the network', X(0.335), y1 - 11 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('job', 0.6), () => {
      s.arrow(X(0.75), y1 + 14 * u, X(0.5), y2 - 7 * u, s.c('--ink-3'), 0.35, 2);
      block(s, X(0.42), y2, 22, 10, 'network', 'blue', { size: 3.6, on: s.win('job', 'learn') });
    });
    s.alpha(s.ease('sees', 0.6), () => s.text('xₜ and t', X(0.66), (y1 + y2) / 2 + 3 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('asks', 0.6), () => {
      s.arrow(X(0.42) + 14 * u, y2, X(0.73) - 9.5 * u, y2, s.c('--ink-3'), 0.35, 2);
      shades(s, X(0.73), y2, px, GUESS, '--ink', SHADE);
      s.text('ε̂: its guess of ε', X(0.73), y2 + 11.5 * u, { ...lab, color: s.c('red') });
    });
    s.alpha(s.win('easy', 'hard') * s.ease('easy', 0.6, 1.4), () => caption(s, 'one formula, no learning', cy));
    s.alpha(s.win('hard', 'job'), () => caption(s, 'which part is noise?', cy));
    s.alpha(s.win('job', 'sees'), () => caption(s, 'denoising: taking the noise out', cy, 'blue'));
    s.alpha(s.ease('learn', 0.6), () => caption(s, 'not image-like = noise', cy));
  },
};

// ---- the loss: three pixels, their misses, the squares, the mean

const loss: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = s.w / 2;
    const iy = 14 * u;
    const px = 0.8;
    const three = s.ease('three', 0.6);
    // The noise and the guess, with the three pixels marked once they are followed.
    for (const [x, img, name, k] of [[c - 20 * u, EPS, 'ε', 'slate'], [c + 20 * u, GUESS, 'ε̂', 'red']] as const) {
      shades(s, x, iy, px, img, '--ink', SHADE);
      s.text(name, x, iy + 9 * u, { ...lab, color: s.c(k) });
      s.alpha(three, () => PIX.forEach(([i, j]) => ring(s, x, iy, px, i, j, 'gold')));
    }
    s.alpha(s.win('loss', 'free'), () => caption(s, 'how far apart?', 32 * u));
    s.alpha(s.win('free', 'three'), () => caption(s, 'the target: ε, drawn on purpose', 32 * u, 'slate'));

    // Bars: the true noise and the guess at each pixel, standing on a zero line.
    const Z = 50 * u;
    const Y = (v: number) => Z - v * 9 * u;
    const xs = [-1, 0, 1].map((k) => c + k * 32 * u);
    s.alpha(three, () => {
      s.line(xs[0]! - 13 * u, Z, xs[2]! + 13 * u, Z, s.c('--axis'), 0.3);
      s.text('0', xs[0]! - 15 * u, Z, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      xs.forEach((x, i) => {
        const g = s.ease('three', 0.8, 0.5 + 0.3 * i);
        for (const [dx, v, k] of [[-3.5, EPS3[i]!, 'slate'], [3.5, HAT3[i]!, 'red']] as const) {
          const top = Y(v * g);
          s.rrect(x + (dx - 2.5) * u, Math.min(top, Z), 5 * u, Math.abs(top - Z), 0.4, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
          s.alpha(g, () => s.text(fmt(v), x + dx * u, Y(v) + (v >= 0 ? -2.6 : 2.6) * u, { size: 2.9, font: 'mono', weight: 600, color: s.c(k), halo: true }));
        }
      });
    });
    // Each miss: a gold gap from the guess to the truth.
    xs.forEach((x, i) => {
      const a = i === 0 ? s.ease('miss', 0.6, 5) : s.ease('others', 0.6, i === 1 ? 0.8 : 3);
      s.alpha(a, () => {
        const gx = x + 9 * u;
        s.line(gx, Y(HAT3[i]!), gx, Y(EPS3[i]!), s.c('gold'), 0.55);
        for (const v of [HAT3[i]!, EPS3[i]!]) s.line(gx - 0.9 * u, Y(v), gx + 0.9 * u, Y(v), s.c('gold'), 0.35);
        s.text(`miss ${fmt(MISS3[i]!)}`, x, 66 * u, { size: 3, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
      });
    });
    // The squares, side proportional to the miss, so area is the squared miss.
    const base = 89 * u;
    xs.forEach((x, i) => {
      const side = Math.abs(MISS3[i]!) * 28 * u * s.ease('square', 1, 0.4 + 0.4 * i);
      if (side > 0.2 * u) s.rrect(x - side / 2, base - side, side, side, 0.2, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.35 });
      s.alpha(s.ease('squares', 0.5, [1.5, 5, 6.5][i]!), () => s.text(fmt(SQ3[i]!), x, base - Math.abs(MISS3[i]!) * 28 * u - 2.6 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
    });
    const cy = 95 * u;
    const o = { size: 3.5, weight: 650, halo: true } as const;
    s.alpha(s.win('cancel', 'square'), () => caption(s, 'mean of the misses: 0.1, they cancel', cy, 'red', 3.4));
    s.alpha(s.win('mean', 'name'), () => rich(s, [['(0.04 + 0.16 + 0.25) / 3 = ', '--ink-2'], ['0.15', 'gold']], c, cy, o));
    s.alpha(s.win('name', 'simple'), () => rich(s, [['mean squared error: ', '--ink-2'], ['0.15', 'gold']], c, cy, o));
    s.alpha(s.ease('simple', 0.6), () => caption(s, 'L_simple: the plain squared error', cy, '--ink-2', 3.4));
    cite(s, 'Ho, Jain & Abbeel, 2020', s.ease('ho', 0.6));
  },
};

// ---- one training step: a minibatch, each image at its own step

const ink = (g: number[][]) => g.map((r) => r.map((v) => -1.2 + 2.2 * v));
const RING = ink(stroke(14, Array.from({ length: 25 }, (_, k) => [6.5 + 4.6 * Math.cos((k / 24) * 2 * Math.PI), 6.5 + 4.6 * Math.sin((k / 24) * 2 * Math.PI)] as [number, number])));
const CROSS = (() => {
  const a = stroke(14, [[2.5, 2.5], [10.5, 10.5]]);
  const b = stroke(14, [[2.5, 10.5], [10.5, 2.5]]);
  return ink(a.map((r, i) => r.map((v, j) => Math.max(v, b[i]![j]!))));
})();
const HOUSE = ink(stroke(14, [[2.5, 6.5], [6.5, 2.5], [10.5, 6.5], [10.5, 11], [2.5, 11], [2.5, 6.5], [10.5, 6.5]]));
const CLEAN = [SMILEY, RING, CROSS, HOUSE];
/** Each image's step and its signal level on a cosine schedule. */
const TS = [120, 410, 650, 880];
const BATCH = CLEAN.map((img, k) => {
  const ab = Math.cos(((TS[k]! / 1000) * Math.PI) / 2) ** 2;
  const r = new Rng(20 + k);
  const eps = img.map((row) => row.map(() => r.randn()));
  const xt = img.map((row, i) => row.map((v, j) => Math.sqrt(ab) * v + Math.sqrt(1 - ab) * eps[i]![j]!));
  const guess = eps.map((row) => row.map((v) => v + 0.3 * r.randn()));
  return { xt, guess };
});

const batch: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = [0, 1, 2, 3].map((k) => s.w / 2 + (k - 1.5) * 26 * u);
    const px = 0.8;
    const [y1, y2, yn, y3] = [16, 42, 56, 72].map((v) => v * u);
    s.text('a random minibatch of B clean images', s.w / 2, 5 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    xs.forEach((x, k) => {
      s.alpha(s.ease('pick', 0.5, 0.4 + 0.3 * k), () => shades(s, x, y1, px, CLEAN[k]!, '--ink', SHADE));
      s.alpha(s.ease('t', 0.5, 0.8 + 0.5 * k), () => {
        s.text(`t = ${TS[k]}`, x, 28.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple') });
        shades(s, x, y2, px, BATCH[k]!.xt, '--ink', SHADE);
      });
      s.alpha(s.ease('guess', 0.5, 0.6 + 0.3 * k), () => {
        s.arrow(x, 48.5 * u, x, 52.5 * u, s.c('--ink-3'), 0.3, 1.5);
        s.arrow(x, 59.5 * u, x, 65.5 * u, s.c('--ink-3'), 0.3, 1.5);
        shades(s, x, y3, px, BATCH[k]!.guess, '--ink', SHADE);
      });
    });
    s.alpha(s.ease('t', 0.6, 3.5), () => s.text('xₜ', xs[0]! - 9 * u, y2, { ...lab, align: 'right', color: s.c('purple') }));
    s.alpha(s.ease('guess', 0.6), () => {
      const w = xs[3]! - xs[0]! + 14 * u;
      s.rrect(xs[0]! - 7 * u, yn - 3 * u, w, 6 * u, 1.4, { fill: s.tint('blue', 0.12 + 0.12 * s.win('guess', 'step')), stroke: s.tint('blue', 0.7) });
      s.text('one network, every step', s.w / 2, yn, { size: 3, font: 'mono', weight: 650, color: s.c('blue') });
      s.text('ε̂', xs[0]! - 9 * u, y3, { ...lab, align: 'right', color: s.c('red') });
    });
    s.alpha(s.ease('step', 0.6), () => caption(s, 'loss: mean of (ε − ε̂)² over every pixel', 90 * u, 'gold', 3.3));
  },
};

// ---- the image: peel the guessed noise away and undo the shrinking

const image: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{x0}{\hat{x}_0} = \dfrac{\sym{xt}{x_t} - \sqrt{1 - \sym{ab}{\bar\alpha}}\;\sym{epshat}{\hat\epsilon}}{\sqrt{\sym{ab}{\bar\alpha}}}`, x: 0.5, y: 0.13, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const c = s.w / 2;
    const px = 0.9;
    s.show('f', s.ease('hat', 0.6));
    /** One row: x_t, minus the scaled guess, divided by 0.8, gives the estimate. */
    const row = (y: number, g: number[][], est: number[][], a: number, note: string, k: Ink) => {
      s.alpha(a, () => {
        shades(s, c - 34 * u, y, px, XT, '--ink', SHADE);
        s.text('xₜ', c - 34 * u, y + 9.5 * u, { ...lab, color: s.c('purple') });
        s.alpha(s.ease('also', 0.6, 3), () => {
          s.text('−', c - 21 * u, y, { size: 5, font: 'mono', color: s.c('--ink-3') });
          shades(s, c - 8 * u, y, px, g, '--ink', SHADE);
          s.text('0.6 · ε̂', c - 8 * u, y + 9.5 * u, { ...lab, color: s.c('red') });
        });
        s.alpha(s.ease('also', 0.6, 6), () => {
          s.arrow(c + 1.5 * u, y, c + 14 * u, y, s.c('--ink-3'), 0.35, 2);
          s.text('÷ 0.8', c + 7.8 * u, y - 3.5 * u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true });
          shades(s, c + 24 * u, y, px, est, '--ink', SHADE);
          s.text('x̂₀', c + 24 * u, y + 9.5 * u, { ...lab, color: s.c('orange') });
        });
        s.alpha(s.ease('worse', 0.6, 0.4), () => s.text(note, c + 33 * u, y, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c(k) }));
      });
    };
    const ya = 37 * u;
    row(ya, GUESS, X0HAT, 1, 'clean', 'green');
    row(62 * u, POOR, X0POOR, s.win('worse', 'pixel') * s.ease('worse', 0.6), 'static left', 'red');
    s.alpha(s.win('undo', 'hat'), () => {
      s.text('noise was scaled by √(1 − ᾱ)', c, 52 * u, { size: 3, font: 'mono', color: s.c('red') });
      s.text('image was shrunk by √ᾱ', c, 58 * u, { size: 3, font: 'mono', color: s.c('orange') });
    });
    // One pixel through the same steps.
    s.alpha(s.ease('pixel', 0.6), () => {
      for (const [x, k] of [[c - 34 * u, 'purple'], [c - 8 * u, 'red'], [c + 24 * u, 'orange']] as const) ring(s, x, ya, px, 7, 7, k);
    });
    const o = { size: 3.5, weight: 650, halo: true } as const;
    s.alpha(s.ease('pixel', 0.6), () => rich(s, [['xₜ = 0.5', 'purple'], ['   ᾱ = 0.64', '--ink-2'], ['   ε̂ = −0.5', 'red']], c, 58 * u, o));
    s.alpha(s.ease('scaled', 0.6), () => rich(s, [['0.6 × (−0.5) = ', '--ink-2'], ['−0.3', 'red']], c, 68 * u, o));
    s.alpha(s.ease('sub', 0.6), () => rich(s, [['0.5 − (−0.3) = ', '--ink-2'], ['0.8', 'purple']], c, 78 * u, o));
    s.alpha(s.ease('div', 0.6), () => rich(s, [['0.8 / 0.8 = ', '--ink-2'], ['1.0', 'orange'], ['  the clean pixel', '--ink-3']], c, 88 * u, o));
  },
};

export const scenes: Record<string, SceneDef> = { task, loss, batch, image };
