import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, columns, verdict } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { fmt } from '../../training/draw';

function stats(r: number[]): { mean: number; sd: number; adv: number[] } {
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
  return { mean, sd, adv: r.map((x) => (sd > 0 ? (x - mean) / sd : 0)) };
}

/** Fades in just after beat `a` starts and out as beat `b` starts, so texts that share a place never overlap. */
const seq = (s: Scene, a: string, b?: string) => s.ease(a, 0.4, 0.45) * (b ? 1 - s.ease(b, 0.4) : 1);

/** A caption centered on the stage. */
const cap = (s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.2) => s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });

/** Eight columns, a little tighter on a phone. */
const cols8 = (s: Scene) => columns(s, 8, s.tall ? 10.5 : 12);

// ---- two questions: one baseline cannot serve both

const EASY_ANS = ['56', '56', '56', '54', '56', '56', '56', '56'];
const HARD_ANS = ['418', '398', '408', '428', '418', '308', '398', '418'];
const EASY = EASY_ANS.map((a) => (a === '56' ? 1 : 0));
const HARD = HARD_ANS.map((a) => (a === '408' ? 1 : 0));

/** One question's eight answers: chips that turn green or red once checked, and their rewards. */
function answerRow(s: Scene, xs: number[], y: number, ans: string[], r: number[], o: { check: number; on: number[]; rOn: number }) {
  const w = (s.tall ? 9.4 : 10) * s.u;
  const h = 7 * s.u;
  xs.forEach((x, i) => {
    s.alpha(1 - o.check, () => s.cell(x - w / 2, y - h / 2, w, h, ans[i]!, 'orange', { size: 3 }));
    s.alpha(o.check, () => s.cell(x - w / 2, y - h / 2, w, h, ans[i]!, r[i] ? 'green' : 'red', { size: 3, on: o.on[i] }));
  });
  s.alpha(o.check, () => cells(s, xs, y + 8.6 * s.u, r.map(String), 'gold', { w: 7.5, h: 6, size: 3, on: r.map(() => o.rOn) }));
}

const expect: SceneDef = {
  draw(s) {
    const xs = cols8(s);
    const check = after(s, 'two', 0.45, 0.6);
    
    const rows: { q: string; ans: string[]; r: number[]; y: number; count: string; mean: string }[] = [
      { q: '7 × 8', ans: EASY_ANS, r: EASY, y: s.h * 0.13, count: '7 of 8 right', mean: 'mean 7/8 = 0.875' },
      { q: '17 × 24', ans: HARD_ANS, r: HARD, y: s.h * 0.38, count: '1 of 8 right', mean: 'mean 1/8 = 0.125' },
    ];
    const worth = seq(s, 'worth', 'same');
    rows.forEach((row, j) => {
      const o = { size: 3.3, weight: 600 };
      s.alpha(1 - s.ease('news', 0.4), () => rich(s, [[row.q, '--ink'], [' = ?', '--ink-3']], s.w / 2, row.y, o));
      s.alpha(seq(s, 'news', 'group'), () => rich(s, [[row.q, '--ink'], ['   ', '--ink'], [row.count, j ? 'red' : 'green']], s.w / 2, row.y, o));
      s.alpha(seq(s, 'group'), () => rich(s, [[row.q, '--ink'], ['   ', '--ink'], [row.mean, 'gold']], s.w / 2, row.y, o));
      const on = row.r.map((v) => (v ? (j ? worth : 0.5 * worth) : 0));
      answerRow(s, xs, row.y + 7.5 * s.u, row.ans, row.r, { check, on, rOn: s.win('group', 'name') });
    });
    const y1 = s.h * 0.7;
    const y2 = s.h * 0.78;
    s.alpha(worth, () => {
      cap(s, '17 × 24, right: news, a big push', y1, 'green');
      cap(s, '7 × 8, right: expected, a small push', y2);
    });
    s.alpha(seq(s, 'same', 'value'), () => {
      const t = 'one baseline for both: the same push';
      const w = s.measure(t, { size: 3.2 }) + 4.5 * s.u;
      verdict(s, false, t, s.w / 2 - w / 2, y1, 3.2);
      cap(s, 'each question needs its own', y2);
    });
    // The road not taken: a second network that predicts each question's expected reward.
    s.alpha(seq(s, 'value', 'group'), () => {
      const bw = Math.min(s.w - 12 * s.u, 74 * s.u);
      const top = s.h * 0.64;
      const bh = s.h * 0.3;
      s.rrect(s.w / 2 - bw / 2, top, bw, bh, 2, { fill: s.tint('slate', 0.1), stroke: s.tint('slate', 0.6), lw: 0.3 });
      s.text('value model', s.w / 2, top + bh * 0.2, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
      s.text('question → its expected reward', s.w / 2, top + bh * 0.45, { size: 3, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('cost', 0.6, 0.8), () => s.text('a 2nd network, about as big as the model', s.w / 2, top + bh * 0.72, { size: 2.9, font: 'mono', color: s.c('red') }));
    });
    s.alpha(seq(s, 'group', 'name'), () => {
      cap(s, 'baseline: the mean of the', y1, 'gold');
      cap(s, "question's own group of answers", y2, 'gold');
    });
    // The name, letter by letter.
    s.alpha(seq(s, 'name'), () => {
      s.text('GRPO', s.w / 2, s.h * 0.67, { size: 5.2, font: 'mono', weight: 700, color: s.c('--ink') });
      const o = { size: s.tall ? 3.2 : 3.4, weight: 600 };
      rich(s, [['G', 'gold'], ['roup ', '--ink-2'], ['R', 'gold'], ['elative ', '--ink-2'], ['P', 'teal'], ['olicy ', '--ink-2'], ['O', 'teal'], ['ptimization', '--ink-2']], s.w / 2, s.h * 0.76, o);
      s.alpha(after(s, 'name', 0.45), () => {
        cap(s, 'policy: the model\'s rule for answering', s.h * 0.84, 'teal', 2.9);
        cap(s, 'each answer judged against its group', s.h * 0.9, 'gold', 2.9);
      });
    });
    cite(s, 'DeepSeekMath · Shao et al., 2024', s.ease('cost', 0.6));
  },
};

// ---- one group: the mean as a level line, the spread as a band, advantages as bars

/** Reward values the strip plot covers, wide enough for any group's band. */
const V: [number, number] = [-0.3, 1.25];

interface View {
  r: number[];
  mean: number;
  sd: number;
  adv: number[];
  /** Opacities: rewards, mean line, distance arrows, band, right bars, wrong bars. */
  dots: number;
  line: number;
  dist: number;
  band: number;
  up: number;
  down: number;
  /** Stage units per unit of advantage. */
  k: number;
}

/** Checks, a strip plot of the rewards with the mean and the band, and the advantages as bars. */
function group(s: Scene, v: View): void {
  const u = s.u;
  const xs = cols8(s);
  const l = xs[0]! - 5 * u;
  const r = xs[7]! + 5 * u;
  const top = s.h * 0.21;
  const bot = s.h * 0.49;
  const Y = (x: number) => top + ((V[1] - x) / (V[1] - V[0])) * (bot - top);
  const ok = v.r.map((x) => x >= 0.5);
  const cw = (s.tall ? 9 : 10) * u;
  xs.forEach((x, i) => s.cell(x - cw / 2, s.h * 0.11 - 3.5 * u, cw, 7 * u, ok[i] ? '✓' : '✗', ok[i] ? 'green' : 'red', { size: 3.6 }));
  // The two reward levels, labelled at the left.
  s.alpha(v.dots, () => {
    for (const lv of [0, 1]) {
      s.line(l, Y(lv), r, Y(lv), s.c('--axis'), 0.25, [0.8, 0.8]);
      s.text(String(lv), l - 1.5 * u, Y(lv), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    }
  });
  s.alpha(v.band, () => {
    const a = Y(v.mean + v.sd);
    const b = Y(v.mean - v.sd);
    s.rrect(l, a, r - l, Math.max(b - a, 0.2 * u), 0.6, { fill: s.tint('gold', 0.16) });
    s.line(l, a, r, a, s.tint('gold', 0.7), 0.25, [1, 0.8]);
    s.line(l, b, r, b, s.tint('gold', 0.7), 0.25, [1, 0.8]);
  });
  s.alpha(v.line, () => s.line(l, Y(v.mean), lerp(l, r, Math.min(1, v.line * 1.5)), Y(v.mean), s.c('gold'), 0.55));
  s.alpha(v.dist, () =>
    xs.forEach((x, i) => {
      if (Math.abs(v.r[i]! - v.mean) < 0.03) return;
      s.arrow(x, Y(v.mean), x, lerp(Y(v.mean), Y(v.r[i]!), v.dist), s.c(ok[i] ? 'green' : 'red'), 0.4, 1.8);
    }),
  );
  s.alpha(v.dots, () => xs.forEach((x, i) => s.circle(x, Y(v.r[i]!), 1.3 * u, { fill: s.c(ok[i] ? 'green' : 'red') })));
  // Advantages as bars from a zero line.
  const zy = s.h * 0.8;
  const bars = Math.max(v.up, v.down);
  s.alpha(bars, () => {
    s.line(l, zy, r, zy, s.c('--axis'), 0.35);
    s.text('A', l - 1.5 * u, zy, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
  });
  xs.forEach((x, i) => {
    const a = v.adv[i]!;
    const g = a >= 0 ? v.up : v.down;
    s.alpha(g, () => {
      const hh = Math.abs(a) * v.k * u * g;
      const kk: Ink = a > 0 ? 'green' : 'red';
      if (hh > 0.2 * u) s.rrect(x - 3.5 * u, a > 0 ? zy - hh : zy, 7 * u, hh, 0.6, { fill: s.tint(kk, 0.4), stroke: s.tint(kk, 0.9), lw: 0.25 });
      const flat = Math.abs(a) < 1e-9;
      s.text(flat ? '0' : fmt(a), x, flat ? zy - 2.6 * u : a > 0 ? zy - hh - 2.6 * u : zy + hh + 2.6 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c(flat ? '--ink-3' : kk), halo: true });
    });
  });
}

const MAIN = [1, 0, 0, 1, 0, 0, 1, 0];
const M = stats(MAIN);

const curve: SceneDef = {
  draw(s) {
    group(s, {
      ...M,
      r: MAIN,
      dots: s.ease('r', 0.6, 0.8),
      line: s.ease('mean', 0.8, 0.6),
      dist: s.ease('right', 0.8, 1) * (1 - 0.7 * s.ease('std', 0.6)),
      band: s.ease('std', 0.8, 0.6),
      up: s.ease('dright', 0.8, 0.4),
      down: s.ease('dwrong', 0.8, 0.4),
      k: 7,
    });
    const y1 = s.h * 0.555;
    const y2 = s.h * 0.615;
    const o = { size: 3.2, weight: 600 };
    s.alpha(seq(s, 'mean', 'A'), () => rich(s, [['mean = 3 / 8 = ', '--ink-2'], ['0.375', 'gold']], s.w / 2, y1, o));
    s.alpha(seq(s, 'A'), () => rich(s, [['A', 'green'], [' = (', '--ink-2'], ['r', 'gold'], [' − mean) / std', '--ink-2']], s.w / 2, y1, o));
    s.alpha(seq(s, 'right', 'spread'), () => rich(s, [['right ', '--ink-2'], ['+0.625', 'green'], ['   wrong ', '--ink-2'], ['−0.375', 'red']], s.w / 2, y2, o));
    s.alpha(seq(s, 'spread', 'std'), () => rich(s, [['std: square, average, square root', '--ink-2']], s.w / 2, y2, o));
    s.alpha(seq(s, 'std'), () => rich(s, [['std ≈ ', '--ink-2'], ['0.484', 'gold'], ['  (the band)', '--ink-3']], s.w / 2, y2, o));
    const y3 = s.h * 0.945;
    s.alpha(seq(s, 'dright', 'dwrong'), () => rich(s, [['right: 0.625 / 0.484 ≈ ', '--ink-2'], ['1.29', 'green']], s.w / 2, y3, o));
    s.alpha(seq(s, 'dwrong', 'A'), () => rich(s, [['wrong: −0.375 / 0.484 ≈ ', '--ink-2'], ['−0.77', 'red']], s.w / 2, y3, o));
    s.alpha(seq(s, 'curve'), () => cap(s, 'pay 10 per right answer: the same A', y3, '--ink-2', 3.1));
  },
};

// ---- the hard group, the easy group, a group that all agrees, and the first group again

const ALL = [1, 1, 1, 1, 1, 1, 1, 1];
const PHASES: { r: number[]; at: string; label: string }[] = [
  { r: HARD, at: '', label: 'hard: 1 of 8 right' },
  { r: EASY, at: 'easy', label: 'easy: 7 of 8 right' },
  { r: ALL, at: 'all', label: 'all 8 right' },
  { r: MAIN, at: 'sum', label: '3 of 8 right' },
];

const agree: SceneDef = {
  draw(s) {
    // Each new group slides in from the last: rewards, mean, band and bars together.
    let st = stats(PHASES[0]!.r);
    let r = PHASES[0]!.r;
    let label = PHASES[0]!.label;
    for (const ph of PHASES.slice(1)) {
      const e = s.ease(ph.at, 0.9);
      if (e <= 0) break;
      const nx = stats(ph.r);
      r = r.map((x, i) => lerp(x, ph.r[i]!, e));
      st = { mean: lerp(st.mean, nx.mean, e), sd: lerp(st.sd, nx.sd, e), adv: st.adv.map((a, i) => lerp(a, nx.adv[i]!, e)) };
      if (e > 0.5) label = ph.label;
    }
    group(s, { ...st, r, dots: 1, line: 1, dist: 0, band: 1, up: 1, down: 1, k: 4.5 });
    const y1 = s.h * 0.555;
    const y2 = s.h * 0.615;
    rich(s, [[label, '--ink-2'], ['   mean ', '--ink-3'], [st.mean.toFixed(3), 'gold'], ['  std ', '--ink-3'], [st.sd.toFixed(3), 'gold']], s.w / 2, y1, { size: 3, weight: 600 });
    s.alpha(seq(s, 'hard', 'easy'), () => cap(s, 'the one right answer: a big push', y2, 'green'));
    s.alpha(seq(s, 'easy', 'all'), () => cap(s, 'each right answer: a small push', y2, 'green'));
    s.alpha(seq(s, 'all', 'eps'), () => cap(s, 'every A = 0: nothing learned', y2));
    s.alpha(seq(s, 'eps', 'sum'), () => cap(s, 'std 0, + 1e-4: 0 / 0.0001 = 0', y2));
    s.alpha(seq(s, 'sum', 'cost'), () => cap(s, 'the advantages add up to 0', y2, 'green'));
    s.alpha(seq(s, 'cost'), () => cap(s, 'no value model; G answers per question', y2));
  },
};

export const scenes: Record<string, SceneDef> = { expect, curve, agree };
