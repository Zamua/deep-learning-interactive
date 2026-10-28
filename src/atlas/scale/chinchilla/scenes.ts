import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after, Frame } from '../../networks/draw';
import { type Ink, mono } from '../draw';

/** Gopher's budget as N × D, in billions of parameters times trillions of tokens (6ND ≈ 5.76 × 10²³). */
const K = 96;
/** The compute-optimal side on that budget: D = 20N, so N² = K / 0.02. */
const BEST = Math.sqrt(K / 0.02);
const GOPHER = { n: 280, d: 0.3 };
const CHIN = { n: 70, d: 1.4 };

/** Stack the figure over its text on a phone; put the text beside it on a wide stage. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.45;

interface Lay {
  l: number;
  t: number;
  side: number;
  tx: number;
  ty: [number, number];
  size: number;
}

/** A square figure and two text rows, below it or beside it. */
function layout(s: Scene, maxH: number, top = 0.08): Lay {
  const u = s.u;
  if (stacked(s)) {
    const side = Math.min(s.w - 34 * u, s.h * maxH);
    const t = s.h * top;
    const y0 = t + side + 13.5 * u;
    return { l: s.w / 2 - side / 2 + 3 * u, t, side, tx: s.w / 2, ty: [y0, y0 + 6.5 * u], size: 3.5 };
  }
  const side = Math.min(s.h * 0.74, s.w * 0.46);
  const l = s.w * 0.1;
  return { l, t: (s.h - side) / 2 - 2 * u, side, tx: (l + side + s.w) / 2 + 2 * u, ty: [s.h * 0.44, s.h * 0.44 + 7 * u], size: 3.6 };
}

/** N across in billions, D up in trillions: 320 billion matches 6.4 trillion, 20 tokens per parameter. */
function axes(s: Scene, L: Lay): Frame {
  const F = new Frame(s, L.l, L.t, L.l + L.side, L.t + L.side, [0, 320], [0, 6.4]);
  F.axes();
  for (const n of [100, 200, 300]) mono(s, String(n), F.X(n), F.b + 3.4 * s.u, { size: 3, k: 'blue' });
  for (const d of [2, 4, 6]) mono(s, String(d), F.l - 2 * s.u, F.Y(d), { size: 3, k: 'orange', align: 'right' });
  mono(s, 'N, billions', F.r, F.b + 7.6 * s.u, { size: 3.2, k: 'blue', align: 'right', weight: 650 });
  mono(s, 'D, trillions', F.l, F.t - 3 * s.u, { size: 3.2, k: 'orange', align: 'left', weight: 650 });
  return F;
}

/** A rectangle from the origin to (n, d): its area is N × D. */
function rect(s: Scene, F: Frame, n: number, d: number, k: Ink, o: { fill?: number; lw?: number; dash?: number[] } = {}): void {
  const x0 = F.X(0);
  const y0 = F.Y(0);
  const x1 = F.X(n);
  const y1 = F.Y(d);
  s.rrect(x0, y1, x1 - x0, y0 - y1, 0, { fill: s.tint(k, o.fill ?? 0.14) });
  const lw = o.lw ?? 0.45;
  s.line(x0, y1, x1, y1, s.c(k), lw, o.dash);
  s.line(x1, y1, x1, y0, s.c(k), lw, o.dash);
}

/** The text rows: one or two lines, centered on the text column. */
function say(s: Scene, L: Lay, a: number, l1: [string, Ink], l2?: [string, Ink]): void {
  s.alpha(a, () => {
    mono(s, l1[0], L.tx, L.ty[0], { size: L.size, k: l1[1], weight: 650, halo: true });
    if (l2) mono(s, l2[0], L.tx, L.ty[1], { size: L.size, k: l2[1], weight: 600, halo: true });
  });
}

/** Who found it, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Eased 0 -> 1 across the fraction [f0, f1] of beat `id`. */
const glide = (s: Scene, id: string, f0: number, f1: number) => smooth((s.prog(id) - f0) / (f1 - f0));

/** The trading rectangle's width at this moment, in billions; its height is always K / N. */
function width(s: Scene): number {
  let ln = Math.log(150);
  if (s.since('trade') >= 0) ln += 0.55 * Math.sin(s.prog('trade') * Math.PI * 2);
  if (s.since('ends') >= 0) {
    ln = lerp(ln, Math.log(280), glide(s, 'ends', 0, 0.3));
    ln = lerp(ln, Math.log(18), glide(s, 'ends', 0.5, 0.75));
  }
  if (s.since('best') >= 0) ln = lerp(ln, Math.log(BEST), s.ease('best', 1.4, 0.3));
  return Math.exp(ln);
}

/** A label up in the empty corner beyond the budget curve, with a leader down to the point (n, d) it names. */
function tag(s: Scene, F: Frame, text: string, k: Ink, n: number, d: number, at: [number, number] = [110, 3]): void {
  const x = F.X(at[0]);
  const y = F.Y(at[1]);
  s.line(x - 1 * s.u, y + 1.6 * s.u, F.X(n) + 0.6 * s.u, F.Y(d) - 0.6 * s.u, s.tint(k, 0.7), 0.3);
  mono(s, text, x, y, { size: 3.3, k, align: 'left', weight: 650, halo: true });
}

const trade: SceneDef = {
  draw(s) {
    const L = layout(s, 0.64);
    const F = axes(s, L);
    const u = s.u;
    // Every rectangle with this area costs the same: N × D = K, a curve.
    s.alpha(s.ease('trade', 0.8), () => F.fn((n) => K / n, 'purple', 0.35, 14, 320, [1.2, 1]));
    s.alpha(s.win('trade', 'ends'), () => mono(s, 'same budget', F.X(250), F.Y(K / 250) - 3.6 * u, { size: 3, k: 'purple', halo: true }));
    const n = width(s);
    const d = K / n;
    const main = s.ease('area', 0.7) * (1 - s.ease('gopher', 0.6));
    const best = s.ease('best', 0.6, 1.4);
    s.alpha(main * (1 - best), () => rect(s, F, n, d, 'purple', { fill: 0.16, lw: 0.55 }));
    s.alpha(main * s.win('area', 'trade'), () => mono(s, 'N × D', F.X(n / 2), F.Y(d / 2), { size: 3.4, k: 'purple', weight: 650, halo: true }));
    s.alpha(main * s.win('ends', 'best') * (1 - after(s, 'ends', 0.45)), () => tag(s, F, 'under-trained', 'red', n * 0.85, d, [200, 1.6]));
    s.alpha(main * s.win('ends', 'best') * after(s, 'ends', 0.7), () => mono(s, 'too small', F.X(n) + 2 * u, F.Y(d) + 1 * u, { size: 3.2, k: 'red', align: 'left', weight: 650, halo: true }));
    s.alpha(main * best, () => {
      rect(s, F, n, d, 'green', { fill: 0.16, lw: 0.6 });
      tag(s, F, 'D = 20N', 'green', n, d);
    });
    // The two models with the same budget: Gopher wide and flat, Chinchilla square.
    s.alpha(s.ease('gopher', 0.7, 0.3), () => {
      rect(s, F, GOPHER.n, GOPHER.d, 'slate', { fill: 0.2, lw: 0.55 });
      tag(s, F, 'Gopher', 'slate', GOPHER.n * 0.85, GOPHER.d, [200, 1.6]);
    });
    s.alpha(s.ease('chin', 0.7, 0.3), () => {
      rect(s, F, CHIN.n, CHIN.d, 'green', { fill: 0.18, lw: 0.6 });
      tag(s, F, 'Chinchilla', 'green', CHIN.n, CHIN.d);
    });

    say(s, L, s.win('ask', 'area'), ['budget C: fixed', 'purple'], ['N = ?    D = ?', '--ink-2']);
    say(s, L, s.win('area', 'trade'), ['C = 6 N D', 'purple'], ['6 × the rectangle\'s area', '--ink-2']);
    say(s, L, s.win('trade', 'ends'), ['same budget, same area', 'purple'], ['wider N, shorter D', '--ink-2']);
    say(s, L, s.win('ends', 'best'), ['too wide: under-trained', 'red'], ['too tall: too small', 'red']);
    say(s, L, s.win('best', 'habit'), ['lowest loss:', '--ink-2'], ['D = 20N', 'green']);
    say(s, L, s.win('habit', 'gopher'), ['a bigger budget:', '--ink-2'], ['mostly a bigger model', 'blue']);
    say(s, L, s.win('gopher', 'hoffmann'), ['Gopher: 280B parameters', 'slate'], ['on 300B tokens', 'orange']);
    say(s, L, s.win('hoffmann', 'chin'), ['grow N and D equally:', '--ink-2'], ['double N, double D', 'green']);
    say(s, L, s.ease('chin', 0.6), ['Chinchilla: 70B params', 'green'], ['1.4T tokens: beat Gopher', 'orange']);
    cite(s, 'Kaplan et al., 2020', s.win('habit', 'hoffmann'));
    cite(s, 'Hoffmann et al., DeepMind, 2022', s.ease('hoffmann', 0.6));
  },
};

const SQ = 70;

const square: SceneDef = {
  draw(s) {
    const L = layout(s, 0.64);
    const F = axes(s, L);
    const u = s.u;
    // A hundred billion across is two trillion up: equal lengths on the page.
    s.alpha(s.win('square', 'sub') * (1 - after(s, 'square', 0.55)), () => {
      rect(s, F, 100, 2, 'slate', { fill: 0.08, dash: [1, 0.8] });
      mono(s, '100B × 2T', F.X(100) + 2 * u, F.Y(2) - 2.4 * u, { size: 3.2, k: 'slate', align: 'left', weight: 650, halo: true });
    });
    // The best shape, then four and nine times its area, kept square.
    const k = 1 + s.ease('four', 1.4, 1.5) + s.ease('nine', 1.4, 1) - 2 * s.ease('other', 1);
    const side = SQ * k;
    const best = after(s, 'square', 0.5);
    s.alpha(best, () => {
      rect(s, F, side, side / 50, 'green', { fill: 0.14, lw: 0.6 });
      F.clip(() => {
        for (let i = 1; i * SQ < side - 0.5; i++) {
          s.line(F.X(i * SQ), F.Y(0), F.X(i * SQ), F.Y(side / 50), s.tint('green', 0.6), 0.3);
          s.line(F.X(0), F.Y((i * SQ) / 50), F.X(side), F.Y((i * SQ) / 50), s.tint('green', 0.6), 0.3);
        }
      });
    });
    s.alpha(best * (1 - s.ease('four', 0.5)), () => mono(s, 'D = 20N', F.X(side) + 2 * u, F.Y(side / 50) - 2.4 * u, { size: 3.3, k: 'green', align: 'left', weight: 650, halo: true }));
    // The square's side, N, once it has a formula.
    s.alpha(s.win('root', 'four'), () => {
      mono(s, 'N', F.X(side / 2), F.b + 3.4 * u, { size: 3.4, k: 'blue', weight: 700, halo: true });
      mono(s, 'N', F.l - 2 * u, F.Y(side / 100), { size: 3.4, k: 'blue', align: 'right', weight: 700, halo: true });
    });
    const grid = (n: number, a: number) => s.alpha(a, () => mono(s, `${n} × ${n}`, F.X(side) + 2 * u, F.Y(side / 50) - 2.4 * u, { size: 3.3, k: 'green', align: 'left', weight: 650, halo: true }));
    grid(2, s.win('four', 'nine') * after(s, 'four', 0.55));
    grid(3, s.win('nine', 'other') * after(s, 'nine', 0.4));
    // Thirty tokens per parameter: half as tall again.
    s.alpha(after(s, 'other', 0.35), () => {
      rect(s, F, SQ, (SQ * 30) / 1000, 'orange', { fill: 0.06, dash: [1, 0.8] });
      mono(s, 'D = 30N', F.X(SQ) + 2 * u, F.Y((SQ * 30) / 1000) - 2.4 * u, { size: 3.3, k: 'orange', align: 'left', weight: 650, halo: true });
    });

    say(s, L, s.win('square', 'sub'), ['100B across = 2T up', '--ink-2'], ['D = 20N: a square', 'green']);
    say(s, L, s.win('sub', 'root'), ['C = 6N · 20N', 'purple'], ['= 120 N²', 'purple']);
    say(s, L, s.win('root', 'four'), ['N² = C / 120', 'purple'], ['N = √(C / 120)', 'blue']);
    say(s, L, s.win('four', 'nine'), ['4 × C: 4 × the area', 'purple'], ['2 × N, 2 × D', 'green']);
    say(s, L, s.win('nine', 'shape'), ['9 × C: 3 × N, 3 × D', 'green'], ['N grows as √C', 'blue']);
    say(s, L, s.win('shape', 'other'), ['D / N = 20', 'green'], ['at any budget', '--ink-2']);
    say(s, L, s.ease('other', 0.6), ['30 tokens per parameter:', 'orange'], ['C = 6N · 30N = 180 N²', 'purple']);
  },
};

const TILES = 20;

const solve: SceneDef = {
  draw(s) {
    const u = s.u;
    const st = stacked(s);
    const side = st ? Math.min(s.w - 34 * u, s.h * 0.58) : Math.min(s.h * 0.7, s.w * 0.44);
    const l = st ? s.w / 2 - side / 2 : s.w * 0.1;
    const t = st ? s.h * 0.13 : (s.h - side) / 2;
    const tx = st ? s.w / 2 : (l + side + s.w) / 2;
    const ys = st ? [s.h * 0.055, t + side + 13 * u, t + side + 19.5 * u] : [s.h * 0.3, s.h * 0.44, s.h * 0.52];
    const size = st ? 3.5 : 3.6;
    const row = (i: number, text: string, k: Ink, a: number) => s.alpha(a, () => mono(s, text, tx, ys[i]!, { size: i === 0 ? size + 0.3 : size, k, weight: 650, halo: true }));
    const cell = side / TILES;
    const b = t + side;

    // The square: N by N, its area N².
    s.rrect(l, t, side, side, 0, { fill: s.tint('green', 0.08), stroke: s.c('green'), lw: 0.5 });
    const fill = s.prog('count');
    s.alpha(s.ease('count', 0.4), () => {
      // Tiles fill the square row by row from the bottom.
      const rows = fill * TILES;
      for (let r = 0; r < Math.ceil(rows); r++) {
        const a = Math.min(1, rows - r);
        s.alpha(a, () => s.rrect(l, b - (r + 1) * cell, side, cell, 0, { fill: s.tint('gold', 0.16) }));
      }
      for (let i = 1; i < TILES; i++) {
        s.line(l + i * cell, t, l + i * cell, b, s.tint('gold', 0.55), 0.18);
        s.line(l, t + i * cell, l + side, t + i * cell, s.tint('gold', 0.55), 0.18);
      }
    });
    s.alpha(s.ease('tile', 0.6) * (1 - s.ease('side', 0.5)), () => s.rrect(l, b - cell, cell, cell, 0, { fill: s.tint('gold', 0.75), stroke: s.c('gold'), lw: 0.35 }));
    s.alpha(s.win('tile', 'count'), () => mono(s, '10⁹ × 10⁹', l + 2.2 * cell, b - 2.2 * cell, { size: 3.2, k: 'gold', align: 'left', weight: 650, halo: true }));
    s.alpha(1 - s.ease('count', 0.5), () => mono(s, 'N²', l + side / 2, t + side / 2, { size: 6, k: 'blue', weight: 650 }));
    // Its sides: N, then twenty tiles along the bottom.
    const sideA = s.ease('side', 0.6);
    s.alpha(1 - sideA, () => {
      mono(s, 'N', l + side / 2, b + 3.6 * u, { size: 3.6, k: 'blue', weight: 700 });
      mono(s, 'N', l - 3 * u, t + side / 2, { size: 3.6, k: 'blue', weight: 700 });
    });
    s.alpha(sideA, () => {
      s.rrect(l, b - cell, side, cell, 0, { fill: s.tint('blue', 0.35), stroke: s.c('blue'), lw: 0.35 });
      mono(s, '20 tiles: 20 billion', l + side / 2, b + 3.6 * u, { size: 3.3, k: 'blue', weight: 700 });
    });

    row(0, 'C = 4.8 × 10²² FLOPs', 'purple', 1);
    row(1, 'N = ?', 'blue', s.win('p', 'lead'));
    row(1, 'N² = C / 120', 'purple', s.win('lead', 'pow'));
    row(2, '4.8 / 1.2 = 4', '--ink-2', s.win('lead', 'pow') * after(s, 'lead', 0.6));
    row(1, '10²² / 10² = 10²⁰', '--ink-2', s.win('pow', 'tile'));
    row(2, 'N² = 4 × 10²⁰', 'purple', s.win('pow', 'count') * after(s, 'pow', 0.5));
    row(1, 'one tile: 10⁹ × 10⁹ = 10¹⁸', 'gold', s.win('tile', 'count'));
    row(1, '10²⁰ = 100 tiles', 'gold', s.win('count', 'side'));
    row(2, 'N² = 400 tiles', 'purple', s.win('count', 'side') * after(s, 'count', 0.5));
    row(1, '√400 = 20 tiles a side', 'gold', s.win('side', 'tok'));
    row(2, 'N = 20 billion', 'blue', s.win('side', 'tok') * after(s, 'side', 0.5));
    row(1, 'D = 20N', 'orange', s.ease('tok', 0.6));
    row(2, '= 400 billion tokens', 'orange', after(s, 'tok', 0.4));
  },
};

export const scenes: Record<string, SceneDef> = { trade, square, solve };
