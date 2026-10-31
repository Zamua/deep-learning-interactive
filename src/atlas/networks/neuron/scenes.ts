import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after } from '../../draw';
import { caption, Frame, reluGlyph, rich, unit, vcells } from '../draw';

/** Who introduced an idea, and when: small and italic, at (x, y). */
function cite(s: Scene, text: string, a: number, x: number, y: number) {
  s.alpha(a, () => s.text(text, x, y, { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true }));
}

// ---- fire: the linear classifier's plane, then the cats' side flattened to 0

const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [1.7, 1.4], [0.7, 0.9], [1.4, 1.9], [1, 1]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
/** The linear classifier's line: w = (1, 1), b = -4, so the score is x₀ + x₁ - 4. */
const score = (p: readonly number[]) => p[0]! + p[1]! - 4;
/** The walk across the line runs along the diagonal, where the score is 2t - 4. */
const WALK: [number, number] = [0.4, 3.8];

/** The feature plane on top, the slice under it, the captions at the bottom. */
function fireLayout(s: Scene) {
  const u = s.u;
  const side = Math.min(s.h * 0.6, s.w - 20 * u);
  const l = s.w / 2 - side / 2;
  const F = new Frame(s, l, 3 * u, l + side, 3 * u + side, [-0.5, 4.5], [-0.5, 4.5]);
  const sl = { l: s.w / 2 - 36 * u, r: s.w / 2 + 40 * u, t: F.b + 5 * u, b: s.h - 12 * u };
  const G = new Frame(s, sl.l, sl.t, sl.r, sl.b, WALK, [-3.8, 4]);
  return { F, G, mid: (sl.t + sl.b) / 2, cy: s.h - 5 * u };
}

const fire: SceneDef = {
  draw(s) {
    const { F, G, mid, cy } = fireLayout(s);
    const u = s.u;
    const flat = s.ease('flat', 1.2, 1.5);
    // The score over the plane: teal where positive, gold where negative, deeper with |score|.
    // w = (1, 1) runs along the diagonal of a square frame, so a gradient along it paints the score exactly.
    const sh = s.ease('plane', 1, 2.5);
    if (sh > 0.003) {
      const g = s.ctx.createLinearGradient(F.X(-0.5), F.Y(-0.5), F.X(4.5), F.Y(4.5));
      g.addColorStop(0, s.tint('gold', 0.42 * sh * (1 - flat)));
      g.addColorStop(0.5, s.tint('gold', 0));
      g.addColorStop(0.5, s.tint('teal', 0));
      g.addColorStop(1, s.tint('teal', 0.42 * sh));
      s.ctx.fillStyle = g;
      s.ctx.fillRect(F.l, F.t, F.r - F.l, F.b - F.t);
    }
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.2 * u, { ...ax, align: 'left' });
    F.clip(() => F.seg(-0.5, 4.5, 4.5, -0.5, 'purple', 0.8));
    CATS.forEach(([a, b]) => F.dot(a, b, 'gold', 1.2));
    SHIPS.forEach(([a, b]) => F.dot(a, b, 'teal', 1.2));
    const tag = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(s.win('plane', 'flat'), () => {
      s.text('+', F.X(3.9), F.Y(2.6), { ...tag, size: 4.4, color: s.c('teal') });
      s.text('−', F.X(0.2), F.Y(0.2), { ...tag, size: 4.4, color: s.c('gold') });
    });
    // After the bend: the cats' side outputs 0, the ships' side keeps its score.
    s.alpha(flat, () => {
      s.text('0', F.X(0.25), F.Y(2.9), { ...tag, size: 4.4, color: s.c('--ink-2') });
      s.text('silent', F.X(0.25), F.Y(2.9) + 5 * u, { ...tag, size: 3, color: s.c('--ink-2') });
      s.text('fires', F.X(3.8), F.Y(1.4), { ...tag, size: 3.2, color: s.c('teal') });
    });

    // The walk across the line, and the score along it.
    const sl = s.ease('slice', 0.6);
    const walk = Math.min(1, s.prog('slice') / 0.42);
    const fold = after(s, 'slice', 0.5, 0.9);
    s.alpha(sl, () => {
      F.seg(WALK[0], WALK[0], WALK[1], WALK[1], '--ink-3', 0.35, [1.2, 1]);
      const t = WALK[0] + (WALK[1] - WALK[0]) * walk;
      F.dot(t, t, 'purple', 1.5);
      s.rrect(G.l, G.t, G.r - G.l, G.b - G.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
      G.seg(WALK[0], 0, WALK[1], 0, '--axis', 0.3);
      G.seg(2, -3.8, 2, 4, '--ink-3', 0.25, [0.8, 0.8]);
      s.text('the line', G.X(2) + 1.5 * u, G.t + 3 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
      s.text('0', G.l - 2 * u, G.Y(0), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('score', G.l - 2 * u, G.t + 2.5 * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('purple') });
      s.text('cats\' side', G.l + 2 * u, G.t + 3 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
      s.text('ships\' side', G.r - 2 * u, G.b - 3 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('teal'), halo: true });
      const to = WALK[0] + (WALK[1] - WALK[0]) * walk;
      const ramp = (t: number) => 2 * t - 4;
      // The straight ramp, then its negative half folded up to 0, leaving a ghost.
      s.alpha(fold, () => G.fn(ramp, '--ink-3', 0.35, WALK[0], 2, [1, 1]));
      G.fn((t) => (ramp(t) < 0 ? ramp(t) * (1 - fold) : ramp(t)), 'purple', 0.8, WALK[0], to);
      G.dot(to, ramp(to) < 0 ? ramp(to) * (1 - fold) : ramp(to), 'purple', 1.2);
    });

    const cap = (text: string, a: number, k: Color | '--ink-2' = '--ink-2') => s.alpha(a, () => caption(s, text, s.since('slice') >= 0 ? cy : mid, k, 3.5));
    s.alpha(s.win('plane', 'cell'), () => rich(s, [['score = ', '--ink-2'], ['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['b', 'green']], s.w / 2, mid, { size: 4, weight: 600 }));
    cap('a brain cell: fire, or stay silent', s.win('cell', 'mp'));
    cap('fires when enough inputs fire: a threshold', s.win('mp', 'flat'));
    cite(s, 'McCulloch & Pitts, 1943', s.win('mp', 'flat'), s.w / 2, mid + 6 * u);
    cap('score 0 or below  →  output 0', s.win('flat', 'slice'));
    cap('a ramp with a bend', s.win('slice', 'detector'), 'purple');
    cap('silent for cats, fires for ships', s.ease('detector', 0.6), 'teal');
  },
};

// ---- bend: the ReLU on its own, z in and a out, and where its name comes from

const relu = (z: number) => Math.max(0, z);

function bendLayout(s: Scene) {
  const u = s.u;
  const F = new Frame(s, 14 * u, 5 * u, s.w - 8 * u, s.h * 0.56, [-4, 4], [-1.4, 4]);
  return { F, nameY: s.h * 0.64, low: [s.h * 0.69, s.h * 0.87] as const, cy: s.h - 5 * u };
}

/** The ReLU's name, with each word lit on its beat. */
function relName(s: Scene, y: number, on: [number, number, number]) {
  const k = (i: number): Color | '--ink-2' => (on[i]! > 0.5 ? 'gold' : '--ink-2');
  rich(s, [['ReLU: ', 'gold'], ['rectified ', k(0)], ['linear ', k(1)], ['unit', k(2)]], s.w / 2, y, { size: 4, weight: 650 });
}

const bend: SceneDef = {
  draw(s) {
    const { F, nameY, low, cy } = bendLayout(s);
    const u = s.u;
    F.axes();
    s.text('z', F.r - 1 * u, F.Y(0) + 4 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
    for (const z of [-3, -2, -1, 1, 2, 3]) s.text(String(z).replace('-', '−'), F.X(z), F.Y(0) + 3.6 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    s.alpha(s.ease('a', 0.6), () => {
      s.text('a', F.X(0) - 2.5 * u, F.t + 2.5 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
      for (const a of [1, 2, 3]) s.text(String(a), F.X(0) - 2 * u, F.Y(a), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(s.win('z', 'a'), () => {
      s.arrow(F.X(-3.6), F.Y(0) - 5 * u, F.X(3.6), F.Y(0) - 5 * u, s.tint('purple', 0.7), 0.4, 2);
      s.text('pre-activation: the score', F.X(0), F.Y(0) - 8.5 * u, { size: 3.2, font: 'mono', color: s.c('purple'), halo: true });
    });
    // The bend draws itself in, flat then rising; the linear part glows on its beat.
    const lin = s.win('linear', 'unit');
    s.alpha(lin, () => F.fn(relu, 'gold', 2.2, 0, 4));
    F.fn(relu, 'gold', 0.8, -4, -4 + 8 * s.ease('a', 2, 1));
    s.alpha(lin, () => s.text('a = z: a straight line', F.X(2.2), F.Y(3), { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('gold'), halo: true }));
    const cut = s.win('rect', 'linear');
    s.alpha(cut, () => {
      s.rrect(F.l, F.t, F.X(0) - F.l, F.b - F.t, 0, { fill: s.tint('red', 0.07) });
      s.text('negative z: cut to 0', F.X(-2), F.Y(1.6), { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    s.alpha(s.win('max', 'relu'), () => {
      F.dot(-2, 0, 'gold', 1.3);
      s.text('max(0, −2) = 0', F.X(-2), F.Y(0) - 4 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
      F.dot(3, 3, 'gold', 1.3);
      s.text('max(0, 3) = 3', F.X(3) - 2.5 * u, F.Y(3), { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('gold'), halo: true });
    });

    // Under the plot: the name, then a rectified wave, then a unit with this bend.
    s.alpha(s.ease('relu', 0.6), () => relName(s, nameY, [s.ease('rect', 0.4), s.ease('linear', 0.4), s.ease('unit', 0.4)]));
    const wave = s.win('rect', 'linear');
    s.alpha(wave, () => {
      const W = new Frame(s, s.w / 2 - 38 * u, low[0], s.w / 2 + 18 * u, low[1], [0, 4 * Math.PI], [-1.2, 1.2]);
      W.seg(0, 0, 4 * Math.PI, 0, '--axis', 0.3);
      W.fn(Math.sin, '--ink-3', 0.4, 0, 4 * Math.PI, [1, 1]);
      const p = s.prog('rect');
      W.fn((t) => relu(Math.sin(t)), 'gold', 0.8, 0, 4 * Math.PI * Math.min(1, Math.max(0, (p - 0.35) / 0.4)));
      s.text('rectified wave', W.r + 3 * u, W.Y(0), { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('unit', 0.6), () => {
      const y = (low[0] + low[1]) / 2;
      unit(s, s.w / 2 - 12 * u, y, 6, 'unit', 'gold', 0.5, 2.8);
      s.arrow(s.w / 2 - 5.5 * u, y, s.w / 2 + 2 * u, y, s.c('--ink-3'), 0.35, 1.6);
      reluGlyph(s, s.w / 2 + 10 * u, y, 13, 10, 'gold', { on: 0.5 });
    });

    const cap = (text: string, a: number, k: Color | '--ink-2' = '--ink-2') => s.alpha(a, () => caption(s, text, cy, k, 3.5));
    s.alpha(s.win('z', 'a'), () => rich(s, [['z', 'purple'], [' = ', '--ink-2'], ['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['b', 'green']], s.w / 2, cy, { size: 3.8, weight: 600 }));
    cap('a: the activation, how strongly it fires', s.win('a', 'max'), 'gold');
    s.alpha(s.win('max', 'relu'), () => rich(s, [['a', 'gold'], [' = max(0, ', '--ink-2'], ['z', 'purple'], [')', '--ink-2']], s.w / 2, cy, { size: 3.8, weight: 600 }));
    cap('a rectifier: current one way only', s.win('rect', 'linear'));
    cap('what passes, passes unchanged', s.win('linear', 'unit'), 'gold');
    cap('unit: another word for a neuron', s.ease('unit', 0.6));
  },
};

// ---- inside: one neuron's arithmetic, weigh, add, bend

const W = [1, -3];
const B = 2;
const XA = [2, 1];
const XB = [1, 2];
const wx = (x: number[]) => W[0]! * x[0]! + W[1]! * x[1]!;
const minus = (v: number) => String(v).replace('-', '−');

/** Where the inputs, the sum, the ReLU and the output sit, centered on the stage. */
function insideLayout(s: Scene) {
  const cx = s.w / 2;
  const yc = s.h * 0.46;
  return { yc, xin: cx - 40 * s.u, xs: cx - 6 * s.u, xr: cx + 19 * s.u, xo: cx + 40 * s.u, ys: [yc - 11 * s.u, yc + 11 * s.u] };
}

const inside: SceneDef = {
  draw(s) {
    const L = insideLayout(s);
    const u = s.u;
    const ng = s.ease('neg', 0.8);
    const lab = { size: 3.8, font: 'mono', weight: 650 } as const;
    // The input, then the weighted arrows into the sum.
    s.text('x', L.xin, L.ys[0]! - 9 * u, { ...lab, color: s.c('orange') });
    s.alpha(1 - ng, () => vcells(s, L.xin, L.ys, XA.map(String), 'orange', { w: 11, on: [s.win('x', 'w'), s.win('x', 'w')] }));
    s.alpha(ng, () => vcells(s, L.xin, L.ys, XB.map(String), 'orange', { w: 11, on: [1, 1] }));
    s.alpha(s.ease('w', 0.6), () => {
      L.ys.forEach((y, i) => {
        const x0 = L.xin + 6.5 * u;
        const x1 = L.xs - 7.5 * u;
        const y1 = L.yc + (i ? 2.5 : -2.5) * u;
        const hot = i === 1 ? s.win('w', 'sum') : 0;
        s.arrow(x0, y, x1, y1, s.tint(i === 1 && hot > 0.5 ? 'red' : 'blue', 0.8), 0.4 + 0.2 * hot, 2.2);
        s.text(`×${minus(W[i]!)}`, (x0 + x1) / 2, (y + y1) / 2 + (i ? 4 : -4) * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
      });
      s.text('w', (L.xin + L.xs) / 2, L.ys[0]! - 9 * u, { ...lab, color: s.c('blue') });
    });
    // The bias drops into the sum from above.
    s.alpha(s.ease('b', 0.6), () => {
      const by = L.yc - 21 * u;
      s.text('b', L.xs - 9 * u, by, { ...lab, color: s.c('green') });
      s.cell(L.xs - 5 * u, by - 4 * u, 10 * u, 8 * u, String(B), 'green', { on: s.win('b', 'a') });
      s.arrow(L.xs, by + 4.5 * u, L.xs, L.yc - 7.5 * u, s.tint('green', 0.8), 0.4, 2);
    });
    // The sum: Σ, then w · x, then z.
    const x = ng > 0.5 ? XB : XA;
    const inSum = s.since('b') >= 0.6 ? minus(wx(x) + B) : s.since('sum') >= 1 ? minus(wx(x)) : 'Σ';
    const zv = wx(x) + B;
    unit(s, L.xs, L.yc, 7, inSum, s.since('b') >= 0.6 && zv < 0 ? 'red' : 'purple', s.win('sum', 'a'), 4.2);
    s.alpha(s.ease('b', 0.6, 0.6), () => s.text('z', L.xs, L.yc + 11 * u, { ...lab, color: s.c('purple') }));
    // The bend, then the output.
    const rA = s.ease('a', 0.6);
    s.alpha(Math.max(0.3, rA), () => {
      s.text('ReLU', L.xr, L.yc - 10 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.arrow(L.xs + 7.5 * u, L.yc, L.xr - 8 * u, L.yc, s.c('--ink-3'), 0.4, 2);
      reluGlyph(s, L.xr, L.yc, 14, 11, 'gold', { z: rA > 0.5 ? zv : undefined, dot: zv < 0 ? 'red' : 'gold', on: s.win('a', 'thr') });
    });
    s.alpha(rA, () => {
      s.arrow(L.xr + 7.5 * u, L.yc, L.xo - 6.5 * u, L.yc, s.c('--ink-3'), 0.4, 2);
      s.text('a', L.xo, L.yc - 9 * u, { ...lab, color: s.c('gold') });
      s.alpha(1 - ng, () => s.cell(L.xo - 5.5 * u, L.yc - 4.25 * u, 11 * u, 8.5 * u, String(Math.max(0, wx(XA) + B)), 'gold', { on: s.win('a', 'neg') }));
      s.alpha(ng, () => s.cell(L.xo - 5.5 * u, L.yc - 4.25 * u, 11 * u, 8.5 * u, '0', 'gold', { on: s.win('neg', 'thr') }));
    });
    // The arithmetic, under the figure.
    const cy = s.h * 0.84;
    s.alpha(s.win('w', 'sum'), () => caption(s, 'a negative weight pulls the sum down', cy, 'blue', 3.4));
    s.alpha(s.win('sum', 'b'), () => caption(s, 'w · x = 2·1 + 1·(−3) = −1', cy, 'purple', 3.6));
    s.alpha(s.win('b', 'a'), () => caption(s, 'z = −1 + 2 = 1', cy, 'purple', 3.8));
    s.alpha(s.win('a', 'neg'), () => caption(s, 'max(0, 1) = 1: fires', cy, 'gold', 3.8));
    s.alpha(s.win('neg', 'thr'), () => caption(s, '1·1 + 2·(−3) + 2 = −3  →  0', cy, '--ink-2', 3.6));
    s.alpha(s.ease('thr', 0.6), () => {
      rich(s, [['fires when ', '--ink-2'], ['w · x', 'blue'], [' > −', '--ink-2'], ['b', 'green'], [' = −2', '--ink-2']], s.w / 2, cy, { size: 3.5, weight: 600 });
      s.alpha(after(s, 'thr', 0.6), () => caption(s, '[2, 1]: −1 > −2 fires · [1, 2]: −5 silent', cy + 6 * u, '--ink-2', 3.1));
    });
  },
};

export const scenes: Record<string, SceneDef> = { fire, bend, inside };
