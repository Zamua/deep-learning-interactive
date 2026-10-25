import type { SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, rowLabel } from '../../draw';
import { block, caption, fmt, NOISE, noised, rich, shades, SMILEY } from '../draw';

const AB = 0.64;
const XT = noised(AB);
const rng = new Rng(9);
/** The network's guess: the true noise, slightly off. */
const GUESS = NOISE.map((r) => r.map((v) => v + 0.25 * rng.randn()));
GUESS[7]![7] = -0.5;
const X0HAT = XT.map((r, i) => r.map((v, j) => (v - Math.sqrt(1 - AB) * GUESS[i]![j]!) / Math.sqrt(AB)));
const SHADE = { lo: -2.2, hi: 2.2 };

const task: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const px = 1.2;
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.6;
    const lab = { size: 3.2, font: 'mono', weight: 650 } as const;
    const hide = 1 - 0.75 * s.ease('sees', 0.6);
    s.alpha(hide, () => {
      shades(s, X(0.2), y1, px, SMILEY, '--ink', SHADE);
      s.text('x₀', X(0.2), y1 + 11.5 * u, { ...lab, color: s.c('orange') });
      s.text('+', X(0.335), y1, { size: 6, font: 'mono', color: s.c('--ink-3') });
      shades(s, X(0.47), y1, px, NOISE, '--ink', SHADE);
      s.text('ε', X(0.47), y1 + 11.5 * u, { ...lab, color: s.c('slate') });
    });
    s.text('→', X(0.6), y1, { size: 6, font: 'mono', color: s.c('--ink-3') });
    shades(s, X(0.75), y1, px, XT, '--ink', SHADE);
    s.text('xₜ', X(0.75), y1 + 11.5 * u, { ...lab, color: s.c('purple') });
    s.alpha(s.ease('sees', 0.6, 1), () => s.text('hidden from the network', X(0.335), y1 - 11 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    const se = s.ease('sees', 0.6);
    s.alpha(se, () => {
      s.arrow(X(0.75), y1 + 14 * u, X(0.5), y2 - 7 * u, s.c('--ink-3'), 0.35, 2);
      s.text('xₜ and t', X(0.66), (y1 + y2) / 2 + 3 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      block(s, X(0.42), y2, 22, 10, 'network', 'blue', { size: 3.6, on: s.win('sees', 'why') });
    });
    s.alpha(s.ease('asks', 0.6), () => {
      s.arrow(X(0.42) + 14 * u, y2, X(0.73) - 9.5 * u, y2, s.c('--ink-3'), 0.35, 2);
      shades(s, X(0.73), y2, px, GUESS, '--ink', SHADE);
      s.text('ε̂: its guess of ε', X(0.73), y2 + 11.5 * u, { ...lab, color: s.c('red') });
    });
    s.alpha(s.ease('why', 0.6), () => caption(s, 'not image-like = noise', s.h * 0.9, '--ink-2', 3.6));
  },
};

const EPS4 = [0.5, -1, 2, 0];
const HAT4 = [0.3, -0.6, 1.5, 0.2];
const D4 = EPS4.map((v, i) => +(v - HAT4[i]!).toFixed(2));
const SQ4 = D4.map((v) => +(v * v).toFixed(2));
/** A minibatch: each image at its own step. */
const BATCH: [number, number][] = [[0.9, 120], [0.55, 410], [0.25, 650], [0.05, 880]];
const BIMGS = BATCH.map(([ab]) => noised(ab));

const loss: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 15);
    const lx = xs[0]! - 10.5 * u;
    const ys = [0.12, 0.26, 0.42, 0.56].map((f) => s.h * f);
    const ba = s.ease('batch', 0.6);
    const dim = 1 - 0.6 * ba;
    s.alpha(dim, () => {
      rowLabel(s, 'ε', lx, ys[0]!, 'slate', 3.8);
      cells(s, xs, ys[0]!, EPS4.map((v) => fmt(v)), 'slate', { w: 12, h: 7.5 });
      rowLabel(s, 'ε̂', lx, ys[1]!, 'red', 3.8);
      cells(s, xs, ys[1]!, HAT4.map((v) => fmt(v)), 'red', { w: 12, h: 7.5 });
      s.alpha(s.ease('square', 0.6), () => {
        rowLabel(s, 'ε − ε̂', lx, ys[2]!, '--ink-2', 3.4);
        cells(s, xs, ys[2]!, D4.map((v) => fmt(v)), 'slate', { w: 12, h: 7.5 });
      });
      s.alpha(s.ease('square', 0.6, 2.5), () => {
        rowLabel(s, 'squared', lx, ys[3]!, 'gold', 3.4);
        cells(s, xs, ys[3]!, SQ4.map((v) => fmt(v)), 'gold', { w: 12, h: 7.5, on: [1, 1, 1, 1] });
      });
      s.alpha(s.ease('square', 0.6, 5) * (1 - ba), () => rich(s, [['mean = 0.49 / 4 ≈ ', '--ink-2'], ['0.12', 'gold']], s.w / 2, s.h * 0.68, { size: 3.8, weight: 650, halo: true }));
    });
    s.alpha(ba, () => {
      BATCH.forEach(([, t], k) => {
        const x = s.w / 2 + (k - 1.5) * 20 * u;
        shades(s, x, s.h * 0.8, 0.8, BIMGS[k]!, '--ink', SHADE);
        s.text(`t = ${t}`, x, s.h * 0.8 + 8.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple') });
      });
      s.text('a minibatch, each image at its own random step', s.w / 2, s.h * 0.69, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true });
    });
  },
};

const image: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{x0}{\hat{x}_0} = \dfrac{\sym{xt}{x_t} - \sqrt{1 - \sym{ab}{\bar\alpha}}\;\sym{epshat}{\hat\epsilon}}{\sqrt{\sym{ab}{\bar\alpha}}}`, x: 0.5, y: 0.14, size: 5 },
  },
  draw(s) {
    const u = s.u;
    s.show('f', s.ease('solve', 0.6));
    const o = { size: 3.6, weight: 650, halo: true } as const;
    s.alpha(s.ease('pixel', 0.6), () => rich(s, [['xₜ = 0.5', 'purple'], ['   ᾱ = 0.64', '--ink-2'], ['   ε̂ = −0.5', 'red']], s.w / 2, s.h * 0.32, o));
    s.alpha(s.ease('sub', 0.6), () => rich(s, [['0.5 − 0.6 · (−0.5) = ', '--ink-2'], ['0.8', 'purple']], s.w / 2, s.h * 0.42, o));
    s.alpha(s.ease('div', 0.6), () => rich(s, [['0.8 / 0.8 = ', '--ink-2'], ['1.0', 'orange'], ['  the clean pixel', '--ink-3']], s.w / 2, s.h * 0.52, o));
    const y = s.h * 0.75;
    const px = 1.1;
    s.alpha(s.ease('solve', 0.6, 1), () => {
      shades(s, s.w / 2 - 22 * u, y, px, XT, '--ink', SHADE);
      s.text('xₜ', s.w / 2 - 22 * u, y + 10.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple') });
      s.arrow(s.w / 2 - 12 * u, y, s.w / 2 + 12 * u, y, s.c('--ink-3'), 0.4, 2);
      shades(s, s.w / 2 + 22 * u, y, px, X0HAT, '--ink', SHADE);
      s.text('x̂₀', s.w / 2 + 22 * u, y + 10.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('orange') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { task, loss, image };
