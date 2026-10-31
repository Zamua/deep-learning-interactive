import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, cite, columns } from '../../draw';
import { block, caption, Frame, fmt, noised, rich, shades, subText } from '../draw';

const EU = [0.2, -0.4];
const EC = [0.3, -0.3];
const at = (w: number) => EU.map((v, i) => +(v + w * (EC[i]! - v)).toFixed(3));
const SHADE = { lo: -2.2, hi: 2.2 };
const XT = noised(0.5);
const cosSched = (t: number) => Math.cos(((t / 1000) * Math.PI) / 2) ** 2;
const WALK = [1000, 750, 500, 250, 0];
const WIMGS = WALK.map((t) => noised(cosSched(t)));

/** Eases in a fraction `f` of the way through beat `id`, so it follows the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.6) => s.ease(id, dur, f * (s.end(id) - s.at(id)));

/** The plane of noise guesses (two pixels), between `top` and `bottom`. */
function plane(s: Scene, top: number, bottom: number): Frame {
  const u = s.u;
  const half = Math.min(s.w / 2 - 10 * u, 55 * u);
  const F = new Frame(s, s.w / 2 - half, top, s.w / 2 + half, bottom, [0.02, 0.68], [-0.52, 0.02]);
  F.axes(0.8);
  s.text('noise guess, 2 pixels', F.r, F.b + 3.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
  return F;
}

type K = 'slate' | 'orange' | 'red' | 'gold';

function label(s: Scene, F: Frame, p: number[], text: string, k: K, dx: number, dy: number, size = 3.2): void {
  const o = { size, color: s.c(k), halo: true, align: dx < 0 ? 'right' : dx > 0 ? 'left' : 'center' } as const;
  const m = /^ε_([cu])$/.exec(text);
  if (m) subText(s, 'ε', m[1]!, F.X(p[0]!) + dx * s.u, F.Y(p[1]!) + dy * s.u, o);
  else s.text(text, F.X(p[0]!) + dx * s.u, F.Y(p[1]!) + dy * s.u, { ...o, font: 'mono', weight: 650 });
}

/** An arrow from p to the point a fraction `k` of the way to q, in plane coordinates. */
function push(s: Scene, F: Frame, p: number[], q: number[], k: number, width = 0.5): void {
  if (k <= 0.01) return;
  s.arrow(F.X(p[0]!), F.Y(p[1]!), F.X(p[0]! + (q[0]! - p[0]!) * k), F.Y(p[1]! + (q[1]! - p[1]!) * k), s.c('red'), width, 2.2);
}

/** The noised image, the denoiser and the prompt above it, in one row at height y. */
function denoiser(s: Scene, y: number, prompt: number) {
  const u = s.u;
  const X = (f: number) => s.w * f;
  shades(s, X(0.13), y, s.tall ? 0.9 : 1, XT, '--ink', SHADE);
  s.text('xₜ, t', X(0.13), y + 10 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple') });
  s.arrow(X(0.13) + 8 * u, y, X(0.42) - 11 * u, y, s.c('--ink-3'), 0.35, 2);
  block(s, X(0.42), y, 18, 10, 'denoiser', 'blue', { size: 3.4 });
  s.alpha(prompt, () => {
    s.text('“a red bicycle”', X(0.42), y - 13 * u, { size: 3.2, font: 'serif', italic: true, color: s.c('orange') });
    s.arrow(X(0.42), y - 10.5 * u, X(0.42), y - 6 * u, s.c('orange'), 0.35, 1.8);
  });
}

/** Two cells of a guess at height y, its name above or below. */
function guess(s: Scene, y: number, v: number[], k: 'orange' | 'slate', sub: string, above: boolean) {
  const xs = [s.w * 0.71, s.w * 0.84];
  cells(s, xs, y, v.map((x) => fmt(x)), k, { w: 11, h: 7 });
  subText(s, 'ε', sub, (xs[0]! + xs[1]!) / 2, y + (above ? -7.5 : 7.5) * s.u, { size: 3.6, color: s.c(k) });
}

const pull: SceneDef = {
  draw(s) {
    const u = s.u;
    // The walk from noise to an image, as sampling made it.
    const gap = s.tall ? 19 : 24;
    const px = s.tall ? 0.9 : 1.1;
    const half = (14 * px) / 2;
    const wy = s.h * 0.24;
    s.alpha(1 - s.ease('prompt', 0.5), () => {
      WALK.forEach((t, k) => {
        const x = s.w / 2 + (k - 2) * gap * u;
        s.alpha(k === 0 ? 1 : after(s, 'walk', 0.1 + 0.12 * k, 0.5), () => {
          shades(s, x, wy, px, WIMGS[k]!, '--ink', SHADE);
          s.text(`t = ${t}`, x, wy + (half + 3.5) * u, { size: 3, font: 'mono', weight: 650, color: s.c(k === 0 ? 'slate' : k === 4 ? 'orange' : 'purple') });
          if (k > 0) s.arrow(x - (gap - half - 1) * u, wy, x - (half + 1) * u, wy, s.c('--ink-3'), 0.3, 1.6);
        });
      });
      s.alpha(after(s, 'walk', 0.7), () => caption(s, 'which image? whatever it lands on', s.h * 0.5, '--ink-2', 3.4));
    });

    const y = s.h * 0.26;
    s.alpha(s.ease('prompt', 0.6, 0.3), () => denoiser(s, y, after(s, 'prompt', 0.25)));
    s.alpha(s.win('prompt', 'ec') * after(s, 'prompt', 0.75), () => caption(s, 'the prompt: one more input', s.h * 0.5, 'orange', 3.4));
    s.alpha(s.ease('ec', 0.6, 0.4), () => {
      s.arrow(s.w * 0.42 + 11 * u, y, s.w * 0.71 - 7 * u, y, s.c('orange'), 0.35, 2);
      guess(s, y, EC, 'orange', 'c', true);
    });
    s.alpha(s.win('ec', 'weak') * after(s, 'ec', 0.5), () => caption(s, 'c: conditioned on the prompt', s.h * 0.5, 'orange', 3.4));

    // The prompt barely moves the guess.
    s.alpha(s.ease('weak', 0.6), () => {
      const F = plane(s, s.h * 0.44, s.h * 0.86);
      F.dot(EC[0]!, EC[1]!, 'orange', 1.5);
      label(s, F, EC, 'ε_c', 'orange', 3, -2.5);
      s.alpha(after(s, 'weak', 0.55), () => {
        F.dot(EU[0]!, EU[1]!, 'slate', 1.5);
        label(s, F, EU, 'no prompt', 'slate', -3, 2.5);
      });
      push(s, F, EU, EC, after(s, 'weak', 0.7, 0.8));
    });
    s.alpha(s.win('weak', 'loose') * after(s, 'weak', 0.75), () => caption(s, 'the prompt moves the guess a little', s.h * 0.95, 'red', 3.3));
    s.alpha(s.ease('loose', 0.6), () => caption(s, 'so each step leans only slightly', s.h * 0.95, 'red', 3.3));
  },
};

const free: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.3;
    // Classifier guidance: a second network, and its gradient back onto the image.
    s.alpha(1 - s.ease('free', 0.5), () => {
      s.alpha(s.ease('cls', 0.6, 0.6), () => {
        shades(s, X(0.15), y, s.tall ? 0.9 : 1, XT, '--ink', SHADE);
        s.text('noisy image', X(0.15), y + 10 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.arrow(X(0.15) + 8 * u, y, X(0.48) - 11 * u, y, s.c('--ink-3'), 0.35, 2);
        block(s, X(0.48), y, 20, 10, 'classifier', 'green', { size: 3.4 });
        s.arrow(X(0.48) + 12 * u, y, X(0.72) - 1 * u, y, s.c('--ink-3'), 0.35, 2);
        s.text('bicycle?', X(0.72), y, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('green') });
      });
      s.alpha(after(s, 'grad', 0.15), () => {
        const yb = y + 15 * u;
        s.line(X(0.48), y + 5.5 * u, X(0.48), yb, s.c('red'), 0.4);
        s.line(X(0.48), yb, X(0.15), yb, s.c('red'), 0.4);
        s.arrow(X(0.15), yb, X(0.15), y + 12.5 * u, s.c('red'), 0.4, 1.8);
        s.text('gradient', X(0.315), yb + 4.6 * u, { size: 3.1, font: 'mono', color: s.c('red'), halo: true });
      });
      s.alpha(after(s, 'grad', 0.6), () => caption(s, 'but a whole second network', s.h * 0.62, '--ink-2', 3.4));
    });

    // Classifier-free: the one denoiser, run with and without the prompt.
    s.alpha(s.ease('free', 0.6, 0.3), () => {
      denoiser(s, y, 1);
      s.alpha(after(s, 'free', 0.55), () => {
        s.text('“” 1 time in 10', s.w * 0.42, y + 13.5 * u, { size: 3.1, font: 'serif', italic: true, color: s.c('slate'), halo: true });
      });
      s.arrow(X(0.42) + 11 * u, y - 2 * u, X(0.71) - 7 * u, y - 7 * u, s.c('orange'), 0.35, 2);
      guess(s, y - 7 * u, EC, 'orange', 'c', true);
    });
    s.alpha(s.ease('eu', 0.6), () => {
      s.arrow(X(0.42) + 11 * u, y + 2 * u, X(0.71) - 7 * u, y + 7 * u, s.c('slate'), 0.35, 2);
      guess(s, y + 7 * u, EU, 'slate', 'u', false);
    });

    // The plane: the same two guesses, and the prompt's direction between them.
    s.alpha(s.ease('eu', 0.6, 0.3), () => {
      const F = plane(s, s.h * 0.5, s.h * 0.86);
      F.dot(EU[0]!, EU[1]!, 'slate', 1.5);
      F.dot(EC[0]!, EC[1]!, 'orange', 1.5);
      label(s, F, EU, 'ε_u', 'slate', -3, 2.5);
      label(s, F, EC, 'ε_c', 'orange', -3, -2.5);
      push(s, F, EU, EC, s.ease('diff', 0.8, 0.6), 0.55);
      s.alpha(after(s, 'diff', 0.6), () => label(s, F, at(0.5), 'the prompt\'s direction', 'red', 4, 2, 3.1));
    });
    s.alpha(after(s, 'name', 0.05), () => caption(s, 'classifier-free: one network, run twice', s.h * 0.95, '--ink-2', 3.3));

    cite(s, 'Dhariwal & Nichol, 2021', s.win('cls', 'free'));
    cite(s, 'Ho & Salimans, 2021', s.win('free', 'name') + s.ease('name', 0.6) * (1 - after(s, 'name', 0.45)));
    cite(s, 'GLIDE · Nichol et al., 2021', after(s, 'name', 0.5));
  },
};

/** The guidance scale over the `ends` beat: 0, then a half, then 1, eased between. */
function wEnds(s: Scene): number {
  const p = s.prog('ends');
  return 0.5 * smooth((p - 0.36) / 0.08) + 0.5 * smooth((p - 0.6) / 0.08);
}

const pushScene: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{epshat}{\hat\epsilon} = \sym{epsu}{\epsilon_u} + \sym{wg}{w}\,(\sym{epsc}{\epsilon_c} - \sym{epsu}{\epsilon_u})`, x: 0.5, y: 0.1, size: 5 },
  },
  draw(s) {
    s.show('f', s.ease('rule', 0.6));
    const F = plane(s, s.h * 0.22, s.h * 0.84);
    const go = s.ease('three', 1.4, 0.4);
    const w = s.since('three') >= 0 ? 1 + 2 * go : s.since('ends') >= 0 ? wEnds(s) : 1;
    const end = at(Math.max(1, w));
    s.line(F.X(EU[0]!), F.Y(EU[1]!), F.X(end[0]!), F.Y(end[1]!), s.tint('red', 0.6), 0.4, [1, 0.8]);
    F.dot(EU[0]!, EU[1]!, 'slate', 1.5);
    F.dot(EC[0]!, EC[1]!, 'orange', 1.5);
    label(s, F, EU, 'ε_u', 'slate', -3, 2.5);
    label(s, F, EC, 'ε_c', 'orange', -3, -2.5);
    s.alpha(s.ease('ends', 0.6), () => {
      const p = at(w);
      push(s, F, EU, p, 1, 0.55);
      F.dot(p[0]!, p[1]!, 'red', 1.8);
      label(s, F, p, `w = ${fmt(+w.toFixed(1))}`, 'red', 3.5, 3.5, 3.2);
    });
    s.alpha(after(s, 'three', 0.85), () => label(s, F, at(3), '[0.5, −0.1]', 'red', -3.5, -3, 3.2));
    const cy = s.h * 0.93;
    s.alpha(s.win('rule', 'ends') * after(s, 'rule', 0.5), () => caption(s, 'w: one number you choose', cy, 'gold', 3.3));
    s.alpha(s.win('three', 'second') * after(s, 'three', 0.6), () => caption(s, '0.2 + 3 × 0.1 = 0.5', cy, 'red', 3.6));
    s.alpha(s.win('second', 'use'), () => caption(s, '−0.4 + 3 × 0.1 = −0.1', cy, 'red', 3.6));
    s.alpha(s.ease('use', 0.6), () => caption(s, 'every step: 2 runs, with and without the prompt', cy, '--ink-2', 3.2));
  },
};

/** One bicycle: two wheels and a frame, in a color, centered on (cx, cy). */
function bike(s: Scene, cx: number, cy: number, b: Bike, a: number): void {
  const u = s.u;
  const r = b.r * u;
  const half = b.base * u;
  const c = s.ctx;
  s.alpha(a, () => {
    const lw = b.lw;
    s.circle(cx - half, cy + r * 0.2, r, { stroke: b.wheel, lw });
    s.circle(cx + half, cy + r * 0.2, r, { stroke: b.wheel, lw });
    const seat: [number, number] = [cx - half * 0.35, cy - r * 0.9];
    const head: [number, number] = [cx + half * 0.6, cy - r * 1.05];
    const crank: [number, number] = [cx, cy + r * 0.2];
    c.beginPath();
    c.moveTo(cx - half, cy + r * 0.2);
    c.lineTo(seat[0], seat[1]);
    c.lineTo(head[0], head[1]);
    c.lineTo(crank[0], crank[1]);
    c.lineTo(cx - half, cy + r * 0.2);
    c.moveTo(seat[0], seat[1]);
    c.lineTo(crank[0], crank[1]);
    c.moveTo(head[0], head[1]);
    c.lineTo(cx + half, cy + r * 0.2);
    c.strokeStyle = b.frame;
    c.lineWidth = lw * 1.5 * u;
    c.lineJoin = 'round';
    c.stroke();
    s.line(head[0] - 1 * u, head[1] - 0.6 * u, head[0] + 1.2 * u, head[1] - 1 * u, b.frame, lw * 1.3);
  });
}

interface Bike {
  r: number;
  base: number;
  frame: string;
  wheel: string;
  lw: number;
}

/** Three samples per guidance scale, from loose and varied to identical and saturated. */
function samples(s: Scene, w: number, k: number): Bike {
  const rng = new Rng(100 * w + k + 7);
  const jit = (amt: number) => (rng.next() - 0.5) * amt;
  const spread = w === 1 ? 1 : w === 3 ? 0.5 : w === 7.5 ? 0.15 : 0;
  const loose = w === 1 && k === 1;
  const hue = w === 1 ? (['red', 'blue', 'green'] as const)[k]! : 'red';
  const strength = w === 15 ? 1 : w === 7.5 ? 0.85 : 0.65;
  return {
    r: 3.4 + jit(1.6 * spread) + (loose ? 1 : 0),
    base: 4.6 + jit(2 * spread) + (loose ? -1.2 : 0),
    frame: w === 15 ? s.c('red') : s.tint(hue, strength),
    wheel: w === 15 ? s.c('--ink') : s.tint('--ink-2', 0.7 + 0.3 * strength),
    lw: w === 15 ? 0.55 : 0.35,
  };
}

const SCALES = [1, 3, 7.5, 15];

const scale: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, Math.min(25, (s.w / u - 12) / 4));
    const ys = [0.32, 0.5, 0.68].map((f) => s.h * f);
    const show = [s.ease('sweep', 0.6), s.ease('mid', 0.6), s.ease('big', 0.6)];
    const hi = [s.win('low', 'mid'), 0, s.win('mid', 'big'), s.win('big', 'trade')];
    SCALES.forEach((w, i) => {
      const a = i === 0 ? show[0]! : i === 3 ? show[2]! : show[1]!;
      s.alpha(a, () => {
        s.text(`w = ${w}`, xs[i]!, s.h * 0.14, { size: 3.6, font: 'mono', weight: 650, color: s.c(hi[i]! > 0.5 ? 'red' : '--ink-2') });
        ys.forEach((y, k) => bike(s, xs[i]!, y, samples(s, w, k), 1));
        s.rrect(xs[i]! - 11 * u, s.h * 0.21, 22 * u, s.h * 0.56, 1.4, { stroke: s.tint('red', 0.15 + 0.6 * hi[i]!), lw: 0.3 + 0.2 * hi[i]! });
      });
    });
    const o = { size: 3.4, weight: 600, halo: true } as const;
    const cy = s.h * 0.88;
    s.alpha(s.win('low', 'mid'), () => rich(s, [['w = 1: ', 'red'], ['varied, loosely on the prompt', '--ink-2']], s.w / 2, cy, o));
    s.alpha(s.win('mid', 'big'), () => rich(s, [['w ≈ 7: ', 'red'], ['closely on the prompt', '--ink-2']], s.w / 2, cy, o));
    s.alpha(s.win('big', 'trade'), () => rich(s, [['w = 15: ', 'red'], ['all alike, saturated', '--ink-2']], s.w / 2, cy, o));
    s.alpha(s.ease('trade', 0.6), () => caption(s, 'variety traded for the prompt', cy, '--ink-2', 3.4));
    cite(s, 'Ho & Salimans, 2021', s.win('big', 'trade'));
  },
};

export const scenes: Record<string, SceneDef> = { pull, free, push: pushScene, scale };
