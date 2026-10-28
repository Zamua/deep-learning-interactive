import type { Scene, SceneDef, TextOpts } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, Frame, noised, rich, shades, SMILEY, type Ink } from '../draw';

const SHADE = { lo: -2.2, hi: 2.2 };
const cosSched = (t: number) => Math.cos(((t / 1000) * Math.PI) / 2) ** 2;
const WALK = [1000, 750, 500, 250, 0];
const WIMGS = WALK.map((t) => noised(cosSched(t)));

/** 0 -> 1 once beat `id` is fraction `f` of the way through its spoken length. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Fades in at beat `from`, just after whatever it replaces has faded out at the same spot. */
const swap = (s: Scene, from: string, until?: string) => s.ease(from, 0.5, 0.45) * (until ? 1 - s.ease(until, 0.4) : 1);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Colored runs as one line, like `rich`, where a run marked `sub` is set as a subscript. */
function runs(s: Scene, parts: [string, Ink, boolean?][], x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 3.4;
  const base: TextOpts = { font: 'mono', weight: 650, ...o, size, align: 'left' };
  const sub: TextOpts = { ...base, size: size * 0.7 };
  const ws = parts.map(([t, , b]) => s.measure(t, b ? sub : base));
  const total = ws.reduce((a, b) => a + b, 0);
  let cur = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  parts.forEach(([t, k, b], i) => {
    s.text(t, cur, b ? y + size * 0.3 * s.u : y, { ...(b ? sub : base), color: s.c(k) });
    cur += ws[i]!;
  });
}

/**
 * The clean-image estimate a walk would see at each step of WALK: a blur of the smiley, broad
 * shapes first and details last, shown as a Gaussian blur that narrows as the noise falls.
 */
const ESTS = [2.2, 1.6, 1, 0.5, 0].map((r, k) => {
  if (!r) return SMILEY;
  const n = SMILEY.length;
  const w = Array.from({ length: 2 * Math.ceil(2 * r) + 1 }, (_, i) => Math.exp(-((i - Math.ceil(2 * r)) ** 2) / (2 * r * r)));
  const ws = w.reduce((a, b) => a + b, 0);
  const at = (i: number) => Math.max(0, Math.min(n - 1, i));
  const h = SMILEY.map((row) => row.map((_, j) => w.reduce((a, wi, d) => a + wi * row[at(j + d - (w.length - 1) / 2)]!, 0) / ws));
  const v = h.map((row, i) => row.map((_, j) => w.reduce((a, wi, d) => a + wi * h[at(i + d - (w.length - 1) / 2)]![j]!, 0) / ws));
  const c = [0.65, 0.8, 0.92, 0.98][k]!;
  return v.map((row) => row.map((x) => c * x));
});

const walk: SceneDef = {
  draw(s) {
    const u = s.u;
    const gap = s.tall ? 19 : 24;
    const px = s.tall ? 0.9 : 1.1;
    const half = (14 * px) / 2;
    const y = s.h * 0.2;
    const xs = WALK.map((_, k) => s.w / 2 + (k - 2) * gap * u);
    const bk = s.ease('back', 0.6);
    // The noising path, faint, with its arrows pointing toward the noise; then walked back.
    WALK.forEach((t, k) => {
      const lit = k === 0 ? 1 : s.ease('back', 0.5, 1.2 + 1.3 * k);
      s.alpha(s.ease('start', 0.6) * lerp(0.25, 1, lit), () => {
        shades(s, xs[k]!, y, px, WIMGS[k]!, '--ink', SHADE);
        s.text(`t = ${t}`, xs[k]!, y + (half + 3.5) * u, { size: 3, font: 'mono', weight: 650, color: s.c(k === 0 ? 'slate' : k === 4 ? 'orange' : 'purple') });
      });
      if (k === 0) return;
      const a = xs[k - 1]! + (half + 1) * u;
      const b = xs[k]! - (half + 1) * u;
      s.alpha(s.ease('start', 0.6) * 0.5 * (1 - bk), () => s.arrow(b, y, a, y, s.c('--ink-3'), 0.3, 1.6));
      s.alpha(lit * bk, () => s.arrow(a, y, b, y, s.c('purple'), 0.35, 1.8));
    });
    s.alpha(swap(s, 'start', 'back'), () => caption(s, 'start: pure noise, np.random.randn', s.h * 0.39, 'slate', 3.4));
    s.alpha(swap(s, 'back', 'sampler'), () => caption(s, 'a little less noise at every step', s.h * 0.39, '--ink-2', 3.4));
    s.alpha(swap(s, 'sampler'), () => caption(s, 'the whole loop: a sampler', s.h * 0.39, 'purple', 3.4));
    // One network call per step.
    s.alpha(s.win('call', 'blur'), () => {
      const y2 = s.h * 0.6;
      block(s, s.w / 2, y2, 24, 10, 'network', 'blue', { size: 3.6, on: 1 });
      s.text('xₜ, t', s.w / 2 - 24 * u, y2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
      s.arrow(s.w / 2 - 22 * u, y2, s.w / 2 - 14 * u, y2, s.c('--ink-3'), 0.35, 2);
      s.arrow(s.w / 2 + 14 * u, y2, s.w / 2 + 22 * u, y2, s.c('--ink-3'), 0.35, 2);
      s.text('ε̂', s.w / 2 + 24 * u, y2, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      const n = Math.round(1000 * Math.min(1, s.prog('call') * 1.3));
      rich(s, [['network calls: ', '--ink-2'], [String(n), 'blue']], s.w / 2, s.h * 0.8, { size: 3.8, weight: 650, halo: true });
    });
    // What the estimate would look like from each step: a blur first, details last.
    const ey = s.h * 0.62;
    s.alpha(s.ease('blur', 0.6, 0.8), () => s.text('x̂₀, the estimate', xs[0]! - half * u, ey - (half + 3.5) * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('orange') }));
    WALK.forEach((_, k) => {
      const a = k === 0 ? s.ease('blur', 0.6, 0.8) : s.ease('ho', 0.5, 1 + 0.7 * k);
      s.alpha(a, () => shades(s, xs[k]!, ey, px, ESTS[k]!, '--ink', SHADE));
    });
    s.alpha(swap(s, 'blur', 'ho'), () => caption(s, 'the estimate at t = 1000: a blur', s.h * 0.84, 'orange', 3.4));
    s.alpha(swap(s, 'ho'), () => caption(s, 'large features first, details last', s.h * 0.84, 'orange', 3.4));
    cite(s, 'Ho, Jain & Abbeel, 2020: DDPM', s.ease('ho', 0.6));
  },
};

const step: SceneDef = {
  marks: {
    est: { tex: String.raw`\sym{x0}{\hat{x}_0} = \dfrac{\sym{xt}{x_t} - \sqrt{1 - \sym{ab}{\bar\alpha_t}}\;\sym{epshat}{\hat\epsilon}}{\sqrt{\sym{ab}{\bar\alpha_t}}}`, x: 0.5, y: 0.1, size: 4.2 },
    level: { tex: String.raw`\sym{xt}{x_{t-1}} = \sqrt{\sym{ab}{\bar\alpha_{t-1}}}\,\text{image} + \sqrt{1 - \sym{ab}{\bar\alpha_{t-1}}}\;\text{noise}`, x: 0.5, y: 0.09, size: 4.2 },
    img: { tex: String.raw`\sym{xt}{x_{t-1}} = \sqrt{\sym{ab}{\bar\alpha_{t-1}}}\,\sym{x0}{\hat{x}_0} + \sqrt{1 - \sym{ab}{\bar\alpha_{t-1}}}\;\text{noise}`, x: 0.5, y: 0.09, size: 4.2 },
    step: { tex: String.raw`\sym{xt}{x_{t-1}} = \sqrt{\sym{ab}{\bar\alpha_{t-1}}}\,\sym{x0}{\hat{x}_0} + \sqrt{1 - \sym{ab}{\bar\alpha_{t-1}} - \sym{sigma}{\sigma}^2}\;\sym{epshat}{\hat\epsilon} + \sym{sigma}{\sigma}\,\sym{z}{z}`, x: 0.5, y: 0.09, size: 3.8 },
  },
  draw(s) {
    const u = s.u;
    s.show('est', s.win('est', 'level'));
    s.show('level', s.win('level', 'img'));
    s.show('img', s.win('img', 'split'));
    s.show('step', s.ease('split', 0.6));
    const o = { size: 3.4, weight: 650, halo: true } as const;
    runs(s, [['xₜ = 0.5', 'purple'], ['    ε̂ = −0.5', 'red']], s.w / 2, s.h * 0.2, o);
    s.alpha(s.ease('est', 0.6), () => runs(s, [['ᾱ', 'teal'], ['t', 'teal', true], [' = 0.64', 'teal']], s.w / 2, s.h * 0.26, o));

    // The variance of step t - 1: image, then the noise share split into the kept guess and fresh noise.
    const L = Math.min(84, s.w / u - 24) * u;
    const l = s.w / 2 - L / 2;
    const yb = s.h * 0.44;
    const seg = (x0: number, w: number, k: Ink) => s.rrect(l + x0 * L, yb - 2.6 * u, Math.max(w * L, 0.5 * u), 5.2 * u, 0.6, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.25 });
    const two = s.ease('fresh', 0.8, 1);
    const sp = s.ease('split', 0.8);
    const so = { ...o, size: 3.1, font: 'mono' } as const;
    s.alpha(s.ease('level', 0.6), () => {
      seg(0, 0.81, 'orange');
      s.alpha(1 - two, () => seg(0.81, 0.19, '--ink-3'));
      runs(s, [['ᾱ', 'teal'], ['t−1', 'teal', true], [' = 0.81: image', 'orange']], l, yb - 6 * u, { ...o, size: 3.1, align: 'left' });
      s.alpha(1 - two, () => s.text('0.19 noise', l + L, yb - 6 * u, { ...so, align: 'right', color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('img', 0.6, 0.6), () => s.text('√0.81 = 0.9', l, yb + 6.5 * u, { ...so, align: 'left', color: s.c('orange') }));
    s.alpha(two, () => {
      seg(0.81, lerp(0.19, 0.16, sp), 'red');
      s.alpha(sp, () => seg(0.97, 0.03, 'slate'));
      s.text('guess + fresh z', l + L, yb - 6 * u, { ...so, align: 'right', color: s.c('--ink-2') });
    });
    s.alpha(sp, () => s.text('σ² = 0.03: σ ≈ 0.17', l + L, yb + 11.5 * u, { ...so, align: 'right', color: s.c('slate') }));
    s.alpha(s.ease('root', 0.6), () => s.text('guess 0.16: √0.16 = 0.4', l + L, yb + 6.5 * u, { ...so, align: 'right', color: s.c('red') }));

    // One pixel on a number line: from x_t, toward the estimate, to the mean, then a fresh nudge.
    const yl = s.h * 0.72;
    const X = (v: number) => s.w / 2 + ((v - 0.5) / 1.4) * L;
    s.line(X(-0.2), yl, X(1.2), yl, s.c('--axis'), 0.35);
    for (const v of [0, 0.5, 1]) {
      s.line(X(v), yl - 1 * u, X(v), yl + 1 * u, s.c('--axis'), 0.3);
      s.text(String(v), X(v), yl + 3.5 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
    }
    const top = { size: 3.1, font: 'mono', weight: 650, halo: true } as const;
    const mv = s.ease('mean', 1.2, 1);
    const ld = s.ease('land', 1, 2);
    const px = lerp(lerp(0.5, 0.7, mv), 0.87, ld);
    s.alpha(s.ease('est', 0.6, 1), () => {
      s.circle(X(1), yl, 1.3 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.35 });
      s.text('x̂₀ = 1', X(1), yl + 8.5 * u, { ...top, color: s.c('orange') });
    });
    s.alpha(mv, () => {
      s.circle(X(0.7), yl, 1.1 * u, { stroke: s.c('purple'), fill: s.c('--card'), lw: 0.35 });
      s.text('mean 0.7', X(0.7), yl + 8.5 * u, { ...top, color: s.c('purple') });
    });
    s.alpha(ld, () => s.arrow(X(0.7), yl - 3 * u, X(0.87), yl - 3 * u, s.c('slate'), 0.3, 1.4));
    s.circle(X(px), yl, 1.3 * u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
    s.alpha(1 - mv, () => s.text('xₜ = 0.5', X(0.5), yl - 5.5 * u, { ...top, color: s.c('purple') }));
    s.alpha(ld, () => s.text('xₜ₋₁ = 0.87', X(0.87), yl - 6.5 * u, { ...top, color: s.c('purple') }));

    // The beat's one computation, under the number line.
    const cy = s.h * 0.92;
    const co = { size: 3.3, weight: 650, halo: true } as const;
    s.alpha(swap(s, 'est', 'level'), () => rich(s, [['(0.5 + 0.3) / 0.8 = ', '--ink-2'], ['1', 'orange']], s.w / 2, cy, co));
    s.alpha(swap(s, 'img', 'fresh'), () => rich(s, [['image part: 0.9 · 1 = ', '--ink-2'], ['0.9', 'orange']], s.w / 2, cy, co));
    s.alpha(swap(s, 'fresh', 'split'), () => caption(s, 'z: a fresh standard normal draw', cy, 'slate', 3.3));
    s.alpha(swap(s, 'root', 'mean'), () => rich(s, [['guess part: 0.4 · (−0.5) = ', '--ink-2'], ['−0.2', 'red']], s.w / 2, cy, co));
    s.alpha(swap(s, 'mean', 'land'), () => rich(s, [['mean = 0.9 − 0.2 = ', '--ink-2'], ['0.7', 'purple']], s.w / 2, cy, co));
    s.alpha(swap(s, 'land'), () => runs(s, [['x', 'purple'], ['t−1', 'purple', true], [' = 0.7 + 0.17 · 1 = ', '--ink-2'], ['0.87', 'purple']], s.w / 2, cy, co));
  },
};

const MEAN = 0.7;
const SD = 0.17;
const bell = (x: number) => 0.85 * Math.exp(-((x - MEAN) ** 2) / (2 * SD * SD));
const rng = new Rng(21);
const DRAWS = Array.from({ length: 14 }, () => MEAN + SD * rng.randn());

const end: SceneDef = {
  draw(s) {
    const u = s.u;
    const half = Math.min(40, s.w / u / 2 - 8) * u;
    const F = new Frame(s, s.w / 2 - half, s.h * 0.1, s.w / 2 + half, s.h * 0.36, [0.15, 1.25], [0, 1]);
    const wy = s.ease('why', 0.6);
    s.alpha(wy, () => {
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
      for (const v of [0.5, 1]) s.text(String(v.toFixed(1)), F.X(v), F.Y(0) + 3.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      F.fn(bell, 'purple', { fill: 0.15, width: 0.5 });
      s.line(F.X(MEAN), F.Y(0), F.X(MEAN), F.Y(0.85), s.c('purple'), 0.3, [0.8, 0.6]);
      s.text('mean 0.7', F.X(MEAN), F.Y(0.85) - 3 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      for (const x of DRAWS) F.dot(x, 0.03, '--ink-3', 0.6);
    });
    s.alpha(after(s, 'why', 0.55), () => {
      F.dot(0.87, 0.03, 'purple', 1.2);
      s.line(F.X(0.87), F.Y(0.05), F.X(1.0), F.Y(0.45), s.c('purple'), 0.25);
      s.text('one draw: 0.87', F.X(1.0) + 1 * u, F.Y(0.45) - 1.5 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
    });
    const o = { size: 3.4, weight: 650, halo: true } as const;
    s.alpha(s.ease('last', 0.6), () => {
      rich(s, [['last step: ', '--ink-3'], ['ᾱ₀ = 1', 'teal'], [', noise share 0', '--ink-2']], s.w / 2, s.h * 0.5, o);
      rich(s, [['nothing kept, nothing fresh: ', '--ink-2'], ['x₀ = x̂₀', 'orange']], s.w / 2, s.h * 0.58, o);
    });
    // The 1,000 steps as a strip, step 1000 on the left; skipping lights every 20th level.
    const ys = s.h * 0.76;
    const ct = s.ease('count', 0.6);
    const sk = s.ease('fifty', 0.6);
    s.alpha(ct, () => {
      s.line(F.l, ys, F.r, ys, s.c('--axis'), 0.35);
      for (let i = 0; i <= 200; i++) {
        const x = F.l + (i / 200) * (F.r - F.l);
        s.line(x, ys - 1.4 * u, x, ys + 1.4 * u, s.tint('--ink-3', 0.5 - 0.35 * sk), 0.12);
      }
      s.text('t = 1000', F.l, ys - 4.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('0', F.r, ys - 4.5 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(1 - s.ease('skip', 0.4), () => caption(s, '1000 network calls, 999 fresh draws', s.h * 0.86, '--ink-2', 3.4));
    });
    s.alpha(swap(s, 'skip', 'fifty'), () => caption(s, 'every level: a blend straight from x₀', s.h * 0.86, '--ink-2', 3.4));
    s.alpha(sk, () => {
      for (let i = 0; i <= 50; i++) {
        const x = F.l + (i / 50) * (F.r - F.l);
        s.line(x, ys - 2.4 * u, x, ys + 2.4 * u, s.c('blue'), 0.3);
      }
    });
    s.alpha(swap(s, 'fifty'), () => caption(s, 'every 20th level: 50 calls', s.h * 0.86, 'blue', 3.4));
    cite(s, 'Song, Meng & Ermon, 2020', s.ease('skip', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { walk, step, end };
