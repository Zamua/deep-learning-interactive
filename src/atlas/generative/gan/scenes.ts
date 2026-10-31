import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { block, caption, Frame, rich, shades, stroke } from '../draw';

/** A handwritten-looking digit on a 14 by 14 grid: the darkest of one or more pen strokes. */
const glyph = (...lines: [number, number][][]): number[][] => {
  const parts = lines.map((l) => stroke(14, l, 0.95));
  return parts[0]!.map((r, i) => r.map((_, j) => Math.max(...parts.map((p) => p[i]![j]!))));
};
const ring = (cx: number, cy: number, rx: number, ry: number): [number, number][] =>
  Array.from({ length: 17 }, (_, i) => [cx + rx * Math.sin((i / 16) * 2 * Math.PI), cy - ry * Math.cos((i / 16) * 2 * Math.PI)]);
const DIGITS: Record<string, number[][]> = {
  '0': glyph(ring(7, 7.5, 3, 4.2)),
  '1': glyph([[5, 5], [7.5, 3], [7.5, 11.5]]),
  '3': glyph([[4, 3.5], [9.5, 4], [6.5, 7.2], [9.8, 9.2], [7.5, 11.6], [4, 11]]),
  '4': glyph([[9, 11.5], [9, 3], [3.5, 8.5], [11, 8.5]]),
  '7': glyph([[3.5, 3.5], [10.5, 3.5], [5.5, 11.5]]),
  '9': glyph([[9.5, 6], [7, 3.2], [4.5, 5.5], [6.5, 8], [9.5, 6], [9, 11.5]]),
};
const REAL = DIGITS['3']!;
const rng = new Rng(11);
/** A smudgy fake: a wobbly 7 plus noise. */
const FAKE = stroke(14, [[4, 4.5], [9.5, 3], [7.5, 8], [6, 11]], 1.2).map((r) => r.map((v) => Math.max(0, Math.min(1, 0.75 * v + 0.25 * rng.next()))));
const NOISE = Array.from({ length: 6 }, () => [rng.randn()]);

/** Eased in from `f` of the way through beat `id`, so a picture lands when the voice reaches it. */
const late = (s: Scene, id: string, f: number, dur = 0.6) => s.ease(id, dur, f * (s.end(id) - s.at(id)));

const pic = (s: Scene, x: number, y: number, img: number[][], px = 0.95) => shades(s, x, y, px, img, '--ink', { lo: 0, hi: 1 });

/** A block whose label crossfades from a plain word to its letter on beat `at`. */
function named(s: Scene, x: number, y: number, word: string, letter: string, k: Ink, at: string, on: number): void {
  const swap = s.ease(at, 0.6);
  s.alpha(1 - swap, () => block(s, x, y, 14, 10, word, k, { size: 3.4, on }));
  s.alpha(swap, () => block(s, x, y, 14, 10, letter, k, { size: 4.4, on }));
}

// ---- the idea: a network that draws needs a loss, and a second network becomes the judge

const idea: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const yT = s.h * 0.3;
    const yB = s.h * 0.62;
    const yD = (yT + yB) / 2;
    const o = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    const pipe = s.ease('z', 0.6);
    // The goal: digits like these, but new.
    s.alpha(1 - pipe, () => {
      ['3', '1', '7', '0'].forEach((d, i) => pic(s, s.w / 2 + (i - 1.5) * 18 * u, s.h * 0.4, DIGITS[d]!, 1.05));
      caption(s, 'real digits: draw new ones like these', s.h * 0.62, '--ink-2', 3.2);
    });
    s.alpha(pipe, () => {
      shades(s, X(0.1), yT, 2, NOISE, 'slate', { lo: -2, hi: 2 });
      s.text('z', X(0.1), yT - 9 * u, { ...o, color: s.c('slate') });
      s.arrow(X(0.1) + 3 * u, yT, X(0.3) - 9 * u, yT, s.c('--ink-3'), 0.35, 2);
      named(s, X(0.3), yT, 'network', 'G', 'green', 'G', s.win('G', 'D'));
      s.arrow(X(0.3) + 9 * u, yT, X(0.5) - 8 * u, yT, s.c('--ink-3'), 0.35, 2);
      pic(s, X(0.5), yT, FAKE);
      s.text('a new picture', X(0.5), yT - 10 * u, { ...o, color: s.c('green') });
    });
    s.alpha(s.win('z', 'stuck'), () => caption(s, 'a new z: a new picture', s.h * 0.86, 'green', 3.4));
    s.alpha(s.win('stuck', 'judge'), () => {
      s.text('loss = ?', X(0.5), yT + 11 * u, { ...o, size: 3.6, color: s.c('red') });
      caption(s, 'no right answer to compare with', s.h * 0.86, 'red', 3.2);
    });
    const dA = s.ease('judge', 0.6);
    s.alpha(dA, () => {
      pic(s, X(0.5), yB, REAL);
      s.text('real x', X(0.5), yB + 10.5 * u, { ...o, color: s.c('orange') });
      s.arrow(X(0.5) + 8 * u, yT, X(0.72) - 9 * u, yD - 2 * u, s.c('--ink-3'), 0.35, 2);
      s.arrow(X(0.5) + 8 * u, yB, X(0.72) - 9 * u, yD + 2 * u, s.c('--ink-3'), 0.35, 2);
      named(s, X(0.72), yD, 'judge', 'D', 'red', 'D', s.win('D', 'name'));
      s.arrow(X(0.72) + 9 * u, yD, X(0.82), yD, s.c('--ink-3'), 0.35, 2);
      s.text('real?', X(0.83), yD - 3 * u, { ...o, align: 'left', color: s.c('red') });
      s.text('0 to 1', X(0.83), yD + 2.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.win('police', 'G'), () => {
      s.text('counterfeiters', X(0.3), yT + 8.5 * u, { ...o, size: 3, color: s.c('green') });
      s.text('police', X(0.72), yD + 8.5 * u, { ...o, size: 3, color: s.c('red') });
      caption(s, 'the contest drives both to improve', s.h * 0.86, '--ink-2', 3.2);
    });
    s.alpha(s.win('G', 'D'), () => caption(s, 'G: the generator', s.h * 0.86, 'green', 3.6));
    s.alpha(s.win('D', 'name'), () => caption(s, 'D: the discriminator, P(real)', s.h * 0.86, 'red', 3.6));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'generative adversarial network: GAN', s.h * 0.86, '--ink-2', 3.4));
    cite(s, 'Goodfellow et al., 2014', s.win('judge', 'G'));
  },
};

// ---- the discriminator's step: a binary classifier trained with cross-entropy

/** One row of the discriminator's table: image, D's output, label, loss. */
function row(s: Scene, y: number, img: number[][], name: string, d: string, label: string, loss: string, a: { d: number; loss: number }, ink: 'orange' | 'green'): void {
  const X = (f: number) => s.w * f;
  pic(s, X(0.14), y, img, 0.8);
  s.text(name, X(0.14), y + 9 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(ink) });
  s.alpha(a.d, () => s.text(d, X(0.37), y, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
  s.text(label, X(0.58), y, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2') });
  s.alpha(a.loss, () => s.text(loss, X(0.81), y, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') }));
}

const dstep: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const table = s.ease('labels', 0.6);
    // Two classes, and one number for both.
    s.alpha(1 - table, () => {
      const y = s.h * 0.24;
      pic(s, X(0.22), y, FAKE, 0.8);
      s.arrow(X(0.22) + 7 * u, y, X(0.45) - 8 * u, y, s.c('--ink-3'), 0.35, 2);
      block(s, X(0.45), y, 12, 9, 'D', 'red', { size: 4 });
      s.arrow(X(0.45) + 7 * u, y - 1.5 * u, X(0.68) - 2 * u, y - 7 * u, s.c('--ink-3'), 0.35, 2);
      s.arrow(X(0.45) + 7 * u, y + 1.5 * u, X(0.68) - 2 * u, y + 7 * u, s.c('--ink-3'), 0.35, 2);
      const cls = { size: 3.4, font: 'mono', weight: 650, align: 'left', halo: true } as const;
      s.text('real', X(0.68), y - 8 * u, { ...cls, color: s.c('orange') });
      s.text('fake', X(0.68), y + 8 * u, { ...cls, color: s.c('green') });
      s.alpha(s.win('binary', 'one'), () => caption(s, 'two classes: a binary classifier', s.h * 0.86, '--ink-2', 3.4));
      const one = s.ease('one', 0.6);
      s.alpha(one, () => {
        const x0 = X(0.12);
        const x1 = X(0.88);
        const by = s.h * 0.56;
        const p = 0.8;
        const xp = x0 + (x1 - x0) * p * s.ease('one', 1.2, 0.8);
        s.rrect(x0, by - 2.5 * u, xp - x0, 5 * u, 0.8, { fill: s.tint('orange', 0.35) });
        s.rrect(xp, by - 2.5 * u, x1 - xp, 5 * u, 0.8, { fill: s.tint('green', 0.3) });
        s.text('0', x0, by + 6 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('1', x1, by + 6 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('P(real) = p', (x0 + xp) / 2, by - 6 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('orange') });
        s.text('1 − p', (xp + x1) / 2, by - 6 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('green') });
        caption(s, 'a sigmoid gives p; fake gets the rest', s.h * 0.86, '--ink-2', 3.4);
      });
    });
    s.alpha(table, () => {
      const head = { size: 3.2, font: 'mono', color: s.c('--ink-3') } as const;
      const y0 = s.h * 0.12;
      s.text('image', X(0.14), y0, head);
      s.text('D(image)', X(0.37), y0, head);
      s.text('label', X(0.58), y0, head);
      s.text('loss', X(0.81), y0, head);
      s.line(X(0.05), y0 + 3.5 * u, X(0.95), y0 + 3.5 * u, s.c('--axis'), 0.3);
      row(s, s.h * 0.3, REAL, 'real', '0.8', '1', '−ln 0.8 = 0.22', { d: s.ease('real', 0.6), loss: late(s, 'real', 0.65) }, 'orange');
      row(s, s.h * 0.55, FAKE, 'fake', '0.3', '0', '−ln 0.7 = 0.36', { d: s.ease('fake', 0.6), loss: s.ease('fakeloss', 0.6, 0.5) }, 'green');
      s.alpha(late(s, 'fake', 0.5), () => s.text('fake: 1 − 0.3 = 0.7', X(0.58), s.h * 0.55 + 6 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      s.alpha(s.win('labels', 'real'), () => caption(s, 'label: 1 for real, 0 for fake', s.h * 0.86, '--ink-2', 3.4));
      s.alpha(s.ease('sum', 0.6), () => {
        rich(s, [['D\'s loss = 0.22 + 0.36 = ', '--ink-2'], ['0.58', 'red']], s.w / 2, s.h * 0.75, { size: 3.8, weight: 650, halo: true });
        caption(s, 'step D: real up, fake down; G fixed', s.h * 0.88, 'red', 3.4);
      });
    });
  },
};

// ---- the generator's step: labeled real, and why not the other loss

const sig = (a: number) => 1 / (1 + Math.exp(-a));
/** D's loss on a fake, −ln(1 − D), and G's loss, −ln D, against D's score before its sigmoid. */
const lossFake = (a: number) => -Math.log(1 - sig(a));
const lossG = (a: number) => -Math.log(sig(a));

const gstep: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.14;
    const back = s.ease('back', 0.6);
    block(s, X(0.16), y, 12, 9, 'G', 'green', { size: 4, on: back });
    s.arrow(X(0.16) + 7 * u, y, X(0.38) - 7 * u, y, s.c('--ink-3'), 0.35, 2);
    pic(s, X(0.38), y, FAKE, 0.8);
    s.arrow(X(0.38) + 7 * u, y, X(0.6) - 7 * u, y, s.c('--ink-3'), 0.35, 2);
    block(s, X(0.6), y, 12, 9, 'D', 'red', { size: 4 });
    s.arrow(X(0.6) + 7 * u, y, X(0.74), y, s.c('--ink-3'), 0.35, 2);
    s.text('0.3', X(0.75), y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    const plot = s.win('whynot', 'back');
    const o = { size: 3.6, weight: 650, halo: true } as const;
    const gone = 1 - s.ease('whynot', 0.6);
    s.alpha(s.ease('flip', 0.6, 1) * gone, () => rich(s, [['label it real: ', '--ink-2'], ['−ln D(G(z))', 'green']], s.w / 2, s.h * 0.33, o));
    s.alpha(s.ease('gnum', 0.6) * gone, () => rich(s, [['−ln 0.3 ≈ ', '--ink-2'], ['1.20', 'green']], s.w / 2, s.h * 0.42, o));
    // The two losses against D's raw score: where D is sure a fake is fake, only −ln D still has a slope.
    s.alpha(plot, () => {
      const F = new Frame(s, X(0.5) - Math.min(42 * u, s.w * 0.4), s.h * 0.32, X(0.5) + Math.min(42 * u, s.w * 0.4), s.h * 0.78, [-6, 3], [-0.4, 6.4]);
      const fl = s.ease('flat', 0.6);
      s.alpha(fl, () => s.rrect(F.X(-6), F.t, F.X(-3) - F.X(-6), F.b - F.t, 0, { fill: s.tint('red', 0.07) }));
      F.axes();
      s.text('D\'s score, before the sigmoid →', F.r, F.Y(0) + 4 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      F.fn(lossFake, 'red', { width: 0.6 });
      const key = { size: 3, font: 'mono', weight: 650, align: 'right', halo: true } as const;
      s.text('D\'s loss on the fake', F.r, F.t + 2 * u, { ...key, color: s.c('red') });
      s.alpha(s.ease('whynot', 0.6, 3), () => {
        s.text('D sure: fake', F.X(-4.5), F.Y(1.4), { size: 3, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      });
      s.alpha(fl, () => {
        s.text('flat', F.X(-4.5), F.Y(0) - 3 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
        F.fn(lossG, 'green', { width: 0.6, to: -6 + 9 * s.ease('flat', 1.4, 2) });
        s.alpha(s.ease('flat', 0.6, 3.4), () => s.text('−ln D: steady slope', F.r, F.t + 6.5 * u, { ...key, color: s.c('green') }));
      });
    });
    cite(s, 'Goodfellow et al., 2014', plot);
    // The gradient runs back through D into G; a real image's score does not move.
    s.alpha(back * (1 - s.ease('alternate', 0.6)), () => {
      const yb = y + 8.5 * u;
      const c = s.ctx;
      c.beginPath();
      c.moveTo(X(0.6), yb);
      c.quadraticCurveTo(X(0.38), yb + 7 * u, X(0.16) + 2 * u, yb);
      c.strokeStyle = s.c('green');
      c.lineWidth = 0.45 * u;
      c.setLineDash([1.2 * u, 0.9 * u]);
      c.stroke();
      c.setLineDash([]);
      s.arrow(X(0.16) + 4 * u, yb + 1.2 * u, X(0.16) + 2 * u, yb, s.c('green'), 0.45, 2);
      s.text('gradient', X(0.38), yb + 8 * u, { size: 3, font: 'mono', color: s.c('green'), halo: true });
      s.text('fixed', X(0.6), y - 7.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      const yr = s.h * 0.52;
      pic(s, X(0.38), yr, REAL, 0.8);
      s.text('real x', X(0.38) - 8 * u, yr, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
      s.arrow(X(0.38) + 7 * u, yr, X(0.6) - 7 * u, yr, s.c('--ink-3'), 0.35, 2);
      block(s, X(0.6), yr, 12, 9, 'D', 'red', { size: 4 });
      s.arrow(X(0.6) + 7 * u, yr, X(0.74), yr, s.c('--ink-3'), 0.35, 2);
      s.text('0.8', X(0.75), yr, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      s.text('stays put', X(0.75), yr + 5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      caption(s, 'step G only: its fakes move', s.h * 0.86, 'green', 3.4);
    });
    s.alpha(s.ease('alternate', 0.6), () => {
      ['D', 'G', 'D', 'G', 'D', 'G'].forEach((k, i) => {
        const x = s.w / 2 + (i - 2.5) * 10 * u;
        const on = s.ease('alternate', 0.3, 0.3 + i * 0.4);
        block(s, x, s.h * 0.5, 7, 6, k, k === 'D' ? 'red' : 'green', { size: 3.4, on });
      });
      caption(s, 'one step each, in turn', s.h * 0.86, '--ink-2', 3.4);
    });
  },
};

// ---- mode collapse: ten peaks in the data, one in what G draws

/** How often each kind of drawing turns up: one bump per digit, at k + 0.5. */
const HEIGHTS = [0.95, 1, 0.9, 1, 0.92, 0.88, 0.97, 1, 0.9, 0.94];
const density = (x: number) => HEIGHTS.reduce((t, h, k) => t + h * Math.exp(-((x - k - 0.5) ** 2) / (2 * 0.16 ** 2)), 0);
const spike = (x: number) => 1.85 * Math.exp(-((x - 7.5) ** 2) / (2 * 0.1 ** 2));
const VARIED = ['3', '1', '7', '0', '4', '9'];

const collapse: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = new Frame(s, s.w / 2 - Math.min(44 * u, s.w * 0.42), s.h * 0.08, s.w / 2 + Math.min(44 * u, s.w * 0.42), s.h * 0.4, [0, 10], [0, 2.4]);
    const name = s.ease('name', 0.8);
    F.axes();
    F.fn(density, 'orange', { width: 0.5, fill: 0.15, to: 10 * s.ease('modes', 1.6, 0.4) });
    for (let k = 0; k < 10; k++) s.text(String(k), F.X(k + 0.5), F.b + 3.2 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('real digits', F.l, F.t + 1 * u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true });
    s.alpha(s.ease('modes', 0.6, 4), () => s.text('ten peaks: ten modes', F.r, F.t + 1 * u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('orange'), halo: true }));
    s.alpha(name, () => {
      F.fn(spike, 'red', { width: 0.6, fill: 0.2, from: 6.8, to: 8.2 });
      s.text('G: one peak', F.X(7.5) + 3 * u, F.Y(1.7), { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    // Six different z: what a healthy G draws, and what a collapsed one draws.
    const gl = s.ease('one', 0.6);
    s.alpha(gl, () => {
      const xs = VARIED.map((_, i) => s.w / 2 + (i - 2.5) * 13 * u + 6 * u);
      const lx = xs[0]! - 8 * u;
      const lab = { size: 3, font: 'mono', weight: 650, align: 'right' } as const;
      const yw = s.h * 0.57;
      const yc = s.h * 0.74;
      s.text('wanted', lx, yw, { ...lab, color: s.c('green') });
      VARIED.forEach((d, i) => pic(s, xs[i]!, yw, DIGITS[d]!, 0.75));
      s.text('collapsed', lx, yc, { ...lab, color: s.c('red') });
      VARIED.forEach((_, i) => s.alpha(s.ease('one', 0.4, 2 + i * 0.35), () => pic(s, xs[i]!, yc, DIGITS['7']!, 0.75)));
    });
    s.alpha(s.ease('modes', 0.6) * (1 - gl), () => caption(s, 'the most common value: the mode', s.h * 0.88, 'orange', 3.4));
    s.alpha(gl * (1 - name), () => caption(s, 'six different z, the same 7', s.h * 0.88, 'red', 3.4));
    s.alpha(name * (1 - s.ease('warned', 0.6)), () => caption(s, 'all on one mode: mode collapse', s.h * 0.88, 'red', 3.4));
    s.alpha(s.ease('warned', 0.6), () => caption(s, 'G trained too long against a fixed D', s.h * 0.88, '--ink-2', 3.2));
    cite(s, 'Goodfellow et al., 2014', s.ease('warned', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { idea, dstep, gstep, collapse };
