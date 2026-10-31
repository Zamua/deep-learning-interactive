import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { caption } from '../../networks/draw';

const S = [1.8, 1.1, 0];
const P = [0.6, 0.3, 0.1];
const Y = 1;
const G = P.map((p, i) => p - (i === Y ? 1 : 0));
const f1 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(Math.abs(v) < 0.1 ? 2 : 1)).replace('-', '−');

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

// ---- the computation graph: s0, s1, s2 -> T -> log T -> L, and s_y -> -s_y -> L

type Key = 's0' | 's1' | 's2' | 'T' | 'lg' | 'ms' | 'L';
interface Node {
  x: number;
  y: number;
  name: string;
  val: string;
  k: Ink;
}

function layout(s: Scene): Record<Key, Node> {
  const at = (fx: number, fy: number) => ({ x: s.w * fx, y: s.h * fy });
  return {
    s0: { ...at(0.13, 0.2), name: 's₀', val: '1.8', k: 'purple' },
    s1: { ...at(0.13, 0.32), name: 's₁', val: '1.1', k: 'purple' },
    s2: { ...at(0.13, 0.44), name: 's₂', val: '0', k: 'purple' },
    T: { ...at(0.4, 0.26), name: 'T', val: '10.05', k: 'slate' },
    lg: { ...at(0.64, 0.26), name: 'log T', val: '2.31', k: 'slate' },
    ms: { ...at(0.64, 0.48), name: '−s₁', val: '−1.1', k: 'purple' },
    L: { ...at(0.87, 0.37), name: 'L', val: '1.21', k: 'red' },
  };
}

const BOX_H = 10.5;
const boxW = (s: Scene, n: Node) => Math.max(s.measure(n.name, { size: 3.3, font: 'mono', weight: 650 }), s.measure(n.val, { size: 2.9, font: 'mono' })) + 4.5 * s.u;

/** A node: its name over its value, lit by `on`. */
function node(s: Scene, n: Node, on = 0) {
  const w = boxW(s, n);
  const h = BOX_H * s.u;
  s.rrect(n.x - w / 2, n.y - h / 2, w, h, 1.4, { fill: s.tint(n.k, 0.08 + 0.2 * on), stroke: s.tint(n.k, 0.45 + 0.55 * on), lw: 0.3 + 0.25 * on });
  s.text(n.name, n.x, n.y - 2.2 * s.u, { size: 3.3, font: 'mono', weight: 650, color: s.c(n.k) });
  s.text(n.val, n.x, n.y + 2.6 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
}

/** An arrow from node a's right side to node b's left side, drawn in up to `grow` of its length. */
function edge(s: Scene, a: Node, b: Node, k: Ink, grow = 1, width = 0.35) {
  if (grow <= 0.003) return;
  const x0 = a.x + boxW(s, a) / 2 + 0.8 * s.u;
  const x1 = b.x - boxW(s, b) / 2 - 0.8 * s.u;
  const g = Math.min(1, grow);
  s.arrow(x0, a.y, x0 + (x1 - x0) * g, a.y + (b.y - a.y) * g, s.c(k), width, 1.8);
}

/** A slope written over the middle of an edge. */
function slope(s: Scene, a: Node, b: Node, t: string, alpha: number) {
  s.alpha(alpha, () => mono(s, t, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3.6 * s.u, 'gold', 3.3));
}

interface Look {
  /** Opacity of each node, and how lit it is. */
  show?: Partial<Record<Key, number>>;
  lit?: Partial<Record<Key, number>>;
  /** How much of the long path's edges and of the short path's are drawn, and how strongly. */
  long?: number;
  short?: number;
  longA?: number;
  shortA?: number;
  /** Which score's edge into T stands out. */
  hot?: number;
}

function graph(s: Scene, o: Look) {
  const N = layout(s);
  const show = (k: Key) => o.show?.[k] ?? 1;
  const lit = (k: Key) => o.lit?.[k] ?? 0;
  const long = o.long ?? 1;
  const short = o.short ?? 1;
  s.alpha(o.longA ?? 1, () => {
    (['s0', 's1', 's2'] as const).forEach((k, i) => {
      const hot = o.hot === i;
      edge(s, N[k], N.T, hot ? 'purple' : '--ink-3', long * 2.2 - i * 0.25, hot ? 0.55 : 0.3);
    });
    edge(s, N.T, N.lg, o.hot !== undefined ? 'purple' : '--ink-3', long * 2.2 - 1, o.hot !== undefined ? 0.55 : 0.3);
    edge(s, N.lg, N.L, '--ink-3', long * 2.2 - 1.6, 0.3);
  });
  s.alpha(o.shortA ?? 1, () => {
    edge(s, N.s1, N.ms, 'gold', short * 2, 0.5);
    edge(s, N.ms, N.L, 'gold', short * 2 - 1, 0.5);
  });
  (Object.keys(N) as Key[]).forEach((k) => s.alpha(show(k), () => node(s, N[k], lit(k))));
  s.alpha(show('s1'), () => s.text('y', N.s1.x - boxW(s, N.s1) / 2 - 1.5 * s.u, N.s1.y, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('gold') }));
  return N;
}

/** A nudge's size under each node it reaches, in a row below the graph. */
function nudges(s: Scene, items: [Node, string, Ink, number][]) {
  const y = s.h * 0.6;
  items.forEach(([n, t, k, a]) => s.alpha(a, () => mono(s, t, n.x, y, k, 3.3)));
}

const paths: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = \log T - \syms_{\symy}`, x: 0.5, y: 0.84, size: 5 },
  },
  draw(s) {
    // What the nudges measured: s, p and ds, with the pattern over ds.
    const rows = s.win('measured', 'loss');
    s.alpha(rows, () => {
      const gap = s.tall ? 24 : 22;
      const xs = columns(s, 3, gap);
      const lx = xs[0]! - (gap / 2 + 4) * s.u;
      const r: [string, string[], Color, number][] = [
        ['s', S.map((v) => v.toFixed(1)), 'purple', 0.2],
        ['p', P.map(f1), 'teal', 0.36],
        ['ds', G.map(f1), 'red', 0.6],
      ];
      r.forEach(([name, vals, k, f], i) => {
        rowLabel(s, name, lx, s.h * f, k);
        cells(s, xs, s.h * f, vals, k, { on: [0, i ? 1 : 0, 0] });
      });
      s.text(`y = ${Y}`, xs[1]!, s.h * 0.2 - 8 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c('gold') });
      s.alpha(after(s, 'measured', 0.6), () => ['= p₀', '= p₁ − 1', '= p₂'].forEach((t, i) => mono(s, t, xs[i]!, s.h * 0.6 - 8 * s.u, i === Y ? 'gold' : 'teal', 3.2)));
      s.alpha(s.ease('why', 0.6, 1), () => caption(s, 'measured for these scores: for any scores?', s.h * 0.84, '--ink-2', 3.3));
    });
    s.show('loss', s.ease('loss', 0.6, 2.2));
    const keys: Key[] = ['s0', 's1', 's2', 'T', 'lg', 'L', 'ms'];
    const appear = Object.fromEntries(keys.map((k, i) => [k, s.ease('loss', 0.5, 0.6 + i * 0.25)])) as Record<Key, number>;
    s.alpha(1 - rows * (1 - s.ease('loss', 0.6)), () =>
      graph(s, {
        show: appear,
        long: s.ease('paths', 0.4) * Math.min(1, s.prog('paths') * 1.6),
        short: after(s, 'paths', 0.6, 0.3) * Math.min(1, Math.max(0, s.prog('paths') - 0.6) * 3),
        lit: { s1: after(s, 'paths', 0.6) },
      }),
    );
  },
};

const top: SceneDef = {
  marks: {
    sum: { tex: String.raw`T = \boxed{e^{\syms_0}} + e^{\syms_1} + e^{\syms_2}`, x: 0.5, y: 0.84, size: 4.8 },
    dT: { tex: String.raw`\dfrac{\partial T}{\partial \syms_0} = e^{\syms_0} = e^{1.8} \approx 6`, x: 0.5, y: 0.84, size: 4.6 },
    dlog: { tex: String.raw`\dfrac{d \log T}{d T} = \dfrac{1}{T} \approx \dfrac{1}{10}`, x: 0.5, y: 0.84, size: 4.6 },
    mult: { tex: String.raw`\dfrac{\partial \log T}{\partial \syms_0} \approx 6 \times \dfrac{1}{10} = 0.6`, x: 0.5, y: 0.84, size: 4.6 },
    pj: { tex: String.raw`\dfrac{\partial \log T}{\partial \syms_j} = e^{\syms_j} \cdot \dfrac{1}{T} = \symp_j`, x: 0.5, y: 0.84, size: 4.6 },
  },
  draw(s) {
    const N = graph(s, { shortA: 0.25, hot: 0, lit: { s0: s.win('term', 'pj') } });
    slope(s, N.s0, N.T, '×6', s.win('dT', 'pj'));
    slope(s, N.T, N.lg, '×1/10', s.win('dlog', 'pj'));
    nudges(s, [
      [N.s0, '+0.01', '--ink-2', s.win('dT', 'pj')],
      [N.T, '→ +0.06', '--ink-2', after(s, 'dT', 0.75) * (1 - s.ease('pj', 0.6))],
      [N.lg, '→ +0.006', 'red', after(s, 'dlog', 0.7) * (1 - s.ease('pj', 0.6))],
    ]);
    s.show('sum', s.win('term', 'dT'));
    s.show('dT', s.win('dT', 'dlog'));
    s.show('dlog', s.win('dlog', 'mult'));
    s.show('mult', s.win('mult', 'pj'));
    s.show('pj', s.ease('pj', 0.6, 1.5));
  },
};

const right: SceneDef = {
  marks: {
    minus: { tex: String.raw`\dfrac{\partial\,(-\syms_{\symy})}{\partial \syms_{\symy}} = -1`, x: 0.5, y: 0.84, size: 4.6 },
    zero: { tex: String.raw`\dfrac{\partial\,(-\syms_{\symy})}{\partial \syms_j} = 0 \quad (j \ne \symy)`, x: 0.5, y: 0.84, size: 4.6 },
    add: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms_j} = \symp_j + \dfrac{\partial\,(-\syms_{\symy})}{\partial \syms_j}`, x: 0.5, y: 0.84, size: 4.4 },
    br: { tex: String.raw`[\,j = \symy\,] = \begin{cases} 1 & j = \symy \\ 0 & j \ne \symy \end{cases}`, x: 0.5, y: 0.84, size: 4.4 },
    res: { tex: String.raw`\dfrac{\partial \symL}{\partial \syms_j} = \symp_j - [\,j = \symy\,]`, x: 0.5, y: 0.84, size: 5 },
  },
  draw(s) {
    const both = s.ease('add', 0.6);
    const N = graph(s, { longA: 0.3 + 0.7 * both, lit: { s1: s.win('minus', 'zero'), L: both * (1 - s.ease('bracket', 0.6)), s0: s.win('zero', 'add'), s2: s.win('zero', 'add') } });
    slope(s, N.s1, N.ms, '×(−1)', s.win('minus', 'zero'));
    s.alpha(s.win('zero', 'add'), () => {
      for (const k of ['s0', 's2'] as const) {
        const a = N[k];
        s.line(a.x + boxW(s, a) / 2 + 1 * s.u, a.y, N.ms.x - boxW(s, N.ms) / 2 - 1 * s.u, N.ms.y, s.tint('red', 0.5), 0.3, [0.8, 0.8]);
      }
      mono(s, '×0', (N.s2.x + N.ms.x) / 2, (N.s2.y + N.ms.y) / 2 + 3.6 * s.u, 'red', 3.3);
    });
    nudges(s, [
      [N.s1, '+0.01', '--ink-2', s.win('minus', 'zero')],
      [N.ms, '→ −0.01', 'purple', after(s, 'minus', 0.65) * (1 - s.ease('zero', 0.6))],
    ]);
    // The gradient, entry by entry, once the two paths add up.
    s.alpha(s.ease('wrong', 0.6), () => {
      const xs = columns(s, 3, s.tall ? 26 : 24);
      const y = s.h * 0.66;
      cells(s, xs, y, G.map(f1), 'red', { w: 13, h: 8, on: [0, after(s, 'wrong', 0.5), 0] });
      // From the bracket on, every entry subtracts its one-hot entry: 0, 1, 0.
      const oh = s.ease('bracket', 0.6, 1.5);
      ['p₀', 'p₁ − 1', 'p₂'].forEach((t, i) => s.alpha(i === Y ? 1 : 1 - oh, () => mono(s, t, xs[i]!, y - 7.5 * s.u, i === Y ? 'gold' : 'teal', 3.2)));
      ['p₀ − 0', 'p₂ − 0'].forEach((t, i) => s.alpha(oh, () => mono(s, t, xs[i * 2]!, y - 7.5 * s.u, 'teal', 3.2)));
    });
    s.show('minus', s.win('minus', 'zero'));
    s.show('zero', s.win('zero', 'add'));
    s.show('add', s.win('add', 'bracket'));
    s.show('br', s.win('bracket', 'result'));
    s.show('res', s.ease('result', 0.6));
    const a = s.ease('result', 0.6, 0.3);
    const w = s.w * (s.tall ? 0.7 : 0.45);
    s.rrect(s.w / 2 - w / 2, s.h * 0.84 - 7.5 * s.u, w, 15 * s.u, 2, { fill: s.tint('red', 0.08 * a), stroke: s.tint('red', 0.5 * a), lw: 0.35 });
    cite(s, 'John Bridle, 1989', s.ease('bridle', 0.6, 0.5));
  },
};

// ---- scores never nudged: [2, 0, 0], the right answer 0

const TS = [2, 0, 0];
const TE = ['7.39', '1', '1'];
const TP = ['0.79', '0.11', '0.11'];

const any: SceneDef = {
  marks: {
    q: { tex: String.raw`\syms = [2,\ 0,\ 0],\quad \symy = 0,\quad e^{2} \approx 7.39`, x: 0.5, y: 0.07, size: 4.4 },
    rule: { tex: String.raw`\partial \symL / \partial \syms_j = \symp_j - [\,j = \symy\,]`, x: 0.5, y: 0.16, size: 4 },
    t: { tex: String.raw`T = 7.39 + 1 + 1 = 9.39`, x: 0.5, y: 0.84, size: 4.4 },
    p0: { tex: String.raw`\symp_0 = 7.39 / 9.39 \approx 0.79`, x: 0.5, y: 0.84, size: 4.4 },
    g0: { tex: String.raw`\partial \symL / \partial \syms_0 \approx 0.79 - 1 = -0.21`, x: 0.5, y: 0.84, size: 4.4 },
    g1: { tex: String.raw`\partial \symL / \partial \syms_1 = \symp_1 = 1 / 9.39 \approx 0.11`, x: 0.5, y: 0.84, size: 4.4 },
  },
  draw(s) {
    const gap = s.tall ? 24 : 22;
    const xs = columns(s, 3, gap);
    const lx = xs[0]! - (gap / 2 + 4) * s.u;
    s.show('q', s.ease('new', 0.6));
    s.show('rule', 1);
    const ys = [0.3, 0.43, 0.56, 0.69].map((f) => s.h * f);
    const c0 = s.win('p0', 'g1');
    const c1 = s.ease('g1', 0.6);
    rowLabel(s, 's', lx, ys[0]!, 'purple');
    cells(s, xs, ys[0]!, TS.map(String), 'purple', { on: [c0, c1, 0] });
    s.alpha(s.ease('new', 0.6, 1.5), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, '--ink-2');
      cells(s, xs, ys[1]!, TE, '--ink-2', { on: [Math.max(s.win('total', 'p0'), c0), Math.max(s.win('total', 'p0'), c1), s.win('total', 'p0')] });
    });
    s.alpha(s.ease('p0', 0.6), () => {
      rowLabel(s, 'p', lx, ys[2]!, 'teal');
      cells(s, xs, ys[2]!, [after(s, 'p0', 0.6) > 0.5 ? TP[0]! : '', c1 > 0.5 ? TP[1]! : '', ''], 'teal', { on: [c0, c1, 0] });
    });
    s.alpha(s.ease('new', 0.6, 2), () => {
      rowLabel(s, 'ds', lx, ys[3]!, 'red');
      const d0 = after(s, 'g0', 0.6) > 0.5 ? '−0.21' : '?';
      const d1 = after(s, 'g1', 0.6) > 0.5 ? '0.11' : '';
      cells(s, xs, ys[3]!, [d0, d1, ''], 'red', { on: [s.win('g0', 'g1'), after(s, 'g1', 0.6), 0] });
    });
    s.show('t', s.win('total', 'p0') * after(s, 'total', 0.3));
    s.show('p0', s.win('p0', 'g0'));
    s.show('g0', s.win('g0', 'g1'));
    s.show('g1', s.ease('g1', 0.6, 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { paths, top, right, any };
