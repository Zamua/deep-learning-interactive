import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { stack } from '../../sequences/draw';
import { fmt, vtext } from '../../transformers/draw';
import { matrix, type Grid } from '../draw';
import { sub } from '../linear-recurrence/chain';

// The memory from linear attention: key [1, 0] holds [2, 3], key [0, 1] holds [1, 4].
const S = [[2, 1], [3, 4]];
const NEW = [4, 1];
const PILED = [[6, 1], [4, 4]];
const DELTA = [2, -2];
const WRITTEN = [[4, 1], [1, 4]];

const Y = (s: Scene, f: number) => f * s.h;
const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.2, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** The two keys, k₁ = [1, 0] and k₂ = [0, 1], over the columns they write. */
function keys(s: Scene, g: Grid) {
  ['k₁', 'k₂'].forEach((t, j) => mono(s, t, g.x(j), g.t - 3.2 * s.u, 'purple', 2.8, 'center', 600));
}

/** A vector as a column of cells with its name under it. */
function col(s: Scene, x: number, y: number, v: readonly number[], name: string, k: Ink, on = 0) {
  stack(s, x, y, v.map((x) => fmt(x)), k, { w: 8, h: 6, gap: 7, on: [on, on] });
  mono(s, name, x, y + 9.5 * s.u, k, 2.8, 'center', 500);
}

// ---- scene 1: adding piles a new value onto the old; slanted keys blend

const pile: SceneDef = {
  draw(s) {
    const u = s.u;
    const cy = Y(s, 0.25);
    const gap = (s.tall ? 30 : 33) * u;
    const go = s.ease('again', 0.8);
    const x0 = lerp(s.w / 2, s.w / 2 - gap, go);
    const piled = s.ease('pile', 0.5);
    s.alpha(s.ease('memory', 0.6), () => {
      const g = matrix(s, x0, cy, S, 'blue', { on: (i, j) => 0.4 * after(s, 'memory', j === 0 ? 0.3 : 0.6, 0.4) * (1 - go) });
      keys(s, g);
      mono(s, 'S', g.l - 4 * u, cy, 'blue', 3.4, 'right', 700);
      s.alpha(1 - go, () => mono(s, 'k₁ = [1, 0] holds [2, 3]   k₂ = [0, 1] holds [1, 4]', s.w / 2, g.b + 5 * u, '--ink-2', 2.8, 'center', 500));
    });
    s.alpha(after(s, 'again', 0.3, 0.6), () => {
      const g = matrix(s, s.w / 2, cy, [[4, 0], [1, 0]], 'blue');
      mono(s, '+', (x0 + s.w / 2) / 2, cy, '--ink-3', 4.2);
      mono(s, '[4, 1] at k₁', s.w / 2, g.b + 4 * u, '--ink-2', 2.7, 'center', 500);
    });
    s.alpha(after(s, 'again', 0.6, 0.6), () => {
      const x = s.w / 2 + gap;
      const g = matrix(s, x, cy, PILED, 'blue', { ink: (i, j) => (j === 0 && piled > 0.5 ? 'red' : 'blue'), on: (i, j) => (j === 0 ? 0.6 * piled : 0) });
      keys(s, g);
      mono(s, '=', (s.w / 2 + x) / 2, cy, '--ink-3', 4.2);
    });
    s.alpha(piled * (1 - s.ease('angle', 0.5) * 0.5), () => mono(s, 'k₁ reads [6, 4]: old + new, piled up', s.w / 2, Y(s, 0.43), 'red', 3.2));
    // Keys as arrows: two at a right angle, one between them that reads a mix.
    s.alpha(s.ease('angle', 0.6), () => {
      const ox = s.w / 2 - (s.tall ? 22 : 26) * u;
      const oy = Y(s, 0.86);
      const L = 24 * u;
      s.line(ox - 3 * u, oy, ox + L + 4 * u, oy, s.c('--axis'), 0.25);
      s.line(ox, oy + 3 * u, ox, oy - L - 4 * u, s.c('--axis'), 0.25);
      s.line(ox + 3 * u, oy, ox + 3 * u, oy - 3 * u, s.tint('--ink-3', 0.8), 0.25);
      s.line(ox, oy - 3 * u, ox + 3 * u, oy - 3 * u, s.tint('--ink-3', 0.8), 0.25);
      s.arrow(ox, oy, ox + L, oy, s.c('purple'), 0.45, 2.2);
      s.arrow(ox, oy, ox, oy - L, s.c('purple'), 0.45, 2.2);
      mono(s, 'k₁', ox + L + 2 * u, oy + 3.2 * u, 'purple', 2.8, 'left');
      mono(s, 'k₂', ox - 2 * u, oy - L, 'purple', 2.8, 'right');
      const tip = after(s, 'angle', 0.3, 0.6);
      s.alpha(tip, () => {
        s.arrow(ox, oy, ox + 0.6 * L, oy - 0.8 * L, s.c('orange'), 0.45, 2.2);
        mono(s, 'k₃', ox + 0.6 * L + 1.6 * u, oy - 0.8 * L - 1.6 * u, 'orange', 2.8, 'left');
      });
      const tx = ox + L + 9 * u;
      s.alpha(tip, () => {
        mono(s, 'k₃ = [0.6, 0.8]', tx, oy - 0.78 * L, 'orange', 2.9, 'left', 500);
        mono(s, 'reads [2, 5]', tx, oy - 0.78 * L + 5 * u, '--ink', 2.9, 'left', 600);
        mono(s, '= 0.6 v₁ + 0.8 v₂', tx, oy - 0.78 * L + 10 * u, '--ink-2', 2.9, 'left', 500);
      });
      s.alpha(s.ease('cap', 0.6), () => {
        mono(s, '2 numbers per key:', tx, oy - 0.78 * L + 17 * u, 'red', 2.9, 'left', 600);
        mono(s, 'only 2 at right angles', tx, oy - 0.78 * L + 21.5 * u, 'red', 2.9, 'left', 600);
      });
    });
    cite(s, 'Schlag, Irie & Schmidhuber, 2021', s.ease('schlag', 0.6));
  },
};

// ---- scene 2: read the old value, take the difference, write only that

const delta: SceneDef = {
  marks: {
    rule: { tex: String.raw`\sym{S}{S} \leftarrow \sym{S}{S} + (\sym{v}{v} - \sym{S}{S}\,\sym{k}{k})\,\sym{k}{k}^\top`, x: 0.5, y: 0.08, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    s.show('rule', s.ease('rule', 0.6));
    const cy = Y(s, 0.27);
    const gx = (s.tall ? 22 : 26) * u;
    const read = after(s, 'old', 0.3, 0.5);
    s.alpha(s.ease('old', 0.6), () => {
      const g = matrix(s, s.w / 2 - gx, cy, S, 'blue', { on: (i, j) => (j === 0 ? 0.6 * read * (1 - s.ease('write', 0.4)) : 0) });
      keys(s, g);
      mono(s, 'S', g.l - 4 * u, cy, 'blue', 3.4, 'right', 700);
      mono(s, 'k = k₁ = [1, 0]', s.w / 2 + gx, cy - 10.5 * u, 'purple', 2.8, 'center', 500);
      s.alpha(read, () => col(s, s.w / 2 + gx, cy, [2, 3], 'old = S k', 'gold', 0.3));
    });
    // v − old = delta
    const yd = Y(s, 0.52);
    s.alpha(s.ease('delta', 0.6) * (1 - 0.6 * s.ease('write', 0.5)), () => {
      const p = (s.tall ? 17 : 19) * u;
      col(s, s.w / 2 - p, yd, NEW, 'v', 'gold', 0.5);
      mono(s, '−', s.w / 2 - p / 2, yd, '--ink-3', 4.2);
      col(s, s.w / 2, yd, [2, 3], 'old', 'gold');
      mono(s, '=', s.w / 2 + p / 2, yd, '--ink-3', 4.2);
      s.alpha(after(s, 'delta', 0.35, 0.5), () => col(s, s.w / 2 + p, yd, DELTA, 'delta', 'red', 0.5));
    });
    // S + delta kᵀ = the rewritten state
    const yw = Y(s, 0.77);
    s.alpha(s.ease('write', 0.6), () => {
      const gap = (s.tall ? 29 : 32) * u;
      matrix(s, s.w / 2 - gap, yw, S, 'blue');
      mono(s, '+', s.w / 2 - gap / 2, yw, '--ink-3', 4.2);
      const t = matrix(s, s.w / 2, yw, [[2, 0], [-2, 0]], 'red', { on: () => 0.3 });
      mono(s, 'delta kᵀ', s.w / 2, t.b + 4 * u, 'red', 2.8, 'center', 500);
      mono(s, '=', s.w / 2 + gap / 2, yw, '--ink-3', 4.2);
      s.alpha(after(s, 'write', 0.4, 0.5), () => {
        const ck = s.ease('check', 0.5);
        const ot = s.ease('other', 0.5);
        const g = matrix(s, s.w / 2 + gap, yw, WRITTEN, 'blue', { ink: (i, j) => (j === 0 && ck > 0.5 ? 'green' : 'blue'), on: (i, j) => (j === 0 ? 0.6 * ck * (1 - ot) : 0.6 * ot) });
        keys(s, g);
      });
    });
    const yc = Y(s, 0.93);
    s.alpha(s.win('check', 'unit'), () => mono(s, 'k reads [4, 1]: the new value replaces the old', s.w / 2, yc, 'green', 3.1));
    s.alpha(s.win('unit', 'other'), () => mono(s, 'the read moves by delta × (k · k), and k · k = 1', s.w / 2, yc, '--ink-2', 3));
    s.alpha(s.ease('other', 0.5), () => mono(s, 'k₂ still reads [1, 4]: at a right angle', s.w / 2, yc, 'blue', 3.1));
  },
};

// ---- scene 3: the write strength β slides the read from the old value to the new

const beta: SceneDef = {
  marks: {
    rule: { tex: String.raw`\sym{S}{S} \leftarrow \sym{S}{S} + \sym{beta}{\beta}\,(\sym{v}{v} - \sym{S}{S}\,\sym{k}{k})\,\sym{k}{k}^\top`, x: 0.5, y: 0.08, size: 4.8 },
    made: { tex: String.raw`\sym{beta}{\beta} = \sigma(\sym{w}{w} \cdot \sym{x}{x})`, x: 0.5, y: 0.9, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    s.show('rule', s.ease('beta', 0.6));
    s.show('made', s.ease('made', 0.6));
    let b = 1;
    b = lerp(b, 0.5, s.ease('half', 1));
    b = lerp(b, 0, s.ease('zero', 1));
    const box = 42 * u;
    const ox = s.w / 2 - (s.tall ? 26 : 30) * u;
    const oy = Y(s, 0.2) + box;
    const P = (x: number, y: number) => [ox + (x / 5) * box, oy - (y / 5) * box] as const;
    s.alpha(s.ease('beta', 0.6), () => {
      s.line(ox, oy, ox + box, oy, s.c('--axis'), 0.3);
      s.line(ox, oy, ox, oy - box, s.c('--axis'), 0.3);
      for (let i = 1; i <= 5; i++) {
        s.line(ox + (i / 5) * box, oy, ox + (i / 5) * box, oy - box, s.tint('--axis', 0.35), 0.15);
        s.line(ox, oy - (i / 5) * box, ox + box, oy - (i / 5) * box, s.tint('--axis', 0.35), 0.15);
      }
      mono(s, 'value read at k', ox + box / 2, oy + 4 * u, '--ink-3', 2.7, 'center', 500);
      const [x0, y0] = P(2, 3);
      const [x1, y1] = P(4, 1);
      s.line(x0, y0, x1, y1, s.tint('gold', 0.7), 0.35, [1, 1]);
      s.circle(x0, y0, 1.4 * u, { stroke: s.c('gold'), lw: 0.4, fill: s.c('--card') });
      s.circle(x1, y1, 1.4 * u, { fill: s.c('gold') });
      mono(s, 'old [2, 3]', x0 - 2.4 * u, y0 - 2.6 * u, 'gold', 2.7, 'right', 500);
      mono(s, 'new [4, 1]', x1 - 2 * u, y1 + 3.6 * u, 'gold', 2.7, 'right', 500);
      const rx = 2 + 2 * b;
      const ry = 3 - 2 * b;
      const [px, py] = P(rx, ry);
      s.circle(px, py, 1.6 * u, { fill: s.tint('red', 0.85), stroke: s.c('red'), lw: 0.3 });
      // The slider and the read, to the right of the plot.
      const tx = ox + box + 10 * u;
      mono(s, `β = ${fmt(Math.round(b * 100) / 100)}`, tx, Y(s, 0.32), 'red', 4, 'left', 700);
      mono(s, `reads ${vtext([Math.round(rx * 100) / 100, Math.round(ry * 100) / 100])}`, tx, Y(s, 0.32) + 7 * u, '--ink', 3.2, 'left', 600);
      const word = b > 0.97 ? 'replaced' : b < 0.03 ? 'kept' : Math.abs(b - 0.5) < 0.03 ? 'halfway' : '';
      if (word) mono(s, word, tx, Y(s, 0.32) + 13 * u, '--ink-2', 3, 'left', 500);
      const sx = tx;
      const sw = 26 * u;
      const sy = Y(s, 0.32) + 21 * u;
      s.line(sx, sy, sx + sw, sy, s.c('--axis'), 0.5);
      mono(s, '0', sx, sy + 3.4 * u, '--ink-3', 2.6);
      mono(s, '1', sx + sw, sy + 3.4 * u, '--ink-3', 2.6);
      s.circle(sx + b * sw, sy, 1.5 * u, { fill: s.c('red') });
    });
  },
};

// ---- scene 4: the delta rule as one gradient step, and S as fast weights

const learn: SceneDef = {
  marks: {
    loss: { tex: String.raw`\sym{L}{L} = \tfrac{1}{2}\,\lVert \sym{S}{S}\,\sym{k}{k} - \sym{v}{v} \rVert^2`, x: 0.5, y: 0.08, size: 4.6 },
    step: { tex: String.raw`\sym{S}{S} \leftarrow \sym{S}{S} - \sym{beta}{\beta}\,(\sym{S}{S}\,\sym{k}{k} - \sym{v}{v})\,\sym{k}{k}^\top`, x: 0.5, y: 0.19, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const fast = s.ease('fast', 0.6);
    s.show('loss', s.ease('loss', 0.6) * (1 - fast));
    s.show('step', s.ease('grad', 0.6, 0.8) * (1 - fast));
    // guess − v = error
    const ye = Y(s, 0.41);
    s.alpha(s.ease('error', 0.6) * (1 - fast), () => {
      const p = (s.tall ? 17 : 19) * u;
      col(s, s.w / 2 - p, ye, [2, 3], 'guess S k', 'gold');
      mono(s, '−', s.w / 2 - p / 2, ye, '--ink-3', 4.2);
      col(s, s.w / 2, ye, NEW, 'v', 'gold', 0.5);
      mono(s, '=', s.w / 2 + p / 2, ye, '--ink-3', 4.2);
      col(s, s.w / 2 + p, ye, [-2, 2], 'error', 'red', 0.5);
    });
    // The slope of the loss for each entry: the error's entry times k's entry.
    s.alpha(s.ease('grad', 0.6) * (1 - fast), () => {
      const cy = Y(s, 0.7);
      const g = matrix(s, s.w / 2 + 4 * u, cy, [[-2, 0], [2, 0]], 'red', { on: () => 0.3 });
      stack(s, g.l - 7 * u, cy, ['−2', '2'], 'red', { w: 7, h: 6.9, gap: 7.8 });
      [0, 1].forEach((j) => s.cell(g.x(j) - 3.5 * u, g.t - 9.5 * u, 7 * u, 6 * u, String([1, 0][j]), 'purple', { size: 3 }));
      mono(s, 'slope for S[i, j] = error[i] × k[j]', s.w / 2, g.b + 5 * u, '--ink-2', 2.9, 'center', 500);
    });
    s.alpha(s.win('widrow', 'fast'), () => mono(s, 'nudge the weights by error × input', s.w / 2, Y(s, 0.93), 'teal', 3.1));
    cite(s, 'Widrow & Hoff, 1960', s.win('widrow', 'fast'));
    // Slow weights make the keys and values; the fast weights S are rewritten by them.
    s.alpha(fast, () => {
      const cy = Y(s, 0.55);
      const gap = (s.tall ? 30 : 34) * u;
      const xs = [-1, 0, 1].map((j) => s.w / 2 + j * gap);
      ['W_Q', 'W_K', 'W_V'].forEach((t, i) => {
        const y = cy + (i - 1) * 8 * u;
        s.rrect(xs[0]! - 7 * u, y - 3 * u, 14 * u, 6 * u, 1, { fill: s.tint('blue', 0.12), stroke: s.tint('blue', 0.6), lw: 0.3 });
        mono(s, t, xs[0]!, y + 0.2 * u, 'blue', 2.8);
      });
      mono(s, 'slow weights', xs[0]!, cy + 16 * u, 'blue', 2.8, 'center', 600);
      mono(s, 'set in training', xs[0]!, cy + 20.5 * u, '--ink-2', 2.8, 'center', 500);
      s.arrow(xs[0]! + 8.5 * u, cy, xs[1]! - 8 * u, cy, s.tint('--ink-3', 0.8), 0.35, 1.8);
      s.cell(xs[1]! - 8 * u, cy - 3 * u, 7.5 * u, 6 * u, `k${sub(1)}`, 'purple', { size: 2.8 });
      s.cell(xs[1]! + 0.5 * u, cy - 3 * u, 7.5 * u, 6 * u, `v${sub(1)}`, 'gold', { size: 2.8 });
      mono(s, 'every token', xs[1]!, cy + 16 * u, '--ink-2', 2.8, 'center', 500);
      s.arrow(xs[1]! + 9 * u, cy, xs[2]! - 10.5 * u, cy, s.tint('--ink-3', 0.8), 0.35, 1.8);
      matrix(s, xs[2]!, cy, WRITTEN, 'blue', { on: () => 0.4 + 0.3 * Math.sin(s.t * 3) ** 2 });
      mono(s, 'fast weights: S', xs[2]!, cy + 16 * u, 'blue', 2.8, 'center', 600);
      mono(s, 'rewritten', xs[2]!, cy + 20.5 * u, '--ink-2', 2.8, 'center', 500);
    });
    cite(s, 'Schlag, Irie & Schmidhuber, 2021', s.win('fast', 'deltanet'));
    s.alpha(s.ease('deltanet', 0.6), () => mono(s, 'DeltaNet: trained in parallel, 1.3B parameters', s.w / 2, Y(s, 0.93), 'teal', 3.1));
    cite(s, 'Yang et al., 2024', s.ease('deltanet', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { pile, delta, beta, learn };
