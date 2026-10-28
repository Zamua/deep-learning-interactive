import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel, verdict } from '../../draw';
import { after, caption } from '../../networks/draw';
import { heat, rich } from '../draw';

const WORDS = ['cats', 'like', 'fresh', 'fish'];
const NEXT = ['like', 'fresh', 'fish', '?'];
// Scores for the 4 by 4 grid; only their sizes show, as shading.
const E = [
  [2, 1, 0, 1],
  [2, 0, 3, 1],
  [1, 2, 1, 0],
  [0, 1, 2, 2],
];

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A quadratic curve from (x0, y) to (x1, y) bulging by `bulge` (negative is up), with an arrowhead at its end. */
function arc(s: Scene, x0: number, x1: number, y: number, bulge: number, col: string, lw: number, dash?: number[]): [number, number] {
  const g = s.ctx;
  const cx = (x0 + x1) / 2;
  const cy = y + 2 * bulge;
  g.beginPath();
  g.moveTo(x0, y);
  g.quadraticCurveTo(cx, cy, x1, y);
  g.strokeStyle = col;
  g.lineWidth = lw * s.u;
  g.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  g.stroke();
  g.setLineDash([]);
  const f = 0.88;
  const px = (1 - f) ** 2 * x0 + 2 * (1 - f) * f * cx + f ** 2 * x1;
  const py = (1 - f) ** 2 * y + 2 * (1 - f) * f * cy + f ** 2 * y;
  if (!dash) s.arrow(px, py, x1, y, col, lw, 1.6);
  return [cx, y + bulge];
}

// ---- peek: every token reads every token, so the one ahead gives the answer away

const peek: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 21 : 24);
    const y = s.h * 0.55;
    const ty = s.h * 0.14;
    const gen = s.win('generate', 'cut');
    const cut = s.ease('cut', 0.8, 0.5);
    const allA = s.ease('all', 0.8, 0.4);
    const hd = (d: number) => (3.5 + 4.5 * d) * u;

    // What each position must predict.
    WORDS.forEach((_, j) => s.alpha(s.ease('predict', 0.5, 3 + 0.7 * j) * (1 - 0.7 * gen), () => s.text(`→ ${NEXT[j]}`, xs[j]!, ty, { size: 3, font: 'mono', weight: 600, color: s.c(j === 0 && s.win('cheat', 'generate') > 0.5 ? 'red' : '--ink-3') })));
    s.alpha(s.ease('predict', 0.5, 2.5), () => s.text('predicts', xs[0]! - 9 * u, ty, { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') }));

    // Arcs that point ahead go above the row; arcs to itself and the past go below.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const fwd = j > i;
        const grow = after(s, 'all', 0.15 + 0.12 * i, 0.5);
        if (grow <= 0) continue;
        const focus = i === 0 && j === 1 ? s.win('cheat', 'cut') : 0;
        const fromCats = i === 0 && fwd ? s.win('cheat', 'cut') : 0;
        const a = allA * grow * (fwd ? 1 - 0.8 * cut : 1);
        const col = fwd ? (cut > 0 || fromCats > 0.5 ? s.c('red') : s.c('--ink-3')) : cut > 0.5 ? s.c('teal') : s.c('--ink-3');
        s.alpha(a * (fwd && gen > 0 && i === 0 ? 1 : 1 - 0.6 * gen), () => {
          if (i === j) {
            s.circle(xs[i]! + 4.5 * u, y + 3.5 * u + 2.2 * u, 2.2 * u, { stroke: col, lw: 0.3 });
            return;
          }
          const edge = fwd ? y - 3.6 * u : y + 3.6 * u;
          const sx = xs[i]! + (fwd ? 2 : -3) * u;
          const ex = xs[j]! + (fwd ? -2 : 0) * u;
          const apex = arc(s, sx, ex, edge, fwd ? -hd(j - i) : hd(i - j), col, 0.3 + 0.35 * focus, fwd && cut > 0.5 ? [1, 1] : undefined);
          if (fwd) s.alpha(cut, () => s.text('×', apex[0], apex[1] + 0.3 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('red'), halo: true }));
        });
      }
    }
    WORDS.forEach((w, j) => {
      const ghost = j > 0 ? gen : 0;
      s.alpha(1 - ghost, () => s.cell(xs[j]! - 7.5 * u, y - 3.5 * u, 15 * u, 7 * u, w, 'orange', { on: j === 0 ? s.win('cheat', 'cut') : 0, size: 3.2 }));
      s.alpha(ghost, () => {
        s.rrect(xs[j]! - 7.5 * u, y - 3.5 * u, 15 * u, 7 * u, 1, { stroke: s.tint('--ink-3', 0.6), lw: 0.25 });
        s.text('?', xs[j]!, y + 0.2 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      });
    });
    const cy = s.h * 0.92;
    s.alpha(s.win('all', 'cheat'), () => caption(s, 'every token reads every token, at once', cy, '--ink-2', 3.2));
    s.alpha(s.win('cheat', 'generate'), () => rich(s, [['cats', 'orange'], [' reads ', '--ink-3'], ['like', 'red'], [': the answer it must predict', '--ink-3']], s.w / 2, cy, { size: 3.1 }));
    s.alpha(gen, () => caption(s, 'generating: the next token is not there yet', cy, 'red', 3.1));
    s.alpha(s.win('cut', 'causal'), () => caption(s, 'each token reads itself and the past', cy, 'teal', 3.2));
    s.alpha(s.ease('causal', 0.6), () => {
      caption(s, 'causal: an output depends only on what came before', cy, '--ink-2', 3);
      s.arrow(xs[0]! - 6 * u, s.h * 0.83, xs[3]! + 6 * u, s.h * 0.83, s.c('--ink-3'), 0.35, 1.8);
      s.text('time', xs[3]! + 8 * u, s.h * 0.83, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
  },
};

/** The 4 by 4 score grid with its words; row i reads, column j is read. */
function grid(s: Scene, x0: number, y0: number, c: number, o: { upper?: number; masked?: number; ones?: number; hot?: number } = {}): void {
  const u = s.u;
  const masked = o.masked ?? 0;
  const ones = o.ones ?? 0;
  WORDS.forEach((w, j) => s.text(w, x0 + j * c * u, y0 - c * 0.5 * u - 3 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('purple') }));
  WORDS.forEach((w, i) => s.text(w, x0 - c * 0.5 * u - 1.5 * u, y0 + i * c * u, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('teal') }));
  heat(s, x0, y0, 4, c, (i, j) => (j > i && masked > 0.5 ? null : 0.12 + 0.18 * E[i]![j]!), 'slate', { text: () => '', size: 2.8 });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cx = x0 + j * c * u;
      const cy = y0 + i * c * u;
      const up = j > i;
      const label = { size: 2.8, font: 'mono', weight: 600 } as const;
      if (up) {
        s.alpha((o.upper ?? 0) * (1 - masked), () => s.rrect(cx - (c / 2 - 0.4) * u, cy - (c / 2 - 0.4) * u, (c - 0.8) * u, (c - 0.8) * u, 0.8, { fill: s.tint('red', 0.14), stroke: s.tint('red', 0.5), lw: 0.25 }));
        s.alpha(masked, () => {
          s.rrect(cx - (c / 2 - 0.4) * u, cy - (c / 2 - 0.4) * u, (c - 0.8) * u, (c - 0.8) * u, 0.8, { fill: s.tint('red', 0.12), stroke: s.tint('red', 0.45), lw: 0.25 });
          s.text('−∞', cx, cy + 0.2 * u, { ...label, color: s.c('red') });
        });
      }
      const num = up ? 1 - masked : 1;
      s.alpha(num * (1 - ones), () => s.text(String(E[i]![j]), cx, cy + 0.2 * u, { ...label, color: s.c('--ink') }));
      s.alpha(ones * (up ? 1 - masked : 1), () => s.text(up ? '0' : '1', cx, cy + 0.2 * u, { ...label, color: s.c(up ? 'red' : 'green') }));
    }
  }
  if (o.hot) s.alpha(o.hot, () => s.rrect(x0 + (c - c / 2) * u, y0 - (c / 2) * u, c * u, c * u, 1, { stroke: s.c('red'), lw: 0.6 }));
}

/** The lower triangle, diagonal included, outlined. */
function lower(s: Scene, x0: number, y0: number, c: number, k: 'green' | 'teal', a: number): void {
  const u = s.u;
  const l = x0 - (c / 2) * u;
  const t = y0 - (c / 2) * u;
  const g = s.ctx;
  s.alpha(a, () => {
    g.beginPath();
    g.moveTo(l, t);
    for (let i = 0; i < 4; i++) {
      g.lineTo(l + (i + 1) * c * u, t + i * c * u);
      g.lineTo(l + (i + 1) * c * u, t + (i + 1) * c * u);
    }
    g.lineTo(l, t + 4 * c * u);
    g.closePath();
    g.strokeStyle = s.c(k);
    g.lineWidth = 0.55 * u;
    g.stroke();
  });
}

// ---- grid: the arcs ahead are the cells above the diagonal

const gridScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = 11;
    const x0 = s.w / 2 - 1.5 * c * u + 4 * u;
    const y0 = s.h * 0.24;
    const masked = s.ease('inf', 0.8, 0.8);
    const ones = s.win('tril', 'inf');
    grid(s, x0, y0, c, { upper: s.ease('upper', 0.6), masked, ones, hot: s.win('fold', 'upper') });
    lower(s, x0, y0, c, 'green', s.ease('tril', 0.6));
    const lab = { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-3') } as const;
    s.alpha(s.ease('fold', 0.6, 1), () => {
      s.text('j →', x0 + 3.5 * c * u + 1 * u, y0 - c * 0.5 * u - 3 * u, { ...lab, align: 'left' });
      s.text('i ↓', x0 - c * 0.5 * u - 1.5 * u, y0 + 3.5 * c * u + 1.5 * u, { ...lab, align: 'right' });
    });
    s.alpha(s.ease('upper', 0.6, 1), () => s.text('j > i', x0 + 3.5 * c * u + 2 * u, y0 + 1 * c * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    s.alpha(s.ease('tril', 0.6, 1), () => s.text('keep: itself and the past', x0 + 2 * c * u, y0 + 3.5 * c * u + 3.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('green'), halo: true }));
    cite(s, 'Vaswani et al., 2017', s.win('inf', 'zero'));
    const cy = s.h * 0.82;
    s.alpha(s.win('fold', 'upper'), () => caption(s, 'row cats, column like: the arc from cats to like', cy, '--ink-2', 3));
    s.alpha(s.win('upper', 'tril'), () => caption(s, 'ahead: the triangle above the diagonal', cy, 'red', 3.2));
    s.alpha(s.win('tril', 'inf'), () => caption(s, 'np.tril: 1 on and below the diagonal', cy, 'green', 3.2));
    s.alpha(s.win('inf', 'zero'), () => caption(s, 'masked before the softmax: −∞', cy, 'red', 3.2));
    s.alpha(s.ease('zero', 0.6), () => {
      const x = s.w / 2 - (s.tall ? 24 : 26) * u;
      verdict(s, false, 'set to 0: e⁰ = 1, still a share', x, cy, 3.2);
      s.alpha(after(s, 'zero', 0.6), () => verdict(s, true, 'set to −∞: e^−∞ = 0, none', x, cy + 6 * u, 3.2));
    });
  },
};

// ---- renorm: softmax over the scores that are left

const ROW = [2, 0, 3, 1];
const softKept = (keep: number) => {
  const x = ROW.map((v, j) => (j <= keep ? Math.exp(v) : 0));
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
};
const W = softKept(1);
const FULL = softKept(3);
const ZEROED = FULL.map((v, j) => (j <= 1 ? v : 0));

const renorm: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 18).map((x) => x + 4 * u);
    WORDS.forEach((w, j) => s.text(w, xs[j]!, s.h * 0.08, { size: 3.2, font: 'mono', weight: 600, color: s.c(j > 1 ? '--ink-3' : 'purple') }));
    rowLabel(s, 'like', xs[0]! - 9 * u, s.h * 0.19, 'teal', 3.4);
    cells(s, xs, s.h * 0.19, ROW.map(String), 'slate', { w: 11, h: 7, size: 3.2, on: [0, 0, s.win('row', 'hide'), s.win('row', 'hide')] });
    s.alpha(s.ease('hide', 0.6) * (1 - 0.7 * s.ease('wrong', 0.8, 1.2)), () => {
      rowLabel(s, 'masked', xs[0]! - 9 * u, s.h * 0.31, 'red', 3.2);
      cells(s, xs.slice(0, 2), s.h * 0.31, ['2', '0'], 'slate', { w: 11, h: 7, size: 3.2 });
      cells(s, xs.slice(2), s.h * 0.31, ['−∞', '−∞'], 'red', { w: 11, h: 7, size: 3.2, on: [1, 1] });
    });
    const base = s.h * 0.74;
    const wrong = s.ease('wrong', 0.8, 1.2);
    const v = W.map((w, j) => w + (ZEROED[j]! - w) * wrong);
    s.alpha(s.ease('weights', 0.6), () => {
      rowLabel(s, 'weights', xs[0]! - 9 * u, base - 5 * u, wrong > 0.5 ? 'red' : 'green', 3.2);
      bars(s, xs, base, v, wrong > 0.5 ? 'red' : 'green', { max: 1, height: 24, w: 9, fmt: (x) => (x < 0.005 ? '0' : x.toFixed(2)), grow: s.ease('weights', 1, 0.3), hi: [s.win('weights', 'sum'), s.win('sum', 'wrong'), 0, 0] });
      WORDS.forEach((w, j) => s.text(w, xs[j]!, base + 3.6 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    });
    const cy = s.h * 0.9;
    s.alpha(s.win('weights', 'sum'), () => caption(s, 'e² / (e² + 1) = 7.39 / 8.39 ≈ 0.88', cy, 'green', 3.2));
    s.alpha(s.win('sum', 'wrong'), () => caption(s, '0.88 + 0.12 = 1', cy, 'green', 3.4));
    s.alpha(wrong, () => caption(s, 'softmax first, then zero: 0.24 + 0.03 = 0.27', cy, 'red', 3.1));
  },
};

// ---- count: the kept triangle and the hidden one

const count: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = 10.5;
    const x0 = s.w / 2 - 1.5 * c * u - 4 * u;
    const y0 = s.h * 0.16;
    const hid = s.ease('hidden', 0.6);
    grid(s, x0, y0, c, { masked: 1, upper: 1 });
    lower(s, x0, y0, c, 'green', s.ease('rows', 0.6) * (1 - 0.6 * hid));
    const kx = x0 + 3.5 * c * u + 4 * u;
    const hx = kx + 11 * u;
    const hy = y0 - c * 0.5 * u - 3 * u;
    s.text('kept', kx, hy, { size: 2.6, font: 'mono', color: s.c('green') });
    [1, 2, 3, 4].forEach((n, i) => s.alpha(after(s, 'rows', 0.3 + 0.12 * i, 0.4), () => s.text(`${n}`, kx, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('green') })));
    // The pairs, joined on the right of the kept counts.
    s.alpha(s.win('pairs', 'hidden'), () => {
      const g = s.ctx;
      const link = (a: number, b: number, dx: number) => {
        g.beginPath();
        g.moveTo(kx + 2.5 * u, y0 + a * c * u);
        g.bezierCurveTo(kx + dx * u, y0 + a * c * u, kx + dx * u, y0 + b * c * u, kx + 2.5 * u, y0 + b * c * u);
        g.strokeStyle = s.c('green');
        g.lineWidth = 0.35 * u;
        g.stroke();
      };
      link(0, 3, 9);
      s.alpha(after(s, 'pairs', 0.45), () => link(1, 2, 6));
    });
    s.alpha(hid, () => {
      s.text('hidden', hx, hy, { size: 2.6, font: 'mono', color: s.c('red') });
      [3, 2, 1, 0].forEach((n, i) => s.text(`${n}`, hx, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') }));
    });
    const o = { size: s.tall ? 3.1 : 3.5, weight: 600 };
    const ly = (k: number) => s.h * (0.6 + 0.07 * k);
    s.alpha(s.win('rows', 'add'), () => caption(s, 'token i keeps i + 1: itself and the past', ly(0), '--ink-2', o.size));
    s.alpha(s.ease('add', 0.6), () => rich(s, [['1 + 2 + 3 + 4 = ', '--ink-2'], ['10', 'green'], [' of 16', '--ink-3']], s.w / 2, ly(0), o));
    s.alpha(s.ease('pairs', 0.6, 0.5), () => rich(s, [['(1 + 4) + (2 + 3) = 5 + 5', '--ink-2']], s.w / 2, ly(1), o));
    s.alpha(s.ease('formula', 0.6), () => rich(s, [['kept: T(T + 1) / 2 = 4 × 5 / 2 = ', '--ink-2'], ['10', 'green']], s.w / 2, ly(2), o));
    s.alpha(s.ease('hidden', 0.6, 0.8), () => rich(s, [['hidden: 16 − 10 = ', '--ink-2'], ['6', 'red']], s.w / 2, ly(3), o));
    s.alpha(s.ease('general', 0.6), () => rich(s, [['T² − kept = ', '--ink-2'], ['T(T − 1) / 2', 'red'], [' = 6', '--ink-3']], s.w / 2, ly(4), o));
  },
};

export const scenes: Record<string, SceneDef> = { peek, grid: gridScene, renorm, count };
