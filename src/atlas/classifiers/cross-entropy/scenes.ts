import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel } from '../../draw';
import { after, caption } from '../../networks/draw';

const f2 = (v: number) => v.toFixed(2);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Probability bars with option numbers under them and a gold `y` tag under the right one. */
function probBars(s: Scene, p: number[], yAt: number, o: { hi?: number[]; base?: number; tag?: number; fmt?: boolean } = {}) {
  const xs = columns(s, p.length, s.tall ? 24 : 26);
  const base = o.base ?? s.h * 0.62;
  rowLabel(s, 'p', xs[0]! - 13 * s.u, base - 6 * s.u, 'teal');
  bars(s, xs, base, p, 'teal', { max: 1, height: (base - s.h * 0.12) / s.u - 6, w: 11, fmt: o.fmt === false ? undefined : (v) => String(v), hi: o.hi });
  xs.forEach((x, i) => s.text(String(i), x, base + 4.5 * s.u, { size: 3.6, font: 'mono', color: s.c('--ink-3') }));
  const tx = lerp(xs[Math.floor(yAt)]!, xs[Math.ceil(yAt)]!, yAt - Math.floor(yAt));
  s.alpha(o.tag ?? 1, () => s.text('y', tx, base + 10.5 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('gold') }));
  return { xs, base };
}

// ---- what a bad guess should cost: the bars, then the curve the cost should follow

const P = [0.7, 0.2, 0.1];
/** A guess sure of option one, when option two is right. */
const SURE = [0.01, 0.98, 0.01];
const P_TOP = 5;
const P_END = Math.exp(-4.8);

/** The plot frame for L = -ln p. */
function frame(s: Scene) {
  const x0 = s.w * (s.tall ? 0.16 : 0.2);
  const x1 = s.w * (s.tall ? 0.86 : 0.82);
  const y0 = s.h * 0.8;
  const y1 = s.h * 0.08;
  const X = (p: number) => lerp(x0, x1, p);
  const Y = (L: number) => lerp(y0, y1, L / P_TOP);
  return { x0, x1, y0, y1, X, Y };
}
const CURVE = Array.from({ length: 160 }, (_, i) => Math.exp(-P_TOP) + (1 - Math.exp(-P_TOP)) * (i / 159) ** 2);

/** Where the moving dot sits: at 1, then 0.7, then 0.1, then off toward 0. */
function pNow(s: Scene): number {
  const a = s.ease('mid', 1.2, 0.3);
  const b = s.ease('low', 1.2, 0.3);
  const c = s.ease('zero', 1.6, 0.2);
  if (c > 0) return Math.exp(lerp(Math.log(0.1), Math.log(P_END), c));
  if (b > 0) return lerp(0.7, 0.1, b);
  return lerp(1, 0.7, a);
}

const cost: SceneDef = {
  marks: {
    px: { tex: String.raw`\symp_{\symy}`, x: 0.5, y: 0.87, size: 4 },
    f: { tex: String.raw`\symL = -\ln \symp_{\symy}`, x: 0.5, y: 0.93, size: 5 },
  },
  draw(s) {
    const B = s.ease('axes', 0.8);
    // Phase one: the guess as bars, and what each right answer should cost.
    s.alpha(1 - B, () => {
      const sure = after(s, 'more', 0.5, 0.8);
      const p = P.map((v, i) => lerp(v, SURE[i]!, sure));
      const mv = s.ease('more', 1.2);
      const yAt = lerp(0, 2, mv);
      const hi = [s.ease('y', 0.6) * (1 - mv), 0, mv];
      probBars(s, p.map((v) => Math.round(v * 100) / 100), yAt, { hi, tag: s.ease('y', 0.6), fmt: sure < 0.05 || sure > 0.95 });
      const cy = s.h * 0.9;
      s.alpha(s.win('loss', 'y'), () => caption(s, 'the loss: how bad the guess was', cy, 'red'));
      s.alpha(s.win('y', 'more'), () => caption(s, 'much on the truth: a small loss', cy, 'green'));
      s.alpha(s.ease('more', 0.6) * (1 - sure), () => caption(s, 'little on the truth: a bigger loss', cy, 'red'));
      s.alpha(sure, () => caption(s, 'sure, and wrong: the most of all', cy, 'red'));
    });
    if (B <= 0.003) return;
    // Phase two: the loss against the right answer's probability.
    s.alpha(B, () => {
      const F = frame(s);
      const ax = s.c('--axis');
      s.line(F.x0, F.y0, F.x1 + 2 * s.u, F.y0, ax, 0.35);
      s.line(F.x0, F.y0, F.x0, F.y1 - 1 * s.u, ax, 0.35);
      const t = { size: 3.2, font: 'mono', color: s.c('--ink-3') } as const;
      for (const p of [0, 0.5, 1]) s.text(String(p), F.X(p), F.y0 + 4 * s.u, t);
      for (const L of [0, 1, 2, 3, 4, 5]) s.text(String(L), F.x0 - 3 * s.u, F.Y(L), { ...t, align: 'right' });
      const named = s.ease('L', 0.6);
      s.alpha(1 - named, () => s.text('loss', F.x0, F.y1 - 4 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') }));
      s.alpha(named, () => s.text('L', F.x0, F.y1 - 4 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
      s.show('px', B, { x: (F.x1 + 6 * s.u) / s.w, y: F.y0 / s.h });

      // The two ends asked for, before the curve joins them.
      s.alpha(s.win('axes', 'one'), () => s.circle(F.X(1), F.Y(0), 1.3 * s.u, { fill: s.c('green') }));
      s.alpha(s.win('axes', 'curve'), () => {
        s.text('no loss at 1', F.X(1) - 2 * s.u, F.Y(0) - 9 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('green'), halo: true });
        s.arrow(F.X(0.04), F.Y(2.6), F.X(0.04), F.y1 + 1 * s.u, s.c('red'), 0.5, 2.4);
        s.text('no limit near 0', F.X(0.09), F.Y(3.6), { size: 3.4, font: 'mono', align: 'left', weight: 600, color: s.c('red'), halo: true });
      });

      const g = s.ease('curve', 1.6);
      const n = Math.max(2, Math.round(CURVE.length * g));
      const pts = CURVE.slice(CURVE.length - n).reverse();
      const c = s.ctx;
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(F.X(p), F.Y(-Math.log(p))) : c.moveTo(F.X(p), F.Y(-Math.log(p)))));
      c.strokeStyle = s.c('red');
      c.lineWidth = 0.6 * s.u;
      c.stroke();
      s.alpha(s.win('curve', 'one') * after(s, 'curve', 0.3), () => s.text('−ln p', F.X(0.22), F.Y(2.6), { size: 4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));

      // Points the voice reads, left behind as the dot slides on.
      const lab = (p: number, label: string, a: number, dx: number, dy: number, k: 'red' | 'green' = 'red') =>
        s.alpha(a, () => {
          s.circle(F.X(p), F.Y(-Math.log(p)), 1.1 * s.u, { fill: s.tint(k, 0.55) });
          s.text(label, F.X(p) + dx * s.u, F.Y(-Math.log(p)) + dy * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
        });
      lab(1, '', s.ease('mid', 0.6, 0.3), 0, 0, 'green');
      lab(0.7, '0.7 → 0.36', after(s, 'mid', 0.55), -6, -5.5);
      lab(0.1, '0.1 → 2.30', after(s, 'low', 0.55), 3, -1.5);
      s.alpha(s.ease('one', 0.6), () => {
        const p = pNow(s);
        const L = Math.min(-Math.log(p), P_TOP);
        const k = p > 0.95 ? 'green' : 'red';
        s.circle(F.X(p), F.Y(L), 1.5 * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.35 });
        // The right answer's bar, shrinking as the dot slides toward 0.
        const bx = F.X(0.86);
        const base = F.Y(2.7);
        const hh = p * (base - F.Y(4.7));
        s.rrect(bx - 3 * s.u, base - hh, 6 * s.u, Math.max(hh, 0.5 * s.u), 1, { fill: s.tint('teal', 0.45), stroke: s.c('teal'), lw: 0.3 });
        s.line(bx - 5 * s.u, base, bx + 5 * s.u, base, s.c('--axis'), 0.35);
        s.text(f2(p), bx, base - hh - 3 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal'), halo: true });
        s.text('on the truth', bx, base + 3.6 * s.u, { size: 3, font: 'mono', color: s.c('teal'), halo: true });
      });
      s.alpha(s.win('one', 'mid'), () => s.text('ln 1 = 0', F.X(1) - 2 * s.u, F.Y(0) - 9 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('green'), halo: true }));
      s.alpha(s.ease('zero', 0.6, 0.8), () => {
        s.arrow(F.X(0.05), F.Y(4.1), F.X(0.05), F.y1 - 1 * s.u, s.c('red'), 0.5, 2.4);
        s.text('→ ∞', F.X(0.09), F.Y(4.6), { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
      });
      s.show('f', s.ease('L', 0.6, 0.6));
    });
  },
};

// ---- surprise, entropy, and the cross: the same bars with each option's surprise above

const SUP = P.map((p) => -Math.log(p));
const ENT = P.reduce((t, p, i) => t + p * SUP[i]!, 0);
const TRUTH = [1, 0, 0];

const name: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\ln \symp_{\symy} = 0.36`, x: 0.5, y: 0.91, size: 4.6 },
  },
  draw(s) {
    const xs = columns(s, 3, s.tall ? 24 : 26);
    const lx = xs[0]! - 13 * s.u;
    const base = s.h * 0.5;
    const ySup = s.h * 0.13;
    const yP = s.h * 0.64;
    const yT = s.h * 0.77;
    const only = s.ease('only', 0.6);
    const keep = [1, 1 - 0.7 * only, 1 - 0.7 * only];
    // The guess.
    bars(s, xs, base, P, 'teal', { max: 1, height: 24, w: 11 });
    xs.forEach((x, i) => s.text(String(i), x, base + 4 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
    // Each option's surprise, above its bar.
    s.alpha(s.ease('surprise', 0.6, 0.6), () => {
      rowLabel(s, '−ln p', lx, ySup, 'red', 3.8);
      xs.forEach((x, i) => s.alpha(keep[i]!, () => cells(s, [x], ySup, [f2(SUP[i]!)], 'red', { w: 13, h: 8, on: [i === 0 ? only : s.win('surprise', 'shannon') * (i === 2 ? 1 : 0)] })));
    });
    // The weights: the guess's own, then the truth's.
    const cross = s.ease('cross', 0.6);
    s.alpha(s.ease('entropy', 0.6) * (1 - 0.65 * cross), () => {
      rowLabel(s, '× p', lx, yP, 'teal', 3.8);
      cells(s, xs, yP, P.map(String), 'teal', { w: 13, h: 8, on: [1, 1, 1].map(() => s.win('entropy', 'cross')) });
    });
    s.alpha(cross, () => {
      rowLabel(s, '× truth', lx, yT, 'gold', 3.8);
      xs.forEach((x, i) => s.alpha(keep[i]!, () => cells(s, [x], yT, [String(TRUTH[i])], 'gold', { w: 13, h: 8, on: [i === 0 ? 1 : 0] })));
    });
    const cy = s.h * 0.91;
    s.alpha(s.win('surprise', 'shannon'), () => caption(s, 'sure: no surprise · a tenth: a lot', cy, '--ink-2', 3.4));
    s.alpha(s.win('shannon', 'entropy'), () => caption(s, 'how uncertain is the guess?', cy, '--ink-2', 3.4));
    s.alpha(s.win('entropy', 'cross'), () => caption(s, `entropy: 0.25 + 0.32 + 0.23 ≈ ${f2(ENT)}`, cy, 'teal', 3.4));
    s.alpha(s.win('cross', 'only'), () => caption(s, 'surprise from the guess, weights from the truth', cy, 'gold', 3.2));
    s.show('f', only);
    cite(s, 'Claude Shannon, 1948', s.win('shannon', 'cross'));
  },
};

// ---- straight from the scores

const SS = [2, 1, -1];
const SE = SS.map((v) => Math.exp(v));
const ST = SE.reduce((a, b) => a + b, 0);
const TEN = Array.from({ length: 10 }, () => 0.1);

const scores: SceneDef = {
  marks: {
    py: { tex: String.raw`\symp_{\symy} = e^{2} / T`, x: 0.5, y: 0.49, size: 4.2 },
    quot: { tex: String.raw`\ln \symp_{\symy} = \ln e^{2} - \ln T`, x: 0.5, y: 0.585, size: 4.2 },
    undo: { tex: String.raw`\ln e^{2} = 2`, x: 0.5, y: 0.68, size: 4.2 },
    flip: { tex: String.raw`\symL = \ln T - 2 \approx 2.35 - 2 = 0.35`, x: 0.5, y: 0.775, size: 4.2 },
    f: { tex: String.raw`\symL = \ln T - \syms_{\symy}`, x: 0.5, y: 0.895, size: 5 },
  },
  draw(s) {
    const xs = columns(s, 3, s.tall ? 24 : 26);
    const lx = xs[0]! - 13 * s.u;
    const [ys, ye, yt] = [0.14, 0.285, 0.39].map((f) => s.h * f);
    rowLabel(s, 's', lx, ys, 'purple');
    cells(s, xs, ys, SS.map(String), 'purple', { on: [s.ease('py', 0.6), 0, 0] });
    s.text('y', xs[0]!, ys - 7.5 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('gold') });
    s.alpha(s.ease('s', 0.6, 2.4), () => {
      downArrows(s, xs, ys + 5.5 * s.u, ye - 5.5 * s.u);
      rowLabel(s, 'e', lx, ye, 'gold');
      cells(s, xs, ye, SE.map(f2), 'gold', { on: [s.ease('py', 0.6), 0, 0] });
    });
    s.alpha(s.ease('s', 0.6, 4), () => s.text(`T = ${SE.map(f2).join(' + ')} = ${f2(ST)}`, s.w / 2, yt, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));
    for (const k of ['py', 'quot', 'undo', 'flip']) s.show(k, s.ease(k, 0.6));
    s.show('f', s.ease('rule', 0.6));
    s.alpha(s.ease('rule', 0.6, 0.8), () => {
      const r = 19 * s.u;
      s.rrect(s.w / 2 - r, s.h * 0.895 - 5.5 * s.u, 2 * r, 11 * s.u, 2, { stroke: s.tint('red', 0.7), lw: 0.35 });
    });
  },
};

// ---- equal scores

const uniform: SceneDef = {
  marks: {
    recip: { tex: String.raw`\symL = -\ln(1/10) = \ln 10 \approx 2.30`, x: 0.5, y: 0.57, size: 4.4 },
    logC: { tex: String.raw`\symL = -\ln(1/C) = \ln C`, x: 0.5, y: 0.67, size: 4.6 },
    eight: { tex: String.raw`\ln 8 = \ln 2^{3} = 3 \ln 2`, x: 0.5, y: 0.78, size: 4.4 },
    eight2: { tex: String.raw`3 \ln 2 \approx 3 \times 0.693 \approx 2.08`, x: 0.5, y: 0.88, size: 4.4 },
  },
  draw(s) {
    const tx = columns(s, 10, s.tall ? 9 : 10);
    bars(s, tx, s.h * 0.38, TEN, 'teal', { max: 0.15, height: 22, w: 6.5, grow: s.ease('init', 0.8) });
    const ev = s.win('even', 'eight');
    s.alpha(s.ease('init', 0.6, 0.6) * (1 - ev), () => s.text('10 equal scores: p = 1/10 = 0.1 each', s.w / 2, s.h * 0.46, { size: 3.4, font: 'mono', color: s.c('teal') }));
    s.alpha(ev, () => s.text('an even split: the most uncertain guess', s.w / 2, s.h * 0.46, { size: 3.4, font: 'mono', color: s.c('teal') }));
    s.show('recip', s.ease('recip', 0.6));
    s.show('logC', s.ease('logC', 0.6));
    s.show('eight', s.ease('eight', 0.6));
    s.show('eight2', s.ease('eight2', 0.6));
    cite(s, 'Claude Shannon, 1948', ev);
  },
};

export const scenes: Record<string, SceneDef> = { cost, name, scores, uniform };
