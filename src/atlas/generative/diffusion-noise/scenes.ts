import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { caption, Frame, NOISE, noised, rich, shades, SMILEY } from '../draw';

const SHADE = { lo: -2.2, hi: 2.2 };
const N = 14;
const PI = 7;
const PJ = 7;

/** 0 -> 1 once beat `id` is fraction `f` of the way through its spoken length. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Fades in at beat `from`, just after whatever it replaces has faded out at the same spot. */
const swap = (s: Scene, from: string, until?: string) => s.ease(from, 0.5, 0.45) * (until ? 1 - s.ease(until, 0.4) : 1);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A box around pixel (PI, PJ) of a 14 by 14 image drawn at `g`, `px` stage units a pixel. */
function mark(s: Scene, g: { l: number; t: number }, px: number) {
  const p = px * s.u;
  s.rrect(g.l + PJ * p - 0.3 * s.u, g.t + PI * p - 0.3 * s.u, p + 0.6 * s.u, p + 0.6 * s.u, 0.3, { stroke: s.c('red'), lw: 0.45 });
}

/** The strip from image to noise: x centers and pixel size, fitted to the stage width. */
function strip(s: Scene) {
  const gap = Math.min(22, (s.w / s.u - 22) / 4);
  return { xs: [0, 1, 2, 3, 4].map((k) => s.w / 2 + (k - 2) * gap * s.u), gap, px: gap / 20.5 };
}

const STRIP = [1, 0.8, 0.5, 0.2, 0];
const SIMGS = STRIP.map((ab) => noised(ab));

// Ink particles: a tight drop that random-walks until it fills the glass evenly.
const ink = new Rng(11);
const DROP = Array.from({ length: 170 }, () => {
  const r = 0.07 * Math.sqrt(ink.next());
  const a = 2 * Math.PI * ink.next();
  return { x: 0.5 + r * Math.cos(a), y: 0.3 + r * Math.sin(a), gx: ink.randn(), gy: ink.randn() };
});
/** Reflects a coordinate back into [0, 1], as a wall would. */
const fold = (v: number) => {
  const m = ((v % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
};

const bell = (x: number) => Math.exp(-(x * x) / 2);

const path: SceneDef = {
  draw(s) {
    const u = s.u;
    const { xs, px } = strip(s);
    const ys = s.h * 0.17;
    // The two ends start large, then shrink into the ends of the strip.
    const mv = s.ease('path', 1.2);
    const big = 1.7;
    const ex = [s.w / 2 - (s.tall ? 25 : 32) * u, s.w / 2 + (s.tall ? 25 : 32) * u];
    const ey = s.h * 0.4;
    [0, 4].forEach((k, i) => {
      const p = lerp(big, px, mv);
      const x = lerp(ex[i]!, xs[k]!, mv);
      const y = lerp(ey, ys, mv);
      shades(s, x, y, p, SIMGS[k]!, '--ink', SHADE);
      s.alpha(1 - mv, () => s.text(i ? 'noise' : 'an image', x, y + (N * p) / 2 * u + 4.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') }));
    });
    for (let k = 1; k <= 3; k++) {
      s.alpha(s.ease('path', 0.5, 0.9 + 0.6 * k), () => shades(s, xs[k]!, ys, px, SIMGS[k]!, '--ink', SHADE));
    }
    const half = (N * px) / 2;
    for (let k = 1; k <= 4; k++) {
      s.alpha(s.ease('path', 0.5, 0.9 + 0.6 * k), () => {
        const a = xs[k - 1]! + (half + 0.8) * u;
        const b = xs[k]! - (half + 0.8) * u;
        if (b > a + 1.5 * u) s.arrow(a, ys, b, ys, s.c('--ink-3'), 0.3, 1.4);
      });
    }
    const lab = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(s.ease('x0', 0.6), () => s.text('x₀', xs[0]!, ys + (half + 3.5) * u, { ...lab, color: s.c('orange') }));
    s.alpha(s.ease('eps', 0.6), () => s.text('ε', xs[4]!, ys + (half + 3.5) * u, { ...lab, color: s.c('slate') }));
    s.alpha(swap(s, 'path', 'ink'), () => caption(s, 'a little more noise at every step', s.h * 0.9, '--ink-2', 3.4));

    // A drop of ink spreading through a glass of water.
    s.alpha(s.win('ink', 'x0'), () => {
      const bw = Math.min(70 * u, s.w - 24 * u);
      const bh = s.h * 0.4;
      const bl = s.w / 2 - bw / 2;
      const bt = s.h * 0.36;
      s.rrect(bl, bt, bw, bh, 1.5, { fill: s.tint('blue', 0.07), stroke: s.tint('blue', 0.45), lw: 0.3 });
      const d = 1.2 * Math.max(0, (s.prog('ink') - 0.3) / 0.7);
      for (const p of DROP) {
        const x = fold(p.x + d * p.gx);
        const y = fold(p.y + d * p.gy);
        s.circle(bl + (0.03 + 0.94 * x) * bw, bt + (0.03 + 0.94 * y) * bh, 0.55 * u, { fill: s.tint('--ink', 0.75) });
      }
    });
    s.alpha(swap(s, 'ink', 'sohl'), () => caption(s, 'ink diffuses until it is evenly mixed', s.h * 0.9, '--ink-2', 3.4));
    s.alpha(swap(s, 'sohl', 'x0'), () => caption(s, 'destroy structure slowly, step by step', s.h * 0.9, '--ink-2', 3.4));
    cite(s, s.tall ? 'Sohl-Dickstein et al., 2015' : 'Sohl-Dickstein, Weiss, Maheswaranathan & Ganguli, 2015', s.win('sohl', 'x0'));

    // The two ends, named, large below the strip.
    const lp = s.tall ? 1.35 : 1.45;
    const lh = (N * lp) / 2;
    const ly = s.h * 0.5;
    const lx = [s.w / 2 - (s.tall ? 22 : 28) * u, s.w / 2 + (s.tall ? 22 : 28) * u];
    s.alpha(s.ease('x0', 0.6), () => {
      const g = shades(s, lx[0]!, ly, lp, SIMGS[0]!, '--ink', SHADE);
      s.alpha(after(s, 'x0', 0.7), () => {
        mark(s, g, lp);
        s.text('a pixel: 1', lx[0]!, ly + (lh + 9) * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      });
      s.text('x₀: step 0', lx[0]!, ly + (lh + 4) * u, { ...lab, color: s.c('orange') });
    });
    s.alpha(s.ease('eps', 0.6), () => {
      shades(s, lx[1]!, ly, lp, SIMGS[4]!, '--ink', SHADE);
      s.text('ε: one draw per pixel', lx[1]!, ly + (lh + 4) * u, { ...lab, size: 3.2, color: s.c('slate') });
    });
    s.alpha(s.ease('eps', 0.6, 3), () => {
      const bw = s.tall ? 30 : 36;
      const F = new Frame(s, lx[1]! - (bw / 2) * u, ly + (lh + 9) * u, lx[1]! + (bw / 2) * u, ly + (lh + 19) * u, [-3, 3], [0, 1]);
      F.fn(bell, 'slate', { fill: 0.15, width: 0.45 });
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.3);
      for (const v of [-2, 0, 2]) s.text(v < 0 ? '−2' : String(v), F.X(v), F.b + 3 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      caption(s, 'standard normal: mean 0, variance 1', s.h * 0.94, 'slate', 3.2);
    });
  },
};

const blendScene: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{xt}{x_t} = \sqrt{\sym{ab}{\bar\alpha}}\,\sym{x0}{x_0} + \sqrt{1 - \sym{ab}{\bar\alpha}}\,\sym{eps}{\epsilon}`, x: 0.5, y: 0.7, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    const px = s.tall ? 1.45 : 1.55;
    const y = s.h * 0.24;
    const half = (N * px) / 2;
    const xs = [0.2, 0.5, 0.8].map((f) => s.w * f);
    // alpha bar: 0.64, then near 1, a half and near 0 as the beat names each, then back to 0.64.
    const p = s.prog('ab');
    const sweep = p < 0.59 ? lerp(0.64, 0.95, smooth((p - 0.39) / 0.05)) : p < 0.77 ? lerp(0.95, 0.5, smooth((p - 0.6) / 0.06)) : lerp(0.5, 0.03, smooth((p - 0.78) / 0.06));
    const ab = lerp(sweep, 0.64, s.ease('mix', 1.2));
    const lab = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
    const g0 = shades(s, xs[0]!, y, px, SMILEY, '--ink', SHADE);
    s.text('x₀', xs[0]!, y + (half + 4) * u, { ...lab, color: s.c('orange') });
    shades(s, xs[1]!, y, px, NOISE, '--ink', SHADE);
    s.text('ε', xs[1]!, y + (half + 4) * u, { ...lab, color: s.c('slate') });
    const xt = noised(ab);
    shades(s, xs[2]!, y, px, xt, '--ink', SHADE);
    s.text('xₜ', xs[2]!, y + (half + 4) * u, { ...lab, color: s.c('purple') });
    s.text('+', (xs[0]! + xs[1]!) / 2, y, { size: 6, font: 'mono', color: s.c('--ink-3') });
    s.text('→', (xs[1]! + xs[2]!) / 2, y, { size: 6, font: 'mono', color: s.c('--ink-3') });

    // The alpha-bar slider, 0 on the left and 1 on the right.
    s.alpha(s.ease('ab', 0.6), () => {
      const L = Math.min(70, s.w / u - 30) * u;
      const l = s.w / 2 - L / 2;
      const yl = s.h * 0.5;
      s.line(l, yl, l + L, yl, s.c('--axis'), 0.5);
      s.text('0: all noise', l, yl + 4.5 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('1: all image', l + L, yl + 4.5 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.circle(l + ab * L, yl, 1.5 * u, { fill: s.c('teal'), stroke: s.c('--card'), lw: 0.4 });
      s.text(`ᾱ = ${ab.toFixed(2)}`, l + ab * L, yl - 4.5 * u, { ...lab, color: s.c('teal') });
    });
    s.show('f', s.ease('mix', 0.6, 0.4));
    s.alpha(s.ease('roots', 0.6), () => {
      rich(s, [['√0.64 = ', '--ink-2'], ['0.8', 'orange'], ['    √0.36 = ', '--ink-2'], ['0.6', 'slate']], s.w / 2, s.h * 0.8, { size: 3.4, weight: 650, halo: true });
    });
    s.alpha(s.ease('pixel', 0.6), () => {
      mark(s, g0, px);
      mark(s, { l: xs[1]! - half * u, t: g0.t }, px);
      mark(s, { l: xs[2]! - half * u, t: g0.t }, px);
      rich(s, [['0.8 · 1 + 0.6 · (−0.5) = ', '--ink-2'], ['0.5', 'purple']], s.w / 2, s.h * 0.89, { size: 3.6, weight: 650, halo: true });
    });
  },
};

const AB = 0.64;
const LEVELS = [1, 0.75, 0.5, 0.25, 0];
const ROOTED = LEVELS.map((ab) => noised(ab));
const UNROOTED = LEVELS.map((ab) => SMILEY.map((r, i) => r.map((v, j) => ab * v + (1 - ab) * NOISE[i]![j]!)));
/** A tighter shade range, so a drop in spread shows as a grayer picture. */
const FADE = { lo: -1.6, hi: 1.6 };

const variance: SceneDef = {
  draw(s) {
    const u = s.u;
    const L = Math.min(84, s.w / u - 24) * u;
    const l = s.w / 2 - L / 2;
    const sc = s.ease('parts', 1.2);
    const sm = s.ease('sum', 1.2);
    const sp = s.ease('spread', 1.2);
    const tot = s.ease('total', 0.8);
    const sh = s.ease('share', 0.6) * (1 - s.ease('without', 0.4));
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
    s.alpha(lerp(1, tot, sp), () => bar(xN, yN, wN, 'slate'));
    // Two pixels on a number line, scaled by 0.8.
    s.alpha(s.win('pair', 'parts'), () => {
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
    s.alpha(after(s, 'rule', 0.62) * (1 - sc), () => caption(s, 'scale by c: variance × c²', s.h * 0.55, '--ink-2', 3.4));
    s.alpha(sm * (1 - sp), () => s.text('xₜ: variance 0.64 + 0.36 = 1', l, s.h * 0.62 - 6.5 * u, { ...o, color: s.c('purple') }));
    s.alpha(sm * (1 - sp), () => s.line(l + wI + wN, s.h * 0.62 - 4 * u, l + wI + wN, s.h * 0.62 + 4 * u, s.c('--ink-3'), 0.3, [0.8, 0.6]));
    s.alpha(sh, () => {
      s.text('64% image', l + (L * AB) / 2, s.h * 0.62 + 7 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange') });
      s.text('36% noise', l + L * AB + (L * (1 - AB)) / 2, s.h * 0.62 + 7 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('slate') });
      caption(s, 'ᾱ: the share of the variance still image', s.h * 0.86, 'teal', 3.4);
    });
    // The path mixed by the roots, against mixed by the shares themselves: the middle fades.
    s.alpha(s.win('without', 'spread'), () => {
      const { xs, px } = strip(s);
      const half = (N * px) / 2;
      const rows: [number, number[][][], string, 'purple' | 'red'][] = [
        [s.h * 0.17, ROOTED, 'with the roots: variance 1 throughout', 'purple'],
        [s.h * 0.42, UNROOTED, 'without: the middle fades', 'red'],
      ];
      for (const [y, imgs, text, k] of rows) {
        imgs.forEach((g, i) => shades(s, xs[i]!, y, px, g, '--ink', FADE));
        s.text(text, xs[0]! - half * u, y - (half + 3) * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true });
      }
      s.alpha(s.ease('without', 0.5, 0.45), () => caption(s, 'no roots, at a half: 0.25 + 0.25 = 0.5', s.h * 0.86, 'red', 3.3));
    });
    s.alpha(sp, () => {
      s.text('x₀: variance 2', l, s.h * 0.2, { ...o, color: s.c('orange') });
      s.text('image part: 0.64 × 2 = 1.28', l, s.h * 0.29, { ...o, color: s.c('orange') });
    });
    s.alpha(tot, () => {
      s.text('noise part: 0.36', l, s.h * 0.38, { ...o, color: s.c('slate') });
      s.text('xₜ: variance 1.28 + 0.36 = 1.64', l, s.h * 0.62 - 6.5 * u, { ...o, color: s.c('purple') });
    });
  },
};

const cosSched = (t: number) => Math.cos(((t / 1000) * Math.PI) / 2) ** 2;
/** The 2020 schedule: noise variances rising linearly from 0.0001 to 0.02 over 1,000 steps. */
const LINEAR = (() => {
  const out = [1];
  for (let t = 1; t <= 1000; t++) out.push(out[t - 1]! * (1 - (1e-4 + ((0.02 - 1e-4) * (t - 1)) / 999)));
  return out;
})();
const linear = (t: number) => LINEAR[Math.max(0, Math.min(1000, Math.round(t)))]!;
const SHOW: [number, number][] = [[1, 0], [0.8, 295], [0.5, 500], [0.2, 705], [0.02, 910]];
const IMGS = SHOW.map(([ab]) => noised(ab));

const schedule: SceneDef = {
  draw(s) {
    const u = s.u;
    const fl = s.ease('falls', 1.5);
    const { xs, px } = strip(s);
    const y = s.h * 0.16;
    SHOW.forEach(([ab], k) => {
      s.alpha(k === 0 ? 1 : s.ease('falls', 0.4, 0.4 + k * 0.5), () => {
        shades(s, xs[k]!, y, px, IMGS[k]!, '--ink', SHADE);
        s.text(`ᾱ = ${ab}`, xs[k]!, y + ((N * px) / 2 + 3.5) * u, { size: 3, font: 'mono', weight: 650, color: s.c('teal') });
      });
    });
    const F = new Frame(s, s.w / 2 - 38 * u, s.h * 0.42, s.w / 2 + 42 * u, s.h * 0.82, [0, 1000], [0, 1]);
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
    for (const t of [0, 500, 1000]) s.text(String(t), F.X(t), F.b + 3.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    for (const v of [0, 0.5, 1]) s.text(String(v), F.l - 2 * u, F.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('t', F.r + 2.5 * u, F.b, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
    s.text('ᾱ', F.l, F.t - 5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('teal') });
    s.alpha(fl, () => {
      F.fn(cosSched, 'teal', { to: 1000 * fl, width: 0.6 });
      SHOW.forEach(([ab, t], k) => s.alpha(s.ease('falls', 0.4, 0.4 + k * 0.5), () => F.dot(t, ab, 'teal', 1.1)));
    });
    const lab = { size: 3, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(s.win('ho', 'jump'), () => s.line(F.X(500), F.b, F.X(500), F.Y(0.5), s.c('--ink-3'), 0.25, [0.8, 0.6]));
    s.alpha(s.ease('ho', 0.8), () => {
      F.fn(linear, 'red', { dash: [1.2, 0.9], width: 0.5, to: 1000 * s.ease('ho', 1.5) });
      s.alpha(after(s, 'ho', 0.6) * (1 - s.ease('cosine', 0.5)), () => {
        F.dot(500, linear(500), 'red', 1.1);
        s.text('0.08', F.X(500) + 2.5 * u, F.Y(linear(500)) - 2.5 * u, { ...lab, align: 'left', color: s.c('red') });
      });
    });
    s.alpha(s.ease('cosine', 0.6, 1), () => {
      s.rrect(F.X(750), F.Y(0.07), F.X(1000) - F.X(750), F.b - F.Y(0.07), 0.4, { fill: s.tint('red', 0.14) });
      s.text('almost pure noise', F.X(1000), F.Y(0.2), { ...lab, align: 'right', color: s.c('red') });
    });
    s.alpha(after(s, 'cosine', 0.6), () => {
      F.dot(500, 0.5, 'teal', 1.1);
      s.text('0.5', F.X(500) + 2.5 * u, F.Y(0.5) - 2.5 * u, { ...lab, align: 'left', color: s.c('teal') });
    });
    cite(s, 'Ho, Jain & Abbeel, 2020', swap(s, 'ho', 'cosine'));
    cite(s, 'Nichol & Dhariwal, 2021', swap(s, 'cosine', 'jump'));
    s.alpha(s.ease('jump', 0.6), () => caption(s, 'any step, straight from x₀: one formula', s.h * 0.93, '--ink-2', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { path, blend: blendScene, variance, schedule };
