import { lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { cite } from '../../draw';
import { band, brace, ghost, grid, type Grid, matrix, rich } from '../../linear-algebra/draw';
import { chip, stack } from '../../sequences/draw';
import { note } from '../draw';

const TOK = ['cats', 'chase', 'mice', 'dogs'];
/** Each token's row: mice near h, cats at a right angle to it, chase pointing away. */
const W = [
  [-1, 2],
  [-1, -1],
  [3, 1],
  [1, 0],
];
const H = [2, 1];
const dot = (r: number[], v: number[]) => r.reduce((a, x, j) => a + x * v[j]!, 0);
const S = W.map((r) => dot(r, H));
const TOP = S.indexOf(Math.max(...S));
/** Three positions' vectors for the batch of rows; the first is h. */
const HS = [H, [0, 1], [1, -1]];
const SS = HS.map((h) => W.map((r) => dot(r, h)));
const f = (v: number) => String(v).replace('-', '−');

/** The plane for d = 2, with its origin placed so every arrow and label fits both stages. */
function frame(s: Scene) {
  const k = (s.tall ? 12 : 13) * s.u;
  const ox = s.w / 2 - 0.9 * k;
  const oy = s.h * 0.56 + 0.4 * k;
  return { k, ox, oy, X: (x: number) => ox + x * k, Y: (y: number) => oy - y * k };
}
type Frame = ReturnType<typeof frame>;

/** Where token i's label sits: beside its arrow's tip, on the side away from the origin. */
function anchor(s: Scene, P: Frame, i: number): { x: number; y: number; side: number } {
  const [a, b] = W[i]!;
  const side = a! >= 0 ? 1 : -1;
  return { x: P.X(a!) + side * 2 * s.u, y: P.Y(b!) + (b! > 0 ? -2.6 : 3) * s.u, side };
}

const LAB = { size: 3.2, font: 'mono', weight: 600 } as const;

/** A token's name and, fading in after it, its score; a left-side label slides over to make room. */
function label(s: Scene, P: Frame, i: number, sa: number, k: string, from?: [number, number], mv = 1): void {
  const { x, y, side } = anchor(s, P, i);
  const name = TOK[i]!;
  const sc = f(S[i]!);
  const gap = 1.4 * s.u;
  const wn = s.measure(name, LAB);
  const ws = s.measure(sc, LAB);
  const left = side > 0 ? x : x - wn - sa * (gap + ws);
  const nx = lerp(from?.[0] ?? left + wn / 2, left + wn / 2, mv);
  const ny = lerp(from?.[1] ?? y, y, mv);
  s.text(name, nx, ny, { ...LAB, color: k, halo: true });
  s.alpha(sa, () => s.text(sc, left + wn + gap, y, { ...LAB, align: 'left', color: s.c('purple'), halo: true }));
}

function axes(s: Scene, P: Frame): void {
  s.line(P.X(-1.7), P.oy, P.X(3.6), P.oy, s.c('--axis'), 0.3);
  s.line(P.ox, P.Y(-1.5), P.ox, P.Y(2.5), s.c('--axis'), 0.3);
}

/** Token i's arrow, grown to fraction g; `on` darkens and thickens it. */
function row(s: Scene, P: Frame, i: number, g: number, on = 0): void {
  if (g <= 0.003) return;
  const [a, b] = W[i]!;
  s.arrow(P.ox, P.oy, P.X(a! * g), P.Y(b! * g), s.tint('blue', 0.55 + 0.45 * on), 0.45 + 0.25 * on, 2.2);
}

function hArrow(s: Scene, P: Frame, g: number, lab = 1): void {
  if (g <= 0.003) return;
  s.arrow(P.ox, P.oy, P.X(H[0]! * g), P.Y(H[1]! * g), s.c('gold'), 0.7, 2.6);
  s.alpha(lab, () => s.text('h', P.X(H[0]!) - 1.5 * s.u, P.Y(H[1]!) - 3.4 * s.u, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true }));
}

/** The small square that marks a right angle between h and cats' row. */
function rightAngle(s: Scene, P: Frame, a: number): void {
  s.alpha(a, () => {
    const q = 2.4 * s.u;
    const n = Math.hypot(H[0]!, H[1]!);
    const [ux, uy] = [(H[0]! / n) * q, (-H[1]! / n) * q];
    const [vx, vy] = [(-H[1]! / n) * q, (-H[0]! / n) * q];
    const c = s.c('--ink-3');
    s.line(P.ox + ux, P.oy + uy, P.ox + ux + vx, P.oy + uy + vy, c, 0.3);
    s.line(P.ox + vx, P.oy + vy, P.ox + ux + vx, P.oy + uy + vy, c, 0.3);
  });
}

const mean: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const P = frame(s);
    // The problem: a token became a vector, and now a vector has to become a token.
    s.alpha(1 - s.ease('pick', 0.6), () => {
      const y = s.h * 0.48;
      chip(s, cx - 34 * s.u, y, 'cats', 'orange', { w: 12, h: 7, size: 3.2 });
      s.arrow(cx - 27 * s.u, y, cx - 19.5 * s.u, y, s.c('--ink-3'), 0.35, 2);
      stack(s, cx - 14 * s.u, y, ['−1', '2'], 'blue', { w: 8, h: 7, gap: 8.5, size: 3.2 });
      note(s, 'embedding', cx - 14 * s.u, y + 13 * s.u, 'blue', 3);
      s.text('⋯', cx, y, { size: 4.4, color: s.c('--ink-3') });
      s.alpha(s.ease('answer', 0.6, 3), () => {
        stack(s, cx + 14 * s.u, y, ['2', '1'], 'gold', { w: 8, h: 7, gap: 8.5, size: 3.2 });
        s.arrow(cx + 19.5 * s.u, y, cx + 27 * s.u, y, s.c('--ink-3'), 0.35, 2);
        ghost(s, cx + 34 * s.u, y, '?', 'gold', 12, 7);
        note(s, 'a token?', cx + 34 * s.u, y + 13 * s.u, 'gold', 3);
      });
    });
    // What it has read, and the slot for the word it must write.
    const won = s.ease('win', 0.6, 1);
    s.alpha(s.ease('pick', 0.6), () => {
      const ys = s.h * 0.08;
      chip(s, cx - 15 * s.u, ys, 'cats', 'orange', { w: 12, h: 6.5, size: 3 });
      chip(s, cx, ys, 'chase', 'orange', { w: 13, h: 6.5, size: 3 });
      s.alpha(1 - won, () => ghost(s, cx + 15 * s.u, ys, '?', 'gold', 12, 6.5));
      s.alpha(won, () => chip(s, cx + 15 * s.u, ys, 'mice', 'gold', { w: 12, h: 6.5, size: 3, on: 1 }));
    });
    // The vocabulary as chips, whose names then travel to their arrows' tips.
    const xs = [-27, -9, 9, 27].map((d) => cx + d * s.u);
    const yv = s.h * 0.2;
    const mv = s.ease('rows', 1.1, 0.3);
    s.alpha(s.ease('pick', 0.6, 3.2) * (1 - mv), () => {
      xs.forEach((x) => s.rrect(x - 7 * s.u, yv - 3.5 * s.u, 14 * s.u, 7 * s.u, 1.2, { fill: s.tint('blue', 0.1), stroke: s.tint('blue', 0.45), lw: 0.3 }));
      note(s, 'the vocabulary', cx, yv + 7 * s.u, '--ink-3', 2.8);
    });
    s.alpha(s.ease('h', 0.6), () => axes(s, P));
    hArrow(s, P, s.ease('h', 0.9, 2.2), s.ease('h', 0.5, 2.8));
    const hiMice = s.ease('mice', 0.5);
    W.forEach((_, i) => row(s, P, i, s.ease('rows', 0.9, 0.5 + 0.2 * i), i === TOP ? hiMice : 0));
    rightAngle(s, P, s.ease('rest', 0.5, 0.9));
    // Scores in the order the voice reads them: mice, then dogs, cats and chase.
    const sa = (i: number) => (i === TOP ? s.ease('mice', 0.5, 2.2) : s.ease('rest', 0.5, [1.2, 3, 0, 0][i]!));
    const ink = (i: number) => s.c(i === TOP && won > 0.5 ? 'gold' : '--ink-2');
    s.alpha(s.ease('pick', 0.6, 3.2), () => TOK.forEach((_, i) => label(s, P, i, sa(i), ink(i), [xs[i]!, yv], mv)));
    // The bottom caption: the dot product's sign, then the sum for mice, then the pick.
    const cy = s.h * 0.92;
    s.alpha(s.win('agree', 'mice'), () => rich(s, [['+', 'green'], [' same way   ', '--ink-2'], ['0', '--ink-3'], [' right angle   ', '--ink-2'], ['−', 'red'], [' apart', '--ink-2']], cx, cy, { size: 3.2, weight: 600 }));
    s.alpha(s.win('mice', 'win'), () => rich(s, [['mice: ', '--ink-2'], ['3×2 + 1×1 = ', '--ink-2'], ['7', 'purple']], cx, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('win', 0.6), () => rich(s, [['highest score wins: ', '--ink-2'], ['mice', 'gold']], cx, cy, { size: 3.4, weight: 600 }));
  },
};

/** The product W_U h = s laid out left to right: names, matrix, h, =, s. */
function layout(s: Scene) {
  const g = grid(s, s.w / 2 - 12.75 * s.u, s.h * 0.44, 4, 2, 13.5, 12.5);
  const hx = g.r + 13 * s.u;
  const sx = hx + 20 * s.u;
  return { g, hx, sx, nx: g.l - 3 * s.u };
}

function names(s: Scene, g: Grid, x: number, on: (i: number) => number = () => 0): void {
  TOK.forEach((t, i) => s.text(t, x, g.y(i), { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(on(i) > 0.5 ? 'gold' : '--ink-2') }));
}

/** Three positions' vectors, one row each, and their rows of scores. */
function batch(s: Scene, a: number): void {
  s.alpha(a, () => {
    const gH = grid(s, s.w / 2 - 22.5 * s.u, s.h * 0.44, 3, 2, 11, 12);
    const gS = grid(s, s.w / 2 + 22.5 * s.u, s.h * 0.44, 3, 4, 11, 12);
    matrix(s, gH, HS.map((r) => r.map(f)), 'gold', { w: 10, h: 9, size: 3.6 });
    matrix(s, gS, SS.map((r) => r.map(f)), 'purple', { w: 10, h: 9, size: 3.6, on: (i, j) => (i === 0 && j === TOP ? 1 : 0) });
    [0, 1, 2].forEach((i) => s.text(`pos ${i}`, gH.l - 1.5 * s.u, gH.y(i), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') }));
    TOK.forEach((t, j) => s.text(t, gS.x(j), gS.t - 3.5 * s.u, { size: 2.9, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.arrow(gH.r + 1.5 * s.u, gH.y(1), gS.l - 1.5 * s.u, gH.y(1), s.c('--ink-3'), 0.35, 2);
    s.text('W_U', (gH.r + gS.l) / 2, gH.y(1) - 4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    note(s, '(3, d) = (3, 2)', (gH.l + gH.r) / 2, gH.b + 5.5 * s.u, 'gold', 3.3);
    note(s, '(3, V) = (3, 4)', (gS.l + gS.r) / 2, gS.b + 5.5 * s.u, 'purple', 3.3);
    note(s, 'each position\'s row is scored on its own', s.w / 2, s.h * 0.88, '--ink-2', 3.4);
  });
}

const matrixScene: SceneDef = {
  draw(s) {
    const { g, hx, sx, nx } = layout(s);
    const cy = (g.t + g.b) / 2;
    const many = s.ease('many', 0.7);
    const logit = s.ease('logits', 0.6, 0.4);
    s.alpha(1 - many, () => {
      stack(s, hx, cy, H.map(f), 'gold', { w: 11, h: 9.5, gap: 12.5, size: 3.8 });
      s.text('h', hx, cy - 17.5 * s.u, { size: 4.4, font: 'mono', weight: 650, color: s.c('gold') });
      // The rows arrive one by one, as arrows stacked into a matrix.
      W.forEach((r, i) =>
        s.alpha(s.ease('stack', 0.5, 0.4 + 0.35 * i), () => {
          s.text(TOK[i]!, nx, g.y(i), { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c(i === TOP && logit > 0.5 ? 'gold' : '--ink-2') });
          r.forEach((v, j) => s.cell(g.x(j) - 6 * s.u, g.y(i) - 4.75 * s.u, 12 * s.u, 9.5 * s.u, f(v), 'blue', { size: 3.8 }));
        }),
      );
      s.alpha(s.ease('stack', 0.6, 2.2), () => {
        s.text('W_U', (g.l + g.r) / 2, g.t - 10 * s.u, { size: 4.2, font: 'mono', weight: 650, color: s.c('purple') });
        brace(s, 'top', g.l + 1 * s.u, g.r - 1 * s.u, g.t - 1.2 * s.u, 'd = 2', 'blue', 3);
      });
      s.alpha(s.ease('shape', 0.6), () => rich(s, [['W_U', 'purple'], [': (V, d) = (4, 2)', '--ink-3']], (g.l + g.r) / 2, g.b + 5.5 * s.u, { size: 3.4 }));
      s.alpha(s.ease('all', 0.6), () => {
        s.text('·', (g.r + hx - 5.5 * s.u) / 2, cy, { size: 5.4, font: 'mono', color: s.c('--ink-3') });
        s.text('=', sx - 10 * s.u, cy, { size: 4.8, font: 'mono', color: s.c('--ink-3') });
        s.text('s', sx, g.t - 4.5 * s.u, { size: 4.4, font: 'mono', weight: 650, color: s.c('purple') });
      });
      TOK.forEach((_, i) => {
        const done = s.ease('all', 0.5, 1.6 + 0.45 * i);
        s.alpha(s.ease('all', 0.6) * (1 - done), () => ghost(s, sx, g.y(i), '?', 'purple', 11, 9.5));
        s.alpha(done, () => s.cell(sx - 5.5 * s.u, g.y(i) - 4.75 * s.u, 11 * s.u, 9.5 * s.u, f(S[i]!), 'purple', { on: i === TOP ? logit : 0, size: 3.8 }));
      });
      band(s, g, 'row', TOP, 'gold', logit);
      // Captions: what the U means, then the product, then the name of its scores.
      const c1 = s.h * 0.84;
      const c2 = s.h * 0.91;
      s.alpha(s.win('name', 'all'), () => {
        rich(s, [['embedding: ', 'blue'], ['token → vector', '--ink-2']], s.w / 2, c1, { size: 3.4, weight: 600 });
        rich(s, [['unembedding: ', 'purple'], ['vector → token', '--ink-2']], s.w / 2, c2, { size: 3.4, weight: 600 });
      });
      s.alpha(s.ease('all', 0.6, 1), () => rich(s, [['s = ', 'purple'], ['W_U', 'purple'], [' h', 'gold'], ['   one score per token', '--ink-3']], s.w / 2, c1, { size: 3.4, weight: 600 }));
      s.alpha(logit * (1 - s.ease('argmax', 0.5)), () => note(s, 'the logits: mice scores highest', s.w / 2, c2, '--ink-2', 3.2));
      // The argmax is a position: indices beside s, with the winner's lit.
      const am = s.ease('argmax', 0.6, 0.3);
      s.alpha(am, () => {
        TOK.forEach((_, i) => s.text(String(i), sx + 8 * s.u, g.y(i), { size: 3, font: 'mono', weight: i === TOP ? 700 : 500, color: s.c(i === TOP ? 'gold' : '--ink-3') }));
        rich(s, [['s.argmax()', 'purple'], [' = 2: ', '--ink-2'], ['mice', 'gold']], s.w / 2, c2, { size: 3.4, weight: 600 });
      });
    });
    batch(s, many);
  },
};

const tie: SceneDef = {
  marks: {
    t: { tex: String.raw`\syms_j = E_j \cdot \symh`, x: 0.5, y: 0.13, size: 4.6 },
  },
  draw(s) {
    const pt = s.ease('sj', 0.7, 0.8);
    const gap = s.tall ? 24 : 28;
    // E and W_U side by side, then both slide to the middle and become one table.
    const slide = s.ease('tied', 1.1, 0.3);
    const gE = grid(s, s.w / 2 + lerp(6 - gap, -8, slide) * s.u, s.h * 0.48, 4, 2, 11, 10.5);
    const gU = grid(s, s.w / 2 + lerp(6 + gap, -8, slide) * s.u, s.h * 0.48, 4, 2, 11, 10.5);
    const same = s.win('same', 'papers');
    const j = TOP;
    s.alpha(1 - pt, () => {
      names(s, gE, gE.l - 3 * s.u, () => same);
      matrix(s, gE, W.map((r) => r.map(f)), 'blue', { w: 10, h: 8, size: 3.4 });
      s.text('E', (gE.l + gE.r) / 2, gE.t - 5 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
      note(s, '(V, d) = (4, 2)', (gE.l + gE.r) / 2, gE.b + 5 * s.u, '--ink-3', 3);
      s.alpha(1 - slide, () => {
        names(s, gU, gU.l - 3 * s.u, () => same);
        matrix(s, gU, W.map((r) => r.map(f)), 'purple', { w: 10, h: 8, size: 3.4 });
        s.text('W_U', (gU.l + gU.r) / 2, gU.t - 5 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
        note(s, '(V, d) = (4, 2)', (gU.l + gU.r) / 2, gU.b + 5 * s.u, '--ink-3', 3);
      });
      s.alpha(same, () => note(s, 'the same tokens: read, and written', s.w / 2, s.h * 0.86, 'gold', 3.2));
      s.alpha(s.ease('tied', 0.6, 1.4), () => {
        note(s, 'W_U = E: one table, used twice', s.w / 2, s.h * 0.86, '--ink-2', 3.2);
        band(s, gE, 'row', j, 'gold', s.ease('Ej', 0.6));
      });
      s.alpha(s.ease('Ej', 0.6, 0.3), () => note(s, `E${'₀₁₂₃'[j]}: ${TOK[j]}'s embedding`, gE.r + 4 * s.u, gE.y(j), 'gold', 3, 'left'));
    });
    s.show('t', s.ease('sj', 0.6) * (1 - s.ease('both', 0.5)));
    // Tied, the arrows are the embeddings themselves, scored against h.
    s.alpha(pt * (1 - s.ease('both', 0.6)), () => {
      const P = frame(s);
      axes(s, P);
      W.forEach((_, i) => row(s, P, i, 1, i === TOP ? 1 : 0));
      hArrow(s, P, 1);
      TOK.forEach((_, i) => label(s, P, i, s.ease('sj', 0.5, 1.6), s.c(i === TOP ? 'gold' : '--ink-2')));
    });
    cite(s, 'Press & Wolf, 2017 · Inan, Khosravi & Socher, 2017', s.win('papers', 'both'));
    s.alpha(s.win('papers', 'tied'), () => note(s, 'one matrix for both jobs?', s.w / 2, s.h * 0.92, '--ink-2', 3.2));
    s.alpha(s.win('better', 'both'), () => note(s, 'tied: better predictions, fewer numbers', s.w / 2, s.h * 0.92, 'green', 3.2));
    // Two V by d tables, then one: the saving as a picture.
    const sv = s.ease('save', 1.1, 0.3);
    s.alpha(s.ease('both', 0.6, 0.2), () => {
      const bw = 15 * s.u;
      const bh = s.h * 0.34;
      const y0 = s.h * 0.24;
      const xE = s.w / 2 - lerp(13 * s.u, 0, sv);
      const xU = s.w / 2 + lerp(13 * s.u, 0, sv);
      const block = (x: number, k: 'blue' | 'purple', a: number) =>
        s.alpha(a, () => {
          s.rrect(x - bw / 2, y0, bw, bh, 1.4, { fill: s.tint(k, 0.14), stroke: s.tint(k, 0.7), lw: 0.35 });
          s.text('V × d', x, y0 + bh / 2, { size: 3.2, font: 'mono', weight: 600, color: s.c(k), halo: true });
        });
      block(xU, 'purple', 1 - sv);
      block(xE, 'blue', 1);
      s.text('E', xE, y0 - 3.5 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue') });
      s.alpha(1 - sv, () => s.text('W_U', xU, y0 - 3.5 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') }));
      s.alpha(sv, () => s.text('= W_U', xE + 3 * s.u, y0 - 3.5 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('purple') }));
    });
    s.alpha(s.ease('both', 0.6, 0.4), () => {
      rich(s, [['untied: ', '--ink-3'], ['2 × V × d', 'blue'], [' = 76,800,000', '--ink-2']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600 });
      note(s, 'V = 50,000 tokens, d = 768', s.w / 2, s.h * 0.71, '--ink-3', 3);
    });
    s.alpha(s.ease('save', 0.6, 0.3), () => {
      rich(s, [['tied: ', '--ink-3'], ['V × d', 'blue'], [' = 38,400,000', '--ink-2']], s.w / 2, s.h * 0.85, { size: 3.4, weight: 600 });
      rich(s, [['saved: ', '--ink-3'], ['38,400,000', 'gold'], [' learned numbers', '--ink-3']], s.w / 2, s.h * 0.92, { size: 3.4, weight: 600 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { mean, matrix: matrixScene, tie };
