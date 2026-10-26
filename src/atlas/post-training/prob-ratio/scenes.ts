import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { cells, columns, rowLabel } from '../../draw';
import { brace, fmt, push, type Ink } from '../draw';

const Y = (s: Scene, v: number) => (v / 100) * s.h;
/** A number with at most two places and a typographic minus: `1.5`, `−0.8`, `0.85`. */
const nf = (v: number) => String(+v.toFixed(2)).replace('-', '−');

// ---- scene 1: the ratio, from probabilities and from log-probabilities

const TOK = ['sure', 'thing', '!'];
const OLD = [0.2, 0.5, 0.4];
const NEW = [0.3, 0.45, 0.5];
const RHO = NEW.map((p, i) => p / OLD[i]!);
const ADV = [1, -1, 1];
// One whole answer's log-probabilities, when it was sampled and after a few updates.
const LP_OLD = -12.4;
const LP_NEW = -12.7;

/** A probability bar standing on `base`, `H` stage units tall at 1, with its value above. */
function bar(s: Scene, x: number, base: number, v: number, H: number, k: 'teal' | 'slate'): void {
  const hh = v * H * s.u;
  s.rrect(x - 3.6 * s.u, base - hh, 7.2 * s.u, hh, 0.8, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.9), lw: 0.25 });
  s.text(v.toFixed(2), x, base - hh - 2.8 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
}

/** Each token's old and new probability as paired bars, then its ratio, advantage and product. */
function tokens(s: Scene, xs: number[]): void {
  const base = s.h * 0.5;
  const lx = xs[0]! - 13 * s.u;
  s.line(xs[0]! - 11 * s.u, base, xs[2]! + 11 * s.u, base, s.c('--axis'), 0.35);
  const nw = s.ease('old', 0.8, 0.8);
  xs.forEach((x, i) => {
    bar(s, x - 4.4 * s.u * nw, base, OLD[i]!, 40, 'slate');
    s.alpha(nw, () => bar(s, x + 4.4 * s.u, base, NEW[i]!, 40, 'teal'));
  });
  rowLabel(s, 'π_old', lx, base - 14 * s.u, 'slate', 3);
  s.alpha(nw, () => rowLabel(s, 'π', lx, base - 7 * s.u, 'teal', 3.6));
  s.alpha(s.ease('rho', 0.6, 0.6), () => {
    rowLabel(s, 'ρ', lx, base + 8 * s.u, 'purple', 3.6);
    cells(s, xs, base + 8 * s.u, RHO.map((v) => fmt(v)), 'purple', { w: 12, h: 7, on: [s.win('eg', 'logs'), 0, 0] });
  });
  s.alpha(s.win('eg', 'logs'), () => s.text('0.3 / 0.2 = 1.5', s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple') }));
  s.alpha(s.ease('obj', 0.6), () => {
    rowLabel(s, 'A', lx, base + 17 * s.u, 'green', 3.6);
    cells(s, xs, base + 17 * s.u, ADV.map((v) => (v > 0 ? '+1' : '−1')), 'green', { w: 12, h: 7 });
    rowLabel(s, 'ρA', lx, base + 26 * s.u, '--ink-2', 3.4);
    cells(s, xs, base + 26 * s.u, RHO.map((v, i) => fmt(v * ADV[i]!)), 'slate', { w: 12, h: 7, on: [1, 1, 1] });
  });
}

/** A batch's life: π_old samples it, the updates move π, and π samples the next batch. */
function cycle(s: Scene): void {
  const xs = columns(s, 3, 30);
  const y = Y(s, 72);
  const step = (i: number, chip: string, k: Ink, under: string, uk: Ink, a: number, ua: number) =>
    s.alpha(a, () => {
      s.cell(xs[i]! - 11 * s.u, y - 3.5 * s.u, 22 * s.u, 7 * s.u, chip, k, { size: 3, on: i === 2 ? s.ease('next', 0.6, 0.4) : 0 });
      s.alpha(ua, () => s.text(under, xs[i]!, y + 7 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(uk) }));
      if (i > 0) s.arrow(xs[i - 1]! + 11.6 * s.u, y, xs[i]! - 11.6 * s.u, y, s.c('--ink-3'), 0.35, 1.6);
    });
  step(0, 'sample', 'slate', 'π_old', 'slate', s.ease('batch', 0.6, 0.4), s.ease('old', 0.6, 0.3));
  step(1, 'update ×4', 'teal', 'π moves', 'teal', s.ease('batch', 0.6, 2), s.ease('old', 0.6, 2.2));
  step(2, 'sample', 'teal', 'new π_old', 'teal', s.ease('next', 0.6), s.ease('next', 0.6, 1));
}

/** The tokens as one answer, with its log-probability before and after the updates. */
function answer(s: Scene, xs: number[]): void {
  brace(s, 'bottom', xs[0]! - 7 * s.u, xs[2]! + 7 * s.u, s.h * 0.1 + 6 * s.u, 'one whole answer', '--ink-3', 3);
  const hot = s.win('lognum', 'obj') * (1 - after(s, 'lognum', 0.5));
  logBoxes(s, Y(s, 36), LP_OLD, LP_NEW, hot, after(s, 'logs', 0.42), after(s, 'logs', 0.72));
}

/** ln π_old and ln π side by side as cells centered on `y`. */
function logBoxes(s: Scene, y: number, lo: number, ln: number, hot: number, a0: number, a1: number): void {
  const box = (x: number, name: string, v: number, k: Ink, a: number) =>
    s.alpha(a, () => {
      s.text(name, x, y - 7.6 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
      s.cell(x - 9 * s.u, y - 4 * s.u, 18 * s.u, 8 * s.u, nf(v), k, { on: hot, size: 3.6 });
    });
  box(s.w / 2 - 14 * s.u, 'ln π_old', lo, 'slate', a0);
  box(s.w / 2 + 14 * s.u, 'ln π', ln, 'teal', a1);
}

const ratio: SceneDef = {
  marks: {
    lq: { tex: String.raw`\ln \sym{rho}{\rho} = \ln \sym{pi}{\pi} - \ln \sym{piold}{\pi_{\text{old}}}`, x: 0.5, y: 0.54, size: 4.8 },
    ln1: { tex: String.raw`\ln \sym{rho}{\rho} = -12.7 - (-12.4) = -0.3`, x: 0.5, y: 0.66, size: 4.8 },
    ln2: { tex: String.raw`\sym{rho}{\rho} = e^{-0.3} \approx 0.74`, x: 0.5, y: 0.8, size: 5.2 },
  },
  draw(s) {
    const xs = columns(s, 3, 26);
    TOK.forEach((t, i) => s.cell(xs[i]! - 7 * s.u, s.h * 0.1 - 4 * s.u, 14 * s.u, 8 * s.u, t, 'purple', { on: i === 0 ? s.win('eg', 'logs') : 0, size: 3.4 }));
    const logs = s.win('logs', 'obj');
    s.alpha(1 - logs, () => tokens(s, xs));
    s.alpha(logs, () => answer(s, xs));
    s.alpha(1 - s.ease('rho', 0.5), () => cycle(s));
    const out = 1 - s.ease('obj', 0.5);
    s.show('lq', after(s, 'lognum', 0.02) * out);
    s.show('ln1', after(s, 'lognum', 0.3) * out);
    s.show('ln2', after(s, 'lognum', 0.66) * out);
  },
};

// ---- scene 2: two worked problems, as the practice asks them

const tryIt: SceneDef = {
  marks: {
    p1: { tex: String.raw`\ln \sym{piold}{\pi_{\text{old}}} = -15.2,\quad \ln \sym{pi}{\pi} = -15.4`, x: 0.5, y: 0.08, size: 4.6 },
    q1: { tex: String.raw`\text{the ratio } \sym{rho}{\rho}\text{?}`, x: 0.5, y: 0.17, size: 4.2 },
    s1: { tex: String.raw`\ln \sym{rho}{\rho} = -15.4 - (-15.2) = -0.2`, x: 0.5, y: 0.56, size: 4.6 },
    s2: { tex: String.raw`\sym{rho}{\rho} = e^{-0.2} \approx 0.82`, x: 0.5, y: 0.7, size: 5 },
    p2: { tex: String.raw`\sym{piold}{\pi_{\text{old}}} = 0.4,\quad \sym{pi}{\pi} = 0.6,\quad \sym{A}{A} = -2`, x: 0.5, y: 0.08, size: 4.6 },
    q2: { tex: String.raw`\text{its term in the objective?}`, x: 0.5, y: 0.17, size: 4.2 },
    s3: { tex: String.raw`\sym{rho}{\rho} = 0.6 / 0.4 = 1.5`, x: 0.5, y: 0.62, size: 4.6 },
    s4: { tex: String.raw`\sym{rho}{\rho}\sym{A}{A} = 1.5 \times (-2) = -3`, x: 0.5, y: 0.75, size: 5 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    s.show('p1', one);
    s.show('q1', one * after(s, 'p1', 0.7));
    s.alpha(one, () => logBoxes(s, Y(s, 36), -15.2, -15.4, after(s, 'a1', 0.05) * (1 - after(s, 'a1', 0.45)), after(s, 'p1', 0.2), after(s, 'p1', 0.5)));
    s.show('s1', one * after(s, 'a1', 0.08));
    s.show('s2', one * after(s, 'a1', 0.45));
    s.alpha(one * after(s, 'a1', 0.78), () => s.text('below 1: the answer became less likely', s.w / 2, Y(s, 86), { size: 3.2, color: s.c('--ink-2') }));
    const two = s.ease('p2', 0.6, 0.3);
    s.show('p2', two);
    s.show('q2', two * after(s, 'p2', 0.75));
    s.alpha(two, () => {
      const base = Y(s, 50);
      const x = s.w / 2;
      s.line(x - 14 * s.u, base, x + 14 * s.u, base, s.c('--axis'), 0.35);
      s.alpha(after(s, 'p2', 0.2), () => bar(s, x - 4.4 * s.u, base, 0.4, 36, 'slate'));
      s.alpha(after(s, 'p2', 0.4), () => bar(s, x + 4.4 * s.u, base, 0.6, 36, 'teal'));
      s.alpha(after(s, 'p2', 0.2), () => s.text('π_old', x - 4.4 * s.u, base + 3.6 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('slate') }));
      s.alpha(after(s, 'p2', 0.4), () => s.text('π', x + 4.4 * s.u, base + 3.6 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal') }));
      // Raising ρA with A < 0 means lowering π.
      push(s, x + 12 * s.u, base - 18 * s.u, -1, 12, after(s, 'a2', 0.7, 0.8));
    });
    s.show('s3', two * after(s, 'a2', 0.05));
    s.show('s4', two * after(s, 'a2', 0.4));
    s.alpha(two * after(s, 'a2', 0.72), () => s.text('A < 0: raising the objective pushes it down', s.w / 2, Y(s, 88), { size: 3.2, color: s.c('red') }));
  },
};

export const scenes: Record<string, SceneDef> = { ratio, try: tryIt };
