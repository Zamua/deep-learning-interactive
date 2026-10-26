import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';

type Ink = Parameters<typeof rowLabel>[4];

/** Typographic minus and fixed places. */
const fmt = (v: number, places = 2) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(places).replace('-', '−'));

function stats(r: number[]): { mean: number; sd: number; adv: number[] } {
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
  return { mean, sd, adv: r.map((x) => (sd > 0 ? (x - mean) / sd : 0)) };
}

const ANS = ['63', '63', '54', '63'];
const R4 = [1, 1, 0, 1];

/** A row of answer chips with a check or a cross under each, and their rewards. */
function answers(s: Scene, xs: number[], y: number, ans: string[], r: number[], o: { checked: number; reward: number; hi?: number[]; w?: number }): void {
  const u = s.u;
  const w = o.w ?? 11;
  xs.forEach((x, i) => s.cell(x - (w / 2) * u, y - 3.6 * u, w * u, 7.2 * u, ans[i]!, 'orange', { size: 3.4, on: o.hi?.[i] ?? 0 }));
  s.alpha(o.checked, () =>
    xs.forEach((x, i) => {
      const ok = r[i] === 1;
      s.text(ok ? '✓' : '✗', x, y + 8 * u, { size: 4.2, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
    }),
  );
  s.alpha(o.reward, () => {
    rowLabel(s, 'r', xs[0]! - (w / 2 + 3) * u, y + 16.5 * u, 'gold', 3.8);
    cells(s, xs, y + 16.5 * u, r.map(String), 'gold', { w: 9, h: 6.5, size: 3.2, on: o.hi });
  });
}

const check: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 15 : 16);
    const y = s.h * 0.22;
    s.text('9 × 7 = ?', s.w / 2, s.h * 0.08, { size: 4.2, font: 'mono', weight: 650, color: s.c('--ink') });
    answers(s, xs, y, ANS, R4, { checked: s.ease('check', 0.6, 1.2), reward: s.ease('check', 0.6, 2.4) });
    s.alpha(s.ease('check', 0.6), () => s.text('checker: final answer == 63 ?', s.w / 2, y + 25 * u, { size: 3.1, font: 'mono', color: s.c('--ink-3'), halo: true }));
    const judge = s.ease('judge', 0.8);
    const lo = (t: string, yy: number, k: Ink, a: number) => s.alpha(a * (1 - judge), () => s.text(t, s.w / 2, yy, { size: 3.1, font: 'mono', weight: 600, color: s.c(k), halo: true }));
    lo('code: run the tests → r = 1 if all pass', s.h * 0.66, 'blue', s.ease('code', 0.6));
    lo('<think> steps </think> answer: + a small bonus', s.h * 0.78, 'purple', s.ease('format', 0.6));
    s.alpha(judge, () => {
      const bx = [s.w / 2 - (s.tall ? 25 : 30) * u, s.w / 2 + (s.tall ? 25 : 30) * u];
      const bw = s.tall ? 46 : 52;
      const by = s.h * 0.74;
      const box = (x: number, k: Ink, title: string, sub: string) => {
        s.rrect(x - (bw / 2) * u, by - 9 * u, bw * u, 18 * u, 1.6, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.8), lw: 0.35 });
        s.text(title, x, by - 3.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c(k) });
        s.text(sub, x, by + 3 * u, { size: 2.7, font: 'mono', color: s.c('--ink-2') });
      };
      box(bx[0]!, 'red', 'learned judge', 'a network: can be fooled');
      box(bx[1]!, 'green', 'checker', 'only right earns 1');
    });
  },
};

const group: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 15 : 16);
    const st = stats(R4);
    answers(s, xs, s.h * 0.09, ANS, R4, { checked: 1, reward: 1 });
    const y = s.h * 0.4;
    s.alpha(s.ease('mean', 0.6, 0.6), () => rich(s, [['mean = 3 / 4 = ', '--ink-2'], ['0.75', 'gold'], ['  (pass rate)', '--ink-3']], s.w / 2, y, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('std', 0.6), () => rich(s, [['std ≈ ', '--ink-2'], ['0.433', 'gold']], s.w / 2, y + 6 * u, { size: 3.3, weight: 600 }));
    // Advantages as bars from a zero line.
    const zy = s.h * 0.66;
    const k = 7 * u;
    const ra = s.ease('right', 0.8);
    const wa = s.ease('wrong', 0.8);
    s.alpha(ra, () => {
      s.line(xs[0]! - 7 * u, zy, xs[3]! + 7 * u, zy, s.c('--axis'), 0.35);
      s.text('A', xs[0]! - 9 * u, zy, { size: 3.8, font: 'mono', weight: 650, color: s.c('green') });
    });
    xs.forEach((x, i) => {
      const a = st.adv[i]!;
      const g = a > 0 ? ra : wa;
      s.alpha(g, () => {
        const hh = Math.abs(a) * k * g;
        const kk: Ink = a > 0 ? 'green' : 'red';
        s.rrect(x - 4 * u, a > 0 ? zy - hh : zy, 8 * u, Math.max(hh, 0.4 * u), 0.6, { fill: s.tint(kk, 0.4), stroke: s.tint(kk, 0.9), lw: 0.25 });
        s.text(fmt(a), x, a > 0 ? zy - hh - 2.8 * u : zy + hh + 2.8 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c(kk), halo: true });
      });
    });
    const cy = s.h * 0.92;
    s.alpha(ra * (1 - wa), () => rich(s, [['right: (1 − 0.75) / 0.433 ≈ ', '--ink-2'], ['0.58', 'green']], s.w / 2, cy, { size: 3.1, weight: 600 }));
    s.alpha(wa, () => rich(s, [['wrong: (0 − 0.75) / 0.433 ≈ ', '--ink-2'], ['−1.73', 'red']], s.w / 2, cy, { size: 3.1, weight: 600 }));
  },
};

/** Answer length over training: rising, with a little noise. */
const LEN = Array.from({ length: 60 }, (_, i) => 0.12 + 0.75 * (i / 59) ** 1.15 + 0.035 * Math.sin(i * 1.7) * Math.cos(i * 0.6));

const edge: SceneDef = {
  draw(s) {
    const u = s.u;
    const lg = s.ease('long', 0.8);
    const rows: { r: number[]; label: string; note: string; k: Ink }[] = [
      { r: [1, 1, 1, 1], label: '4 of 4', note: 'every A = 0', k: '--ink-3' },
      { r: [0, 0, 0, 0], label: '0 of 4', note: 'every A = 0', k: '--ink-3' },
      { r: R4, label: '3 of 4', note: 'A = 0.58, 0.58, −1.73, 0.58', k: 'green' },
    ];
    const cw = 7;
    const x0 = s.w / 2 - (s.tall ? 30 : 36) * u;
    rows.forEach((row, j) => {
      const y = s.h * (0.12 + j * 0.15);
      const a = j < 2 ? (j === 0 ? 1 : s.ease('all', 0.6, 3.5)) : s.ease('edge', 0.6);
      s.alpha(a * (1 - 0.6 * lg), () => {
        s.text(row.label, x0 - 3 * u, y, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
        row.r.forEach((v, i) => s.cell(x0 + i * (cw + 1) * u, y - 3.2 * u, cw * u, 6.4 * u, v ? '✓' : '✗', v ? 'green' : 'red', { size: 3.2, on: j === 2 ? s.win('edge', 'long') : 0 }));
        s.text(row.note, x0 + 4 * (cw + 1) * u + 2 * u, y, { size: 2.9, font: 'mono', weight: 600, align: 'left', color: s.c(row.k), halo: true });
      });
    });
    s.alpha(s.win('all', 'edge'), () => s.text('no signal: these prompts teach nothing', s.w / 2, s.h * 0.5, { size: 3, color: s.c('--ink-2') }));
    s.alpha(s.ease('edge', 0.6, 0.6) * (1 - lg), () => s.text('the edge: solved some of the time', s.w / 2, s.h * 0.5, { size: 3.2, color: s.c('green') }));
    // Answers grow longer over training.
    s.alpha(lg, () => {
      const l = s.w / 2 - (s.tall ? 38 : 44) * u;
      const r = s.w / 2 + (s.tall ? 38 : 44) * u;
      const t = s.h * 0.58;
      const b = s.h * 0.88;
      s.line(l, b, r, b, s.c('--axis'), 0.35);
      s.line(l, t, l, b, s.c('--axis'), 0.35);
      const upto = Math.floor(LEN.length * clamp01(s.prog('long') * 1.4));
      const c = s.ctx;
      c.beginPath();
      for (let i = 0; i < upto; i++) {
        const x = l + ((r - l) * i) / (LEN.length - 1);
        const yy = b - (b - t) * LEN[i]!;
        if (i) c.lineTo(x, yy);
        else c.moveTo(x, yy);
      }
      c.strokeStyle = s.c('orange');
      c.lineWidth = 0.6 * u;
      c.lineJoin = 'round';
      c.stroke();
      s.text('training steps →', r, b + 4 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('answer length', l + 2 * u, t - 2 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('orange') });
    });
  },
};

const TRY = ['42', '42', '32', '42', '42'];
const TR = [1, 1, 0, 1, 1];

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 5, s.tall ? 14 : 15);
    const k = 2;
    s.alpha(s.ease('p1', 0.6, 0.2), () => {
      rich(s, [['17 + 25', '--ink'], ['   G = 5', '--ink-2'], ['   std = 0.4', 'gold']], s.w / 2, s.h * 0.07, { size: 3.4, weight: 650 });
      xs.forEach((x, i) => s.text(String(i), x, s.h * 0.14, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(s.ease('p1', 0.6, 0.8), () =>
      answers(s, xs, s.h * 0.21, TRY, TR, { checked: s.ease('r', 0.6), reward: s.ease('r', 0.6, 0.6), hi: TR.map((_, i) => (i === k ? s.win('a1', 'count') : 0)), w: 10 }),
    );
    const y = s.h * 0.6;
    s.alpha(s.ease('mean', 0.6, 0.3) * (1 - s.ease('count', 0.6)), () => rich(s, [['mean = 4 / 5 = ', '--ink-2'], ['0.8', 'gold']], s.w / 2, y, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('a1', 0.6, 0.3) * (1 - s.ease('count', 0.6)), () => rich(s, [['answer 2: 0 − 0.8 = ', '--ink-2'], ['−0.8', 'red']], s.w / 2, y + 9 * u, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('a1', 0.6, 2.4) * (1 - s.ease('count', 0.6)), () => rich(s, [['−0.8 / 0.4 = ', '--ink-2'], ['−2', 'red']], s.w / 2, y + 18 * u, { size: 4, weight: 700 }));
    s.alpha(s.ease('count', 0.6, 0.3), () => {
      rich(s, [['8 answers, mean reward ', '--ink-2'], ['0.625', 'gold']], s.w / 2, y, { size: 3.6, weight: 600 });
      rich(s, [['0.625 × 8 = ', '--ink-2'], ['5 passed', 'green']], s.w / 2, y + 10 * u, { size: 4, weight: 700 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { check, group, edge, try: tryIt };
