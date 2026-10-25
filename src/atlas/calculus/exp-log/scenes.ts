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
    const hiAdd = s.ease('add', 0.6);
    rowLabel(s, 'x', G.lx, G.yx, 'orange');
    cells(s, G.xs, G.yx, XS.map(String), 'orange', { on: [0, 0, hiAdd, hiAdd, s.ease('add', 0.6, 1.2)] });
    s.alpha(Math.max(...vis), () => rowLabel(s, 'eˣ', G.lx, G.ye, 'gold'));
    const H = (s.h * 0.93 - G.ye) / s.u - 15;
    s.alpha(Math.max(...vis), () => s.line(G.xs[0]! - 7 * s.u, s.h * 0.93, G.xs[4]! + 7 * s.u, s.h * 0.93, s.c('--axis'), 0.35));
    G.xs.forEach((x, i) => {
      s.alpha(vis[i]!, () => {
        downArrows(s, [x], G.yx + 5.5 * s.u, G.ye - 5.5 * s.u);
        const on = i === 0 ? s.win('neg', 'add') : i === 2 || i === 3 ? hiAdd : i === 4 ? s.ease('add', 0.6, 1.2) : 0;
        cells(s, [x], G.ye, [f2(EX[i]!)], 'gold', { on: [on] });
        bars(s, [x], s.h * 0.93, [EX[i]!], 'gold', { max: EX[4]!, height: H, w: 9, grow: vis[i], hi: [on] });
      });
    });
    // "times e" between each pair of neighbors once both are showing.
    for (let i = 0; i < 4; i++) {
      s.alpha(Math.min(vis[i]!, vis[i + 1]!), () => {
        s.text('×e', (G.xs[i]! + G.xs[i + 1]!) / 2, G.ye + 9 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-3') });
      });
    }
    s.alpha(s.ease('add', 0.6, 0.4), () => {
      const o = { size: 3.7, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
      s.text('e² · e¹ = e²⁺¹ = e³', G.xs[1]!, s.h * 0.6, o);
      s.text(`${f2(EX[3]!)} × ${f2(EX[2]!)} ≈ ${f2(EX[4]!)}`, G.xs[1]!, s.h * 0.69, { ...o, color: s.c('gold'), weight: 600 });
    });
  },
};

const LN_ROWS: [number, string][] = [
  [3, 'ln 7.39 = 2'],
  [1, 'ln 1.00 = 0'],
  [0, 'ln 0.37 = −1'],
];

const log: SceneDef = {
  marks: {
    ask: { tex: String.raw`\ln y = \, ? \quad\Longleftrightarrow\quad e^{\,?} = y`, x: 0.5, y: 0.67, size: 5 },
    undo: { tex: String.raw`\ln(e^{a}) = a \qquad e^{\ln a} = a`, x: 0.5, y: 0.89, size: 4.8 },
  },
  draw(s) {
    const G = grid(s);
    const beats = ['two', 'one', 'neg'];
    const on = [0, 0, 0, 0, 0];
    LN_ROWS.forEach(([col], k) => (on[col] = s.win(beats[k]!, beats[k + 1] ?? 'undo')));
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
    LN_ROWS.forEach(([, text], k) => {
      s.alpha(s.ease(beats[k]!, 0.6, k === 0 ? 0.6 : 0), () => {
        s.text(text, x0, s.h * (0.55 + 0.11 * k), { size: 4.4, font: 'mono', weight: 600, align: 'left', color: s.c(k === 2 ? 'red' : 'teal') });
      });
    });
    s.show('undo', s.ease('undo', 0.6));
  },
};

/** Two rows of three cells, `a op b = c`, joined by ln arrows: products on top, sums below. */
function pairRows(s: Scene, top: string[], bot: string[], yT: number, yB: number, o: { topA: number[]; botA: number[]; arrows: number[]; hi: number; ops?: [string, string] }) {
  const xs = columns(s, 3, s.tall ? 30 : 32);
  const [opT, opB] = o.ops ?? ['×', '+'];
  xs.forEach((x, i) => {
    s.alpha(o.topA[i]!, () => cells(s, [x], yT, [top[i]!], '--ink-2', { w: 17, h: 9, on: [i === 2 ? o.hi : 0] }));
    s.alpha(o.botA[i]!, () => cells(s, [x], yB, [bot[i]!], 'teal', { w: 17, h: 9, on: [i === 2 ? o.hi : 0] }));
    s.alpha(o.arrows[i]!, () => {
      s.arrow(x, yT + 5.5 * s.u, x, yB - 5.5 * s.u, s.c('teal'), 0.4, 2);
      s.text('ln', x + 2 * s.u, (yT + yB) / 2, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('teal'), halo: true });
    });
  });
  const opText = (t: string, x: number, y: number) => s.text(t, x, y, { size: 4.6, font: 'mono', weight: 600, color: s.c('--ink-3') });
  s.alpha(Math.min(o.topA[0]!, o.topA[1]!), () => opText(opT, (xs[0]! + xs[1]!) / 2, yT));
  s.alpha(Math.min(o.topA[1]!, o.topA[2]!), () => opText('=', (xs[1]! + xs[2]!) / 2, yT));
  s.alpha(Math.min(o.botA[0]!, o.botA[1]!), () => opText(opB, (xs[0]! + xs[1]!) / 2, yB));
  s.alpha(Math.min(o.botA[1]!, o.botA[2]!), () => opText('=', (xs[1]! + xs[2]!) / 2, yB));
}

const PS = [0.9, 0.5, 0.1];

const rules: SceneDef = {
  marks: {
    rule: { tex: String.raw`\ln(ab) = \ln a + \ln b`, x: 0.5, y: 0.11, size: 5.2 },
    flip: { tex: String.raw`-\ln \tfrac{1}{2} = \ln 2 \approx 0.69`, x: 0.5, y: 0.13, size: 5.2 },
  },
  draw(s) {
    const top = 1 - s.ease('flip', 0.6);
    s.alpha(top, () => {
      const a = s.ease('why', 0.6);
      const b = s.ease('nums', 0.6, 0.3);
      pairRows(s, ['2', '3', '6'], ['0.69', '1.10', '1.79'], s.h * 0.34, s.h * 0.66, { topA: [a, a, a], botA: [b, b, s.ease('nums', 0.6, 2.4)], arrows: [b, b, b], hi: s.ease('nums', 0.6, 2.4) });
    });
    s.show('rule', s.ease('why', 0.6) * top);
    s.show('flip', s.ease('flip', 0.6, 0.3));
    // -ln p for three probabilities: the loss in miniature.
    const xs = columns(s, 3, s.tall ? 26 : 28);
    const base = s.h * 0.84;
    const vis = [s.ease('small', 0.6, 0.3), s.ease('flip', 0.6, 0.6), s.ease('small', 0.6, 1.2)];
    xs.forEach((x, i) => {
      s.alpha(vis[i]!, () => {
        bars(s, [x], base, [-Math.log(PS[i]!)], 'red', { max: -Math.log(0.1), height: 38, w: 11, grow: vis[i], fmt: f2, hi: [i === 2 ? s.ease('small', 0.6, 1.8) : 0] });
        s.text(`p = ${PS[i]}`, x, base + 5 * s.u, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
    });
    s.alpha(vis[0]!, () => rowLabel(s, '−ln p', xs[0]! - 11 * s.u, base - 6 * s.u, 'red', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { exp, log, rules };
