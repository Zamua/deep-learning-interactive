import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../draw';

const f2 = (v: number) => v.toFixed(2);

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
    given: { tex: String.raw`\ln 2 \approx 0.69, \quad \ln 5 \approx 1.61`, x: 0.5, y: 0.09, size: 4.6 },
    ask: { tex: String.raw`p = \tfrac{1}{10}: \quad -\ln p = \,?`, x: 0.5, y: 0.17, size: 4.6 },
    ten: { tex: String.raw`\ln 10 = \ln 2 + \ln 5 \approx 0.69 + 1.61 = 2.30`, x: 0.5, y: 0.25, size: 4.4 },
    neg: { tex: String.raw`-\ln \tfrac{1}{10} = \ln 10 \approx 2.30`, x: 0.5, y: 0.33, size: 4.4 },
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
    s.show('flip', s.ease('small', 0.6, 0.3) * (1 - s.ease('try', 0.4)));
    s.show('given', s.ease('try', 0.6, 0.3));
    s.show('ask', after(s, 'try', 0.55));
    s.show('ten', after(s, 'solve', 0.1));
    s.show('neg', after(s, 'solve', 0.45));
    // -ln p for three numbers below 1: the smaller p, the taller the bar.
    const xs = columns(s, 3, s.tall ? 26 : 28);
    const base = s.h * 0.84;
    // p = 0.5 with the voice, then 0.9; the 0.1 bar is the worked problem's answer.
    const vis = [after(s, 'small', 0.7), after(s, 'small', 0.3), after(s, 'solve', 0.55)];
    xs.forEach((x, i) => {
      s.alpha(vis[i]!, () => {
        bars(s, [x], base, [-Math.log(PS[i]!)], 'red', { max: -Math.log(0.1), height: 30, w: 11, grow: vis[i], fmt: f2, hi: [i === 2 ? after(s, 'solve', 0.8) : 0] });
        s.text(`p = ${PS[i]}`, x, base + 5 * s.u, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
    });
    s.alpha(vis[1]!, () => rowLabel(s, '−ln p', xs[0]! - 11 * s.u, base - 6 * s.u, 'red', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { rules, quot };
