import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, downArrows, rowLabel } from '../../draw';

const S = [1.8, 1.1, 0];
const P = [0.6, 0.3, 0.1];
const Y = 1;
const G = P.map((p, i) => p - (i === Y ? 1 : 0));
/** A confident, correct model: what `done` morphs the probabilities to. */
const DONE_P = [0.02, 0.97, 0.01];
const f1 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(Math.abs(v) < 0.1 ? 2 : 1));

/** Three columns and a label x to their left, for rows of cells. */
function grid(s: Scene) {
  const gap = s.tall ? 24 : 22;
  const xs = columns(s, 3, gap);
  return { xs, lx: xs[0]! - (gap / 2 + 4) * s.u };
}

const setup: SceneDef = {
  marks: {
    g: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms} = \symp - \mathrm{onehot}(\symy)`, x: 0.5, y: 0.64, size: 5 },
  },
  draw(s) {
    const { xs, lx } = grid(s);
    const ys = s.h * 0.12;
    const yp = s.h * 0.33;
    const yg = s.h * 0.84;
    rowLabel(s, 's', lx, ys, 'purple');
    cells(s, xs, ys, S.map((v) => v.toFixed(1)), 'purple');
    s.alpha(s.ease('chain', 0.6, 1), () => {
      downArrows(s, xs, ys + 6 * s.u, yp - 6 * s.u);
      rowLabel(s, 'p', lx, yp, 'teal');
      cells(s, xs, yp, P.map(f1), 'teal', { on: [0, 1, 0] });
      s.text(`y = ${Y}`, xs[2]! + 10 * s.u, yp, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('chain', 0.6, 4), () => {
      s.text('L = −log p[1] = −log 0.3 ≈ 1.2', s.w / 2, s.h * 0.48, { size: 3.8, font: 'mono', weight: 600, color: s.c('red') });
    });
    s.alpha(s.ease('ask', 0.6), () => {
      rowLabel(s, 'ds', lx, yg, 'red');
      const a = s.ease('answer', 0.8, 1.6);
      cells(s, xs, yg, a > 0.5 ? G.map(f1) : ['?', '?', '?'], 'red', { on: G.map(() => a) });
    });
    s.show('g', s.ease('answer', 0.6));
  },
};

const derive: SceneDef = {
  marks: {
    m0: { tex: String.raw`\symL = -\log \symp_{\symy} = -\log \dfrac{e^{\syms_{\symy}}}{\sum_k e^{\syms_k}}`, x: 0.5, y: 0.12, size: 4.6 },
    m1: { tex: String.raw`\symL = -\syms_{\symy} + \log \textstyle\sum_k e^{\syms_k}`, x: 0.5, y: 0.295, size: 4.6 },
    m2: { tex: String.raw`\dfrac{\partial}{\partial \syms_j} \log \textstyle\sum_k e^{\syms_k} = \dfrac{e^{\syms_j}}{\sum_k e^{\syms_k}} = \symp_j`, x: 0.5, y: 0.48, size: 4.6 },
    m3: { tex: String.raw`\dfrac{\partial\,(-\syms_{\symy})}{\partial \syms_j} = \begin{cases} -1 & j = \symy \\ 0 & j \ne \symy \end{cases}`, x: 0.5, y: 0.67, size: 4.4 },
    m4: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms_j} = \symp_j - [\,j = \symy\,]`, x: 0.5, y: 0.87, size: 5 },
  },
  draw(s) {
    s.show('m0', 1);
    s.show('m1', s.ease('expand', 0.6));
    s.show('m2', s.ease('log', 0.6));
    s.show('m3', s.ease('minus', 0.6));
    s.show('m4', s.ease('together', 0.6));
    const a = s.ease('together', 0.6, 0.4);
    const w = s.w * (s.tall ? 0.78 : 0.56);
    s.rrect(s.w / 2 - w / 2, s.h * 0.87 - 7.5 * s.u, w, 15 * s.u, 2, { fill: s.tint('red', 0.08 * a), stroke: s.tint('red', 0.5 * a), lw: 0.35 });
    const tag = (text: string, y: number, beat: string) =>
      s.alpha(s.ease(beat, 0.6, 0.8), () => s.text(text, s.w - 5 * s.u, s.h * y - (s.tall ? 7 : 0) * s.u, { size: 3, color: s.c('--ink-3'), align: 'right' }));
    tag('chain rule', 0.48, 'log');
  },
};

const bars: SceneDef = {
  draw(s) {
    const { xs, lx } = grid(s);
    const yp = s.h * 0.1;
    const yo = s.h * 0.24;
    const base = s.h * 0.6;
    const unit = s.h * 0.3;
    const done = s.ease('done', 1.4, 0.8);
    rowLabel(s, 'p', lx, yp, 'teal');
    cells(s, xs, yp, done > 0.5 ? DONE_P.map((v) => v.toFixed(2)) : P.map(f1), 'teal', { w: 12, h: 8, on: [0, s.win('p', 'sub') + done, 0] });
    const sub = s.ease('sub', 1, 1.5);
    s.alpha(s.ease('sub', 0.6), () => {
      rowLabel(s, 'y', lx, yo, 'gold');
      cells(s, xs, yo, ['0', '1', '0'], 'gold', { w: 12, h: 8, on: [0, 1, 0] });
    });
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
      s.text('0.6 − 0.7 + 0.1 = 0', s.w / 2, s.h * 0.93, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    s.alpha(s.win('step', 'done'), () => {
      vals.forEach((v, i) => {
        const x = xs[i]! + bw / 2 + 3.5 * s.u;
        const len = Math.max(3, Math.abs(v) * 20) * s.u;
        s.arrow(x, base, x, base + (v > 0 ? len : -len), s.c('purple'), 0.6, 2.2);
      });
    });
    s.alpha(s.ease('done', 0.6, 0.8), () => {
      s.text('p[1] near 1: ds near 0', s.w / 2, s.h * 0.93, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
    });
  },
};

const EP = [0.5, 0.2, 0.3];
const EG = [-0.5, 0.2, 0.3];

const example: SceneDef = {
  draw(s) {
    const { xs, lx } = grid(s);
    const y1 = s.h * 0.16;
    const y2 = s.h * 0.4;
    const y3 = s.h * 0.66;
    rowLabel(s, 'p', lx, y1, 'teal');
    cells(s, xs, y1, EP.map(f1), 'teal');
    s.text('y = 0', s.w / 2, s.h * 0.29, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold') });
    s.alpha(s.ease('onehot', 0.6), () => {
      rowLabel(s, 'y', lx, y2, 'gold');
      cells(s, xs, y2, ['1', '0', '0'], 'gold', { on: [1, 0, 0] });
    });
    const sub = s.ease('sub', 0.6);
    s.alpha(sub, () => {
      downArrows(s, xs, y2 + 6 * s.u, y3 - 6 * s.u);
      s.text('p − onehot', xs[2]! + 9 * s.u, (y2 + y3) / 2, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('ask', 0.6, 1), () => {
      rowLabel(s, 'ds', lx, y3, 'red');
      cells(s, xs, y3, sub > 0.5 ? EG.map(f1) : ['?', '?', '?'], 'red', { on: [sub, 0, 0] });
    });
    s.alpha(s.ease('check', 0.6), () => {
      s.text('−0.5 + 0.2 + 0.3 = 0', s.w / 2, s.h * 0.86, { size: 4.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { setup, derive, bars, example };
