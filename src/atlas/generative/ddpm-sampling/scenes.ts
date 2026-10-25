import type { Scene, SceneDef, TextOpts } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, Frame, noised, rich, shades, type Ink } from '../draw';

const SHADE = { lo: -2.2, hi: 2.2 };
const cosSched = (t: number) => Math.cos(((t / 1000) * Math.PI) / 2) ** 2;
const WALK = [1000, 750, 500, 250, 0];
const WIMGS = WALK.map((t) => noised(cosSched(t)));

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

const walk: SceneDef = {
  draw(s) {
    const u = s.u;
    const gap = s.tall ? 19 : 24;
    const px = s.tall ? 0.9 : 1.1;
    const half = (14 * px) / 2;
    const y = s.h * 0.24;
    WALK.forEach((t, k) => {
      const x = s.w / 2 + (k - 2) * gap * u;
      const a = k === 0 ? s.ease('start', 0.6) : s.ease('loop', 0.5, 0.5 + 0.9 * k);
      s.alpha(a, () => {
        shades(s, x, y, px, WIMGS[k]!, '--ink', SHADE);
        s.text(`t = ${t}`, x, y + (half + 3.5) * u, { size: 3, font: 'mono', weight: 650, color: s.c(k === 0 ? 'slate' : k === 4 ? 'orange' : 'purple') });
        if (k > 0) s.arrow(x - (gap - half - 1) * u, y, x - (half + 1) * u, y, s.c('--ink-3'), 0.3, 1.6);
      });
    });
    s.alpha(s.win('start', 'loop'), () => caption(s, 'np.random.randn: pure noise', s.h * 0.43, 'slate', 3.4));
    s.alpha(s.ease('loop', 0.6, 1), () => caption(s, 'a little less noise at every step', s.h * 0.43, '--ink-2', 3.4));
    const c = s.ease('call', 0.6);
    s.alpha(c, () => {
      const y2 = s.h * 0.62;
      block(s, s.w / 2, y2, 24, 10, 'network', 'blue', { size: 3.6, on: 1 });
      s.text('xₜ, t', s.w / 2 - 24 * u, y2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
      s.arrow(s.w / 2 - 22 * u, y2, s.w / 2 - 14 * u, y2, s.c('--ink-3'), 0.35, 2);
      s.arrow(s.w / 2 + 14 * u, y2, s.w / 2 + 22 * u, y2, s.c('--ink-3'), 0.35, 2);
      s.text('ε̂', s.w / 2 + 24 * u, y2, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      const n = Math.round(1000 * Math.min(1, s.prog('call') * 1.3));
      rich(s, [['network calls: ', '--ink-2'], [String(n), 'blue']], s.w / 2, s.h * 0.8, { size: 3.8, weight: 650, halo: true });
      caption(s, 'one per step', s.h * 0.88, '--ink-3', 3.2);
    });
  },
};

const step: SceneDef = {
  marks: {
    est: { tex: String.raw`\sym{x0}{\hat{x}_0} = \dfrac{\sym{xt}{x_t} - \sqrt{1 - \sym{ab}{\bar\alpha_t}}\;\sym{epshat}{\hat\epsilon}}{\sqrt{\sym{ab}{\bar\alpha_t}}}`, x: 0.5, y: 0.12, size: 4.4 },
    step: { tex: String.raw`\sym{xt}{x_{t-1}} = \sqrt{\sym{ab}{\bar\alpha_{t-1}}}\,\sym{x0}{\hat{x}_0} + \sqrt{1 - \sym{ab}{\bar\alpha_{t-1}} - \sym{sigma}{\sigma}^2}\;\sym{epshat}{\hat\epsilon} + \sym{sigma}{\sigma}\,\sym{z}{z}`, x: 0.5, y: 0.11, size: 4 },
  },
  draw(s) {
    const u = s.u;
    s.show('est', s.win('est', 'back'));
    s.show('step', s.ease('back', 0.6, 0.4));
    const o = { size: 3.4, weight: 650, halo: true } as const;
    runs(s, [['xₜ = 0.5', 'purple'], ['    ᾱ', 'teal'], ['t', 'teal', true], [' = 0.64', 'teal'], ['    ε̂ = −0.5', 'red']], s.w / 2, s.h * 0.27, o);
    s.alpha(s.ease('est', 0.6), () => rich(s, [['x̂₀ = (0.5 − 0.6 · (−0.5)) / 0.8 = ', '--ink-2'], ['1', 'orange']], s.w / 2, s.h * 0.36, o));
    // The variance at step t - 1: image, then the noise share split into the guess and fresh noise.
    const L = Math.min(84, s.w / u - 24) * u;
    const l = s.w / 2 - L / 2;
    const yb = s.h * 0.52;
    const seg = (x0: number, w: number, k: Ink) => s.rrect(l + x0 * L, yb - 2.6 * u, Math.max(w * L, 0.5 * u), 5.2 * u, 0.6, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.25 });
    const sp = s.ease('split', 0.8);
    s.alpha(s.ease('back', 0.6), () => {
      seg(0, 0.81, 'orange');
      s.alpha(1 - sp, () => seg(0.81, 0.19, '--ink-3'));
      runs(s, [['ᾱ', 'orange'], ['t−1', 'orange', true], [' = 0.81: image', 'orange']], l, yb - 6 * u, { ...o, size: 3.2, align: 'left' });
      s.alpha(1 - sp, () => s.text('0.19 noise', l + L, yb - 6 * u, { ...o, size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') }));
    });
    s.alpha(sp, () => {
      seg(0.81, 0.16, 'red');
      seg(0.97, 0.03, 'slate');
      s.text('guess 0.16 → ×0.4', l + L, yb + 6.5 * u, { ...o, size: 3.2, font: 'mono', align: 'right', color: s.c('red') });
      s.text('fresh σ² = 0.03 → σ ≈ 0.17', l + L, yb + 11.5 * u, { ...o, size: 3.2, font: 'mono', align: 'right', color: s.c('slate') });
    });
    s.alpha(s.ease('mean', 0.6), () => rich(s, [['mean = 0.9 · 1 + 0.4 · (−0.5) = ', '--ink-2'], ['0.7', 'purple']], s.w / 2, s.h * 0.73, o));
    s.alpha(s.ease('fresh', 0.6), () => {
      runs(s, [['x', 'purple'], ['t−1', 'purple', true], [' = 0.7 + 0.17 · 1 = ', '--ink-2'], ['0.87', 'purple']], s.w / 2, s.h * 0.82, o);
      caption(s, 'z = 1: a fresh draw', s.h * 0.89, 'slate', 3);
    });
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
    s.alpha(s.ease('why', 0.6, 2.5), () => {
      F.dot(0.87, 0.03, 'red', 1.2);
      s.line(F.X(0.87), F.Y(0.05), F.X(1.0), F.Y(0.45), s.c('red'), 0.25);
      s.text('one draw: 0.87', F.X(1.0) + 1 * u, F.Y(0.45) - 1.5 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    const o = { size: 3.4, weight: 650, halo: true } as const;
    s.alpha(s.ease('last', 0.6), () => {
      rich(s, [['last step: ', '--ink-3'], ['ᾱ₀ = 1', 'teal'], [', noise share 0', '--ink-2']], s.w / 2, s.h * 0.52, o);
      rich(s, [['nothing kept, nothing fresh: ', '--ink-2'], ['x₀ = x̂₀', 'orange']], s.w / 2, s.h * 0.6, o);
    });
    // The 1,000 steps as a strip, step 1000 on the left; skipping lights every 20th level.
    const ys = s.h * 0.76;
    const ct = s.ease('count', 0.6);
    const sk = s.ease('skip', 0.6);
    s.alpha(ct, () => {
      s.line(F.l, ys, F.r, ys, s.c('--axis'), 0.35);
      for (let i = 0; i <= 200; i++) {
        const x = F.l + (i / 200) * (F.r - F.l);
        s.line(x, ys - 1.4 * u, x, ys + 1.4 * u, s.tint('--ink-3', 0.5 - 0.35 * sk), 0.12);
      }
      s.text('t = 1000', F.l, ys - 4.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('0', F.r, ys - 4.5 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(1 - sk, () => caption(s, '1000 network calls, 999 fresh draws', s.h * 0.86, '--ink-2', 3.4));
    });
    s.alpha(sk, () => {
      for (let i = 0; i <= 50; i++) {
        const x = F.l + (i / 50) * (F.r - F.l);
        s.line(x, ys - 2.4 * u, x, ys + 2.4 * u, s.c('blue'), 0.3);
      }
      caption(s, 'every 20th level: 50 calls', s.h * 0.86, 'blue', 3.4);
    });
  },
};

export const scenes: Record<string, SceneDef> = { walk, step, end };
