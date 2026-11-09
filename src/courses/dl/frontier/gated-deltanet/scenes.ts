import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { lerp } from '../../../../lecture/scene';
import { after, cite, stacked } from '../../draw';
import { stack } from '../../sequences/draw';
import { fmt } from '../../transformers/draw';
import { curves, matrix, type Grid } from '../draw';
import { NIAH, NIAH_LENGTHS } from '../niah';

// The memory from the delta rule: key [1, 0] holds [2, 3], key [0, 1] holds [1, 4].
const S = [[2, 1], [3, 4]];
const NEW = [4, 1];

const Y = (s: Scene, f: number) => f * s.h;
const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.2, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The two keys, k₁ = [1, 0] and k₂ = [0, 1], over the columns they write. */
function keys(s: Scene, g: Grid) {
  ['k₁', 'k₂'].forEach((t, j) => mono(s, t, g.x(j), g.t - 3.2 * s.u, 'purple', 2.8, 'center', 600));
}

function col(s: Scene, x: number, y: number, v: readonly number[], name: string, k: Ink, on = 0) {
  stack(s, x, y, v.map((x) => fmt(x)), k, { w: 8, h: 6, gap: 7, on: [on, on] });
  mono(s, name, x, y + 9.5 * s.u, k, 2.8, 'center', 500);
}

/** S after a gated step with β = 1 at key [1, 0]: the written column is exact, the other faded by α. */
const gated = (alpha: number, written: number): number[][] => S.map((row, i) => [lerp(alpha * row[0]!, NEW[i]!, written), alpha * row[1]!].map(r2));

// ---- scene 1: the delta rule edits one key; a decay fades every key alike

const forget: SceneDef = {
  marks: {
    mamba: { tex: String.raw`\sym{S}{S} \leftarrow \sym{a}{a}\,\sym{S}{S} + \sym{v}{v}\,\sym{k}{k}^\top`, x: 0.5, y: 0.9, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    const st = stacked(s);
    const pa = st ? { x: s.w / 2, y: Y(s, 0.27) } : { x: s.w / 2 - 36 * u, y: Y(s, 0.4) };
    const pb = st ? { x: s.w / 2, y: Y(s, 0.63) } : { x: s.w / 2 + 36 * u, y: Y(s, 0.4) };
    s.show('mamba', s.ease('mamba2', 0.6));
    s.alpha(s.ease('one', 0.6), () => {
      const w = after(s, 'one', 0.25, 0.8);
      const g = matrix(s, pa.x, pa.y, gated(1, w), 'blue', { on: (i, j) => (j === 0 ? 0.6 * Math.min(w, 1 - after(s, 'one', 0.7, 0.5)) : 0) });
      keys(s, g);
      mono(s, 'delta rule: one key per token', pa.x, g.b + 5 * u, 'blue', 3, 'center', 600);
      s.alpha(after(s, 'one', 0.55, 0.5), () => mono(s, 'stale pairs: cleared one at a time', pa.x, g.b + 10 * u, '--ink-3', 2.8, 'center', 500));
    });
    s.alpha(s.ease('decay', 0.6), () => {
      const a = lerp(1, 0.5, after(s, 'decay', 0.4, 1.2));
      const g = matrix(s, pb.x, pb.y, S.map((row) => row.map((x) => r2(a * x))), 'teal', { alpha: () => 0.45 + 0.55 * a, on: () => 0.5 * s.ease('blunt', 0.5) });
      keys(s, g);
      mono(s, `decay a = ${fmt(r2(a))}: every pair at once`, pb.x, g.b + 5 * u, 'teal', 3, 'center', 600);
      s.alpha(s.ease('blunt', 0.6, 0.5), () => mono(s, 'both values halve, stale or not', pb.x, g.b + 10 * u, 'red', 2.8, 'center', 600));
    });
    cite(s, 'Dao & Gu, 2024', s.ease('mamba2', 0.6));
  },
};

// ---- scene 2: fade by the gate α, then the delta rule on what is left

const gate: SceneDef = {
  marks: {
    rule: { tex: String.raw`\sym{S}{S} \leftarrow \sym{alpha}{\alpha}\sym{S}{S} + \sym{beta}{\beta}\,(\sym{v}{v} - \sym{alpha}{\alpha}\sym{S}{S}\,\sym{k}{k})\,\sym{k}{k}^\top`, x: 0.5, y: 0.08, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    s.show('rule', s.ease('rule', 0.6));
    let a = lerp(1, 0.5, s.ease('both', 1.2, 0.8));
    const wipe = after(s, 'ends', 0.05, 1.2);
    const back = after(s, 'ends', 0.55, 1.2);
    a = lerp(a, 0, wipe);
    a = lerp(a, 1, back);
    const w = after(s, 'delta', 0.35, 0.8);
    const cx = s.w / 2 + 8 * u;
    const cy = Y(s, 0.42);
    s.alpha(s.ease('both', 0.6), () => {
      const g = matrix(s, cx, cy, gated(a, w), 'blue', { alpha: (i, j) => (j === 0 ? lerp(0.35 + 0.65 * a, 1, w) : 0.35 + 0.65 * a), on: (i, j) => (j === 0 ? 0.6 * w * s.win('delta', 'rule') : 0) });
      keys(s, g);
      mono(s, 'S', g.l - 4 * u, cy, 'blue', 3.4, 'right', 700);
      // The gate as a dial from 0 to 1.
      const gx = g.l - 18 * u;
      const top = cy - 12 * u;
      const bot = cy + 12 * u;
      s.line(gx, top, gx, bot, s.c('--axis'), 0.5);
      mono(s, '1', gx - 2.6 * u, top, '--ink-3', 2.6, 'right', 500);
      mono(s, '0', gx - 2.6 * u, bot, '--ink-3', 2.6, 'right', 500);
      s.circle(gx, lerp(bot, top, a), 1.6 * u, { fill: s.c('teal') });
      mono(s, `α = ${fmt(r2(a))}`, gx, bot + 5 * u, 'teal', 3.2, 'center', 650);
    });
    const yc = Y(s, 0.75);
    s.alpha(s.win('gate', 'delta'), () => mono(s, 'a gate: it lets through a share α of the memory', s.w / 2, yc, 'teal', 3.1));
    s.alpha(s.win('delta', 'ends'), () => mono(s, 'then the delta rule writes [4, 1] at k₁', s.w / 2, yc, 'blue', 3.1));
    s.alpha(s.ease('ends', 0.5) * (1 - after(s, 'ends', 0.5, 0.4)), () => mono(s, 'α near 0: the old memory is wiped', s.w / 2, yc, 'red', 3.1));
    s.alpha(after(s, 'ends', 0.55, 0.5), () => mono(s, 'α = 1: nothing fades, the plain delta rule', s.w / 2, yc, 'blue', 3.1));
  },
};

// ---- scene 3: one step in numbers, α = 0.5 and β = 1

const run: SceneDef = {
  draw(s) {
    const u = s.u;
    mono(s, 'α = 0.5   β = 1   k = k₁ = [1, 0]   v = [4, 1]', s.w / 2, Y(s, 0.07), '--ink-2', 3.1, 'center', 600);
    const gap = (s.tall ? 29 : 32) * u;
    const y1 = Y(s, 0.23);
    const fade = s.ease('fade', 0.6);
    s.alpha(s.ease('start', 0.6), () => {
      const g = matrix(s, s.w / 2 - gap, y1, S, 'blue');
      keys(s, g);
      s.alpha(fade, () => {
        s.arrow(g.r + 2 * u, y1, s.w / 2 + gap - 12 * u, y1, s.tint('--ink-3', 0.8), 0.35, 1.8);
        mono(s, '× α', s.w / 2, y1 - 3 * u, 'teal', 3, 'center', 650);
        const f = matrix(s, s.w / 2 + gap, y1, [[1, 0.5], [1.5, 2]], 'teal', { on: (i, j) => (j === 0 ? 0.5 * s.win('fade', 'write') : 0) });
        keys(s, f);
      });
    });
    const y2 = Y(s, 0.46);
    s.alpha(s.ease('diff', 0.6), () => {
      const p = (s.tall ? 17 : 19) * u;
      col(s, s.w / 2 - p, y2, NEW, 'v', 'gold', 0.5);
      mono(s, '−', s.w / 2 - p / 2, y2, '--ink-3', 4.2);
      col(s, s.w / 2, y2, [1, 1.5], 'αS k', 'teal');
      mono(s, '=', s.w / 2 + p / 2, y2, '--ink-3', 4.2);
      col(s, s.w / 2 + p, y2, [3, -0.5], 'difference', 'red', 0.5);
    });
    const y3 = Y(s, 0.71);
    s.alpha(s.ease('write', 0.6), () => {
      const g = matrix(s, s.w / 2, y3, [[4, 0.5], [1, 2]], 'blue', { ink: (i, j) => (j === 0 ? 'green' : 'teal'), on: (i, j) => (j === 0 ? 0.6 * (1 - s.ease('k2', 0.5)) : 0.6 * s.ease('k2', 0.5)) });
      keys(s, g);
      mono(s, 'k₁ reads [4, 1]: exact', s.w / 2, g.b + 4.5 * u, 'green', 2.9, 'center', 600);
      s.alpha(s.ease('k2', 0.6), () => mono(s, 'k₂ reads [0.5, 2]: faded by α', s.w / 2, g.b + 9.5 * u, 'teal', 2.9, 'center', 600));
    });
  },
};

// ---- scene 4: the needle-in-a-haystack results

const SERIES: { key: keyof (typeof NIAH)['repeat']; label: string; k: Ink }[] = [
  { key: 'deltanet', label: 'DeltaNet', k: 'red' },
  { key: 'mamba2', label: 'Mamba2', k: 'teal' },
  { key: 'gated', label: 'Gated DeltaNet', k: 'purple' },
];

const results: SceneDef = {
  draw(s) {
    const u = s.u;
    const st = stacked(s);
    s.alpha(s.ease('paper', 0.6) * (1 - s.ease('needle', 0.5)), () => mono(s, 'every model: 1.3B parameters, 100B tokens', s.w / 2, Y(s, 0.12), '--ink-2', 3));
    // The haystack: filler tokens with one key and value hidden, and the question at the end.
    s.alpha(s.ease('needle', 0.6) * (1 - s.ease('best', 0.5)), () => {
      const n = s.tall ? 13 : 17;
      const pitch = 5 * u;
      const x0 = s.w / 2 - ((n - 1) / 2) * pitch;
      const y = Y(s, 0.1);
      for (let i = 0; i < n; i++) {
        const k: Ink = i === 4 ? 'gold' : i === n - 1 ? 'teal' : '--ink-3';
        s.rrect(x0 + i * pitch - 2 * u, y - 2 * u, 4 * u, 4 * u, 0.6, { fill: s.tint(k, i === 4 || i === n - 1 ? 0.55 : 0.15), stroke: s.tint(k, 0.7), lw: 0.25 });
      }
      mono(s, 'needle', x0 + 4 * pitch, y + 5 * u, 'gold', 2.6, 'center', 600);
      mono(s, 'the question', x0 + (n - 1) * pitch, y + 5 * u, 'teal', 2.6, 'right', 600);
    });
    // Legend.
    const ly = Y(s, 0.27);
    s.alpha(s.ease('repeat', 0.6), () => {
      const lw = st ? 26 : 30;
      SERIES.forEach((c, i) => {
        const x = s.w / 2 + (i - 1) * lw * u;
        s.line(x - 9 * u, ly, x - 6 * u, ly, s.c(c.k), 0.6);
        mono(s, c.label, x - 5 * u, ly, c.k, 2.7, 'left', 600);
      });
    });
    const cw = (st ? 58 : 52) * u;
    const ch = (st ? 16 : 30) * u;
    const boxes = st
      ? [{ x: s.w / 2 - cw / 2 + 4 * u, y: Y(s, 0.38) }, { x: s.w / 2 - cw / 2 + 4 * u, y: Y(s, 0.38) + ch + 14 * u }]
      : [{ x: s.w / 2 - cw - 6 * u, y: Y(s, 0.4) }, { x: s.w / 2 + 10 * u, y: Y(s, 0.4) }];
    const sets = [NIAH.repeat, NIAH.essay];
    const titles = ['repeating filler', 'real essays'];
    const beats = ['repeat', 'essay'];
    sets.forEach((set, j) => {
      s.alpha(s.ease(beats[j]!, 0.6), () => {
        const b = boxes[j]!;
        curves(s, b.x, b.y, cw, ch, NIAH_LENGTHS, SERIES.map((c) => ({ vals: set[c.key], k: c.k })), { title: titles[j], reveal: 1 + 3 * after(s, beats[j]!, 0.15, 2.4) });
      });
    });
    s.alpha(s.ease('best', 0.6, 0.4), () => {
      mono(s, 'Gated DeltaNet: ahead of both,', s.w / 2, Y(s, 0.09), 'purple', 3.1);
      mono(s, 'and as fast to train as DeltaNet', s.w / 2, Y(s, 0.09) + 4.8 * u, 'purple', 3.1);
    });
    cite(s, 'Yang, Kautz & Hatamizadeh, 2024', s.ease('paper', 0.6) * (1 - s.ease('needle', 0.5)));
  },
};

export const scenes: Record<string, SceneDef> = { forget, gate, run, results };
