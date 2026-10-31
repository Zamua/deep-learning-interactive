import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { caption, fmt, Frame, rich, shades, stroke } from '../draw';

const lab = (s: Scene, t: string, x: number, y: number, k: Ink, o: { size?: number; align?: CanvasTextAlign } = {}) =>
  s.text(t, x, y, { size: o.size ?? 3.2, font: 'mono', weight: 650, align: o.align ?? 'center', color: s.c(k), halo: true });

/** A bell over the code line: its height is the true density's shape, capped so narrow ones stay on stage. */
const bell = (mu: number, sig: number, base = 0.42, cap = 1) => {
  const peak = Math.min(cap, base / sig);
  return (x: number) => peak * Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
};

/** A code line from -r to r: axis at `y`, plot top at `top` (fractions of the stage height). */
function line(s: Scene, top: number, y: number, r = 2.8, ticks = [-2, -1, 0, 1, 2]): Frame {
  const u = s.u;
  const half = Math.min(s.w / 2 - 8 * u, 56 * u);
  const F = new Frame(s, s.w / 2 - half, s.h * top, s.w / 2 + half, s.h * y, [-r, r], [0, 1]);
  s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
  for (const t of ticks) {
    s.line(F.X(t), F.b, F.X(t), F.b + 1.2 * u, s.c('--axis'), 0.3);
    s.text(fmt(t), F.X(t), F.b + 4 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
  }
  return F;
}

// ---- the digits: pen strokes on a 12 by 12 grid

const PX = 0.82;
const ONE = stroke(12, [[4.5, 3.6], [6.5, 2], [6.5, 10]], 0.9);
const SEVEN = stroke(12, [[3, 2.6], [9, 2.6], [5.2, 10]], 0.9);
const ZERO = stroke(12, [[6, 2], [8.5, 3.5], [9, 6], [8.5, 8.5], [6, 10], [3.5, 8.5], [3, 6], [3.5, 3.5], [6, 2]], 0.85);
const FOUR = stroke(12, [[8, 10], [8, 2], [3, 7.5], [9.5, 7.5]], 0.85);
const TWO = stroke(12, [[3.4, 4], [5, 2.3], [7.4, 2.3], [8.7, 4], [8, 6], [3, 10], [9.2, 10]], 0.85);
/** Half a 7, half a 0, blurred, with grit: what a code no image owns decodes to. */
const SMUDGE = (() => {
  const rng = new Rng(7);
  return SEVEN.map((r, i) =>
    r.map((_, j) => {
      let acc = 0;
      let n = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const v = 0.5 * ((SEVEN[i + a]?.[j + b] ?? 0) + (ZERO[i + a]?.[j + b] ?? 0));
        acc += v;
        n++;
      }
      return Math.max(0, Math.min(1, (1.3 * acc) / n + 0.22 * rng.randn()));
    }),
  );
})();
const digit = (s: Scene, img: number[][], cx: number, cy: number, px = PX) => shades(s, cx, cy, px, img, '--ink', { lo: 0, hi: 1 });

/** Training images and their codes on the line. */
const CODES: { img: number[][]; z: number }[] = [
  { img: ONE, z: -2 },
  { img: SEVEN, z: -0.9 },
  { img: ZERO, z: 1 },
  { img: FOUR, z: 2.1 },
];
const NEW = 0.1;

const gaps: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = line(s, 0.36, 0.7, 3.4);
    s.text('z', F.r + 3 * u, F.b, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
    const ty = s.h * 0.17;
    const cloud = s.ease('cloud', 1.4, 0.8);
    CODES.forEach((c, i) => {
      const a = s.ease('codes', 0.6, 0.6 + 0.35 * i);
      s.alpha(a, () => {
        digit(s, c.img, F.X(c.z), ty);
        s.arrow(F.X(c.z), ty + 6 * u, F.X(c.z), F.b - 2.6 * u, s.tint('--ink-3', 0.7), 0.3, 1.8);
        F.dot(c.z, 0, 'purple', 1.4);
      });
      s.alpha(cloud, () => F.fn(bell(c.z, lerp(0.05, 0.55, cloud), 0.3, 0.75), 'purple', { fill: 0.12, width: 0.45 }));
    });
    // A code no image produced, in the gap between the 7 and the 0.
    const nA = s.ease('new', 0.6, 2);
    s.alpha(nA, () => {
      F.dot(NEW, 0, 'green', 1.6);
      lab(s, 'new code', F.X(NEW), F.b + 8.5 * u, 'green', { size: 3 });
    });
    const sm = s.ease('smudge', 0.6);
    s.alpha(sm * (1 - cloud), () => {
      const y = s.h * 0.45;
      s.arrow(F.X(NEW), F.b - 2.6 * u, F.X(NEW), y + 6 * u, s.c('green'), 0.35, 1.8);
      digit(s, SMUDGE, F.X(NEW), y);
      lab(s, '?', F.X(NEW) + 7.5 * u, y, 'red', { size: 4.5 });
    });
    const cy = s.h * 0.9;
    s.alpha(s.win('codes', 'new') * after(s, 'codes', 0.55), () => caption(s, 'one image → one code: a point', cy, '--ink-2', 3.3));
    s.alpha(s.win('smudge', 'cloud'), () => caption(s, 'between the codes: never trained', cy, 'red', 3.3));
    s.alpha(cloud, () => caption(s, 'each image: a range of codes', cy, 'purple', 3.3));
  },
};

// ---- a bell for each image: where it sits (mu) and how wide it is (sigma)

const MU = [1, -0.5];
const SIG = [0.5, 0.2];

/** Counts of 4,000 standard normal draws in bins 0.25 wide, scaled so the tallest is 1. */
const HIST = (() => {
  const rng = new Rng(3);
  const bins = Array.from({ length: 22 }, () => 0);
  for (let k = 0; k < 4000; k++) {
    const b = Math.floor((rng.randn() + 2.75) / 0.25);
    if (b >= 0 && b < 22) bins[b]!++;
  }
  const top = Math.max(...bins);
  return bins.map((c) => c / top);
})();

/** The spread as a double arrow across the bell where it is 2σ wide, labeled. */
function spreadBar(s: Scene, F: Frame, mu: number, sig: number, h: number, text: string) {
  const y = F.Y(h * Math.exp(-0.5));
  s.arrow(F.X(mu), y, F.X(mu - sig), y, s.c('teal'), 0.35, 1.5);
  s.arrow(F.X(mu), y, F.X(mu + sig), y, s.c('teal'), 0.35, 1.5);
  lab(s, text, F.X(mu + sig) + 1.5 * s.u, y, 'teal', { size: 3, align: 'left' });
}

const spread: SceneDef = {
  draw(s) {
    const u = s.u;
    const four = s.ease('four', 0.9);
    const F = line(s, lerp(0.3, 0.27, four), lerp(0.84, 0.56, four));
    const sh = s.ease('mu', 1.2, 0.6);
    const nw = s.ease('sigma', 1.2, 0.8);
    const mu0 = lerp(0, MU[0]!, sh);
    const sg0 = lerp(1, SIG[0]!, nw);
    const B0 = bell(mu0, sg0);

    // How often each value comes up: bars, then the bell they trace.
    const hist = s.ease('bell', 1.2, 0.5) * (1 - s.ease('mu', 0.6));
    s.alpha(hist, () =>
      HIST.forEach((c, i) => {
        const x0 = -2.75 + 0.25 * i;
        const hgt = c * 0.42 * Math.min(1, s.ease('bell', 1.5, 0.5 + 0.03 * i) * 1.2);
        s.rrect(F.X(x0) + 0.2 * u, F.Y(hgt), F.X(x0 + 0.25) - F.X(x0) - 0.4 * u, F.Y(0) - F.Y(hgt), 0.2, { fill: s.tint('slate', 0.35) });
      }),
    );
    s.alpha(s.ease('bell', 0.8, 3), () => F.fn(B0, 'purple', { fill: 0.12, width: 0.55 }));
    s.alpha(s.win('bell', 'mu') * after(s, 'bell', 0.35), () => caption(s, 'how often each value comes up', s.h * 0.93, '--ink-2', 3.3));

    // The mean: where the bell is centered.
    s.alpha(s.ease('mu', 0.6), () => {
      s.line(F.X(mu0), F.b, F.X(mu0), F.Y(0.42 / sg0 > 1 ? 1 : 0.42 / sg0) - 1.5 * u, s.c('orange'), 0.35, [1, 0.8]);
      lab(s, `μ = ${fmt(Math.round(mu0 * 10) / 10)}`, F.X(mu0), F.Y(Math.min(1, 0.42 / sg0)) - 4 * u, 'orange', { size: 3.1 });
    });
    s.alpha(s.ease('sigma', 0.6, 2), () => spreadBar(s, F, mu0, sg0, Math.min(1, 0.42 / sg0), `σ = ${fmt(Math.round(sg0 * 10) / 10)}`));
    s.alpha(s.win('sigma', 'four') * after(s, 'sigma', 0.55), () => caption(s, 'σ = e^raw: never negative', s.h * 0.93, 'teal', 3.3));
    s.alpha(1 - four, () => lab(s, 'dim 0', F.l + 2 * u, F.t, '--ink-3', { size: 2.9, align: 'left' }));

    // Two code numbers: a second bell on its own line.
    s.alpha(four, () => {
      lab(s, 'dim 0', F.l + 2 * u, F.t, '--ink-3', { size: 2.9, align: 'left' });
      const G = line(s, 0.64, 0.82);
      G.fn(bell(MU[1]!, SIG[1]!), 'purple', { fill: 0.12, width: 0.55 });
      lab(s, 'dim 1', G.l + 2 * u, G.t, '--ink-3', { size: 2.9, align: 'left' });
      lab(s, 'μ = −0.5, σ = 0.2', G.X(MU[1]!) + 4 * u, G.t + 2 * u, '--ink-2', { size: 3, align: 'left' });
    });

    // The encoder's outputs: one mean and one spread per code dimension.
    const xs = columns(s, 2, 18).map((x) => x - 10 * u);
    const lx = xs[0]! - 12 * u;
    const ya = s.h * 0.07;
    const yb = s.h * 0.16;
    s.alpha(s.ease('mu', 0.6), () => {
      rowLabel(s, 'μ', lx, ya, 'orange', 3.8);
      cells(s, xs, ya, [fmt(MU[0]!), four > 0.5 ? fmt(MU[1]!) : ''], 'orange', { w: 13, h: 6.6, on: [s.win('mu', 'sigma'), 0] });
    });
    s.alpha(s.ease('sigma', 0.6), () => {
      rowLabel(s, 'σ', lx, yb, 'teal', 3.8);
      cells(s, xs, yb, [fmt(SIG[0]!), four > 0.5 ? fmt(SIG[1]!) : ''], 'teal', { w: 13, h: 6.6, on: [s.win('sigma', 'four'), 0] });
    });
    s.alpha(after(s, 'four', 0.4), () => lab(s, '4 outputs', xs[1]! + 9 * u, (ya + yb) / 2, '--ink-2', { size: 3.1, align: 'left' }));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'VAE: a bell for each image, not a point', s.h * 0.935, 'purple', 3.2));
    cite(s, 'Kingma & Welling, 2013', s.ease('name', 0.6));
  },
};

// ---- draw a code: stretch standard noise by sigma, shift it by mu

const EPS = [0.4, -1];
const Z = MU.map((m, i) => m + SIG[i]! * EPS[i]!);
/** Fresh noise for later training steps, drawn once. */
const DRAWS = (() => {
  const rng = new Rng(11);
  return Array.from({ length: 14 }, () => Math.max(-2.2, Math.min(2.2, rng.randn())));
})();

const sample: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 2, 16);
    const lx = xs[0]! - 11 * u;
    const rows: [string, number[], Ink, number, string][] = [
      ['μ', MU, 'orange', 0.06, ''],
      ['σ', SIG, 'teal', 0.135, ''],
      ['ε', EPS, 'slate', 0.21, 'eps'],
      ['z', Z, 'purple', 0.285, 'shift'],
    ];
    rows.forEach(([name, vals, k, f, beat]) => {
      s.alpha(beat ? s.ease(beat, 0.6, beat === 'shift' ? 1.5 : 0.8) : 1, () => {
        rowLabel(s, name, lx, s.h * f, k, 3.6);
        cells(s, xs, s.h * f, vals.map((v) => fmt(Math.round(v * 10) / 10)), k, { w: 12, h: 6, on: beat === 'shift' ? [s.win('shift', 'fresh'), 0] : undefined });
      });
    });
    s.alpha(s.ease('shift', 0.6, 2.5), () => rich(s, [['z = ', 'purple'], ['μ', 'orange'], [' + ', '--ink-2'], ['σ', 'teal'], ['ε', 'slate']], xs[1]! + 9 * u, s.h * 0.285, { size: 3.4, weight: 650, align: 'left' }));

    // Dimension 0: the standard normal, stretched by sigma, then shifted by mu.
    const F = line(s, 0.42, 0.82);
    lab(s, 'dim 0', F.l + 2 * u, F.t, '--ink-3', { size: 2.9, align: 'left' });
    const st = s.ease('stretch', 1.2, 0.4);
    const sf = s.ease('shift', 1.2, 0.4);
    const sg = lerp(1, SIG[0]!, st);
    const mu = lerp(0, MU[0]!, sf);
    const e = EPS[0]!;
    const zx = mu + sg * e;
    s.alpha(s.ease('eps', 0.6), () => F.fn(bell(0, 1), 'slate', { width: 0.35, dash: [1, 0.8] }));
    s.alpha(s.ease('eps', 0.6, 0.3), () => F.fn(bell(mu, sg), 'purple', { fill: 0.12, width: 0.55 }));
    s.alpha(after(s, 'eps', 0.6), () => F.dot(zx, 0, sf > 0.5 ? 'purple' : 'slate', 1.6));
    s.alpha(after(s, 'eps', 0.6) * (1 - s.ease('fresh', 0.4)), () => {
      const text = sf > 0.5 ? `z = ${fmt(Math.round(zx * 10) / 10)}` : st > 0.5 ? `σε = ${fmt(Math.round(zx * 10) / 10)}` : `ε = ${fmt(e)}`;
      lab(s, text, F.X(zx), F.b - 4.5 * u, sf > 0.5 ? 'purple' : st > 0.5 ? 'teal' : 'slate', { size: 3.1 });
    });

    // Fresh draws, every one a code the decoder must turn back into this 0.
    const fr = s.ease('fresh', 0.6);
    DRAWS.forEach((d, k) => s.alpha(s.ease('fresh', 0.3, 0.6 + k * 0.28) * (1 - s.ease('grad', 0.6)), () => F.dot(MU[0]! + SIG[0]! * d, 0.06 + 0.07 * (k % 4), 'purple', 1)));
    s.alpha(fr * (1 - s.ease('grad', 0.6)), () => {
      const dx = F.X(MU[0]!) + 18 * u;
      const dy = F.Y(0.82);
      s.arrow(F.X(MU[0]! + 0.35), F.Y(0.5), dx - 6 * u, dy + 2 * u, s.tint('--ink-3', 0.8), 0.3, 1.8);
      digit(s, ZERO, dx, dy);
    });
    s.alpha(s.win('fresh', 'grad'), () => caption(s, 'every draw must decode to this 0', s.h * 0.93, 'purple', 3.2));
    s.alpha(s.win('grad', 'trick'), () =>
      rich(s, [['∂z/∂μ = 1', 'orange'], ['    ', '--ink-2'], ['∂z/∂σ = ε', 'teal']], s.w / 2, s.h * 0.93, { size: 3.5, weight: 650, halo: true }),
    );
    s.alpha(s.ease('trick', 0.6), () => caption(s, 'the reparameterization trick', s.h * 0.93, '--ink-2', 3.3));
    cite(s, 'Kingma & Welling, 2013', s.ease('trick', 0.6));
  },
};

// ---- the extra term: how far each bell is from the standard normal

const kl = (mu: number, sg: number) => 0.5 * (mu * mu + sg * sg - 1 - Math.log(sg * sg));
/** The images' bells: narrowed and pushed apart when training cheats, then pulled toward the standard normal. */
const APART: [number, number][] = [[-2.4, 0.06], [-1.1, 0.05], [1.2, 0.05], [2.5, 0.07]];
const TOGETHER: [number, number][] = [[-0.8, 0.75], [-0.3, 0.85], [0.35, 0.8], [0.9, 0.75]];

/** The term's formula in colored runs; `hi` boxes one run. */
function formula(s: Scene, x: number, y: number, hi: number[], value: string) {
  const runs: [string, Ink][] = [['½(', '--ink-2'], ['μ²', 'orange'], [' + ', '--ink-2'], ['σ²', 'teal'], [' − 1 − ', '--ink-2'], ['ln σ²', 'teal'], [')', '--ink-2'], [value, '--ink']];
  const o = { size: s.tall ? 3.7 : 4, font: 'mono', weight: 650 } as const;
  const ws = runs.map(([t]) => s.measure(t, o));
  let cur = x - ws.reduce((a, b) => a + b, 0) / 2;
  runs.forEach(([t, k], i) => {
    const a = hi[i] ?? 0;
    if (a > 0.003) s.alpha(a, () => s.rrect(cur - 0.6 * s.u, y - 3.2 * s.u, ws[i]! + 1.2 * s.u, 6.4 * s.u, 1, { fill: s.tint(k, 0.14), stroke: s.c(k), lw: 0.35 }));
    s.text(t, cur, y, { ...o, align: 'left', color: s.c(k) });
    cur += ws[i]!;
  });
}

const pull: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = line(s, 0.3, 0.76, 4, [-3, -2, -1, 0, 1, 2, 3]);
    s.text('z', F.r + 3 * u, F.b, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });

    // Training cheats: spreads shrink, means drift apart.
    const cheat = after(s, 'cheat', 0.4, 2);
    const solo = s.ease('term', 0.6) * (1 - s.ease('generate', 0.6));
    const back = s.ease('generate', 1.6, 0.3);
    s.alpha(1 - solo, () =>
      APART.forEach(([m1, s1], i) => {
        const [m0, s0] = TOGETHER[i]!;
        const t = back > 0 ? 1 - back : cheat;
        const m = lerp(lerp(CODES[i]!.z, m1, t), m0, back);
        const sg = lerp(lerp(0.55, s1, t), s0, back);
        F.fn(bell(m, sg, 0.42, 0.95), 'purple', { fill: 0.1, width: 0.45 });
      }),
    );
    s.alpha(s.win('cheat', 'term') * after(s, 'cheat', 0.5), () => caption(s, 'σ → 0: exact codes, gaps again', s.h * 0.92, 'red', 3.3));

    // One bell against the standard normal, as the term reads it.
    const toMean = s.ease('mean', 1.2, 0.3) * (1 - s.ease('narrow', 0.8));
    const toNarrow = s.ease('narrow', 1.2, 0.8);
    const toWide = s.ease('wide', 1.6, 0.3);
    const home = s.ease('kl', 1, 0.3);
    const mu = 2 * toMean;
    const sg = lerp(lerp(lerp(1, 0.5, toNarrow), 2, toWide), 1, home);
    const std = s.ease('term', 0.6) * (1 - 0.6 * s.ease('generate', 0.6));
    s.alpha(std, () => F.fn(bell(0, 1), '--ink-2', { width: 0.4, dash: [1.2, 1] }));
    s.alpha(s.win('term', 'kl') * after(s, 'term', 0.45), () => lab(s, 'standard normal', F.X(-2.4), F.Y(0.3), '--ink-2', { size: 3 }));
    s.alpha(solo, () => {
      F.fn(bell(mu, sg, 0.42, 0.95), 'purple', { fill: 0.14, width: 0.55 });
      rich(s, [['μ = ', 'orange'], [fmt(Math.round(mu * 10) / 10), 'orange'], ['    σ = ', 'teal'], [fmt(Math.round(sg * 100) / 100), 'teal']], s.w / 2, s.h * 0.92, { size: 3.4, weight: 650 });
    });
    const fA = s.ease('term', 0.6, 1) * (1 - s.ease('generate', 0.6));
    s.alpha(fA, () => {
      const hi = [0, s.win('mean', 'narrow'), 0, s.win('wide', 'kl') * after(s, 'wide', 0.3), 0, s.win('narrow', 'wide') * after(s, 'narrow', 0.3), 0, 0];
      formula(s, s.w / 2, s.h * 0.12, hi, ` = ${kl(mu, sg).toFixed(2)}`);
    });
    s.alpha(s.ease('kl', 0.6, 0.5) * (1 - s.ease('generate', 0.6)), () => lab(s, 'the KL divergence', s.w / 2, s.h * 0.205, '--ink-2', { size: 3.2 }));
    cite(s, 'Kullback & Leibler, 1951', s.win('kl', 'generate'));

    // A fresh code from the standard normal decodes to a new image.
    const g = after(s, 'generate', 0.5);
    s.alpha(g, () => {
      const z = -0.35;
      F.dot(z, 0, 'green', 1.7);
      const dx = F.X(z) + 22 * u;
      const dy = s.h * 0.14;
      s.arrow(F.X(z), F.b - 2.8 * u, dx - 6.5 * u, dy + 4 * u, s.c('green'), 0.4, 2);
      digit(s, TWO, dx, dy);
      lab(s, 'new', dx + 7.5 * u, dy, 'green', { size: 3.1, align: 'left' });
      caption(s, 'any code from the standard normal', s.h * 0.92, 'green', 3.3);
    });
  },
};

export const scenes: Record<string, SceneDef> = { gaps, spread, sample, pull };
