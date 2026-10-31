import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after } from '../../draw';
import { rich } from '../draw';
import { type Box, edges } from './box';
import { type Plane, gridLines, plane, rect } from './plane';

const TRUTH: Box = [1, 1, 5, 4];
const GUESS: Box = [2, 2, 6, 5];
const AWAY: Box = [6, 2, 10, 5];
/** A pair that misses on both sides: right − left = −2, bottom − top = −1. */
const MISS_A: Box = [1, 1, 4, 3];
const MISS_B: Box = [6, 4, 9, 6];
/** A guess over the whole picture. */
const HUGE: Box = [0, 0, 10, 6];

/** One line of working in the text column, `row` lines down. */
function work(s: Scene, P: Plane, row: number, runs: [string, Ink][], a: number, size = 3.3): void {
  s.alpha(a, () => rich(s, runs, P.tx, P.ty + row * P.gap, { size, weight: 600 }));
}

/** Who introduced an idea, and when: top right on a wide stage, at the foot of a phone's. */
function cite(s: Scene, P: Plane, text: string, a: number): void {
  const o = { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true } as const;
  s.alpha(a, () => (P.side ? s.text(text, s.w - 5 * s.u, 5 * s.u, { ...o, align: 'right' }) : s.text(text, s.w / 2, s.h - 5 * s.u, o)));
}

/** A cat that just fits the box (1, 1) to (5, 4): ears at the top, head at the left, body to the right and the bottom. */
function cat(s: Scene, P: Plane, a: number): void {
  s.alpha(a, () => {
    const c = s.ctx;
    c.fillStyle = s.tint('gold', 0.5);
    c.strokeStyle = s.c('gold');
    c.lineWidth = 0.35 * s.u;
    c.beginPath();
    c.ellipse(P.X(3.25), P.Y(3.05), 1.75 * P.c, 0.95 * P.c, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    for (const [x0, x1, x2] of [[1.2, 1.45, 1.75], [1.95, 2.25, 2.5]] as const) {
      c.beginPath();
      c.moveTo(P.X(x0), P.Y(1.55));
      c.lineTo(P.X(x1), P.Y(1));
      c.lineTo(P.X(x2), P.Y(1.45));
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.beginPath();
    c.arc(P.X(1.85), P.Y(2.05), 0.85 * P.c, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(P.X(4.55), P.Y(2.55));
    c.quadraticCurveTo(P.X(5), P.Y(2.2), P.X(4.7), P.Y(1.7));
    c.lineWidth = 0.6 * s.u;
    c.stroke();
  });
}

const boxes: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, 10, 6, 8, 42);
    if (s.since('br') >= 0) gridLines(s, P, 10, 6, { x: [5], y: [4], a: s.win('br', 'width') });
    else gridLines(s, P, 10, 6, { x: [1], y: [1], a: s.win('tl', 'br') });
    // Which way x and y count.
    s.alpha(s.ease('axes', 0.6) * (1 - 0.5 * s.ease('tl', 0.6)), () => {
      const k = s.c('--ink-2');
      const ay = P.t - 5.8 * u;
      const ax = P.l - 5.5 * u;
      s.arrow(P.X(0), ay, P.r + 1.5 * u, ay, k, 0.35, 1.6);
      s.text('x', P.r + 3.5 * u, ay, { size: 3.4, font: 'mono', weight: 700, color: k });
      s.arrow(ax, P.Y(0), ax, P.b + 1.5 * u, k, 0.35, 1.6);
      s.text('y', ax, P.b + 4 * u, { size: 3.4, font: 'mono', weight: 700, color: k });
    });
    cat(s, P, s.ease('what', 0.8, 0.2));
    const tA = s.ease('what', 0.8, 3.2);
    s.alpha(tA, () => rect(s, P, TRUTH, 'green', { fill: 0.06, lw: 0.7 }));
    const lab = { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true } as const;
    s.alpha(after(s, 'tl', 0.2) * (1 - s.ease('width', 0.5)), () => {
      s.circle(P.X(1), P.Y(1), 1.1 * u, { fill: s.c('green') });
      s.text('(x₁, y₁)', P.X(1) + 1.6 * u, P.Y(1) - 2.8 * u, lab);
    });
    s.alpha(after(s, 'br', 0.2) * (1 - s.ease('width', 0.5)), () => {
      s.circle(P.X(5), P.Y(4), 1.1 * u, { fill: s.c('green') });
      s.text('(x₂, y₂)', P.X(5) + 1.4 * u, P.Y(4) + 3.2 * u, lab);
    });
    const gone = 1 - s.ease('guess', 0.6);
    s.alpha(after(s, 'width', 0.2) * gone, () => {
      const y = P.Y(1) - 1.6 * u;
      s.line(P.X(1), y, P.X(5), y, s.c('green'), 0.35);
      s.text('4', P.X(3), y - 2.4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    s.alpha(after(s, 'height', 0.2) * gone, () => {
      const x = P.X(1) - 1.6 * u;
      s.line(x, P.Y(1), x, P.Y(4), s.c('green'), 0.35);
      s.text('3', x - 2.2 * u, P.Y(2.5), { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    const gA = after(s, 'guess', 0.15, 0.8);
    s.alpha(gA, () => rect(s, P, GUESS, 'blue', { fill: 0.06, lw: 0.7 }));

    work(s, P, 0, [['x: across →    y: down ↓', '--ink-2']], s.win('axes', 'tl'));
    const corners = s.win('tl', 'width');
    work(s, P, 0, [['top left (x₁, y₁) = ', '--ink-2'], ['(1, 1)', 'green']], after(s, 'tl', 0.4) * corners);
    work(s, P, 1, [['bottom right (x₂, y₂) = ', '--ink-2'], ['(5, 4)', 'green']], after(s, 'br', 0.4) * corners);
    work(s, P, 0, [['truth = ', '--ink-2'], ['(1, 1, 5, 4)', 'green']], s.ease('width', 0.5));
    work(s, P, 1, [['width = 5 − 1 = ', '--ink-2'], ['4', 'green']], after(s, 'width', 0.4) * gone);
    work(s, P, 2, [['height = 4 − 1 = ', '--ink-2'], ['3', 'green']], after(s, 'height', 0.4) * gone);
    work(s, P, 3, [['area = 4 × 3 = ', '--ink-2'], ['12', 'green']], after(s, 'area', 0.2) * gone);
    work(s, P, 1, [['area = ', '--ink-2'], ['12', 'green']], s.ease('guess', 0.5, 0.3));
    work(s, P, 2, [['guess = ', '--ink-2'], ['(2, 2, 6, 5)', 'blue']], after(s, 'guess', 0.3));
    work(s, P, 3, [['area = ', '--ink-2'], ['12', 'blue']], after(s, 'guess', 0.55));
    work(s, P, 4.3, [['agree? ', '--ink'], ['1: a match   0: a miss', '--ink-2']], after(s, 'ask', 0.4), 3.4);
  },
};

const overlap: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, 10, 6, 8, 42);
    const xLit = s.win('lr', 'tb');
    const yLit = s.win('tb', 'inter');
    const away = after(s, 'apart', 0.1, 0.9);
    const both = after(s, 'both', 0.1, 0.9);
    if (s.since('both') >= 0) gridLines(s, P, 10, 6, { x: [4, 6], y: [3, 4], a: after(s, 'both', 0.5) });
    else if (s.since('tb') >= 0) gridLines(s, P, 10, 6, { y: [2, 4], a: yLit });
    else gridLines(s, P, 10, 6, { x: [2, 5], a: xLit });
    const t = TRUTH.map((v, i) => lerp(v, MISS_A[i]!, both)) as Box;
    const g = GUESS.map((v, i) => lerp(lerp(v, AWAY[i]!, away), MISS_B[i]!, both)) as Box;
    rect(s, P, t, 'green', { fill: 0.08 });
    rect(s, P, g, 'blue', { fill: 0.08 });
    s.alpha(s.ease('share', 0.8, 1) * (1 - away), () => rect(s, P, [2, 2, 5, 4], 'gold', { fill: 0.45, lw: 0.6 }));
    s.alpha(xLit, () => {
      for (const x of [2, 5]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(yLit, () => {
      for (const y of [2, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.45, [1.2, 0.9]);
    });
    const red = { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true } as const;
    // Slid apart: the right edge, 5, now lies left of the left edge, 6.
    s.alpha(after(s, 'apart', 0.5) * (1 - both), () => {
      const y = P.Y(3.5);
      s.line(P.X(5), y, P.X(g[0]), y, s.c('red'), 0.6);
      s.text('5 − 6 = −1', (P.X(5) + P.X(g[0])) / 2, P.Y(5) + 3.4 * u, red);
    });
    // Missing on both sides, each gap beside its own red bar.
    s.alpha(after(s, 'both', 0.5), () => {
      for (const x of [4, 6]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.4, [1.2, 0.9]);
      s.line(P.X(4), P.Y(2), P.X(6), P.Y(2), s.c('red'), 0.6);
      s.text('4 − 6 = −2', P.X(6) + 1.4 * u, P.Y(2), { ...red, align: 'left' });
    });
    s.alpha(after(s, 'both', 0.75), () => {
      for (const y of [3, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.4, [1.2, 0.9]);
      s.line(P.X(7.5), P.Y(3), P.X(7.5), P.Y(4), s.c('red'), 0.6);
      s.text('3 − 4 = −1', P.X(7.5) + 1.4 * u, P.Y(3.5), { ...red, align: 'left' });
    });

    const first = 1 - away;
    work(s, P, 0, [['width = min(5, 6) − max(1, 2) = ', '--ink-2'], ['3', 'gold']], after(s, 'lr', 0.55) * first);
    work(s, P, 1, [['height = min(4, 5) − max(1, 2) = ', '--ink-2'], ['2', 'gold']], after(s, 'tb', 0.55) * first);
    work(s, P, 2, [['inter = 3 × 2 = ', '--ink-2'], ['6', 'gold']], after(s, 'inter', 0.15) * first);
    work(s, P, 3, [['inter: the part in both', '--ink-2']], after(s, 'inter', 0.5) * first);
    work(s, P, 0, [['right − left = 5 − 6 = ', '--ink-2'], ['−1', 'red']], after(s, 'apart', 0.5) * (1 - both));
    work(s, P, 1, [['negative: ', '--ink-2'], ['no overlap', 'red']], after(s, 'apart', 0.8) * (1 - both));
    const raw = 1 - after(s, 'clamp', 0.5);
    work(s, P, 0, [['right − left = 4 − 6 = ', '--ink-2'], ['−2', 'red']], after(s, 'both', 0.55) * raw);
    work(s, P, 1, [['bottom − top = 3 − 4 = ', '--ink-2'], ['−1', 'red']], after(s, 'both', 0.8) * raw);
    work(s, P, 2, [['(−2) × (−1) = 2', '--ink-3'], ['   ✗ no overlap', 'red']], after(s, 'clamp', 0.05) * (1 - after(s, 'clamp', 0.7)));
    work(s, P, 0, [['width = max(0, −2) = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.5));
    work(s, P, 1, [['height = max(0, −1) = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.62));
    work(s, P, 2, [['inter = 0 × 0 = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.8));
  },
};

/** The union of TRUTH and GUESS: both boxes as one shape. */
const UNION: [number, number][] = [[1, 1], [5, 1], [5, 2], [6, 2], [6, 5], [2, 5], [2, 4], [1, 4]];

const union: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, 10, 6, 8, 42);
    gridLines(s, P, 10, 6);
    const grow = after(s, 'big', 0.2, 1.4) * (1 - after(s, 'union', 0, 1));
    const g = GUESS.map((v, i) => lerp(v, HUGE[i]!, grow)) as Box;
    s.alpha(s.win('fair', 'union'), () => rect(s, P, HUGE, 'purple', { fill: 0.12, lw: 0.9 }));
    const uA = after(s, 'union', 0.45) * (1 - 0.6 * s.ease('range', 0.6));
    s.alpha(uA, () => {
      const c = s.ctx;
      c.beginPath();
      UNION.forEach(([x, y], i) => (i ? c.lineTo(P.X(x), P.Y(y)) : c.moveTo(P.X(x), P.Y(y))));
      c.closePath();
      c.fillStyle = s.tint('purple', 0.16);
      c.fill();
      c.strokeStyle = s.c('purple');
      c.lineWidth = 0.8 * u;
      c.stroke();
    });
    rect(s, P, TRUTH, 'green', { fill: 0.06 });
    rect(s, P, g, 'blue', { fill: 0.06 });
    const e = edges(TRUTH, g);
    rect(s, P, [e.l, e.t, e.r, e.bt], 'gold', { fill: 0.45, lw: 0.6 });
    rect(s, P, TRUTH, 'green', { fill: 0 });
    // Not the rectangle around both.
    const hull = s.win('union', 'count') * after(s, 'union', 0.7);
    s.alpha(hull, () => rect(s, P, [1, 1, 6, 5], 'red', { fill: 0, lw: 0.5, dash: true }));

    const early = 1 - s.ease('union', 0.5);
    work(s, P, 0, [['shared = ', '--ink-2'], ['12', 'gold'], [': all of truth', '--ink-2']], after(s, 'big', 0.6) * early);
    work(s, P, 1, [['covers ', '--ink-2'], ['60', 'purple'], [': 12 / 60 = 0.2', '--ink-2']], after(s, 'fair', 0.65) * early);
    const mid = s.ease('union', 0.5, 0.3) * (1 - s.ease('range', 0.6));
    work(s, P, 0, [['union: ', 'purple'], ['inside either box', '--ink-2']], mid);
    work(s, P, 1, [['✗ not the box around both', 'red']], hull);
    work(s, P, 1, [['union = 12 + 12 − 6 = ', '--ink-2'], ['18', 'purple']], after(s, 'count', 0.5) * (1 - s.ease('range', 0.6)));
    const fy = lerp(2, 0, s.ease('range', 0.8));
    s.alpha(s.ease('iou', 0.6, 0.6), () => rich(s, [['IoU = 6 / 18 ≈ ', '--ink'], ['0.33', 'gold']], P.tx, P.ty + fy * P.gap, { size: 4, weight: 650 }));

    // A scale from 0 to 1 with this guess on it, and the hit zone above a half.
    s.alpha(s.ease('range', 0.6, 0.6), () => {
      const half = (P.side ? 26 : 34) * u;
      const x0 = P.tx - half;
      const x1 = P.tx + half;
      const y = P.ty + 2.2 * P.gap;
      const X = (v: number) => lerp(x0, x1, v);
      s.line(x0, y, x1, y, s.c('--ink-3'), 0.45);
      const hit = after(s, 'voc', 0.75);
      const ticks: [number, string, string, number][] = [[0, '0', 'apart', 1], [0.5, '0.5', 'hit →', hit], [1, '1', 'same', 1]];
      for (const [v, n, w, a] of ticks) {
        s.alpha(a, () => {
          s.line(X(v), y - 1.4 * u, X(v), y + 1.4 * u, s.c('--ink-3'), 0.4);
          s.text(n, X(v), y - 4 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
          s.text(w, X(v), y + 4.2 * u, { size: 3, color: s.c(v === 0.5 ? 'green' : '--ink-3') });
        });
      }
      s.alpha(hit, () => s.rrect(X(0.5), y - 0.9 * u, X(1) - X(0.5), 1.8 * u, 0.9, { fill: s.tint('green', 0.35) }));
      const short = after(s, 'low', 0.5);
      s.circle(X(1 / 3), y, 1.4 * u, { fill: s.c(short > 0.5 ? 'red' : 'gold'), stroke: s.c('--card'), lw: 0.4 });
    });
    work(s, P, 4, [['Jaccard: ', '--ink'], ['in both / in either', '--ink-2']], s.win('jaccard', 'voc'));
    work(s, P, 4, [['a hit: IoU above 0.5', 'green']], s.win('voc', 'low'));
    work(s, P, 4, [['0.33: ', '--ink-2'], ['short of a hit', 'red']], after(s, 'low', 0.5));
    cite(s, P, 'Paul Jaccard, 1901', s.win('jaccard', 'voc'));
    cite(s, P, 'Visual Object Classes · Everingham et al., 2010', s.ease('voc', 0.6));
  },
};

// Worked as the practice asks it: B lies inside A, so the overlap is B and the union is A.
const BIG: Box = [1, 1, 7, 5];
const SMALL: Box = [2, 2, 5, 4];

const inside: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, 10, 6, 8, 42);
    gridLines(s, P, 10, 6);
    const label = { size: 3.2, font: 'mono', weight: 700, align: 'left', halo: true } as const;
    rect(s, P, BIG, 'green', { fill: 0.08 });
    s.text('A', P.X(1) + 1.4 * u, P.Y(1) + 2.6 * u, { ...label, color: s.c('green') });
    const bA = s.ease('small', 0.6);
    s.alpha(bA, () => rect(s, P, SMALL, 'blue', { fill: 0.08 }));
    s.alpha(after(s, 'inter', 0.1), () => rect(s, P, SMALL, 'gold', { fill: 0.45, lw: 0.6 }));
    s.alpha(after(s, 'inter', 0.55) * (1 - 0.6 * s.ease('answer', 0.6)), () => rect(s, P, BIG, 'purple', { fill: 0.1, lw: 0.9 }));
    s.alpha(bA, () => s.text('B', P.X(2) + 1.4 * u, P.Y(2) + 2.6 * u, { ...label, color: s.c('blue') }));

    work(s, P, 0, [['A = (1, 1, 7, 5): 6 × 4 = ', '--ink-2'], ['24', 'green']], s.ease('nest', 0.6, 1.5));
    work(s, P, 1, [['B = (2, 2, 5, 4): 3 × 2 = ', '--ink-2'], ['6', 'blue']], s.ease('small', 0.6, 0.3));
    work(s, P, 2, [['inter = all of B = ', '--ink-2'], ['6', 'gold']], after(s, 'inter', 0.2));
    work(s, P, 3, [['union = all of A = ', '--ink-2'], ['24', 'purple']], after(s, 'inter', 0.6));
    s.alpha(s.ease('answer', 0.6, 0.4), () => rich(s, [['IoU = 6 / 24 = ', '--ink'], ['0.25', 'gold']], P.tx, P.ty + 4 * P.gap, { size: 4, weight: 650 }));
    work(s, P, 5, [['below 0.5: ', '--ink-2'], ['not a hit', 'red']], after(s, 'answer', 0.6) * (1 - s.ease('rule', 0.5)));
    work(s, P, 5, [['box inside box: ', '--ink-2'], ['small / big', 'gold']], s.ease('rule', 0.5, 0.3));
  },
};

export const scenes: Record<string, SceneDef> = { boxes, overlap, union, inside };
