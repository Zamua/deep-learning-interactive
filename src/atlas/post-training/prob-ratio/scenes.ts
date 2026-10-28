import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { cells, columns, rowLabel } from '../../draw';
import { push, rich, type Ink } from '../draw';

const Y = (s: Scene, v: number) => (v / 100) * s.h;
/** A number with at most two places and a typographic minus: `1.5`, `−0.8`, `0.85`. */
const nf = (v: number) => String(+v.toFixed(2)).replace('-', '−');
const sgn = (v: number) => (v > 0 ? `+${nf(v)}` : nf(v));

/** Who introduced an idea, and when: small and italic, under the idea's name. */
function byline(s: Scene, text: string, y: number) {
  s.text(text, s.w / 2, y, { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true });
}

// The seven times eight model: its answers, π_old when the batch was drawn, and π after one update.
const ANS = ['56', '54', '64'];
const OLD = [0.5, 0.3, 0.2];
const NEW = [0.6, 0.3, 0.1];
const RHO = NEW.map((p, i) => p / OLD[i]!);
const BATCH = [5, 3, 2];
const FRESH = [5, 3, 2].map((_, i) => Math.round(NEW[i]! * 10));
const R = [1, 0, 0];
const ADV = R.map((r) => r - 0.5);

/** A probability bar standing on `base`, `H` stage units tall at 1, with its value above. */
function bar(s: Scene, x: number, base: number, v: number, H: number, k: 'teal' | 'slate'): void {
  const hh = v * H * s.u;
  s.rrect(x - 3.4 * s.u, base - hh, 6.8 * s.u, hh, 0.8, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.9), lw: 0.25 });
  s.text(v.toFixed(1), x, base - hh - 2.8 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
}

/** Each answer's π_old and π as paired bars over its label; `nw` fades π in and `mv` moves it from π_old to its new value. */
function probs(s: Scene, xs: number[], base: number, nw: number, mv: number): void {
  s.line(xs[0]! - 10 * s.u, base, xs[2]! + 10 * s.u, base, s.c('--axis'), 0.35);
  xs.forEach((x, i) => {
    bar(s, x - 4 * s.u, base, OLD[i]!, 36, 'slate');
    s.alpha(nw, () => bar(s, x + 4 * s.u, base, OLD[i]! + (NEW[i]! - OLD[i]!) * mv, 36, 'teal'));
    s.text(ANS[i]!, x, base + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink') });
  });
  const kx = xs[2]! + 11 * s.u;
  const ky = base - 30 * s.u;
  s.text('π_old', kx, ky, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
  s.alpha(nw, () => s.text('π', kx, ky + 5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('teal') }));
}

/** Ten answers in a row, grouped by answer: `counts` of each, chips `w` units wide. */
function draws(s: Scene, y: number, counts: number[], k: Ink, o: { dash?: boolean; on?: (g: number) => number } = {}): number[] {
  const w = 7.4 * s.u;
  const gap = 1 * s.u;
  const extra = 2.4 * s.u;
  const n = counts.reduce((a, b) => a + b, 0);
  let x = s.w / 2 - (n * w + (n - 1) * gap + (counts.length - 1) * extra) / 2;
  const mids: number[] = [];
  counts.forEach((c, g) => {
    const x0 = x;
    for (let i = 0; i < c; i++) {
      if (o.dash) {
        const ctx = s.ctx;
        ctx.save();
        ctx.setLineDash([0.8 * s.u, 0.7 * s.u]);
        s.rrect(x, y - 3.2 * s.u, w, 6.4 * s.u, 1.2, { stroke: s.tint(k, 0.8), lw: 0.3 });
        ctx.restore();
        s.text(ANS[g]!, x + w / 2, y + 0.2 * s.u, { size: 2.8, font: 'mono', color: s.c(k) });
      } else s.cell(x, y - 3.2 * s.u, w, 6.4 * s.u, ANS[g]!, k, { on: o.on?.(g) ?? 0, size: 2.8 });
      x += w + gap;
    }
    mids.push((x0 + x - gap) / 2);
    x += extra;
  });
  return mids;
}

// ---- scene 1: one batch, several updates, and the count goes stale

const stale: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 24);
    const base = Y(s, 42);
    probs(s, xs, base, s.ease('old', 0.8, 1), s.ease('moved', 1));
    const by = Y(s, 64);
    s.text('the batch, drawn by π_old', s.w / 2, by - 6.5 * s.u, { size: 3, color: s.c('slate') });
    const wrong = (g: number) => (g === 1 ? 0 : s.ease('stale', 0.6));
    const mids = draws(s, by, BATCH, 'slate', { on: wrong });
    s.alpha(s.ease('slow', 0.6, 2), () => s.text('4 updates on these same 10 draws', s.w / 2, Y(s, 8), { size: 3.2, font: 'mono', color: s.c('teal') }));
    const fy = Y(s, 84);
    s.alpha(after(s, 'moved', 0.45), () => {
      s.text('a fresh batch from π', s.w / 2, fy - 6.5 * s.u, { size: 3, color: s.c('teal') });
      draws(s, fy, FRESH, 'teal', { dash: true });
    });
    s.alpha(s.ease('stale', 0.6, 0.4), () => {
      mids.forEach((m, g) => {
        if (g === 1) return;
        s.text(`${BATCH[g]}, not ${FRESH[g]}`, m, by + 6 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      });
    });
  },
};

// ---- scene 2: the ratio fixes the count

const ratio: SceneDef = {
  marks: {
    rho: { tex: String.raw`\sym{rho}{\rho} = \sym{pi}{\pi} \,/\, \sym{piold}{\pi_{\text{old}}}`, x: 0.5, y: 0.07, size: 5 },
  },
  draw(s) {
    const xs = columns(s, 3, 24);
    const base = Y(s, 42);
    probs(s, xs, base, 1, 1);
    s.show('rho', s.ease('fix', 0.6, 1.5));
    // Each answer's weight, in the row under its label.
    const ry = base + 11 * s.u;
    const shown = [s.ease('w56', 0.6, 2), s.ease('w64', 0.6, 0.8), after(s, 'w64', 0.6)];
    const lit = [s.win('w56', 'w64'), s.win('w64', 'rho'), s.win('w64', 'rho')];
    xs.forEach((x, i) => s.alpha(shown[i]!, () => cells(s, [x], ry, [nf(RHO[i]!)], 'purple', { w: 11, h: 6.5, on: [lit[i]!], size: 3.2 })));
    s.alpha(s.ease('rho', 0.6), () => rowLabel(s, 'ρ', xs[0]! - 8 * s.u, ry, 'purple', 3.6));
    // The batch, its draws now weighted: each group counts as a fresh batch would.
    const by = Y(s, 72);
    const batch = 1 - s.ease('next', 0.6);
    s.alpha(batch, () => {
      const mids = draws(s, by, BATCH, 'slate', { on: (g) => [s.win('six', 'w64'), after(s, 'w64', 0.6) * (1 - s.ease('rho', 0.6)), s.win('w64', 'rho')][g]! });
      const tally = [after(s, 'six', 0.05), after(s, 'w64', 0.7), after(s, 'w64', 0.2)];
      mids.forEach((m, g) =>
        s.alpha(tally[g]!, () => s.text(`${BATCH[g]} × ${nf(RHO[g]!)} = ${FRESH[g]}`, m, by + 6.5 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('purple'), halo: true })),
      );
      s.alpha(s.ease('rho', 0.6, 2) * (1 - s.ease('kahn', 0.6)), () => s.text('before any update: π = π_old, so ρ = 1', s.w / 2, by + 14 * s.u, { size: 3.1, color: s.c('--ink-2') }));
      s.alpha(s.win('kahn', 'next'), () => s.text('importance sampling', s.w / 2, by + 13 * s.u, { size: 3.4, italic: true, weight: 600, color: s.c('purple') }));
      const hy = by + 19.5 * s.u;
      s.alpha(s.win('kahn', 'schulman'), () => byline(s, 'Herman Kahn & Andrew Marshall, 1953', hy));
      s.alpha(s.win('schulman', 'next'), () => byline(s, 'John Schulman et al., 2015', hy));
    });
    cycle(s, Y(s, 78));
  },
};

/** A batch's life: π_old draws it, the updates move π, and π draws the next batch. */
function cycle(s: Scene, y: number): void {
  const xs = columns(s, 3, 30);
  const step = (i: number, chip: string, k: Ink, under: string, uk: Ink, a: number, ua: number) =>
    s.alpha(a, () => {
      s.cell(xs[i]! - 11 * s.u, y - 3.5 * s.u, 22 * s.u, 7 * s.u, chip, k, { size: 3, on: i === 2 ? s.ease('next', 0.6, 2) : 0 });
      s.alpha(ua, () => s.text(under, xs[i]!, y + 7 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(uk) }));
      if (i > 0) s.arrow(xs[i - 1]! + 11.6 * s.u, y, xs[i]! - 11.6 * s.u, y, s.c('--ink-3'), 0.35, 1.6);
    });
  step(0, 'draw', 'slate', 'π_old', 'slate', s.ease('next', 0.6, 0.3), s.ease('next', 0.6, 0.3));
  step(1, 'update ×4', 'teal', 'π moves', 'teal', s.ease('next', 0.6, 0.8), s.ease('next', 0.6, 0.8));
  step(2, 'draw', 'teal', 'new π_old', 'teal', s.ease('next', 0.6, 1.6), s.ease('next', 0.6, 2.2));
}

// ---- scene 3: the objective, measured on the old batch

const objective: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 21).map((x) => x + 6 * s.u);
    const lx = xs[0]! - 8 * s.u;
    const row = (i: number) => Y(s, 24) + i * 9 * s.u;
    const cw = { w: 12, h: 6.5, size: 3.2 };
    // The J of each model, from its probabilities.
    const jy = Y(s, 8);
    s.alpha(s.ease('J', 0.6, 4), () =>
      rich(s, [["π_old's J = ", 'slate'], ['0.5', 'slate'], ['     ', '--ink-3'], ["π's J = ", 'teal'], ['0.6', 'teal']], s.w / 2, jy, { size: 3.4, weight: 650 }),
    );
    xs.forEach((x, i) => s.text(ANS[i]!, x, row(0), { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink') }));
    rowLabel(s, 'in batch', lx, row(1), 'slate', 3);
    cells(s, xs, row(1), BATCH.map(String), 'slate', cw);
    rowLabel(s, 'ρ', lx, row(2), 'purple', 3.6);
    cells(s, xs, row(2), RHO.map(nf), 'purple', { ...cw, on: [s.win('weighted', 'obj'), 0, 0] });
    s.alpha(s.ease('J', 0.6, 2), () => {
      rowLabel(s, 'R', lx, row(3), 'gold', 3.6);
      cells(s, xs, row(3), R.map(String), 'gold', { ...cw, on: [s.win('plain', 'obj'), 0, 0] });
    });
    s.alpha(s.ease('obj', 0.6, 1.5), () => {
      rowLabel(s, 'A', lx, row(4), 'green', 3.6);
      cells(s, xs, row(4), ADV.map(sgn), 'green', { ...cw, on: [s.win('term', 'push'), s.win('push'), s.win('push')] });
    });
    s.alpha(s.ease('term', 0.6, 2), () => {
      rowLabel(s, 'ρA', lx, row(5), '--ink-2', 3.4);
      cells(s, xs, row(5), RHO.map((r, i) => nf(r * ADV[i]!)), 'slate', { ...cw, on: [1, after(s, 'push', 0.1), after(s, 'push', 0.1)] });
    });
    // Raising ρA pushes π up where A > 0 and down where A < 0.
    xs.forEach((x, i) => push(s, x + 9 * s.u, row(5), Math.sign(ADV[i]!), 6, s.ease('push', 0.8, 1.5)));
    const ty = row(5) + 11 * s.u;
    const o = { size: 3.2, weight: 600 };
    s.alpha(s.win('plain', 'weighted'), () => rich(s, [['5 × 1 / 10 = ', '--ink-2'], ['0.5', 'slate'], [": π_old's J", 'slate']], s.w / 2, ty, o));
    s.alpha(s.win('weighted', 'obj'), () => rich(s, [['5 × 1.2 × 1 / 10 = ', '--ink-2'], ['0.6', 'teal'], [": π's J", 'teal']], s.w / 2, ty, o));
    s.alpha(s.win('obj', 'term'), () => rich(s, [['objective = the mean of ', '--ink-2'], ['ρA', 'purple']], s.w / 2, ty, o));
    s.alpha(s.win('term', 'push'), () => rich(s, [['1.2 × 0.5 = ', '--ink-2'], ['0.6', 'green']], s.w / 2, ty, o));
    s.alpha(s.ease('push', 0.6, 2), () => s.text('the sign of A sets the direction', s.w / 2, ty, { size: 3.2, color: s.c('--ink-2') }));
  },
};

// ---- scene 4: the ratio from log-probabilities

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

const logs: SceneDef = {
  marks: {
    lq: { tex: String.raw`\ln \sym{rho}{\rho} = \ln \sym{pi}{\pi} - \ln \sym{piold}{\pi_{\text{old}}}`, x: 0.5, y: 0.55, size: 4.8 },
    ln1: { tex: String.raw`\ln \sym{rho}{\rho} = -12.7 - (-12.4) = -0.3`, x: 0.5, y: 0.67, size: 4.8 },
    ln2: { tex: String.raw`\sym{rho}{\rho} = e^{-0.3} \approx 0.74`, x: 0.5, y: 0.81, size: 5.2 },
  },
  draw(s) {
    // Twenty tokens, each at a half: their product is under one in a million.
    const n = 20;
    const w = 3.8 * s.u;
    const gap = 0.6 * s.u;
    const x0 = s.w / 2 - (n * w + (n - 1) * gap) / 2;
    const up = s.ease('logs', 0.9);
    const ty = Y(s, 40 - 31 * up);
    const dim = 1 - 0.6 * up;
    s.alpha(dim, () => {
      for (let i = 0; i < n; i++) {
        const a = s.ease('tiny', 0.3, 0.6 + i * 0.08);
        s.alpha(a, () => s.cell(x0 + i * (w + gap), ty - 2.6 * s.u, w, 5.2 * s.u, '½', 'teal', { size: 2.4, on: i === 0 ? s.win('token', 'turn') : 0 }));
      }
      s.alpha(after(s, 'tiny', 0.6), () => rich(s, [['0.5', 'teal'], ['²⁰', 'teal'], [' = 0.00000095', '--ink-2']], s.w / 2, ty + 7 * s.u, { size: 3.2, weight: 600 }));
    });
    s.alpha(s.win('token', 'turn'), () => rich(s, [['one token: ', '--ink-2'], ['ρ', 'purple'], [' = its π / its π_old', '--ink-2']], s.w / 2, Y(s, 92), { size: 3.2, weight: 600 }));
    const hot = s.win('quot', 'exp') * (1 - after(s, 'quot', 0.5));
    s.alpha(s.ease('logs', 0.6), () => logBoxes(s, Y(s, 36), -12.4, -12.7, hot, after(s, 'logs', 0.42), after(s, 'logs', 0.72)));
    s.show('lq', after(s, 'quot', 0.02));
    s.show('ln1', after(s, 'quot', 0.4));
    s.show('ln2', after(s, 'exp', 0.05));
    s.alpha(after(s, 'exp', 0.6) * (1 - s.ease('token', 0.6)), () => s.text('below 1: the answer became less likely', s.w / 2, Y(s, 92), { size: 3.2, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { stale, ratio, objective, logs };
