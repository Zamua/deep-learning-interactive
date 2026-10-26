import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, downArrows, rowLabel } from '../../draw';

const S = [1.8, 1.1, 0];
const P = [0.6, 0.3, 0.1];
const Y = 1;
const G = P.map((p, i) => p - (i === Y ? 1 : 0));
/** Nearly all the probability on the correct option: what `done` morphs the probabilities to. */
const DONE_P = [0.02, 0.97, 0.01];
const f1 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(Math.abs(v) < 0.1 ? 2 : 1));
/** What a 0.01 nudge to each score does to the loss, 1.208 before it. */
const NUDGE = ['L + 0.006', 'L − 0.007', 'L + 0.001'];
const PAT = ['p0', 'p1 − 1', 'p2'];

/** Three columns and a label x to their left, for rows of cells. */
function grid(s: Scene) {
  const gap = s.tall ? 24 : 22;
  const xs = columns(s, 3, gap);
  return { xs, lx: xs[0]! - (gap / 2 + 4) * s.u };
}

/** Eased in `frac` of the way through beat `id`, so a value lands as the voice says it. */
const lateIn = (s: Scene, id: string, frac: number) => s.ease(id, 0.6, frac * (s.end(id) - s.at(id)));

const mono = (s: Scene, t: string, x: number, y: number, k: Parameters<Scene['c']>[0], size = 3.6, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

const setup: SceneDef = {
  draw(s) {
    const { xs, lx } = grid(s);
    const ys = s.h * 0.11;
    const yp = s.h * 0.3;
    const yl = s.h * 0.44;
    const yg = s.h * 0.87;
    const late = (id: string, frac: number) => lateIn(s, id, frac);
    // Each score's measured line, then its slope landing in ds: s0 in `nudge`, s1 and s2 in `others`.
    const line = [late('nudge', 0.3), late('others', 0.12), late('others', 0.6)];
    const meas = [late('nudge', 0.78), late('others', 0.42), late('others', 0.85)];
    const nudging = s.win('nudge', 'others');
    rowLabel(s, 's', lx, ys, 'purple');
    cells(s, xs, ys, S.map((v, i) => (i === 0 && nudging > 0.5 ? '1.81' : v.toFixed(1))), 'purple', { on: [nudging, 0, 0] });
    s.alpha(s.ease('chain', 0.6, 1), () => {
      downArrows(s, xs, ys + 6 * s.u, yp - 6 * s.u);
      rowLabel(s, 'p', lx, yp, 'teal');
      cells(s, xs, yp, P.map(f1), 'teal', { on: [0, 1, 0] });
      s.text(`y = ${Y}`, xs[2]! + 10 * s.u, yp, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('chain', 0.6, 4), () => {
      const t = nudging > 0.5 ? 'L = −log p[1] ≈ 1.208 → 1.214' : `L = −log p[1] ≈ ${s.since('nudge') >= 0 ? '1.208' : '1.2'}`;
      mono(s, t, s.w / 2, yl, 'red', 3.8);
    });
    // The measured slopes, one line per score.
    const ty = [0.54, 0.61, 0.68].map((f) => s.h * f);
    line.forEach((a, i) =>
      s.alpha(a, () => {
        mono(s, `s${i} + 0.01:`, s.w / 2 - 2 * s.u, ty[i]!, 'purple', 3.4, 'right');
        mono(s, NUDGE[i]!, s.w / 2 + 1 * s.u, ty[i]!, '--ink-2', 3.4, 'left');
        s.alpha(meas[i]!, () => mono(s, `slope ${f1(G[i]!)}`, s.w / 2 + 22 * s.u, ty[i]!, 'red', 3.4, 'left'));
      }),
    );
    s.alpha(s.ease('ask', 0.6), () => {
      rowLabel(s, 'ds', lx, yg, 'red');
      cells(s, xs, yg, G.map((v, i) => (meas[i]! > 0.5 ? f1(v) : '?')), 'red', { on: meas });
    });
    // The pattern: each slope against its probability.
    s.alpha(s.ease('pattern', 0.6, 0.4), () => {
      xs.forEach((x, i) => mono(s, `= ${PAT[i]}`, x, yg - 7.6 * s.u, i === Y ? 'gold' : 'teal', 3.2));
    });
  },
};

const bars: SceneDef = {
  marks: {
    g: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms} = \symp - \mathrm{onehot}(\symy)`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const { xs, lx } = grid(s);
    const yp = s.h * 0.1;
    const yo = s.h * 0.24;
    const base = s.h * 0.58;
    const unit = s.h * 0.28;
    const done = s.ease('done', 1.4, 0.8);
    rowLabel(s, 'p', lx, yp, 'teal');
    cells(s, xs, yp, done > 0.5 ? DONE_P.map((v) => v.toFixed(2)) : P.map(f1), 'teal', { w: 12, h: 8, on: [0, s.win('p', 'sub') + done, 0] });
    const sub = s.ease('sub', 1, 1.5);
    s.alpha(s.ease('answer', 0.6, 0.6), () => {
      s.text('onehot(y)', xs[0]! - 7.5 * s.u, yo, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
      cells(s, xs, yo, ['0', '1', '0'], 'gold', { w: 12, h: 8, on: [0, s.ease('answer', 0.6, 1.4) * (1 - s.ease('sum', 0.6)) + done, 0] });
    });
    s.show('g', s.win('answer', 'sum'));
    const vals = P.map((p, i) => lerp(p - (i === Y ? sub : 0), DONE_P[i]! - (i === Y ? 1 : 0), done));
    const k = sub > 0.5 ? 'red' : 'teal';
    s.line(xs[0]! - 9 * s.u, base, xs[2]! + 9 * s.u, base, s.c('--axis'), 0.35);
    const bw = 10 * s.u;
    vals.forEach((v, i) => {
      const hh = v * unit;
      s.rrect(xs[i]! - bw / 2, Math.min(base, base - hh), bw, Math.max(Math.abs(hh), 0.5 * s.u), 1, { fill: s.tint(k, 0.4), stroke: s.tint(k, 0.9), lw: 0.3 });
      s.text(f1(v), xs[i]!, v >= 0 ? base - hh - 3.4 * s.u : base - hh + 3.6 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c(k), halo: true });
      s.text(`s${i}`, xs[i]! - bw / 2 - 1.5 * s.u, base + (v >= 0 ? 3.2 : -3.2) * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('purple') });
    });
    s.alpha(s.ease('sub', 0.6, 1.5), () => rowLabel(s, 'ds', lx, base, 'red', 3.8));
    s.alpha(s.win('sum', 'done'), () => {
      s.text('0.6 − 0.7 + 0.1 = 0', s.w / 2, s.h * 0.92, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    s.alpha(s.win('step', 'done'), () => {
      vals.forEach((v, i) => {
        const x = xs[i]! + bw / 2 + 3.5 * s.u;
        const len = Math.max(3, Math.abs(v) * 20) * s.u;
        s.arrow(x, base, x, base + (v > 0 ? len : -len), s.c('purple'), 0.6, 2.2);
      });
    });
    s.alpha(s.ease('done', 0.6, 0.8), () => {
      s.text('p[1] near 1: ds near 0', s.w / 2, s.h * 0.92, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { setup, bars };
