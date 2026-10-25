import type { Scene, SceneDef } from '../../../lecture/scene';
import { band, brace, ghost, grid, type Grid, matrix, note, rich, stack } from '../draw';

const TOK = ['cat', 'dog', 'sat', 'mat'];
const W = [
  [1, 0],
  [3, 1],
  [-1, 2],
  [-1, -1],
];
const H = [2, 1];
const S = W.map((r) => r[0]! * H[0]! + r[1]! * H[1]!);
const TOP = S.indexOf(Math.max(...S));
const f = (v: number) => String(v).replace('-', '−');

/** The product W_U h = s laid out left to right: names, matrix, h, =, s. */
function layout(s: Scene) {
  const g = grid(s, s.w / 2 - (s.tall ? 12 : 14) * s.u, s.h * 0.42, 4, 2, 11, 10.5);
  const hx = g.r + 11 * s.u;
  const sx = hx + 17 * s.u;
  return { g, hx, sx, nx: g.l - 3 * s.u };
}

function names(s: Scene, g: Grid, x: number, on: (i: number) => number = () => 0): void {
  TOK.forEach((t, i) => s.text(t, x, g.y(i), { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(on(i) > 0.5 ? 'gold' : '--ink-2') }));
}

const score: SceneDef = {
  draw(s) {
    const { g, hx, sx, nx } = layout(s);
    const cy = (g.t + g.b) / 2;
    s.alpha(s.ease('vector', 0.6), () => {
      stack(s, hx, cy, H.map(f), 'gold', { w: 9, h: 8, gap: 10.5, size: 3.4, on: [s.win('row', 'all'), s.win('row', 'all')] });
      s.text('h', hx, cy - 15 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('gold') });
      note(s, 'd = 2', hx, cy + 15 * s.u, '--ink-3', 3);
    });
    s.alpha(s.ease('need', 0.6), () => {
      names(s, g, nx, (i) => (i === 1 ? s.win('row', 'all') : i === TOP ? s.ease('all', 0.6, 3) : 0));
      s.text('=', sx - 8.5 * s.u, cy, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
      s.text('s', sx, g.t - 5 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
      TOK.forEach((_, i) => {
        const done = i === 1 ? s.ease('row', 0.6, 2.5) : s.ease('all', 0.5, 0.4 * i);
        s.alpha(1 - done, () => ghost(s, sx, g.y(i), '?', 'purple', 9, 8));
        s.alpha(done, () => s.cell(sx - 4.5 * s.u, g.y(i) - 4 * s.u, 9 * s.u, 8 * s.u, f(S[i]!), 'purple', { on: i === TOP ? s.ease('all', 0.6, 3) : 0, size: 3.4 }));
      });
    });
    s.alpha(s.ease('matrix', 0.7), () => {
      matrix(s, g, W.map((r) => r.map(f)), 'blue', { w: 10, h: 8, size: 3.4 });
      brace(s, 'top', g.l + 1 * s.u, g.r - 1 * s.u, g.t - 1.5 * s.u, 'd = 2', 'blue', 3);
      s.text('·', (g.r + hx - 4.5 * s.u) / 2, cy, { size: 5, font: 'mono', color: s.c('--ink-3') });
      rich(s, [['W_U', 'blue'], [': (V, d) = (4, 2)', '--ink-3']], (g.l + g.r) / 2, g.b + 6 * s.u, { size: 3.2 });
    });
    band(s, g, 'row', 1, 'gold', s.win('row', 'all'));
    s.alpha(s.win('row', 'all'), () => rich(s, [['dog: ', 'gold'], ['3×2 + 1×1 = ', '--ink-2'], ['7', 'purple']], s.w / 2, s.h * 0.84, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('all', 0.6, 1), () => {
      rich(s, [['s = ', 'purple'], ['W_U', 'blue'], [' h', 'gold'], ['  one score per token', '--ink-3']], s.w / 2, s.h * 0.82, { size: 3.6, weight: 600 });
      note(s, 'the logits: dog scores highest', s.w / 2, s.h * 0.9, '--ink-3', 3.2);
    });
  },
};

/** Arrows for d = 2: each token's embedding row in blue, h in gold. */
function plane(s: Scene, a: number, lab: number): void {
  s.alpha(a, () => {
    const k = (s.tall ? 10.5 : 11) * s.u;
    const ox = s.w / 2 - 8 * s.u;
    const oy = s.h * 0.48;
    const X = (x: number) => ox + x * k;
    const Y = (y: number) => oy - y * k;
    s.line(X(-1.9), oy, X(3.5), oy, s.c('--axis'), 0.3);
    s.line(ox, Y(-1.6), ox, Y(2.4), s.c('--axis'), 0.3);
    W.forEach((r, i) => {
      const hi = i === TOP ? lab : 0;
      s.arrow(ox, oy, X(r[0]!), Y(r[1]!), s.tint('blue', 0.55 + 0.45 * hi), 0.45 + 0.2 * hi, 2.2);
      const dx = r[0]! >= 0 ? 1 : -1;
      s.alpha(lab, () =>
        s.text(`${TOK[i]} ${f(S[i]!)}`, X(r[0]!) + dx * 2 * s.u, Y(r[1]!) + (r[1]! > 0 ? -2.6 : 3) * s.u, { size: 3, font: 'mono', weight: 600, align: dx > 0 ? 'left' : 'right', color: s.c(i === TOP ? 'gold' : '--ink-2'), halo: true }),
      );
    });
    s.arrow(ox, oy, X(H[0]!), Y(H[1]!), s.c('gold'), 0.7, 2.6);
    s.text('h', X(H[0]!) - 1.5 * s.u, Y(H[1]!) - 3.4 * s.u, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true });
  });
}

const tie: SceneDef = {
  marks: {
    t: { tex: String.raw`\sym{WU}{W_U} = E, \quad\text{so}\quad \syms_j = E_j \cdot \symh`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const pt = s.ease('point', 0.7);
    const gap = s.tall ? 24 : 28;
    const gE = grid(s, s.w / 2 - gap * s.u + 6 * s.u, s.h * 0.5, 4, 2, 11, 10.5);
    const slide = s.ease('tie', 1.1, 0.3);
    const gU = grid(s, s.w / 2 + gap * s.u + 6 * s.u - 2 * gap * s.u * slide, s.h * 0.5, 4, 2, 11, 10.5);
    s.alpha(1 - pt, () => {
      names(s, gE, gE.l - 3 * s.u);
      matrix(s, gE, W.map((r) => r.map(f)), 'blue', { w: 10, h: 8, size: 3.4 });
      s.text('E', (gE.l + gE.r) / 2, gE.t - 5 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
      note(s, '(V, d) = (4, 2)', (gE.l + gE.r) / 2, gE.b + 5 * s.u, '--ink-3', 3);
      s.alpha(s.ease('compare', 0.6) * (1 - slide), () => {
        matrix(s, gU, W.map((r) => r.map(f)), 'blue', { w: 10, h: 8, size: 3.4 });
        s.text('W_U', (gU.l + gU.r) / 2, gU.t - 5 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue') });
        note(s, '(V, d) = (4, 2)', (gU.l + gU.r) / 2, gU.b + 5 * s.u, '--ink-3', 3);
      });
      s.alpha(s.ease('tie', 0.6, 1.4), () => {
        band(s, gE, 'row', 1, 'gold', 1);
        note(s, 'one table, used twice', s.w / 2 + (s.tall ? 22 : 26) * s.u, s.h * 0.5, '--ink-2', 3.2);
      });
    });
    s.show('t', s.ease('tie', 0.6, 1.4) * (1 - s.ease('save', 0.5)));
    plane(s, pt * (1 - s.ease('save', 0.6) * 0.75), s.ease('point', 0.6, 2.5));
    s.alpha(s.ease('save', 0.6, 0.4), () => {
      rich(s, [['saved: ', '--ink-3'], ['V × d', 'blue'], [' = 50,000 × 768', '--ink-2']], s.w / 2, s.h * 0.8, { size: 3.6, weight: 600 });
      rich(s, [['= 38,400,000', 'gold'], [' parameters', '--ink-3']], s.w / 2, s.h * 0.89, { size: 3.6, weight: 600 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { score, tie };
