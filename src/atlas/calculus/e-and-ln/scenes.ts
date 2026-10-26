import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel } from '../../draw';
import { after } from '../draw';

const XS = [-1, 0, 1, 2, 3];
const EX = XS.map(Math.exp);
const f2 = (v: number) => v.toFixed(2);

/** The x row over the eˣ row, five columns. */
function grid(s: Scene) {
  const xs = columns(s, 5, s.tall ? 18 : 19);
  return { xs, yx: s.h * 0.15, ye: s.h * 0.37, lx: xs[0]! - 11 * s.u };
}

const exp: SceneDef = {
  draw(s) {
    const G = grid(s);
    // Columns appear as the voice reaches them: x = 1 first, then 0, 2, 3, and -1 last.
    const vis = [s.ease('neg', 0.6), after(s, 'zero', 0.05), s.ease('e', 0.6, 0.3), after(s, 'zero', 0.62), after(s, 'zero', 0.82)];
    // Which columns each rule lights: its two inputs first, then its result.
    const add = s.win('add', 'div');
    const div = s.win('div', 'pow');
    const hi = [s.win('neg', 'add'), 0, add + div, add + div * after(s, 'div', 0.55) + s.ease('pow', 0.6), add * s.ease('add', 0.6, 1.2) + div].map((v) => Math.min(1, v));
    rowLabel(s, 'x', G.lx, G.yx, 'orange');
    cells(s, G.xs, G.yx, XS.map(String), 'orange', { on: [0, ...hi.slice(1)] });
    s.alpha(Math.max(...vis), () => rowLabel(s, 'eˣ', G.lx, G.ye, 'gold'));
    const H = (s.h * 0.93 - G.ye) / s.u - 15;
    s.alpha(Math.max(...vis), () => s.line(G.xs[0]! - 7 * s.u, s.h * 0.93, G.xs[4]! + 7 * s.u, s.h * 0.93, s.c('--axis'), 0.35));
    G.xs.forEach((x, i) => {
      s.alpha(vis[i]!, () => {
        downArrows(s, [x], G.yx + 5.5 * s.u, G.ye - 5.5 * s.u);
        cells(s, [x], G.ye, [f2(EX[i]!)], 'gold', { on: [hi[i]!] });
        bars(s, [x], s.h * 0.93, [EX[i]!], 'gold', { max: EX[4]!, height: H, w: 9, grow: vis[i], hi: [hi[i]!] });
      });
    });
    // "times e" between each pair of neighbors once both are showing.
    for (let i = 0; i < 4; i++) {
      s.alpha(Math.min(vis[i]!, vis[i + 1]!), () => {
        s.text('×e', (G.xs[i]! + G.xs[i + 1]!) / 2, G.ye + 9 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-3') });
      });
    }
    const o = { size: 3.7, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    const say = (lines: [string, boolean][], a: number) =>
      s.alpha(a, () => lines.forEach(([t, num], k) => s.text(t, G.xs[1]!, s.h * (0.6 + 0.09 * k), num ? { ...o, color: s.c('gold'), weight: 600 } : o)));
    say([['e² · e¹ = e²⁺¹ = e³', false], [`${f2(EX[3]!)} × ${f2(EX[2]!)} ≈ ${f2(EX[4]!)}`, true]], s.ease('add', 0.6, 0.4) * (1 - s.ease('div', 0.4)));
    say([['e³ / e¹ = e³⁻¹ = e²', false], [`${f2(EX[4]!)} ÷ ${f2(EX[2]!)} ≈ ${f2(EX[3]!)}`, true]], s.ease('div', 0.6, 0.4) * (1 - s.ease('pow', 0.4)));
    say([['(e²)³ = e² · e² · e²', false], ['= e²⁺²⁺² = e⁶', false], ['2 + 2 + 2 = 3 × 2 = 6', true]], s.ease('pow', 0.6, 0.4));
  },
};

const LN_ROWS: [number, string][] = [
  [3, 'ln 7.39 = 2'],
  [1, 'ln 1.00 = 0'],
  [0, 'ln 0.37 = −1'],
];

const log: SceneDef = {
  marks: {
    ask: { tex: String.raw`\ln y = \, ? \quad\text{means}\quad e^{\,?} = y`, x: 0.5, y: 0.67, size: 5 },
    undo: { tex: String.raw`\ln(e^{a}) = a \qquad e^{\ln a} = a`, x: 0.5, y: 0.89, size: 4.8 },
    q: { tex: String.raw`\ln(e^{4} \cdot e^{-1}) = \, ?`, x: 0.5, y: 0.56, size: 5 },
    sum: { tex: String.raw`e^{4} \cdot e^{-1} = e^{4 + (-1)} = e^{3}`, x: 0.5, y: 0.67, size: 5 },
    ans: { tex: String.raw`\ln(e^{3}) = 3`, x: 0.5, y: 0.78, size: 5 },
  },
  draw(s) {
    const G = grid(s);
    const beats = ['two', 'one', 'neg'];
    const on = [0, 0, 0, 0, 0];
    LN_ROWS.forEach(([col], k) => (on[col] = s.win(beats[k]!, beats[k + 1] ?? 'undo')));
    on[4] = after(s, 'solve', 0.5);
    rowLabel(s, 'x', G.lx, G.yx, 'orange');
    cells(s, G.xs, G.yx, XS.map(String), 'orange', { on });
    rowLabel(s, 'eˣ', G.lx, G.ye, 'gold');
    cells(s, G.xs, G.ye, EX.map(f2), 'gold', { on });
    // Up arrows: ln takes the bottom value back to its power.
    G.xs.forEach((x, i) => {
      const a = 0.25 + 0.75 * Math.max(on[i]!, s.ease('undo', 0.6));
      s.alpha(s.ease('ask', 0.6, 0.8) * a, () => {
        s.arrow(x, G.ye - 5.5 * s.u, x, G.yx + 5.5 * s.u, s.c('teal'), 0.4, 2);
        s.text('ln', x + 2 * s.u, (G.yx + G.ye) / 2, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('teal'), halo: true });
      });
    });
    s.show('ask', s.win('ask', 'two', 0.5));
    const x0 = s.w / 2 - 15 * s.u;
    // The ln rows give way to the worked problem.
    const rows = 1 - s.ease('try', 0.5);
    LN_ROWS.forEach(([, text], k) => {
      s.alpha(s.ease(beats[k]!, 0.6, k === 0 ? 0.6 : 0) * rows, () => {
        s.text(text, x0, s.h * (0.55 + 0.11 * k), { size: 4.4, font: 'mono', weight: 600, align: 'left', color: s.c(k === 2 ? 'red' : 'teal') });
      });
    });
    s.alpha(after(s, 'neg', 0.55) * (1 - s.ease('undo', 0.4)), () => {
      s.text('−ln 0.37 = 1', x0, s.h * 0.88, { size: 4.4, font: 'mono', weight: 600, align: 'left', color: s.c('green') });
    });
    s.show('undo', s.ease('undo', 0.6));
    s.show('q', s.ease('try', 0.6, 0.4));
    s.show('sum', after(s, 'solve', 0.1));
    s.show('ans', after(s, 'solve', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { exp, log };
