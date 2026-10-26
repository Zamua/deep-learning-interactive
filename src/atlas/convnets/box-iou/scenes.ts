import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, rich } from '../draw';
import type { Box } from './box';
import { type Plane, gridLines, plane, rect } from './plane';

const TRUTH: Box = [1, 1, 5, 4];
const GUESS: Box = [2, 2, 6, 5];
const AWAY: Box = [6, 2, 10, 5];
/** A pair that misses on both sides: right − left = −2, bottom − top = −1. */
const MISS_A: Box = [1, 1, 4, 3];
const MISS_B: Box = [6, 4, 9, 6];

/** One line of working in the text column, `row` lines down. */
function work(s: Scene, P: Plane, row: number, runs: [string, Ink][], a: number, size = 3.3): void {
  s.alpha(a, () => rich(s, runs, P.tx, P.ty + row * P.gap, { size, weight: 600 }));
}

const boxes: SceneDef = {
  draw(s) {
    const P = plane(s, 10, 6, 8, 42);
    gridLines(s, P, 10, 6);
    const tA = s.ease('box', 0.8, 0.3);
    s.alpha(tA, () => rect(s, P, TRUTH, 'green'));
    s.alpha(s.ease('corners', 0.5, 0.6), () => {
      s.circle(P.X(1), P.Y(1), 1.1 * s.u, { fill: s.c('green') });
      s.circle(P.X(5), P.Y(4), 1.1 * s.u, { fill: s.c('green') });
    });
    s.alpha(after(s, 'corners', 0.15) * (1 - s.ease('area', 0.5)), () => {
      s.text('(1, 1)', P.X(1) + 1.5 * s.u, P.Y(1) - 2.8 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('green'), halo: true });
      s.text('(5, 4)', P.X(5) + 1.2 * s.u, P.Y(4) + 3.2 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('green'), halo: true });
    });
    const wA = after(s, 'area', 0.15);
    const hA = after(s, 'area', 0.5);
    const gone = 1 - s.ease('guess', 0.6);
    s.alpha(wA * gone, () => {
      const y = P.Y(1) - 1.6 * s.u;
      s.line(P.X(1), y, P.X(5), y, s.c('green'), 0.35);
      s.text('4', P.X(3), y - 2.4 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    s.alpha(hA * gone, () => {
      const x = P.X(1) - 1.6 * s.u;
      s.line(x, P.Y(1), x, P.Y(4), s.c('green'), 0.35);
      s.text('3', x - 2.2 * s.u, P.Y(2.5), { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    const gA = after(s, 'guess', 0.1, 0.8);
    s.alpha(gA, () => rect(s, P, GUESS, 'blue'));
    work(s, P, 0, [['truth ', 'green'], ['(x1, y1, x2, y2)', '--ink-3']], tA * (1 - s.ease('corners', 0.4)));
    work(s, P, 0, [['truth = (1, 1, 5, 4)', 'green']], s.ease('corners', 0.5, 0.4));
    work(s, P, 1, [['area = 4 × 3 = ', '--ink-2'], ['12', 'green']], after(s, 'area', 0.75));
    work(s, P, 2, [['guess = (2, 2, 6, 5)', 'blue']], gA);
    work(s, P, 3, [['area = 4 × 3 = ', '--ink-2'], ['12', 'blue']], after(s, 'guess', 0.55));
  },
};

const overlap: SceneDef = {
  draw(s) {
    const P = plane(s, 10, 6, 8, 42);
    const xLit = after(s, 'inter', 0.35);
    const yLit = after(s, 'tall', 0.15);
    const tallOn = s.since('tall') >= 0;
    const back = 1 - s.ease('union', 0.9);
    const away = after(s, 'apart', 0.1, 0.9) * back;
    const both = after(s, 'both', 0.1, 0.9) * back;
    if (s.since('both') >= 0) gridLines(s, P, 10, 6, { x: [4, 6], y: [3, 4], a: after(s, 'both', 0.5) * back });
    else gridLines(s, P, 10, 6, { x: tallOn ? [] : [2, 5], y: [2, 4], a: tallOn ? yLit : xLit });
    const tB = TRUTH.map((v, i) => lerp(v, MISS_A[i]!, both)) as Box;
    const g = GUESS.map((v, i) => lerp(lerp(v, AWAY[i]!, away), MISS_B[i]!, both)) as Box;
    const uA = s.ease('union', 0.6) * (1 - s.ease('range', 0.6));
    rect(s, P, tB, 'green', { fill: 0.08 });
    rect(s, P, g, 'blue', { fill: 0.08 });
    s.alpha(uA, () => {
      const c = s.ctx;
      c.beginPath();
      const pts: [number, number][] = [[1, 1], [5, 1], [5, 2], [6, 2], [6, 5], [2, 5], [2, 4], [1, 4]];
      pts.forEach(([x, y], i) => (i ? c.lineTo(P.X(x), P.Y(y)) : c.moveTo(P.X(x), P.Y(y))));
      c.closePath();
      c.fillStyle = s.tint('purple', 0.14);
      c.fill();
      c.strokeStyle = s.c('purple');
      c.lineWidth = 0.8 * s.u;
      c.stroke();
    });
    // The overlap: edges as dashed guides, then the gold rectangle once both sides are known.
    s.alpha(xLit * (1 - s.ease('tall', 0.5)), () => {
      for (const x of [2, 5]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(yLit * (1 - s.ease('apart', 0.4)), () => {
      for (const y of [2, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(after(s, 'tall', 0.7) * (1 - away), () => rect(s, P, [2, 2, 5, 4], 'gold', { fill: 0.45, lw: 0.6 }));
    s.alpha(away * (1 - both), () => {
      const y = P.Y(3.5);
      s.line(P.X(5), y, P.X(g[0]), y, s.c('red'), 0.6);
      s.text('5 − 6 = −1', (P.X(5) + P.X(g[0])) / 2, P.Y(5) + 3.4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    });
    s.alpha(after(s, 'both', 0.5) * back, () => {
      for (const x of [4, 6]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.4, [1.2, 0.9]);
    });
    s.alpha(after(s, 'both', 0.75) * back, () => {
      for (const y of [3, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.4, [1.2, 0.9]);
    });
    // Both gaps of the pair that misses on both sides, each beside its own red bar.
    const gapText = { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true } as const;
    s.alpha(after(s, 'both', 0.55) * back, () => {
      s.line(P.X(4), P.Y(2), P.X(6), P.Y(2), s.c('red'), 0.6);
      s.text('4 − 6 = −2', P.X(6) + 1.4 * s.u, P.Y(2), { ...gapText, align: 'left' });
    });
    s.alpha(after(s, 'both', 0.8) * back, () => {
      s.line(P.X(7.5), P.Y(3), P.X(7.5), P.Y(4), s.c('red'), 0.6);
      s.text('3 − 4 = −1', P.X(7.5) + 1.4 * s.u, P.Y(3.5), { ...gapText, align: 'left' });
    });
    const done = 1 - s.ease('range', 0.6);
    s.alpha((1 - away) * done, () => work(s, P, 0, [['width = min(5, 6) − max(1, 2) = ', '--ink-2'], ['3', 'gold']], after(s, 'inter', 0.8)));
    s.alpha(away * (1 - both), () => work(s, P, 0, [['width = max(0, 5 − 6) = ', '--ink-2'], ['0', 'red']], 1));
    const raw = 1 - after(s, 'clamp', 0.45);
    work(s, P, 0, [['right − left = 4 − 6 = ', '--ink-2'], ['−2', 'red']], after(s, 'both', 0.55) * back * raw);
    work(s, P, 1, [['bottom − top = 3 − 4 = ', '--ink-2'], ['−1', 'red']], after(s, 'both', 0.8) * back * raw);
    work(s, P, 2, [['(−2) × (−1) = 2', '--ink-3'], ['   ✗ no overlap', 'red']], after(s, 'clamp', 0.1) * back * (1 - after(s, 'clamp', 0.75)));
    work(s, P, 0, [['width = max(0, −2) = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.45) * back);
    work(s, P, 1, [['height = max(0, −1) = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.6) * back);
    work(s, P, 2, [['inter = 0 × 0 = ', '--ink-2'], ['0', 'gold']], after(s, 'clamp', 0.8) * back);
    s.alpha((1 - 0.75 * away) * (1 - both) * done, () => {
      work(s, P, 1, [['height = min(4, 5) − max(1, 2) = ', '--ink-2'], ['2', 'gold']], after(s, 'tall', 0.45));
      work(s, P, 2, [['inter = 3 × 2 = ', '--ink-2'], ['6', 'gold']], after(s, 'tall', 0.75));
    });
    work(s, P, 3, [['union = 12 + 12 − 6 = ', '--ink-2'], ['18', 'purple']], after(s, 'union', 0.75) * done);
    const fy = lerp(4, 0, s.ease('range', 0.8));
    s.alpha(s.ease('iou', 0.6), () => rich(s, [['IoU = 6 / 18 ≈ ', '--ink'], ['0.33', 'gold']], P.tx, P.ty + fy * P.gap, { size: 4, weight: 650 }));

    // A scale from 0 to 1 with this guess marked on it.
    s.alpha(s.ease('range', 0.6, 0.6), () => {
      const half = (P.side ? 26 : 34) * s.u;
      const x0 = P.tx - half;
      const x1 = P.tx + half;
      const y = P.ty + 2.2 * P.gap;
      const X = (v: number) => lerp(x0, x1, v);
      s.line(x0, y, x1, y, s.c('--ink-3'), 0.45);
      const ticks: [number, string, string][] = [[0, '0', 'apart'], [0.5, '0.5', 'hit'], [1, '1', 'same']];
      for (const [v, n, w] of ticks) {
        s.line(X(v), y - 1.4 * s.u, X(v), y + 1.4 * s.u, s.c('--ink-3'), 0.4);
        s.text(n, X(v), y - 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
        s.text(w, X(v), y + 4.2 * s.u, { size: 3, color: s.c('--ink-3') });
      }
      s.alpha(after(s, 'range', 0.6), () => s.rrect(X(0.5), y - 0.9 * s.u, X(1) - X(0.5), 1.8 * s.u, 0.9, { fill: s.tint('green', 0.35) }));
      s.circle(X(1 / 3), y, 1.4 * s.u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.4 });
    });
  },
};


// Worked as the practice asks it: B lies inside A, so the overlap is B and the union is A.
const BIG: Box = [1, 1, 7, 5];
const SMALL: Box = [2, 2, 5, 4];

const inside: SceneDef = {
  draw(s) {
    const P = plane(s, 10, 6, 8, 42);
    const guides = after(s, 'edges', 0.05) * (1 - after(s, 'edges', 0.5));
    gridLines(s, P, 10, 6, { x: [2, 5], y: [2, 4], a: guides });
    const label = { size: 3.2, font: 'mono', weight: 700, align: 'left', halo: true } as const;
    rect(s, P, BIG, 'green', { fill: 0.08 });
    s.text('A', P.X(1) + 1.4 * s.u, P.Y(1) + 2.6 * s.u, { ...label, color: s.c('green') });
    s.alpha(after(s, 'ask', 0.5), () => rect(s, P, SMALL, 'blue', { fill: 0.08 }));
    s.alpha(guides, () => {
      for (const x of [2, 5]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.45, [1.2, 0.9]);
      for (const y of [2, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(after(s, 'edges', 0.35), () => rect(s, P, SMALL, 'gold', { fill: 0.45, lw: 0.6 }));
    s.alpha(after(s, 'edges', 0.65), () => rect(s, P, BIG, 'purple', { fill: 0.1, lw: 0.9 }));
    s.alpha(after(s, 'ask', 0.5), () => s.text('B', P.X(2) + 1.4 * s.u, P.Y(2) + 2.6 * s.u, { ...label, color: s.c('blue') }));

    work(s, P, 0, [['A = (1, 1, 7, 5): 6 × 4 = ', '--ink-2'], ['24', 'green']], after(s, 'ask', 0.1));
    work(s, P, 1, [['B = (2, 2, 5, 4): 3 × 2 = ', '--ink-2'], ['6', 'blue']], after(s, 'ask', 0.55));
    work(s, P, 2, [['inter = (5 − 2) × (4 − 2) = ', '--ink-2'], ['6', 'gold']], after(s, 'edges', 0.4));
    work(s, P, 3, [['union = 24 + 6 − 6 = ', '--ink-2'], ['24', 'purple']], after(s, 'edges', 0.8));
    s.alpha(s.ease('answer', 0.6), () => rich(s, [['IoU = 6 / 24 = ', '--ink'], ['0.25', 'gold']], P.tx, P.ty + 4 * P.gap, { size: 4, weight: 650 }));
    work(s, P, 5, [['below 0.5: ', '--ink-2'], ['not a hit', 'red']], after(s, 'answer', 0.55));
  },
};

export const scenes: Record<string, SceneDef> = { boxes, overlap, inside };
