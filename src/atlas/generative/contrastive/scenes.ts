import type { SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { bars, cells, columns, rowLabel } from '../../draw';
import { caption, fmt, rich } from '../draw';

const S = [2, 0, 1];
const E = S.map((v) => +Math.exp(v).toFixed(2));
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);

const SLOPE = P.map((v, j) => (j ? v : v - 1));

const push: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.17, 0.31, 0.45, 0.59].map((f) => s.h * f);
    ['positive', 'negative', 'negative'].forEach((t, j) => s.text(t, xs[j]!, s.h * 0.08, { size: 3, font: 'mono', weight: 650, color: s.c(j ? 'red' : 'green') }));
    rowLabel(s, 's', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, S.map(String), 'purple', { w: 14, h: 8, on: [s.win('recall', 'nudge'), 0, s.win('nudge', 'share')] });
    s.alpha(s.ease('recall', 0.6, 1.5), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, 'gold', 3.8);
      cells(s, xs, ys[1]!, E.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8, on: [0, 0, s.win('nudge', 'push')] });
      s.text(`total ${TOTAL.toFixed(2)}`, xs[2]! + 9 * u, ys[1]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('recall', 0.6, 3.5), () => {
      rowLabel(s, 'p', lx, ys[2]!, 'teal', 3.8);
      cells(s, xs, ys[2]!, P.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [s.win('recall', 'nudge'), 0, s.win('share', 'push')] });
    });
    // The loss's slope on each score: a negative's is its probability, the positive's is p - 1.
    const shown = [after(s, 'push', 0.15), after(s, 'share', 0.7), after(s, 'share', 0.35)];
    s.alpha(shown[2]!, () => rowLabel(s, 'slope', lx, ys[3]!, 'red', 3.4));
    SLOPE.forEach((v, j) => s.alpha(shown[j]!, () => cells(s, [xs[j]!], ys[3]!, [fmt(v, 2)], 'red', { w: 14, h: 8 })));
    s.alpha(after(s, 'recall', 0.75) * (1 - s.ease('nudge', 0.6)), () => {
      rich(s, [['loss = ln 11.11 − 2 = ', '--ink-2'], ['0.41', 'red']], s.w / 2, s.h * 0.71, { size: 3.8, weight: 650, halo: true });
      s.alpha(after(s, 'recall', 0.9), () => caption(s, '= −ln 0.67: cross-entropy on the positive', s.h * 0.78, '--ink-3', 3.2));
    });
    s.alpha(after(s, 'nudge', 0.45) * (1 - s.ease('push', 0.5)), () => rich(s, [['candidate 2: total grows ', '--ink-2'], ['2.72', 'gold'], ['× as fast', '--ink-2']], s.w / 2, s.h * 0.71, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'share', 0.2) * (1 - s.ease('push', 0.5)), () => rich(s, [['slope = 2.72 / 11.11 = ', '--ink-2'], ['0.24', 'red'], [' = its p', '--ink-2']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'push', 0.3), () => {
      rich(s, [['pull ', '--ink-2'], ['positive', 'green'], [' in, push ', '--ink-2'], ['negatives', 'red'], [' out', '--ink-2']], s.w / 2, s.h * 0.75, { size: 3.4, weight: 600, halo: true });
      s.alpha(after(s, 'push', 0.75), () => caption(s, 'average over every row', s.h * 0.84, '--ink-3', 3));
    });
  },
};

const SIM0 = [0.9, 0.1, 0.5];
const soft = (t: number) => {
  const e = SIM0.map((v) => Math.exp(v / t));
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / tot);
};
const WARM = soft(1);
const COLD = soft(0.1);

const temperature: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\text{similarity}}{\sym{tau}{\tau}}`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 15);
    s.show('f', s.ease('sharp', 0.6));
    const ys = s.h * 0.25;
    rowLabel(s, 'sim', xs[0]! - 10 * u, ys, 'green', 3.6);
    cells(s, xs, ys, SIM0.map((v) => fmt(v)), 'green', { w: 12, h: 7.5 });
    const base = s.h * 0.82;
    const groups: [number, number[], string, number][] = [
      [s.w / 2 - 27 * u, WARM, 'τ = 1', s.ease('sharp', 0.8)],
      [s.w / 2 + 27 * u, COLD, 'τ = 0.1', s.ease('sharp', 0.8, 3.5)],
    ];
    groups.forEach(([cx, p, name, a]) => {
      s.alpha(a, () => {
        const bx = [-1, 0, 1].map((k) => cx + k * 10.5 * u);
        const hard = name === 'τ = 0.1' ? after(s, 'hard', 0.55) : after(s, 'hard', 0.25) * (1 - after(s, 'hard', 0.55));
        bars(s, bx, base, p, 'teal', { max: 1, height: 30, w: 7, fmt: (v) => v.toFixed(2), grow: a, hi: [0, name === 'τ = 1' ? hard : 0, hard] });
        s.text(name, cx, s.h * 0.4, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
      });
    });
    s.alpha(s.ease('sharp', 0.6, 0.4), () => s.text('÷ τ: gaps stretch', s.w / 2, s.h * 0.33, { size: 3.4, font: 'mono', color: s.c('slate'), halo: true }));
    s.alpha(s.ease('sharp', 0.6, 2), () => s.text('soft', s.w / 2 - 27 * u, base + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('sharp', 0.6, 5), () => s.text('sharp', s.w / 2 + 27 * u, base + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(after(s, 'hard', 0.6), () => caption(s, 'closest negative (0.5) gets the push', s.h * 0.93, 'red', 3.3));
  },
};

// Worked as the practice asks it: one candidate's slope, then the positive's.
const WS = [2, 1, 1];
const WE = WS.map((v) => +Math.exp(v).toFixed(2));
const WT = WE.reduce((a, b) => a + b, 0);
const WP = WE.map((e) => +(e / WT).toFixed(2));

const worked: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.17, 0.31, 0.45].map((f) => s.h * f);
    ['positive', 'negative', 'negative'].forEach((t, j) => s.text(t, xs[j]!, s.h * 0.08, { size: 3, font: 'mono', weight: 650, color: s.c(j ? 'red' : 'green') }));
    rowLabel(s, 's', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, WS.map(String), 'purple', { w: 14, h: 8, on: [s.win('pos', 'turn'), s.win('ask', 'pos'), 0] });
    s.alpha(after(s, 'ask', 0.6) * (1 - s.ease('exps', 0.5)), () => caption(s, 'slope on candidate 1?', s.h * 0.24, '--ink-3', 3.2));
    s.alpha(s.ease('exps', 0.6, 0.5), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, 'gold', 3.8);
      cells(s, xs, ys[1]!, WE.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8, on: [s.win('pos', 'turn'), s.win('neg', 'pos'), 0] });
    });
    s.alpha(after(s, 'exps', 0.7), () => s.text(`total ${WT.toFixed(2)}`, xs[2]! + 9 * u, ys[1]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') }));
    const shown = [after(s, 'pos', 0.75), after(s, 'neg', 0.75)];
    s.alpha(shown[1]!, () => rowLabel(s, 'slope', lx, ys[2]!, 'red', 3.4));
    shown.forEach((a, j) => s.alpha(a, () => cells(s, [xs[j]!], ys[2]!, [fmt(j ? WP[j]! : +(WP[j]! - 1).toFixed(2), 2)], 'red', { w: 14, h: 8 })));
    s.alpha(after(s, 'neg', 0.3), () => rich(s, [[`candidate 1: ${WE[1]!.toFixed(2)} / ${WT.toFixed(2)} = `, '--ink-2'], [WP[1]!.toFixed(2), 'red']], s.w / 2, s.h * 0.62, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'pos', 0.3), () => rich(s, [[`positive: ${WP[0]!.toFixed(2)} − 1 = `, '--ink-2'], [fmt(+(WP[0]! - 1).toFixed(2), 2), 'red']], s.w / 2, s.h * 0.7, { size: 3.4, weight: 600, halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { push, temperature, worked };
