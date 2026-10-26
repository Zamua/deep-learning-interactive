import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';

const S = [1.8, 1.1, 0];
const P = [0.6, 0.3, 0.1];
const Y = 1;
const G = P.map((p, i) => p - (i === Y ? 1 : 0));
const f1 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(Math.abs(v) < 0.1 ? 2 : 1));
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

/** Where the chain s0 -> T -> log T sits, and its node labels. */
function links(s: Scene) {
  const k = s.tall ? 34 : 40;
  const xs = [s.w / 2 - k * s.u, s.w / 2, s.w / 2 + k * s.u];
  return { xs, y: s.h * 0.4, flow: s.h * 0.5 };
}

const derive: SceneDef = {
  marks: {
    m0: { tex: String.raw`\symL = -\log \symp_{\symy} = -\log \dfrac{e^{\syms_{\symy}}}{\sum_k e^{\syms_k}}`, x: 0.5, y: 0.1, size: 4.6 },
    m1: { tex: String.raw`\symL = -\syms_{\symy} + \log T, \quad T = \textstyle\sum_k e^{\syms_k}`, x: 0.5, y: 0.25, size: 4.6 },
    dT: { tex: String.raw`\dfrac{\partial T}{\partial \syms_j} = e^{\syms_j}`, x: 0.5, y: 0.72, size: 4.8 },
    dlog: { tex: String.raw`\dfrac{d \log T}{d T} = \dfrac{1}{T}`, x: 0.5, y: 0.72, size: 4.8 },
    m2: { tex: String.raw`\dfrac{\partial \log T}{\partial \syms_j} = e^{\syms_j} \cdot \dfrac{1}{T} = \symp_j`, x: 0.5, y: 0.72, size: 4.6 },
    m3: { tex: String.raw`\dfrac{\partial\,(-\syms_{\symy})}{\partial \syms_j} = \begin{cases} -1 & j = \symy \\ 0 & j \ne \symy \end{cases}`, x: 0.5, y: 0.62, size: 4.4 },
    m4: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms_j} = \symp_j - [\,j = \symy\,]`, x: 0.5, y: 0.85, size: 5 },
  },
  draw(s) {
    // The measured result, restated: s, p and ds with the pattern over it.
    s.alpha(s.win('recap', 'expand'), () => {
      const { xs, lx } = grid(s);
      const rows: [string, string[], 'purple' | 'teal' | 'red', number][] = [
        ['s', S.map((v) => v.toFixed(1)), 'purple', 0.34],
        ['p', P.map(f1), 'teal', 0.5],
        ['ds', G.map(f1), 'red', 0.72],
      ];
      rows.forEach(([name, vals, k, f], i) => {
        rowLabel(s, name, lx, s.h * f, k);
        s.alpha(i === 2 ? s.ease('recap', 0.6, 1.5) : 1, () => cells(s, xs, s.h * f, vals, k, { on: [0, i ? 1 : 0, 0] }));
      });
      s.text(`y = ${Y}`, xs[2]! + 10 * s.u, s.h * 0.5, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
      s.alpha(lateIn(s, 'recap', 0.55), () => xs.forEach((x, i) => mono(s, `= ${PAT[i]}`, x, s.h * 0.72 - 7.6 * s.u, i === Y ? 'gold' : 'teal', 3.2)));
    });
    s.show('m0', 1);
    s.show('m1', s.ease('expand', 0.6));
    const gone = s.ease('minus', 0.6);
    s.show('dT', s.win('dT', 'dlog') * lateIn(s, 'dT', 0.7));
    s.show('dlog', s.win('dlog', 'pj') * s.ease('dlog', 0.6, 0.4));
    s.show('m2', lateIn(s, 'pj', 0.55), { y: lerp(0.72, 0.42, s.ease('minus', 0.8)) });
    s.show('m3', s.ease('minus', 0.6, 0.6));
    s.show('m4', s.ease('together', 0.6));
    const a = s.ease('together', 0.6, 0.4);
    const w = s.w * (s.tall ? 0.7 : 0.5);
    s.rrect(s.w / 2 - w / 2, s.h * 0.85 - 7.5 * s.u, w, 15 * s.u, 2, { fill: s.tint('red', 0.08 * a), stroke: s.tint('red', 0.5 * a), lw: 0.35 });
    // The chain s0 -> T -> log T, with each link's slope and a 0.01 nudge riding along it.
    s.alpha(s.ease('dT', 0.6) * (1 - gone), () => {
      const L = links(s);
      const names = ['s0 = 1.8', 'T ≈ 10.05', 'log T ≈ 2.308'];
      const ks = ['purple', '--ink-2', 'red'] as const;
      const bw = names.map((t) => s.measure(t, { size: 3.4, font: 'mono', weight: 650 }) + 3 * s.u);
      const bh = 7 * s.u;
      names.forEach((t, i) => {
        const on = i === 0 ? 0 : lateIn(s, 'dT', i === 1 ? 0.15 : 0.25);
        s.alpha(i === 0 ? 1 : on, () => {
          s.rrect(L.xs[i]! - bw[i]! / 2, L.y - bh / 2, bw[i]!, bh, 1.4, { fill: s.tint(ks[i], 0.1), stroke: s.tint(ks[i], 0.6), lw: 0.3 });
          s.text(t, L.xs[i]!, L.y, { size: 3.4, font: 'mono', weight: 650, color: s.c(ks[i]) });
        });
      });
      const slope = ['×6', '×1/10'];
      const when = [lateIn(s, 'dT', 0.75), lateIn(s, 'dlog', 0.3)];
      for (let i = 0; i < 2; i++) {
        const x0 = L.xs[i]! + bw[i]! / 2 + 1 * s.u;
        const x1 = L.xs[i + 1]! - bw[i + 1]! / 2 - 1 * s.u;
        s.alpha(lateIn(s, 'dT', i === 0 ? 0.15 : 0.25), () => s.arrow(x0, L.y, x1, L.y, s.c('--ink-3'), 0.35, 1.8));
        s.alpha(when[i]!, () => mono(s, slope[i]!, (x0 + x1) / 2, L.y - 5 * s.u, 'gold', 3.4));
      }
      const flow = ['+0.01', '+0.06', '+0.006'];
      const fa = [lateIn(s, 'dlog', 0.6), lateIn(s, 'dlog', 0.72), lateIn(s, 'dlog', 0.86)];
      flow.forEach((t, i) => s.alpha(fa[i]!, () => mono(s, t, L.xs[i]!, L.flow, i === 2 ? 'red' : '--ink-2', 3.4)));
      s.alpha(lateIn(s, 'pj', 0.15), () => mono(s, '6 × 1/10 ≈ 0.6 = p0', s.w / 2, s.h * 0.59, 'teal', 3.6));
    });
  },
};

// The worked problem: scores [2, 0, 0], the correct option 0.
const TS = [2, 0, 0];
const TE = ['7.39', '1', '1'];

const tryIt: SceneDef = {
  marks: {
    q: { tex: String.raw`\syms = [2,\ 0,\ 0],\quad \symy = 0`, x: 0.5, y: 0.07, size: 4.6 },
    q2: { tex: String.raw`e^{2} \approx 7.39,\quad \partial \symL / \partial \syms_0 = \,?`, x: 0.5, y: 0.16, size: 4.6 },
    t: { tex: String.raw`T = 7.39 + 1 + 1 = 9.39`, x: 0.5, y: 0.65, size: 4.4 },
    sl: { tex: String.raw`e^{\syms_0} / T = 7.39 / 9.39 \approx 0.79`, x: 0.5, y: 0.75, size: 4.4 },
    mi: { tex: String.raw`\partial \symL / \partial \syms_0 \approx 0.79 - 1 = -0.21`, x: 0.5, y: 0.85, size: 4.4 },
    ot: { tex: String.raw`\partial \symL / \partial \syms_1 = e^{\syms_1} / T = 1 / 9.39 \approx 0.11`, x: 0.5, y: 0.85, size: 4.4 },
  },
  draw(s) {
    const { xs, lx } = grid(s);
    const other = s.ease('other', 0.5);
    s.show('q', s.ease('p1', 0.6));
    s.show('q2', s.ease('p1', 0.6, 0.8));
    s.show('t', lateIn(s, 'total', 0.5));
    s.show('sl', lateIn(s, 'slope', 0.5) * (1 - other));
    s.show('mi', lateIn(s, 'minus', 0.6), { y: 0.85 - 0.1 * other });
    s.show('ot', lateIn(s, 'other', 0.4));
    const ys = s.h * 0.3;
    const ye = s.h * 0.42;
    const yg = s.h * 0.54;
    rowLabel(s, 's', lx, ys, 'purple');
    cells(s, xs, ys, TS.map(String), 'purple', { on: [s.win('slope', 'other'), other, 0] });
    s.alpha(s.ease('total', 0.6), () => {
      rowLabel(s, 'eˢ', lx, ye, '--ink-2');
      cells(s, xs, ye, TE, '--ink-2', { on: [s.win('slope', 'other'), other, 0] });
    });
    s.alpha(s.ease('p1', 0.6, 1.2), () => {
      rowLabel(s, 'ds', lx, yg, 'red');
      const d0 = lateIn(s, 'minus', 0.7) > 0.5 ? '−0.21' : '?';
      const d1 = lateIn(s, 'other', 0.5) > 0.5 ? '0.11' : '';
      cells(s, xs, yg, [d0, d1, ''], 'red', { on: [s.win('minus', 'other'), lateIn(s, 'other', 0.5), 0] });
    });
  },
};

export const scenes: Record<string, SceneDef> = { derive, try: tryIt };
