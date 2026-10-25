import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { axes, clipped, curve, fmt, frame, type Frame } from '../draw';

const TOK = ['sure', 'thing', '!'];
const OLD = [0.2, 0.5, 0.4];
const NEW = [0.3, 0.45, 0.5];
const RHO = NEW.map((p, i) => p / OLD[i]!);
const ADV = [1, -1, 1];
const EPS = 0.2;

const ratio: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 26);
    const base = s.h * 0.5;
    const H = 40;
    const lx = xs[0]! - 13 * s.u;
    TOK.forEach((t, i) => s.cell(xs[i]! - 7 * s.u, s.h * 0.1 - 4 * s.u, 14 * s.u, 8 * s.u, t, 'purple', { on: i === 0 ? s.win('eg', 'obj') : 0, size: 3.4 }));
    s.line(xs[0]! - 11 * s.u, base, xs[2]! + 11 * s.u, base, s.c('--axis'), 0.35);
    const nw = s.ease('old', 0.8, 0.8);
    xs.forEach((x, i) => {
      const bar = (dx: number, v: number, k: 'teal' | 'slate', a: number) =>
        s.alpha(a, () => {
          const hh = v * H * s.u;
          s.rrect(x + dx - 3.6 * s.u, base - hh, 7.2 * s.u, hh, 0.8, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.9), lw: 0.25 });
          s.text(v.toFixed(2), x + dx, base - hh - 2.8 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
        });
      bar(-4.4 * s.u * nw, OLD[i]!, 'slate', 1);
      bar(4.4 * s.u, NEW[i]!, 'teal', nw);
    });
    rowLabel(s, 'π_old', lx, base - 14 * s.u, 'slate', 3);
    s.alpha(nw, () => rowLabel(s, 'π', lx, base - 7 * s.u, 'teal', 3.6));
    const r = s.ease('rho', 0.6, 0.6);
    s.alpha(r, () => {
      rowLabel(s, 'ρ', lx, base + 8 * s.u, 'orange', 3.6);
      cells(s, xs, base + 8 * s.u, RHO.map((v) => fmt(v)), 'orange', { w: 12, h: 7, on: [s.win('eg', 'obj'), 0, 0] });
    });
    s.alpha(s.win('eg', 'obj'), () => s.text('0.3 / 0.2 = 1.5', s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') }));
    s.alpha(s.ease('obj', 0.6), () => {
      rowLabel(s, 'A', lx, base + 17 * s.u, 'red', 3.6);
      cells(s, xs, base + 17 * s.u, ADV.map((v) => (v > 0 ? '+1' : '−1')), 'red', { w: 12, h: 7 });
      rowLabel(s, 'ρA', lx, base + 26 * s.u, '--ink-2', 3.4);
      cells(s, xs, base + 26 * s.u, RHO.map((v, i) => fmt(v * ADV[i]!)), 'slate', { w: 12, h: 7, on: [1, 1, 1] });
    });
  },
};

/** min(ρA, clip(ρ)A) for an advantage A. */
const clipObj = (a: number) => (r: number) => Math.min(r * a, Math.min(1 + EPS, Math.max(1 - EPS, r)) * a);

/** One objective-versus-ratio panel; `hot` lights its flat part, `wrong` its still-sloped tail. */
function panel(s: Scene, F: Frame, a: number, o: { band: number; line: number; hot: number; wrong: number }): void {
  axes(s, F, 'ρ', '', { x: 'orange', y: 'red' });
  // Named in the corner its lines stay clear of.
  s.text(a > 0 ? 'A = +1' : 'A = −1', a > 0 ? F.l + 2 * s.u : F.r, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: a > 0 ? 'left' : 'right', color: s.c('red') });
  s.alpha(o.band, () => {
    s.rrect(F.X(1 - EPS), F.t, F.X(1 + EPS) - F.X(1 - EPS), F.b - F.t, 0, { fill: s.tint('orange', 0.1) });
    [1 - EPS, 1 + EPS].forEach((v) => s.text(v.toFixed(1), F.X(v), F.b + 3.2 * s.u, { size: 2.8, font: 'mono', color: s.c('orange') }));
  });
  curve(s, F, (r) => r * a, 0.4, 1.8, '--ink-3', { dash: [1.2, 1], width: 0.4 });
  s.alpha(o.line, () => curve(s, F, clipObj(a), 0.4, 1.8, 'red', { width: 0.7, upto: o.line }));
  // Where the minimum is flat: past 1 + ε for A > 0, below 1 - ε for A < 0.
  const [f0, f1] = a > 0 ? [1 + EPS, 1.8] : [0.4, 1 - EPS];
  s.alpha(o.hot, () => clipped(s, F, () => s.line(F.X(f0), F.Y(clipObj(a)(f0)), F.X(f1), F.Y(clipObj(a)(f1)), s.c('green'), 1.4)));
  const [w0, w1] = a > 0 ? [0.4, 1 - EPS] : [1 + EPS, 1.8];
  s.alpha(o.wrong, () => clipped(s, F, () => s.line(F.X(w0), F.Y(clipObj(a)(w0)), F.X(w1), F.Y(clipObj(a)(w1)), s.c('orange'), 1.4)));
}

const clip: SceneDef = {
  draw(s) {
    const l = s.w / 2 - 34 * s.u;
    const r = s.w / 2 + 34 * s.u;
    const top = frame(l, s.h * 0.08, r, s.h * 0.4, [0.4, 1.8], [0.3, 1.9]);
    const bot = frame(l, s.h * 0.52, r, s.h * 0.84, [0.4, 1.8], [-1.9, -0.3]);
    const band = s.ease('clip', 0.6);
    const line = s.ease('min', 1.2);
    const wrong = s.win('wrong', 'why');
    panel(s, top, 1, { band, line, hot: s.win('pos', 'wrong'), wrong });
    panel(s, bot, -1, { band, line, hot: s.win('neg', 'wrong'), wrong });
    s.alpha(s.win('trust', 'clip'), () => s.text('far from ρ = 1: the samples say little', s.w / 2, s.h * 0.93, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.win('pos', 'neg'), () => s.text('A > 0: flat past 1.2, no push', s.w / 2, s.h * 0.93, { size: 3.2, color: s.c('green') }));
    s.alpha(s.win('neg', 'wrong'), () => s.text('A < 0: flat below 0.8, no push', s.w / 2, s.h * 0.93, { size: 3.2, color: s.c('green') }));
    s.alpha(s.win('wrong', 'why'), () => s.text('moved the wrong way: still pulled back', s.w / 2, s.h * 0.93, { size: 3.2, color: s.c('orange') }));
    s.alpha(s.ease('why', 0.6), () => s.text('one batch, several safe updates', s.w / 2, s.h * 0.93, { size: 3.2, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { ratio, clip };
