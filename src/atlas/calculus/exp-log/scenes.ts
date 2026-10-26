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

/** A pairRows set that reveals in order: the two inputs, the result, the ln arrows, the logs. */
function pairSet(s: Scene, top: string[], bot: string[], beat: string, a: number, f = [0, 0.3, 0.45, 0.7, 0.5]) {
  const [fIn, fOut, fArr, fLogs, fLog2] = f;
  s.alpha(a, () => {
    const tIn = after(s, beat, fIn!);
    const arr = after(s, beat, fArr!);
    const logs = after(s, beat, fLogs!);
    pairRows(s, top, bot, s.h * 0.34, s.h * 0.64, { topA: [tIn, tIn, after(s, beat, fOut!)], botA: [logs, logs, after(s, beat, fLog2!)], arrows: [arr, arr, arr], hi: after(s, beat, Math.max(fLogs!, fLog2!)) });
  });
}

const rules: SceneDef = {
  marks: {
    lnE: { tex: String.raw`\ln(e^{2} \cdot e^{3}) = \ln e^{5} = 5 = 2 + 3`, x: 0.5, y: 0.86, size: 4.6 },
    rule: { tex: String.raw`\ln(ab) = \ln a + \ln b`, x: 0.5, y: 0.11, size: 5.2 },
    power: { tex: String.raw`\ln a^{k} = k \ln a`, x: 0.5, y: 0.11, size: 5.2 },
    nine: { tex: String.raw`\ln 9 = \ln 3 + \ln 3 = 2 \ln 3 \approx 2.20`, x: 0.5, y: 0.86, size: 4.6 },
  },
  draw(s) {
    // e² × e³ = e⁵, then 2 × 3 = 6, then 3 × 3 = 9, each with its logs below.
    pairSet(s, ['e²', 'e³', 'e⁵'], ['2', '3', '5'], 'why', 1 - s.ease('nums', 0.5), [0, 0.5, 0.58, 0.78, 0.65]);
    pairSet(s, ['2', '3', '6'], ['0.69', '1.10', '1.79'], 'nums', s.ease('nums', 0.5, 0.3) * (1 - s.ease('nine', 0.5)), [0, 0, 0.05, 0.1, 0.62]);
    pairSet(s, ['3', '3', '9'], ['1.10', '1.10', '2.20'], 'nine', s.ease('nine', 0.5, 0.3), [0.1, 0.36, 0.48, 0.55, 0.8]);
    s.show('lnE', after(s, 'why', 0.85) * (1 - s.ease('nums', 0.4)));
    s.show('rule', s.ease('rule', 0.6, 0.3) * (1 - s.ease('power', 0.4)));
    s.show('power', s.ease('power', 0.6, 0.3));
    s.show('nine', after(s, 'nine', 0.8));
  },
};

const quot: SceneDef = {
  marks: {
    half: { tex: String.raw`\ln \tfrac{1}{2} = -\ln 2 \approx -0.69`, x: 0.5, y: 0.86, size: 4.6 },
    recip: { tex: String.raw`\ln \tfrac{1}{a} = -\ln a`, x: 0.5, y: 0.11, size: 5.2 },
    threeHalves: { tex: String.raw`\ln \tfrac{3}{2} = \ln 3 - \ln 2 \approx 1.10 - 0.69 = 0.41`, x: 0.5, y: 0.86, size: 4.4 },
    diff: { tex: String.raw`\ln \tfrac{a}{b} = \ln a - \ln b`, x: 0.5, y: 0.11, size: 5.2 },
    flip: { tex: String.raw`-\ln \tfrac{1}{2} = \ln 2 \approx 0.69`, x: 0.5, y: 0.13, size: 5.2 },
  },
  draw(s) {
    const rows = 1 - s.ease('small', 0.5);
    // 2 × ½ = 1, so the logs add to ln 1 = 0; then 3 × ½ = 1.5.
    pairSet(s, ['2', '½', '1'], ['0.69', '−0.69', '0'], 'flip', rows * (1 - s.ease('quot', 0.5)), [0, 0.08, 0.15, 0.45, 0.18]);
    pairSet(s, ['3', '½', '1.5'], ['1.10', '−0.69', '0.41'], 'quot', rows * s.ease('quot', 0.5, 0.3), [0.1, 0.3, 0.35, 0.45, 0.85]);
    s.show('half', after(s, 'flip', 0.6) * (1 - s.ease('quot', 0.4)));
    s.show('recip', after(s, 'flip', 0.85) * (1 - s.ease('diff', 0.4)));
    s.show('threeHalves', after(s, 'quot', 0.88) * rows);
    s.show('diff', s.ease('diff', 0.6, 0.3) * (1 - s.ease('small', 0.4)));
    s.show('flip', s.ease('small', 0.6, 0.3));
    // -ln p for three numbers below 1: the smaller p, the taller the bar.
    const xs = columns(s, 3, s.tall ? 26 : 28);
    const base = s.h * 0.84;
    const vis = [after(s, 'small', 0.45), s.ease('small', 0.6, 0.4), after(s, 'small', 0.75)];
    xs.forEach((x, i) => {
      s.alpha(vis[i]!, () => {
        bars(s, [x], base, [-Math.log(PS[i]!)], 'red', { max: -Math.log(0.1), height: 38, w: 11, grow: vis[i], fmt: f2, hi: [i === 2 ? after(s, 'small', 0.9) : 0] });
        s.text(`p = ${PS[i]}`, x, base + 5 * s.u, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
    });
    s.alpha(vis[0]!, () => rowLabel(s, '−ln p', xs[0]! - 11 * s.u, base - 6 * s.u, 'red', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { exp, log, rules, quot };
