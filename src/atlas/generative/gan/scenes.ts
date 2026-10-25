import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, rich, shades, stroke } from '../draw';

const REAL = stroke(14, [[3.5, 3.5], [10.5, 3.5], [5.5, 11.5]], 0.9);
const rng = new Rng(11);
/** A smudgy fake: a wobbly 7 plus noise. */
const FAKE = stroke(14, [[4, 4.5], [9.5, 3], [7.5, 8], [6, 11]], 1.2).map((r) => r.map((v) => Math.max(0, Math.min(1, 0.75 * v + 0.25 * rng.next()))));
const NOISE = Array.from({ length: 6 }, () => [rng.randn()]);

const players: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const yT = s.h * 0.3;
    const yB = s.h * 0.62;
    const yD = (yT + yB) / 2;
    const o = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    shades(s, X(0.1), yT, 2, NOISE, 'slate', { lo: -2, hi: 2 });
    s.text('z', X(0.1), yT - 9 * u, { ...o, color: s.c('slate') });
    s.arrow(X(0.1) + 3 * u, yT, X(0.3) - 9 * u, yT, s.c('--ink-3'), 0.35, 2);
    block(s, X(0.3), yT, 14, 10, 'G', 'green', { size: 4.4, on: s.win('gen', 'disc') });
    s.arrow(X(0.3) + 8 * u, yT, X(0.5) - 8 * u, yT, s.c('--ink-3'), 0.35, 2);
    shades(s, X(0.5), yT, 0.95, FAKE, '--ink', { lo: 0, hi: 1 });
    s.text('fake', X(0.5), yT - 10 * u, { ...o, color: s.c('green') });
    const dA = s.ease('disc', 0.6);
    s.alpha(dA, () => {
      shades(s, X(0.5), yB, 0.95, REAL, '--ink', { lo: 0, hi: 1 });
      s.text('real x', X(0.5), yB + 10.5 * u, { ...o, color: s.c('orange') });
      s.arrow(X(0.5) + 8 * u, yT, X(0.72) - 8 * u, yD - 2 * u, s.c('--ink-3'), 0.35, 2);
      s.arrow(X(0.5) + 8 * u, yB, X(0.72) - 8 * u, yD + 2 * u, s.c('--ink-3'), 0.35, 2);
      block(s, X(0.72), yD, 14, 10, 'D', 'red', { size: 4.4, on: s.win('disc', 'game') });
      s.arrow(X(0.72) + 8 * u, yD, X(0.82), yD, s.c('--ink-3'), 0.35, 2);
      s.text('real?', X(0.83), yD - 4 * u, { ...o, align: 'left', color: s.c('red') });
      s.text('0 to 1', X(0.83), yD + 2 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('game', 0.6), () => {
      caption(s, 'D: tell real from fake', s.h * 0.82, 'red', 3.6);
      caption(s, 'G: make fakes D calls real', s.h * 0.9, 'green', 3.6);
    });
  },
};

/** One row of the discriminator's table: image, D's output, label, loss. */
function row(s: Scene, y: number, img: number[][], name: string, d: string, label: string, loss: string, a: { d: number; loss: number }, ink: 'orange' | 'green'): void {
  const X = (f: number) => s.w * f;
  shades(s, X(0.14), y, 0.8, img, '--ink', { lo: 0, hi: 1 });
  s.text(name, X(0.14), y + 9 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(ink) });
  s.alpha(a.d, () => s.text(d, X(0.37), y, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
  s.text(label, X(0.58), y, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2') });
  s.alpha(a.loss, () => s.text(loss, X(0.81), y, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') }));
}

const dstep: SceneDef = {
  draw(s) {
    const X = (f: number) => s.w * f;
    const head = { size: 3.2, font: 'mono', color: s.c('--ink-3') } as const;
    const y0 = s.h * 0.12;
    s.text('image', X(0.14), y0, head);
    s.text('D(image)', X(0.37), y0, head);
    s.text('label', X(0.58), y0, head);
    s.text('loss', X(0.81), y0, head);
    s.line(X(0.05), y0 + 3.5 * s.u, X(0.95), y0 + 3.5 * s.u, s.c('--axis'), 0.3);
    row(s, s.h * 0.3, REAL, 'real', '0.8', '1', '−ln 0.8 = 0.22', { d: s.ease('real', 0.6), loss: s.ease('real', 0.6, 2.5) }, 'orange');
    row(s, s.h * 0.55, FAKE, 'fake', '0.3', '0', '−ln 0.7 = 0.36', { d: s.ease('fake', 0.6), loss: s.ease('fake', 0.6, 4.5) }, 'green');
    s.alpha(s.ease('fake', 0.6, 2.5), () => s.text('fake: 1 − 0.3 = 0.7', X(0.58), s.h * 0.55 + 6 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('sum', 0.6), () => {
      rich(s, [['D\'s loss = 0.22 + 0.36 = ', '--ink-2'], ['0.58', 'red']], s.w / 2, s.h * 0.75, { size: 3.8, weight: 650, halo: true });
      caption(s, 'step D: real up, fake down; G fixed', s.h * 0.88, 'red', 3.4);
    });
  },
};

/** What G draws for six different z: varied when healthy, one shape when collapsed. */
const VARIED = ['3', '1', '7', '0', '4', '9'];

const gstep: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.18;
    const back = s.ease('back', 0.6);
    block(s, X(0.16), y, 12, 9, 'G', 'green', { size: 4, on: back });
    s.arrow(X(0.16) + 7 * u, y, X(0.38) - 7 * u, y, s.c('--ink-3'), 0.35, 2);
    shades(s, X(0.38), y, 0.8, FAKE, '--ink', { lo: 0, hi: 1 });
    s.arrow(X(0.38) + 7 * u, y, X(0.6) - 7 * u, y, s.c('--ink-3'), 0.35, 2);
    block(s, X(0.6), y, 12, 9, 'D', 'red', { size: 4 });
    s.arrow(X(0.6) + 7 * u, y, X(0.74), y, s.c('--ink-3'), 0.35, 2);
    s.text('0.3', X(0.75), y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    const fl = s.ease('flip', 0.6, 0.8);
    s.alpha(fl, () => rich(s, [['label it real: ', '--ink-2'], ['−ln 0.3 = 1.20', 'green']], s.w / 2, s.h * 0.43, { size: 3.6, weight: 650, halo: true }));
    s.alpha(back, () => {
      const yb = y + 8.5 * u;
      s.ctx.beginPath();
      s.ctx.moveTo(X(0.6), yb);
      s.ctx.quadraticCurveTo(X(0.38), yb + 7 * u, X(0.16) + 2 * u, yb);
      s.ctx.strokeStyle = s.c('green');
      s.ctx.lineWidth = 0.45 * u;
      s.ctx.setLineDash([1.2 * u, 0.9 * u]);
      s.ctx.stroke();
      s.ctx.setLineDash([]);
      s.arrow(X(0.16) + 4 * u, yb + 1.2 * u, X(0.16) + 2 * u, yb, s.c('green'), 0.45, 2);
      s.text('gradient', X(0.38), yb + 8 * u, { size: 3, font: 'mono', color: s.c('green'), halo: true });
      s.text('fixed', X(0.6), y - 7.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    const al = s.ease('alternate', 0.6);
    s.alpha(al, () => {
      const steps = ['D', 'G', 'D', 'G', 'D', 'G'];
      steps.forEach((k, i) => {
        const x = s.w / 2 + (i - 2.5) * 9 * u;
        const on = s.ease('alternate', 0.3, 0.3 + i * 0.4);
        block(s, x, s.h * 0.56, 7, 6, k, k === 'D' ? 'red' : 'green', { size: 3.4, on });
      });
    });
    const col = s.ease('collapse', 0.6);
    s.alpha(col, () => {
      const glyph = (x: number, yy: number, ch: string, k: 'green' | 'red') => {
        s.rrect(x - 4 * u, yy - 4.5 * u, 8 * u, 9 * u, 1, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.5), lw: 0.25 });
        s.text(ch, x, yy + 0.4 * u, { size: 6, font: 'mono', weight: 600, color: s.c('--ink') });
      };
      const xs = VARIED.map((_, i) => s.w / 2 + (i - 2.5) * 10 * u + 8 * u);
      const lx = xs[0]! - 7 * u;
      s.text('wanted', lx, s.h * 0.7, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
      VARIED.forEach((d, i) => glyph(xs[i]!, s.h * 0.7, d, 'green'));
      s.text('collapsed', lx, s.h * 0.82, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('red') });
      VARIED.forEach((_, i) => s.alpha(s.ease('collapse', 0.4, 1.5 + i * 0.2), () => glyph(xs[i]!, s.h * 0.82, '7', 'red')));
      caption(s, 'six different z, one output: mode collapse', s.h * 0.94, 'red', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { players, dstep, gstep };
