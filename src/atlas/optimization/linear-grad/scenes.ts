import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns } from '../../draw';

const X = [2, 1];
const DS = [-0.7, 0.7];
const f = (v: number) => String(Math.round(v * 100) / 100);

type Ink = 'purple' | 'teal' | 'red' | 'blue';

/** Eased in `frac` of the way through beat `id`, so a value lands as the voice says it. */
const lateIn = (s: Scene, id: string, frac: number) => s.ease(id, 0.6, frac * (s.end(id) - s.at(id)));

const loop: SceneDef = {
  draw(s) {
    s.text('x = [2, 1]    y = 0', s.w / 2, s.h * 0.07, { size: 3.8, font: 'mono', weight: 600, color: s.c('orange') });
    const rows: [string, string, Ink, string][] = [
      ['s = Wx + b', '[1.0, 1.85]', 'purple', 'scores'],
      ['p = softmax(s)', '[0.3, 0.7]', 'teal', 'probs'],
      ['ds = p − onehot(y)', '[−0.7, 0.7]', 'red', 'grad'],
      ['dW = ?,  db = ?', '', 'blue', ''],
    ];
    const cx = s.w * 0.4;
    const bw = s.w * 0.56;
    const bh = 9 * s.u;
    rows.forEach(([text, val, k, beat], i) => {
      const y = s.h * (0.24 + i * 0.2);
      const on = beat && s.since(beat) >= 0 ? 1 : 0;
      const lit = beat ? s.win(beat, rows[i + 1]?.[3]) : lateIn(s, 'grad', 0.9);
      s.alpha(0.3 + 0.7 * s.ease('x', 0.6, 0.8 + i * 0.25), () => {
        s.rrect(cx - bw / 2, y - bh / 2, bw, bh, 1.4, { fill: s.tint(k, 0.08 + 0.18 * lit), stroke: s.tint(k, 0.4 + 0.5 * lit), lw: 0.3 + 0.2 * lit });
        s.text(text, cx, y, { size: 3.4, font: 'mono', weight: 600, color: s.c(k) });
        if (i < 3) s.arrow(cx, y + bh / 2 + 1.2 * s.u, cx, y + s.h * 0.2 - bh / 2 - 1.2 * s.u, s.c('--ink-3'), 0.35, 1.8);
      });
      if (val) s.alpha(s.ease(beat, 0.6, 0.6) * on, () => s.text(val, cx + bw / 2 + 3 * s.u, y, { size: 3.4, font: 'mono', align: 'left', color: s.c(k) }));
    });
  },
};

const fm = (v: number) => (v < 0 ? `−${f(-v)}` : f(v));
const mono = (s: Scene, t: string, x: number, y: number, k: Ink | 'orange' | 'gold' | 'green' | '--ink-2' | '--ink-3', size = 3.6, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** x across the top, ds down the side, the dW grid between them and db at the right. */
function table(s: Scene) {
  const xs = columns(s, 2, s.tall ? 22 : 20).map((x) => x + (s.tall ? 3 : 0) * s.u);
  return { xs, left: xs[0]! - (s.tall ? 24 : 22) * s.u, right: xs[1]! + (s.tall ? 24 : 22) * s.u, top: s.h * 0.13, ry: [s.h * 0.37, s.h * 0.56] };
}

const outer: SceneDef = {
  marks: {
    one: { tex: String.raw`\syms_0 = \symW_{0,0}\,\symx_0 + \symW_{0,1}\,\symx_1 + \symb_0`, x: 0.5, y: 0.8, size: 4.6 },
    slope: { tex: String.raw`\dfrac{\partial \syms_0}{\partial \symW_{0,0}} = \symx_0 = 2`, x: 0.5, y: 0.8, size: 4.8 },
    entry: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{0,0}} = d\syms_0\,\symx_0 = -0.7 \times 2 = -1.4`, x: 0.5, y: 0.8, size: 4.6 },
    row0: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{0,1}} = d\syms_0\,\symx_1 = -0.7 \times 1 = -0.7`, x: 0.5, y: 0.8, size: 4.6 },
    row1: { tex: String.raw`d\syms_1\,\symx_0 = 0.7 \times 2 = 1.4, \quad d\syms_1\,\symx_1 = 0.7 \times 1 = 0.7`, x: 0.5, y: 0.8, size: 4.4 },
    rule: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{i,j}} = d\syms_i\,\symx_j`, x: 0.5, y: 0.8, size: 5 },
  },
  draw(s) {
    const T = table(s);
    const { xs, left, right, top, ry } = T;
    // When each dW entry fills, in the beat that computes it.
    const fill = [
      [lateIn(s, 'entry', 0.8), lateIn(s, 'row0', 0.75)],
      [lateIn(s, 'row1', 0.5), lateIn(s, 'row1', 0.8)],
    ];
    // Which entry the voice is on: its row's ds and its column's x light with it.
    const cur = (i: number, j: number) => {
      if (i === 0 && j === 0) return s.win('one', 'row0');
      if (i === 0 && j === 1) return s.win('row0', 'row1');
      return s.win('row1', 'rule') * (j === 0 ? 1 - lateIn(s, 'row1', 0.68) : lateIn(s, 'row1', 0.68));
    };
    const xOn = (j: number) => (j === 0 ? Math.max(s.win('slope', 'row0'), cur(1, 0)) : Math.max(cur(0, 1), cur(1, 1)));
    const dsOn = (i: number) => (i === 0 ? s.win('entry', 'row1') : s.win('row1', 'rule'));
    mono(s, 'x', left, top, 'orange', 4, 'center', 650);
    cells(s, xs, top, X.map(String), 'orange', { on: xs.map((_, j) => xOn(j)) });
    xs.forEach((x, j) => s.text(`col ${j}`, x, top - 6.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    mono(s, 'ds', left, ry[0]! - 9 * s.u, 'red', 3.6, 'center', 650);
    ry.forEach((y, i) => {
      cells(s, [left], y, [fm(DS[i]!)], 'red', { w: 13, on: [dsOn(i)] });
      s.text(`row ${i}`, left - 8.5 * s.u, y, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    mono(s, '∂L/∂W', (xs[0]! + xs[1]!) / 2, ry[0]! - 9 * s.u, 'red', 3.4, 'center', 650);
    ry.forEach((y, i) =>
      xs.forEach((x, j) => {
        const a = fill[i]![j]!;
        const asked = i === 0 && j === 0 ? s.ease('one', 0.6, 0.6) : 0;
        cells(s, [x], y, [a > 0.4 ? fm(DS[i]! * X[j]!) : asked > 0.4 ? '?' : ''], 'red', { on: [Math.max(cur(i, j), 0.3 * a)] });
      }),
    );
    s.show('one', s.win('one', 'slope'));
    s.show('slope', s.win('slope', 'entry'));
    s.show('entry', s.win('entry', 'row0'));
    s.show('row0', s.win('row0', 'row1'));
    s.show('row1', s.win('row1', 'rule'));
    s.show('rule', s.ease('rule', 0.6));
    s.alpha(s.ease('rule', 0.6, 0.4) * lateIn(s, 'rule', 0.7), () => mono(s, 'np.outer(ds, x)', s.w / 2, s.h * 0.92, '--ink-2', 3.4));
    s.alpha(s.ease('db', 0.6), () => {
      mono(s, 'db', right, ry[0]! - 9 * s.u, 'red', 3.6, 'center', 650);
      ry.forEach((y, i) => cells(s, [right], y, [fm(DS[i]!)], 'red', { w: 13, on: [1] }));
    });
  },
};

// The worked problem: the givens of the practice's dW-entry question.
const TW = [
  [2, 0],
  [-1, 1],
];
const TX = [1, 3];
const TP = [0.2, 0.8];
const TY = 0;
const TDS = TP.map((p, i) => Math.round((p - (i === TY ? 1 : 0)) * 100) / 100);

const tryIt: SceneDef = {
  marks: {
    g1: { tex: String.raw`\symW = \begin{bmatrix} 2 & 0 \\ -1 & 1 \end{bmatrix},\quad \symx = [1,\ 3],\quad \symy = 0`, x: 0.5, y: 0.1, size: 4.4 },
    g2: { tex: String.raw`\symp = [0.2,\ 0.8]`, x: 0.5, y: 0.22, size: 4.4 },
    q1: { tex: String.raw`\partial \symL / \partial \symW_{0,1} = \,?`, x: 0.5, y: 0.31, size: 4.4 },
    ds: { tex: String.raw`d\syms = \symp - \mathrm{onehot}(\symy) = [0.2,\ 0.8] - [1,\ 0] = [-0.8,\ 0.8]`, x: 0.5, y: 0.76, size: 4 },
    dw: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{0,1}} = d\syms_0\,\symx_1 = (-0.8) \times 3 = -2.4`, x: 0.5, y: 0.88, size: 4.2 },
  },
  draw(s) {
    s.show('g1', s.ease('p1', 0.6));
    s.show('g2', s.ease('p1', 0.6, 0.3));
    s.show('q1', lateIn(s, 'p1', 0.8));
    s.show('ds', lateIn(s, 'ds', 0.6));
    s.show('dw', lateIn(s, 'dw', 0.75));
    const xs = columns(s, 2, s.tall ? 20 : 18).map((x) => x + (s.tall ? 4 : 0) * s.u);
    const left = xs[0]! - (s.tall ? 22 : 20) * s.u;
    const ry = [s.h * 0.53, s.h * 0.64];
    const top = s.h * 0.42;
    // ds down the side, filled once the score gradient is worked.
    const dsA = lateIn(s, 'ds', 0.7);
    s.alpha(s.ease('ds', 0.6), () => {
      ry.forEach((y, i) => cells(s, [left], y, [dsA > 0.4 ? fm(TDS[i]!) : '?'], 'red', { w: 13, h: 8, on: [i === 0 ? s.win('dw', 'turn') : 0] }));
      mono(s, 'ds', left - 10 * s.u, (ry[0]! + ry[1]!) / 2, 'red', 3.6, 'right', 650);
    });
    // W with x across the top; W[0,1] is the asked weight.
    s.alpha(lateIn(s, 'p1', 0.8), () => {
      const hit = s.win('dw', 'turn');
      cells(s, xs, top, TX.map(String), 'orange', { w: 12, h: 7, on: [0, hit] });
      mono(s, 'x', xs[1]! + 9 * s.u, top, 'orange', 3.8, 'left', 650);
      ry.forEach((y, i) =>
        xs.forEach((x, j) => {
          const it = i === 0 && j === 1;
          cells(s, [x], y, [fm(TW[i]![j]!)], 'blue', { w: 12, h: 8, on: [it ? 0.4 + 0.6 * hit : 0] });
        }),
      );
      mono(s, 'W', xs[1]! + 9 * s.u, (ry[0]! + ry[1]!) / 2, 'blue', 3.8, 'left', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { loop, outer, try: tryIt };
