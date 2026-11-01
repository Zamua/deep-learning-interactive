import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { stack } from '../../sequences/draw';
import { fmt, vtext } from '../../transformers/draw';
import { matrix } from '../draw';
import { sub } from '../linear-recurrence/chain';

// The running example: two tokens with keys on the axes, so each table fills one column of S.
const KS = [[1, 0], [0, 1]];
const VS = [[2, 3], [1, 4]];
const TABLES = KS.map((k, i) => VS[i]!.map((a) => k.map((b) => a * b)));
const S = [[2, 1], [3, 4]];
const ZERO = [[0, 0], [0, 0]];

const Y = (s: Scene, f: number) => f * s.h;
const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.2, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** A row of `n` bars on `base` centered on cx, bar i `h(i)` stage units tall; `a(i)` fades each in. */
function stairs(s: Scene, cx: number, base: number, n: number, h: (i: number) => number, k: Ink, a: (i: number) => number) {
  const pitch = 4.4 * s.u;
  const x0 = cx - ((n - 1) / 2) * pitch;
  s.line(x0 - 3 * s.u, base, x0 + (n - 1) * pitch + 3 * s.u, base, s.c('--axis'), 0.3);
  for (let i = 0; i < n; i++) {
    s.alpha(a(i), () => {
      const hh = h(i) * s.u;
      s.rrect(x0 + i * pitch - 1.5 * s.u, base - hh, 3 * s.u, hh, 0.6, { fill: s.tint(k, 0.4), stroke: s.tint(k, 0.85), lw: 0.25 });
    });
  }
}

// ---- scene 1: the cache grows, and every query scores every key

const WORDS = ['the', 'cat', 'sat', 'on', 'a', 'mat'];

const cache: SceneDef = {
  marks: {
    soft: { tex: String.raw`\text{weight}_i = \frac{e^{\,\sym{q}{q}\cdot\sym{k}{k}_i}}{\sum_j e^{\,\sym{q}{q}\cdot\sym{k}{k}_j}}`, x: 0.5, y: 0.66, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const n = WORDS.length;
    const pitch = (s.tall ? 12.5 : 14) * u;
    const xs = WORDS.map((_, i) => s.w / 2 + (i - (n - 1) / 2) * pitch);
    const yw = Y(s, 0.08);
    const yv = Y(s, 0.16);
    const yk = Y(s, 0.245);
    const yq = Y(s, 0.38);
    const shown = (i: number) => after(s, 'grow', 0.03 + 0.08 * i, 0.4);
    const block = s.ease('block', 0.6);
    xs.forEach((x, i) => s.alpha(shown(i), () => {
      mono(s, WORDS[i]!, x, yw, 'orange', 3, 'center', 500);
      s.cell(x - 4 * u, yv - 3 * u, 8 * u, 6 * u, `v${sub(i + 1)}`, 'gold', { on: 0.2, size: 2.8 });
      s.cell(x - 4 * u, yk - 3 * u, 8 * u, 6 * u, `k${sub(i + 1)}`, 'purple', { on: 0.2 + 0.6 * block, size: 2.8 });
    }));
    s.alpha(after(s, 'grow', 0.5, 0.5), () => {
      for (const x of xs) s.line(s.w / 2, yq - 3.2 * u, x, yk + 3.2 * u, s.tint('teal', 0.55), 0.3);
      s.cell(s.w / 2 - 4 * u, yq - 3 * u, 8 * u, 6 * u, 'q', 'teal', { on: 0.5, size: 3 });
      mono(s, 'the new token\'s query scores every key', s.w / 2, yq + 6 * u, '--ink-2', 2.9, 'center', 500);
    });
    // Work per token: attention's grows with the cache, a recurrent network's stays flat.
    const gx = (s.tall ? 24 : 30) * u;
    const base = Y(s, 0.8);
    s.alpha(s.ease('cost', 0.6) * (1 - block), () => {
      const cx = s.w / 2 - gx;
      mono(s, 'attention: scores per token', cx, base - 22 * u, 'teal', 2.8, 'center', 500);
      stairs(s, cx, base, n, (i) => 2.8 * (i + 1), 'teal', (i) => after(s, 'cost', 0.1 + 0.08 * i, 0.4));
      mono(s, 'grows with t', cx, base + 4 * u, '--ink-3', 2.8, 'center', 500);
    });
    s.alpha(s.ease('rnn', 0.6) * (1 - block), () => {
      const cx = s.w / 2 + gx;
      mono(s, 'recurrent: work per step', cx, base - 22 * u, 'gold', 2.8, 'center', 500);
      stairs(s, cx, base, n, () => 5.6, 'gold', (i) => after(s, 'rnn', 0.05 + 0.06 * i, 0.4));
      mono(s, 'one state, fixed size', cx, base + 4 * u, '--ink-3', 2.8, 'center', 500);
    });
    s.show('soft', block);
    s.alpha(s.ease('block', 0.6, 0.8), () => mono(s, 'needs q before any key\'s term is added', s.w / 2, Y(s, 0.84), 'red', 3.1, 'center', 600));
  },
};

// ---- scene 2: drop the softmax, regroup each term as a table times q

const drop: SceneDef = {
  marks: {
    soft: { tex: String.raw`\sym{o}{o} = \sum_i \text{softmax}(\sym{q}{q}\cdot\sym{k}{k})_i\;\sym{v}{v}_i`, x: 0.5, y: 0.09, size: 4.6 },
    plain: { tex: String.raw`\sym{o}{o} = \sum_i (\sym{k}{k}_i\cdot\sym{q}{q})\;\sym{v}{v}_i`, x: 0.5, y: 0.09, size: 4.8 },
    regroup: { tex: String.raw`(\sym{k}{k}\cdot\sym{q}{q})\;\sym{v}{v} = (\sym{v}{v}\,\sym{k}{k}^\top)\;\sym{q}{q}`, x: 0.5, y: 0.2, size: 4.6 },
    state: { tex: String.raw`\sym{S}{S} = \sum_i \sym{v}{v}_i\,\sym{k}{k}_i^\top \qquad \sym{o}{o} = \sym{S}{S}\,\sym{q}{q}`, x: 0.5, y: 0.09, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    const plain = s.ease('plain', 0.6, 0.4);
    const toS = s.ease('S', 0.6);
    s.show('soft', 1 - plain);
    s.show('plain', plain * (1 - toS));
    s.show('regroup', s.ease('regroup', 0.6) * (1 - toS));
    s.show('state', toS);
    // The weighted sum: each value times its key's score with q = [1, 1].
    const ys = Y(s, 0.43);
    s.alpha(s.ease('sum', 0.6) * (1 - s.ease('regroup', 0.5)), () => {
      const gap = (s.tall ? 19 : 21) * u;
      const xs = [-1, 0, 1].map((j) => s.w / 2 + j * gap);
      mono(s, 'q = [1, 1]', s.w / 2, ys - 16 * u, 'teal', 3.2);
      [0, 1].forEach((i) => {
        const x = xs[i]!;
        mono(s, `k${sub(i + 1)}·q = 1`, x, ys - 9.5 * u, 'purple', 2.8);
        stack(s, x, ys + 2 * u, VS[i]!.map(String), 'gold', { w: 8, h: 6, gap: 7 });
        mono(s, `v${sub(i + 1)}`, x, ys + 11.5 * u, 'gold', 2.8);
      });
      mono(s, '+', (xs[0]! + xs[1]!) / 2, ys + 2 * u, '--ink-3', 4);
      mono(s, '=', (xs[1]! + xs[2]!) / 2, ys + 2 * u, '--ink-3', 4);
      stack(s, xs[2]!, ys + 2 * u, ['3', '7'], 'green', { w: 8, h: 6, gap: 7, on: [0.5, 0.5] });
      mono(s, 'o', xs[2]!, ys + 11.5 * u, 'green', 2.8);
    });
    // The outer product v kᵀ: v down the side, k along the top, every product in the grid.
    s.alpha(s.ease('outer', 0.6) * (1 - toS), () => {
      const cx = s.w / 2 + 4 * u;
      const cy = Y(s, 0.47);
      const g = matrix(s, cx, cy, TABLES[0]!, 'blue', { on: (i, j) => after(s, 'outer', 0.25 + 0.12 * (2 * i + j), 0.3) * 0.5 });
      stack(s, g.l - 7 * u, cy, VS[0]!.map(String), 'gold', { w: 7, h: 6.9, gap: 7.8 });
      mono(s, 'v', g.l - 7 * u, g.b + 4.5 * u, 'gold', 3);
      [0, 1].forEach((j) => s.cell(g.x(j) - 3.5 * u, g.t - 9.5 * u, 7 * u, 6 * u, String(KS[0]![j]), 'purple', { size: 3 }));
      mono(s, 'k', g.r + 4 * u, g.t - 6.5 * u, 'purple', 3, 'left');
      mono(s, 'v kᵀ: a row per entry of v, a column per entry of k', s.w / 2, g.b + 11 * u, '--ink-2', 2.9, 'center', 500);
    });
    // Two tokens' tables add up to S, and S q gives the same o.
    s.alpha(toS, () => {
      const cy = Y(s, 0.42);
      const gap = (s.tall ? 27 : 30) * u;
      const at = [-1, 0, 1].map((j) => s.w / 2 + j * gap);
      matrix(s, at[0]!, cy, TABLES[0]!, 'blue');
      matrix(s, at[1]!, cy, TABLES[1]!, 'blue');
      mono(s, '+', (at[0]! + at[1]!) / 2, cy, '--ink-3', 4.2);
      mono(s, '=', (at[1]! + at[2]!) / 2, cy, '--ink-3', 4.2);
      matrix(s, at[2]!, cy, S, 'blue', { on: () => 0.5 });
      mono(s, `v${sub(1)}k${sub(1)}ᵀ`, at[0]!, cy + 12 * u, 'blue', 2.9);
      mono(s, `v${sub(2)}k${sub(2)}ᵀ`, at[1]!, cy + 12 * u, 'blue', 2.9);
      mono(s, 'S', at[2]!, cy + 12 * u, 'blue', 3.2, 'center', 700);
      s.alpha(after(s, 'S', 0.5), () => mono(s, 'S q = S [1, 1] = [3, 7]: the same o', s.w / 2, Y(s, 0.66), 'green', 3.3));
    });
    s.alpha(s.ease('fold', 0.6), () => {
      const y = Y(s, 0.8);
      const p = s.prog('fold');
      [0, 1].forEach((i) => {
        const x = s.w / 2 + (i - 0.5) * 22 * u;
        s.alpha(1 - 0.75 * p, () => {
          s.cell(x - 9 * u, y - 3 * u, 8 * u, 6 * u, `k${sub(i + 1)}`, 'purple', { size: 2.8 });
          s.cell(x + 1 * u, y - 3 * u, 8 * u, 6 * u, `v${sub(i + 1)}`, 'gold', { size: 2.8 });
        });
      });
      mono(s, 'folded into S as they arrive, then let go', s.w / 2, y + 7.5 * u, '--ink-2', 3, 'center', 500);
    });
  },
};

// ---- scene 3: the same thing as a recurrence, run on two tokens and read twice

const rnn: SceneDef = {
  marks: {
    rec: { tex: String.raw`\sym{S}{S}_t = \sym{S}{S}_{t-1} + \sym{v}{v}_t\,\sym{k}{k}_t^\top \qquad \sym{o}{o}_t = \sym{S}{S}_t\,\sym{q}{q}_t`, x: 0.5, y: 0.14, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    s.show('rec', s.ease('rec', 0.6));
    s.alpha(s.win('linear', 't1'), () => mono(s, 'a linear recurrence: decay 1, nothing fades', s.w / 2, Y(s, 0.24), 'teal', 3.1, 'center', 500));
    const cy = Y(s, 0.45);
    const gap = (s.tall ? 30 : 34) * u;
    const at = [-1, 0, 1].map((j) => s.w / 2 + j * gap);
    const states = [ZERO, TABLES[0]!, S];
    const on = [s.ease('t1', 0.6), after(s, 't1', 0.55, 0.5), after(s, 't2', 0.35, 0.5)];
    const recall = s.ease('recall', 0.5);
    states.forEach((M, i) => s.alpha(Math.max(0.15, on[i]!) * s.ease('rec', 0.6, 0.6), () => {
      const g = matrix(s, at[i]!, cy, on[i]! > 0.5 ? M : [['', ''], ['', '']], 'blue', { on: (r, c) => (i === 2 ? Math.max(0.3 * s.ease('q', 0.5), c === 0 ? recall : 0) : 0) });
      mono(s, `S${sub(i)}`, at[i]!, g.t - 3.6 * u, 'blue', 3.1, 'center', 650);
    }));
    [0, 1].forEach((i) => {
      const x = (at[i]! + at[i + 1]!) / 2;
      s.alpha(on[i + 1]!, () => {
        s.arrow(at[i]! + 10.5 * u, cy, at[i + 1]! - 10.5 * u, cy, s.tint('--ink-3', 0.8), 0.35, 1.8);
        mono(s, `k${sub(i + 1)} = ${vtext(KS[i]!)}`, x, cy + 12.5 * u, 'purple', 2.8);
        mono(s, `v${sub(i + 1)} = ${vtext(VS[i]!)}`, x, cy + 17 * u, 'gold', 2.8);
      });
    });
    const y1 = Y(s, 0.78);
    s.alpha(s.ease('q', 0.6) * (1 - recall), () => {
      mono(s, 'S₂ [1, 1] = [3, 7]', s.w / 2, y1, 'green', 3.6, 'center', 650);
      s.alpha(after(s, 'q', 0.5), () => mono(s, 'old sum: 1·[2, 3] + 1·[1, 4] = [3, 7]', s.w / 2, y1 + 6.5 * u, '--ink-2', 3, 'center', 500));
    });
    s.alpha(recall, () => {
      mono(s, 'S₂ [1, 0] = [2, 3] = v₁', s.w / 2, y1, 'green', 3.6, 'center', 650);
      s.alpha(after(s, 'recall', 0.5), () => mono(s, 'a memory from keys to values', s.w / 2, y1 + 6.5 * u, '--ink-2', 3, 'center', 500));
    });
    cite(s, 'Katharopoulos et al., 2020', s.ease('paper', 0.6));
  },
};

// ---- scene 4: the state's size against the cache's, and the work per token

const D = 64;

const size: SceneDef = {
  draw(s) {
    const u = s.u;
    const x0 = s.w / 2 - 40 * u;
    const unit = 24 * u;
    const max = 80 * u;
    const ys = Y(s, 0.18);
    const yc = Y(s, 0.36);
    // Tokens: up to 32 across the cache beat, then out to 4,000.
    const T = Math.round(lerp(lerp(0, 32, after(s, 'cache', 0.2, 1.6)), 4000, smoothLog(after(s, 'cross', 0.35, 1.8))));
    s.alpha(s.ease('state', 0.6), () => {
      mono(s, `state S: ${D} × ${D} = 4,096 numbers`, x0, ys - 5 * u, 'blue', 3.1, 'left');
      s.rrect(x0, ys - 2 * u, unit, 4 * u, 0.8, { fill: s.tint('blue', 0.4), stroke: s.c('blue'), lw: 0.3 });
    });
    s.alpha(s.ease('cache', 0.6), () => {
      const len = (unit * T) / 32;
      const shown = Math.min(len, max);
      mono(s, `cache: 128 × ${T.toLocaleString('en-US')} = ${(128 * T).toLocaleString('en-US')} numbers`, x0, yc - 5 * u, 'purple', 3.1, 'left');
      s.rrect(x0, yc - 2 * u, Math.max(shown, 0.6 * u), 4 * u, 0.8, { fill: s.tint('purple', 0.4), stroke: s.c('purple'), lw: 0.3 });
      if (len > max) s.arrow(x0 + max, yc, x0 + max + 4 * u, yc, s.c('purple'), 0.4, 2);
      s.alpha(after(s, 'cross', 0.1) * (1 - after(s, 'cross', 0.35, 0.4)), () => mono(s, '32 tokens: as big as the state', x0, yc + 6 * u, 'teal', 3, 'left'));
      s.alpha(after(s, 'cross', 0.75), () => mono(s, `${fmt(Math.round((128 * T) / 4096))}× the state, and growing`, x0, yc + 6 * u, 'red', 3.1, 'left', 650));
    });
    const base = Y(s, 0.74);
    const gx = (s.tall ? 24 : 30) * u;
    s.alpha(s.ease('work', 0.6), () => {
      const n = 8;
      mono(s, 'softmax: scores per token', s.w / 2 - gx, base - 22 * u, 'teal', 2.8, 'center', 500);
      stairs(s, s.w / 2 - gx, base, n, (i) => 2.1 * (i + 1), 'teal', (i) => after(s, 'work', 0.05 + 0.06 * i, 0.4));
      mono(s, 'linear: one add, one read', s.w / 2 + gx, base - 22 * u, 'blue', 2.8, 'center', 500);
      stairs(s, s.w / 2 + gx, base, n, () => 4.2, 'blue', (i) => after(s, 'work', 0.3 + 0.04 * i, 0.4));
    });
    const yt = Y(s, 0.87);
    s.alpha(s.win('train', 'fast'), () => mono(s, 'training: every output at once, from matrix products', s.w / 2, yt, '--ink-2', 3, 'center', 500));
    s.alpha(s.ease('fast', 0.6), () => mono(s, 'up to 4,000× faster generation', s.w / 2, yt, 'teal', 3.8, 'center', 700));
    cite(s, 'Katharopoulos et al., 2020', s.ease('fast', 0.6));
  },
};

/** Eases 0 to 1 so that a value lerped from 32 to 4,000 moves evenly in its logarithm. */
function smoothLog(f: number): number {
  const lo = Math.log(32);
  const hi = Math.log(4000);
  return (Math.exp(lo + (hi - lo) * f) - 32) / (4000 - 32);
}

export const scenes: Record<string, SceneDef> = { cache, drop, rnn, size };
