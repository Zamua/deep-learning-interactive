import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { after, bars, cells, cite, columns, downArrows, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { Frame } from '../../networks/draw';
import { vrow } from '../draw';

const soft = (e: number[]) => {
  const x = e.map(Math.exp);
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
};
const f2 = (v: number) => v.toFixed(2);
const sgn = (v: number) => (v < 0 ? `−${-v}` : String(v));
const WORDS = ['cats', 'like', 'fish'];

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.3) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

// ---- all or nothing: fish's soft weights, the same scores four times bigger, and a nudge to each

const E = [2, 0, 1];
const NUDGE = 0.5;

const sharp: SceneDef = {
  draw(s) {
    const u = s.u;
    const gx = s.tall ? 25 : 30;
    const base = s.h * 0.66;
    const split = s.ease('bigger', 0.9);
    // Fish's score goes up by a half on the nudge and comes back down as the next beat ends.
    const d = NUDGE * s.ease('nudge', 0.8, 1) * (1 - s.ease('britz', 0.6));
    const ghost = s.ease('nudge', 0.5, 0.6) * (1 - s.ease('britz', 0.6));
    const groups: { sc: number[]; head: string; a: number; dx: number }[] = [
      { sc: [E[0]!, E[1]!, E[2]! + d], head: 'scores', a: s.ease('recall', 0.6), dx: lerp(0, -gx, split) },
      { sc: [4 * E[0]!, 4 * E[1]!, 4 * E[2]! + d], head: '× 4', a: s.ease('bigger', 0.6, 0.4), dx: gx },
    ];
    const dim = 1 - 0.45 * s.win('britz');
    groups.forEach((g, gi) => {
      const xs = columns(s, 3, 11).map((x) => x + g.dx * u);
      const p = soft(g.sc);
      const p0 = soft(gi === 0 ? E : E.map((v) => 4 * v));
      s.alpha(g.a * dim, () => {
        s.text(g.head, xs[1]!, s.h * 0.15, { size: 3.3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        cells(s, xs, s.h * 0.24, g.sc.map((v) => sgn(Math.round(v * 10) / 10)), 'slate', { w: 9, h: 7, size: 3, on: [0, 0, ghost] });
        bars(s, xs, base, p, 'green', { max: 1, height: 28, w: 7.5, fmt: f2, grow: gi === 0 ? s.ease('recall', 1, 0.4) : s.ease('bigger', 1, 0.8) });
        WORDS.forEach((w, i) => s.text(w, xs[i]!, base + 3.5 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c(i === 2 && ghost > 0.5 ? 'teal' : '--ink-2') }));
        // The fish bar's height before the nudge, dashed, so the shift reads at a glance.
        s.alpha(ghost, () => {
          const y = base - p0[2]! * 28 * u;
          s.line(xs[2]! - 5 * u, y, xs[2]! + 5 * u, y, s.c('--ink-2'), 0.35, [0.8, 0.8]);
          const moved = p[2]! - p0[2]!;
          s.text(`+${f2(moved)}`, xs[2]! + 5 * u, base - p[2]! * 28 * u - 3.4 * u, { size: 3, font: 'mono', weight: 700, align: 'left', color: s.c(gi === 0 ? 'teal' : 'red'), halo: true });
        });
      });
    });
    s.alpha(split, () => s.text('→', s.w / 2, s.h * 0.24, { size: 4, font: 'mono', color: s.c('--ink-3') }));

    // Two entries here, against sixty four in a real model.
    s.alpha(s.win('long', 'bigger'), () => {
      const x = s.w / 2 + 1 * u;
      const lab = { size: 3.1, font: 'mono' as const, weight: 600, align: 'right' as const, color: s.c('--ink-2') };
      s.text('here: 2', x - 2 * u, s.h * 0.8, lab);
      [0, 1].forEach((i) => s.cell(x + i * 4 * u, s.h * 0.8 - 1.6 * u, 3.2 * u, 3.2 * u, '', 'teal'));
      s.text('Vaswani: 64', x - 2 * u, s.h * 0.88, lab);
      s.alpha(after(s, 'long', 0.2), () => {
        for (let i = 0; i < 64; i++) s.rrect(x + i * 0.62 * u, s.h * 0.88 - 1.6 * u, 0.45 * u, 3.2 * u, 0.15, { fill: s.tint('teal', 0.55) });
      });
    });
    const cy = s.h * 0.86;
    s.alpha(s.win('recall', 'long') * after(s, 'recall', 0.5), () => caption(s, 'soft: mostly cats, some of the rest', cy));
    s.alpha(s.win('bigger', 'nudge') * after(s, 'bigger', 0.4), () => caption(s, 'gaps × 4: all or nothing', cy));
    s.alpha(s.win('nudge', 'flat') * after(s, 'nudge', 0.4), () => caption(s, 'fish + 0.5: soft moves, sharp barely', cy));
    s.alpha(s.win('flat', 'britz'), () => {
      caption(s, 'barely moves: almost no gradient', cy - 2.8 * u, 'red');
      s.alpha(after(s, 'flat', 0.6), () => caption(s, 'saturated, like a sigmoid far from 0', cy + 2.8 * u));
    });
    s.alpha(s.win('britz', 'vaswani'), () => caption(s, 'length 512: fine · 1,024: much worse', cy));
    s.alpha(s.ease('vaswani', 0.6), () => {
      const q = { size: 3.3, italic: true, halo: true, color: s.c('--ink-2') };
      s.text('“pushing the softmax function into regions', s.w / 2, cy - 2.7 * u, q);
      s.text('where it has extremely small gradients”', s.w / 2, cy + 2.7 * u, q);
    });
    cite(s, 'Britz, Goldie, Luong & Le, 2017', s.win('britz', 'vaswani'));
    cite(s, 'Vaswani et al., 2017 · Attention Is All You Need', s.ease('vaswani', 0.6));
  },
};

// ---- why: coin-flip products, their running total as a walk, and how far it wanders

const QC = [1, -1, -1, 1];
const KC = [1, 1, -1, 1];
const COINS = QC.map((v, i) => v * KC[i]!);
const STEPS = 64;
/** Seeded walks of 64 coin flips; the first starts with the four flips on screen. */
const WALKS: number[][] = (() => {
  const r = new Rng(7);
  return Array.from({ length: 48 }, (_, w) => {
    const path = [0];
    for (let i = 0; i < STEPS; i++) path.push(path[i]! + (w === 0 && i < 4 ? COINS[i]! : r.next() < 0.5 ? -1 : 1));
    return path;
  });
})();
const SUMS = [-4, -2, 0, 2, 4];
const WAYS = [1, 4, 6, 4, 1];

function walkFrame(s: Scene): Frame {
  return new Frame(s, 12 * s.u, s.h * 0.1, s.w - 6 * s.u, s.h * 0.8, [0, STEPS], [-24, 24]);
}

/** The walks drawn up to `upto` steps, the first one in teal. */
function walks(s: Scene, F: Frame, upto: number) {
  const g = s.ctx;
  F.clip(() => {
    WALKS.forEach((p, w) => {
      g.beginPath();
      const n = Math.floor(upto);
      for (let i = 0; i <= n; i++) (i ? g.lineTo(F.X(i), F.Y(p[i]!)) : g.moveTo(F.X(i), F.Y(p[i]!)));
      if (upto > n && n < STEPS) g.lineTo(F.X(upto), F.Y(lerp(p[n]!, p[n + 1]!, upto - n)));
      g.strokeStyle = w === 0 ? s.c('teal') : s.tint('slate', 0.32);
      g.lineWidth = (w === 0 ? 0.55 : 0.25) * s.u;
      g.lineJoin = 'round';
      g.stroke();
    });
  });
}

const why: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    // The coins: q, k and their products, then the products' running total.
    const coins = 1 - s.ease('walk', 0.6);
    s.alpha(coins, () => {
      const xs = columns(s, 4, 10);
      const rows: [string, number[], Ink, number][] = [
        ['q', QC, 'teal', s.h * 0.2],
        ['k', KC, 'purple', s.h * 0.31],
      ];
      rows.forEach(([name, vals, k, y], r) => s.alpha(s.ease('coin', 0.5, 1 + 0.4 * r), () => {
        rowLabel(s, name, xs[0]! - 7 * u, y, k, 3.4);
        cells(s, xs, y, vals.map((v) => (v > 0 ? '+1' : '−1')), k, { w: 8, h: 7, size: 3 });
      }));
      s.alpha(s.ease('coin', 0.5, 3.5), () => {
        rowLabel(s, 'q·k', xs[0]! - 7 * u, s.h * 0.46, '--ink-2', 3.4);
        COINS.forEach((v, i) => s.cell(xs[i]! - 4 * u, s.h * 0.46 - 3.5 * u, 8 * u, 7 * u, v > 0 ? '+1' : '−1', v > 0 ? 'green' : 'red', { size: 3 }));
        s.text('each product: a coin flip', cx, s.h * 0.6, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        rich(s, [['q · k = 1 − 1 + 1 + 1 = ', '--ink-2'], ['2', '--ink']], cx, s.h * 0.7, { size: 3.4, weight: 600 });
      });
    });

    // The walks: drawn on the walk beat, hidden while the four flips are counted, back for the root.
    const F = walkFrame(s);
    const plot = s.ease('walk', 0.6, 0.3) * (1 - s.ease('count', 0.6)) + s.ease('grow', 0.6);
    s.alpha(plot, () => {
      F.axes();
      s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
      for (const y of [-16, -8, 0, 8, 16]) s.text(sgn(y), F.l - 1.6 * u, F.Y(y), { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('steps →', F.r - 1.5 * u, F.b + 3.4 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('running total', F.l + 2 * u, F.t + 3.2 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
      walks(s, F, s.since('count') < 0 ? STEPS * s.ease('walk', 4, 0.6) : STEPS);
      // The most a walk could reach: every flip the same way.
      s.alpha(s.ease('cancel', 0.6, 1) * (1 - s.ease('grow', 0.4)), () => {
        F.clip(() => {
          F.seg(0, 0, 30, 30, 'red', 0.4, [1.2, 1]);
          F.seg(0, 0, 30, -30, 'red', 0.4, [1.2, 1]);
        });
        s.text('all flips alike: ±64', F.X(25), F.Y(22), { size: 2.9, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true });
      });
      // A typical distance from zero: the square root of the number of steps.
      const env = s.ease('grow', 1.2, 0.6);
      F.fn((n) => Math.sqrt(Math.max(0, n)), 'gold', 0.8, 0, STEPS * env);
      F.fn((n) => -Math.sqrt(Math.max(0, n)), 'gold', 0.8, 0, STEPS * env);
      [4, 16, 64].forEach((n, i) => s.alpha(after(s, 'grow', 0.25 + 0.15 * i), () => {
        F.dot(n, Math.sqrt(n), 'gold', 1.2);
        s.text(String(Math.sqrt(n)), F.X(n) - (n === 64 ? 2.2 : 0) * u, F.Y(Math.sqrt(n)) - 3.4 * u, { size: 3.2, font: 'mono', weight: 700, align: n === 64 ? 'right' : 'center', color: s.c('gold'), halo: true });
      }));
    });

    // Four flips, counted exactly.
    const hist = s.ease('count', 0.6, 0.3) * (1 - s.ease('grow', 0.5));
    s.alpha(hist, () => {
      const xs = columns(s, 5, s.tall ? 15 : 16);
      const base = s.h * 0.5;
      s.text('4 flips: 16 ways to land', cx, s.h * 0.12, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
      bars(s, xs, base, WAYS, 'slate', { max: 6, height: 24, w: 9, fmt: (v) => `${v}×`, grow: s.ease('count', 1.6, 1) });
      rowLabel(s, 'sum', xs[0]! - 8 * u, base + 4 * u, '--ink-2', 3.2);
      SUMS.forEach((v, i) => s.text(sgn(v), xs[i]!, base + 4 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink') }));
      s.alpha(s.ease('square', 0.6), () => {
        rowLabel(s, 'sum²', xs[0]! - 8 * u, base + 10.5 * u, 'gold', 3.2);
        SUMS.forEach((v, i) => s.text(String(v * v), xs[i]!, base + 10.5 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') }));
      });
      const o = { size: s.tall ? 3.1 : 3.4, weight: 600 };
      s.alpha(after(s, 'square', 0.45), () => rich(s, [['average square: 64 / 16 = ', '--ink-2'], ['4', 'gold'], [' = dₖ', '--ink-3']], cx, s.h * 0.77, o));
      s.alpha(s.ease('typical', 0.6, 0.4), () => rich(s, [['typical size: √4 = ', '--ink-2'], ['2', '--ink']], cx, s.h * 0.86, o));
    });

    const cy = s.h * 0.9;
    s.alpha(s.win('walk', 'cancel') * after(s, 'walk', 0.5), () => s.text('48 walks of 64 flips', cx, cy, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.win('cancel', 'count') * after(s, 'cancel', 0.4), () => s.text('they mostly cancel, but not exactly', cx, cy, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('grow', 0.6, 1.5), () => rich(s, [['typical |q · k| ≈ ', '--ink-2'], ['√dₖ', 'gold'], [':  16× the flips, 4× the size', '--ink-3']], cx, cy, { size: s.tall ? 3 : 3.2, weight: 600 }));
    cite(s, 'Vaswani et al., 2017 · footnote 4', s.ease('footnote', 0.6));
  },
};

// ---- the fix: divide by the square root of d_k, then the worked numbers

const DKS = [4, 16, 64, 256];
const Q = [2, 1, 0, 1];
const K = [1, 0, 1, 2];
const DOTS = [4, 0, 2];
const SC = DOTS.map((v) => v / 2);
const A = soft(SC);

const scale: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\sym{q}{q} \cdot \sym{k}{k}}{\sqrt{\sym{dk}{d_k}}}`, x: 0.5, y: 0.12, size: 6 },
  },
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    // Typical sizes at four lengths: unscaled, then over the root, over d_k itself, and back.
    const fix = s.ease('fix', 1.2, 0.8);
    const toDk = s.ease('root', 1.2, 2.5) * (1 - s.ease('name', 0.8));
    const sizes = 1 - s.ease('name', 0.6);
    s.alpha(sizes, () => {
      const xs = columns(s, 4, 22);
      const base = s.h * 0.78;
      const typ = DKS.map((d) => lerp(lerp(Math.sqrt(d), 1, fix), Math.sqrt(d) / d, toDk));
      const k: Ink = toDk > 0.5 ? 'red' : fix > 0.5 ? 'green' : 'slate';
      // The unscaled sizes stay behind, faint, once the fix has shrunk them.
      s.alpha(0.3 * fix, () => bars(s, xs, base, DKS.map(Math.sqrt), 'slate', { max: 16, height: 40, w: 9 }));
      const label = (v: number) => (toDk > 0.98 ? (Math.round(v * 100) / 100).toFixed(2) : fix > 0.98 && toDk < 0.02 ? '≈ 1' : String(Math.round(v)));
      bars(s, xs, base, typ, k, { max: 16, height: 40, w: 9, fmt: label });
      DKS.forEach((d, i) => s.text(`dₖ = ${d}`, xs[i]!, base + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      const head = toDk > 0.5 ? 'q · k / dₖ: shrinks toward 0' : fix > 0.5 ? 'typical |q · k| / √dₖ ≈ 1' : 'typical |q · k| ≈ √dₖ';
      s.text(head, cx, s.h * 0.14, { size: 3.4, font: 'mono', weight: 600, color: s.c(k === 'slate' ? '--ink-2' : k) });
      s.alpha(after(s, 'root', 0.6), () => s.text('weights → equal shares', cx, s.h * 0.92, { size: 3.2, font: 'mono', color: s.c('red'), halo: true }));
    });

    // The formula and its name, then one query and one key worked through.
    s.show('f', s.ease('name', 0.6, 0.4));
    s.alpha(s.win('name', 'dot') * s.ease('name', 0.6, 0.6), () => {
      s.text('scaled dot-product attention', cx, s.h * 0.44, { size: s.tall ? 4.6 : 5, font: 'display', weight: 600, color: s.c('--ink') });
      s.alpha(after(s, 'name', 0.5), () => rich(s, [['a dot product, ', '--ink-2'], ['q · k', 'teal'], [', scaled by ', '--ink-2'], ['1/√dₖ', 'slate']], cx, s.h * 0.56, { size: s.tall ? 3.1 : 3.4 }));
    });
    const row = s.ease('row', 0.6);
    s.alpha(s.ease('dot', 0.6) * (1 - row), () => {
      rowLabel(s, 'q', cx - 20 * u, s.h * 0.3, 'teal', 4);
      vrow(s, cx, s.h * 0.3, Q.map(String), 'teal', { on: Q.map(() => s.win('dot', 'divide')) });
      rowLabel(s, 'k', cx - 20 * u, s.h * 0.4, 'purple', 4);
      vrow(s, cx, s.h * 0.4, K.map(String), 'purple', { on: K.map(() => s.win('dot', 'divide')) });
      s.text('dₖ = 4', cx + 22 * u, s.h * 0.35, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.alpha(after(s, 'dot', 0.45), () => rich(s, [['q · k = 2 + 0 + 0 + 2 = ', '--ink-2'], ['4', '--ink']], cx, s.h * 0.55, { size: 3.6 }));
      s.alpha(after(s, 'divide', 0.35), () => rich(s, [['√4 = 2   →   4 / 2 = ', '--ink-2'], ['2', 'slate']], cx, s.h * 0.66, { size: 3.6, weight: 600 }));
    });
    const xs = columns(s, 3, 26);
    s.alpha(row, () => {
      rowLabel(s, 'q·k', xs[0]! - 10 * u, s.h * 0.3, '--ink-2', 3.6);
      cells(s, xs, s.h * 0.3, DOTS.map(String), '--ink-3', { w: 11, h: 8 });
      s.alpha(s.ease('row', 0.6, 1.2), () => {
        downArrows(s, xs, s.h * 0.3 + 5 * u, s.h * 0.45 - 5 * u);
        xs.forEach((x) => s.text('÷ 2', x + 3 * u, s.h * 0.375, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true }));
        rowLabel(s, 'score', xs[0]! - 10 * u, s.h * 0.45, 'slate', 3.6);
        cells(s, xs, s.h * 0.45, SC.map(String), 'slate', { w: 11, h: 8, on: SC.map(() => s.win('row', 'soft')) });
      });
    });
    s.alpha(s.ease('soft', 0.6), () => {
      const base = s.h * 0.88;
      bars(s, xs, base, A, 'green', { max: 1, height: 22, w: 9, fmt: f2, grow: s.ease('soft', 1, 0.3) });
      xs.forEach((x, i) => s.text(`key ${i}`, x, base + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { sharp, why, scale };
