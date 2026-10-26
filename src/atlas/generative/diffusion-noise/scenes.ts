import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { caption, Frame, NOISE, noised, rich, shades, SMILEY } from '../draw';

const N = 14;
const X0 = SMILEY;
const EPS = NOISE;
const PI = 7;
const PJ = 7;
const blend = (ab: number) => noised(ab);
const XT64 = blend(0.64);

/** A box around pixel (PI, PJ) of an image drawn at `g`. */
function mark(s: Scene, g: { l: number; t: number }, px: number, k: 'red' | 'gold'): void {
  const p = px * s.u;
  s.rrect(g.l + PJ * p - 0.3 * s.u, g.t + PI * p - 0.3 * s.u, p + 0.6 * s.u, p + 0.6 * s.u, 0.3, { stroke: s.c(k), lw: 0.45 });
}

const blendScene: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{xt}{x_t} = \sqrt{\sym{ab}{\bar\alpha}}\,\sym{x0}{x_0} + \sqrt{1 - \sym{ab}{\bar\alpha}}\,\sym{eps}{\epsilon}`, x: 0.5, y: 0.64, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const px = 1.55;
    const y = s.h * 0.3;
    const xs = [0.2, 0.5, 0.8].map((f) => s.w * f);
    const lab = { size: 3.4, font: 'mono', weight: 650 } as const;
    const g0 = shades(s, xs[0]!, y, px, X0, '--ink', { lo: -2.2, hi: 2.2 });
    s.text('x₀', xs[0]!, y + 14.5 * u, { ...lab, color: s.c('orange') });
    s.alpha(s.ease('eps', 0.6), () => {
      shades(s, xs[1]!, y, px, EPS, '--ink', { lo: -2.2, hi: 2.2 });
      s.text('ε', xs[1]!, y + 14.5 * u, { ...lab, color: s.c('slate') });
    });
    const mx = s.ease('mix', 0.8);
    s.alpha(mx, () => {
      shades(s, xs[2]!, y, px, XT64, '--ink', { lo: -2.2, hi: 2.2 });
      s.text('xₜ, ᾱ = 0.64', xs[2]!, y + 14.5 * u, { ...lab, color: s.c('purple') });
      s.text('+', (xs[0]! + xs[1]!) / 2, y, { size: 6, font: 'mono', color: s.c('--ink-3') });
      s.text('→', (xs[1]! + xs[2]!) / 2, y, { size: 6, font: 'mono', color: s.c('--ink-3') });
    });
    s.show('f', s.ease('mix', 0.6, 0.6));
    const pa = s.ease('pixel', 0.6);
    s.alpha(pa, () => {
      mark(s, g0, px, 'red');
      mark(s, { l: xs[1]! - (N * px * u) / 2, t: g0.t }, px, 'red');
      mark(s, { l: xs[2]! - (N * px * u) / 2, t: g0.t }, px, 'red');
      caption(s, 'one pixel: x₀ = 1, ε = −0.5', s.h * 0.8, '--ink-2', 3.4);
      rich(s, [['0.8 · 1 + 0.6 · (−0.5) = ', '--ink-2'], ['0.5', 'purple']], s.w / 2, s.h * 0.88, { size: 3.6, weight: 650, halo: true });
    });
  },
};

const AB = 0.64;

/** 0 -> 1 as beat `id` passes fraction `f` of its spoken length. */
const after = (s: Scene, id: string, f: number) => Math.min(1, Math.max(0, (s.prog(id) - f) * 10));

const variance: SceneDef = {
  draw(s) {
    const u = s.u;
    const L = Math.min(84, s.w / u - 24) * u;
    const l = s.w / 2 - L / 2;
    const sc = s.ease('scale', 1.2);
    const sm = s.ease('sum', 1.2);
    const sp = s.ease('spread', 1.2);
    const sh = s.ease('share', 0.6) * (1 - s.ease('spread', 0.5));
    const o = { size: 3.4, font: 'mono', weight: 650, align: 'left' } as const;
    const bar = (x: number, y: number, w: number, k: 'orange' | 'slate', a = 1) =>
      s.alpha(a, () => s.rrect(x, y - 3 * u, Math.max(w, 0.5 * u), 6 * u, 0.8, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 }));
    // The image and noise parts, shrinking to their shares, then sliding together into one bar.
    // For the spread beat the clean variance doubles and the scale shrinks so the bar still fits.
    const vx = lerp(1, 2, sp);
    const k = L / lerp(1, AB * 2 + 1 - AB, sp);
    const wI = k * lerp(1, AB, sc) * vx;
    const wN = k * lerp(1, 1 - AB, sc);
    const yI = lerp(s.h * 0.2, s.h * 0.62, sm);
    const yN = lerp(s.h * 0.4, s.h * 0.62, sm);
    const xN = lerp(l, l + wI, sm);
    s.alpha(1 - sm, () => {
      s.text(sc > 0.5 ? 'image part: ᾱ = 0.64' : 'x₀: variance 1', l, s.h * 0.2 - 6 * u, { ...o, color: s.c('orange') });
      s.text(sc > 0.5 ? 'noise part: 1 − ᾱ = 0.36' : 'ε: variance 1', l, s.h * 0.4 - 6 * u, { ...o, color: s.c('slate') });
    });
    bar(l, yI, wI, 'orange');
    bar(xN, yN, wN, 'slate');
    // Two pixels on a number line, scaled by 0.8.
    s.alpha(s.win('pair', 'sum'), () => {
      const yl = s.h * 0.74;
      const X = (v: number) => s.w / 2 + (v * L) / 2 / 1.25;
      const p = lerp(1, 0.8, s.ease('rule', 1.2));
      s.line(X(-1.25), yl, X(1.25), yl, s.c('--axis'), 0.35);
      for (const v of [-1, 0, 1]) {
        s.line(X(v), yl - 1 * u, X(v), yl + 1 * u, s.c('--axis'), 0.3);
        // The ±1 ticks are labelled only once the dots have left them.
        s.alpha(v ? s.ease('rule', 0.6, 0.8) : 1, () => s.text(v < 0 ? '−1' : String(v), X(v), yl + 4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      }
      const lab = p > 0.9 ? '1' : '0.8';
      for (const sg of [-1, 1]) {
        s.circle(X(sg * p), yl, 1.3 * u, { fill: s.c('orange') });
        s.text(sg < 0 ? `−${lab}` : lab, X(sg * p), yl - 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      }
      const r = s.ease('rule', 0.6, 0.6);
      const v = { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
      s.alpha(1 - r, () => s.text('variance (1² + 1²) / 2 = 1', s.w / 2, s.h * 0.86, v));
      s.alpha(r, () => s.text('variance (0.8² + 0.8²) / 2 = 0.64', s.w / 2, s.h * 0.86, v));
    });
    s.alpha(after(s, 'rule', 0.62) * (1 - sm), () => caption(s, 'scale by c: variance × c²', s.h * 0.55, '--ink-2', 3.4));
    s.alpha(sm * (1 - sp), () => s.text('xₜ: variance 0.64 + 0.36 = 1', l, s.h * 0.62 - 6.5 * u, { ...o, color: s.c('purple') }));
    s.alpha(sm, () => s.line(l + wI + wN, s.h * 0.62 - 4 * u, l + wI + wN, s.h * 0.62 + 4 * u, s.c('--ink-3'), 0.3, [0.8, 0.6]));
    s.alpha(sh, () => {
      s.text('64% image', l + (L * AB) / 2, s.h * 0.62 + 7 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange') });
      s.text('36% noise', l + L * AB + (L * (1 - AB)) / 2, s.h * 0.62 + 7 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('slate') });
      caption(s, 'ᾱ: the share of the variance still image', s.h * 0.86, 'purple', 3.4);
    });
    s.alpha(sp, () => {
      s.text('x₀: variance 2', l, s.h * 0.2, { ...o, color: s.c('orange') });
      s.text('image part: 0.64 × 2 = 1.28', l, s.h * 0.29, { ...o, color: s.c('orange') });
      s.text('noise part: 0.36', l, s.h * 0.38, { ...o, color: s.c('slate') });
      s.text('xₜ: variance 1.28 + 0.36 = 1.64', l, s.h * 0.62 - 6.5 * u, { ...o, color: s.c('purple') });
    });
  },
};

const cosSched = (t: number) => Math.cos(((t / 1000) * Math.PI) / 2) ** 2;
const fast = (t: number) => cosSched(t) ** 3;
const SHOW: [number, number][] = [[1, 0], [0.8, 295], [0.5, 500], [0.2, 705], [0.02, 910]];
const IMGS = SHOW.map(([ab]) => blend(ab));

const schedule: SceneDef = {
  draw(s) {
    const u = s.u;
    const fl = s.ease('falls', 1.5);
    const y = s.h * 0.16;
    SHOW.forEach(([ab], k) => {
      const x = s.w / 2 + (k - 2) * 21 * u;
      s.alpha(k === 0 ? 1 : s.ease('falls', 0.4, 0.4 + k * 0.5), () => {
        shades(s, x, y, 1.05, IMGS[k]!, '--ink', { lo: -2.2, hi: 2.2 });
        s.text(`ᾱ = ${ab}`, x, y + 10.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple') });
      });
    });
    const F = new Frame(s, s.w / 2 - 40 * u, s.h * 0.42, s.w / 2 + 44 * u, s.h * 0.82, [0, 1000], [0, 1]);
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
    for (const t of [0, 500, 1000]) s.text(String(t), F.X(t), F.b + 3.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    for (const v of [0, 0.5, 1]) s.text(String(v), F.l - 2 * u, F.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('t', F.r + 2.5 * u, F.b, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
    s.text('ᾱ', F.l, F.t - 5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
    s.alpha(fl, () => {
      F.fn(cosSched, 'purple', { to: 1000 * fl, width: 0.6 });
      SHOW.forEach(([ab, t], k) => s.alpha(s.ease('falls', 0.4, 0.4 + k * 0.5), () => F.dot(t, ab, 'purple', 1.1)));
    });
    const sc = s.ease('sched', 0.8);
    s.alpha(sc, () => {
      F.fn(fast, 'red', { dash: [1.2, 0.9], width: 0.5 });
      s.text('faster', F.X(330), F.Y(fast(330)) - 3 * u, { size: 3, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      s.text('0.5 at t = 500', F.X(520) + 2 * u, F.Y(0.5) - 3 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
    });
    s.alpha(s.ease('jump', 0.6), () => caption(s, 'any step, straight from x₀: one formula', s.h * 0.93, '--ink-2', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { blend: blendScene, variance, schedule };
