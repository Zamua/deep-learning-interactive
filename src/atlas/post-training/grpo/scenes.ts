import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { cells, columns, rowLabel } from '../../draw';
import { fmt, rich } from '../draw';

const MAIN = [1, 0, 0, 1, 0, 0, 1, 0];
const HARD = [1, 0, 0, 0, 0, 0, 0, 0];
const EASY = [1, 1, 1, 1, 1, 1, 1, 0];
const ALL = [1, 1, 1, 1, 1, 1, 1, 1];

function stats(r: number[]): { mean: number; sd: number; adv: number[] } {
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
  return { mean, sd, adv: r.map((x) => (sd > 0 ? (x - mean) / sd : 0)) };
}

/** A group of eight: a check or cross per answer, its reward, and its advantage as a bar from zero. */
function group(s: Scene, r: number[], o: { reward: number; adv: number; caption?: boolean; hi?: number[] }): void {
  const xs = columns(s, 8, s.tall ? 12 : 13);
  const st = stats(r);
  const y0 = s.h * 0.13;
  xs.forEach((x, i) => {
    const ok = r[i] === 1;
    s.cell(x - 5 * s.u, y0 - 4 * s.u, 10 * s.u, 8 * s.u, ok ? '✓' : '✗', ok ? 'green' : 'red', { on: o.hi?.[i] ?? 0, size: 3.8 });
  });
  s.alpha(o.reward, () => cells(s, xs, y0 + 10 * s.u, r.map(String), 'gold', { w: 9, h: 6.5 }));
  // Advantages as bars from a zero line.
  const zy = s.h * 0.63;
  const k = 8 * s.u;
  s.alpha(o.adv, () => {
    s.line(xs[0]! - 6 * s.u, zy, xs[7]! + 6 * s.u, zy, s.c('--axis'), 0.35);
    xs.forEach((x, i) => {
      const a = st.adv[i]!;
      const hh = Math.abs(a) * k * o.adv;
      if (hh > 0.2 * s.u) s.rrect(x - 4 * s.u, a > 0 ? zy - hh : zy, 8 * s.u, hh, 0.6, { fill: s.tint(a > 0 ? 'green' : 'red', 0.4), stroke: s.tint(a > 0 ? 'green' : 'red', 0.9), lw: 0.25 });
      s.text(fmt(a), x, a > 0 ? zy - hh - 2.6 * s.u : a < 0 ? zy + hh + 2.6 * s.u : zy - 2.6 * s.u, { size: 2.5, font: 'mono', weight: 600, color: s.c(a > 0 ? 'green' : a < 0 ? 'red' : '--ink-3'), halo: true });
    });
    if (o.caption !== false) s.text('A = (r − mean) / std', xs[0]! - 6 * s.u, s.h * 0.45, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
  });
}

const groupScene: SceneDef = {
  draw(s) {
    const g = s.ease('group', 1);
    // Before the group: the road not taken.
    s.alpha(1 - g, () => {
      s.rrect(s.w / 2 - 26 * s.u, s.h * 0.42 - 7 * s.u, 52 * s.u, 14 * s.u, 2, { fill: s.tint('slate', 0.12), stroke: s.tint('slate', 0.6), lw: 0.3 });
      s.text('value model', s.w / 2, s.h * 0.42 - 1.8 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate') });
      s.text('predicts the expected reward', s.w / 2, s.h * 0.42 + 3 * s.u, { size: 2.8, color: s.c('--ink-3') });
      s.text('a second network to train', s.w / 2, s.h * 0.6, { size: 3.2, color: s.c('--ink-2') });
    });
    const st = stats(MAIN);
    s.alpha(g, () => group(s, MAIN, { reward: s.ease('group', 0.6, 1.2), adv: s.ease('adv', 1, 0.3) }));
    const y = s.h * 0.31;
    s.alpha(s.ease('mean', 0.6), () => rich(s, [['mean = 3 / 8 = ', '--ink-2'], [st.mean.toFixed(3), 'gold']], s.w / 2, y, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('std', 0.6), () => rich(s, [['std ≈ ', '--ink-2'], [st.sd.toFixed(3), 'gold']], s.w / 2, y + 5.5 * s.u, { size: 3.4, weight: 600 }));
    // Right and wrong answers: first minus the mean, then over the std.
    const sub = s.ease('sub', 0.6) * (1 - s.ease('adv', 0.5));
    const div = s.ease('adv', 0.6, 0.3);
    const y1 = s.h * 0.84;
    const y2 = s.h * 0.92;
    const sd = st.sd.toFixed(3);
    s.alpha(sub, () => {
      rich(s, [['right: 1 − 0.375 = ', '--ink-2'], ['0.625', 'green']], s.w / 2, y1, { size: 3.2, weight: 600 });
      rich(s, [['wrong: 0 − 0.375 = ', '--ink-2'], ['−0.375', 'red']], s.w / 2, y2, { size: 3.2, weight: 600 });
    });
    s.alpha(div, () => {
      rich(s, [[`right: 0.625 / ${sd} ≈ `, '--ink-2'], [fmt(st.adv[0]!), 'green']], s.w / 2, y1, { size: 3.2, weight: 600 });
      rich(s, [[`wrong: −0.375 / ${sd} ≈ `, '--ink-2'], [fmt(st.adv[1]!), 'red']], s.w / 2, y2, { size: 3.2, weight: 600 });
    });
  },
};

const agree: SceneDef = {
  draw(s) {
    // Which group is on stage: hard, then easy, then all right, then the first group again.
    const swap = s.at('hard') + (s.end('hard') - s.at('hard')) * 0.5;
    const phase = s.t < swap ? 0 : s.since('easy') < 0 ? 1 : s.since('sum') < 0 ? 2 : 3;
    const r = [HARD, EASY, ALL, MAIN][phase]!;
    const st = stats(r);
    const fade = (t0: number) => Math.min(1, Math.max(0, (s.t - t0) / 0.5));
    const enter = phase === 0 ? 1 : fade(phase === 1 ? swap : phase === 2 ? s.at('easy') : s.at('sum'));
    s.alpha(0.4 + 0.6 * enter, () => group(s, r, { reward: 1, adv: enter, caption: false, hi: r.map((x, i) => (phase < 2 && (phase === 0 ? x === 1 : x === 1 && i === 0) ? 1 : 0)) }));
    const y = s.h * 0.34;
    const label = phase === 0 ? 'hard: 1 of 8 right' : phase === 1 ? 'easy: 7 of 8 right' : phase === 2 ? 'every answer right' : '3 of 8 right';
    rich(s, [[label, '--ink-2'], [`   mean ${st.mean.toFixed(3)}  std ${st.sd.toFixed(3)}`, 'gold']], s.w / 2, y, { size: 3.1, weight: 600 });
    const cap = (t: string, k: 'green' | 'red' | '--ink-2', a: number) => s.alpha(a, () => s.text(t, s.w / 2, s.h * 0.94, { size: 3.2, color: s.c(k) }));
    cap(phase === 0 ? 'the one right answer: a big push' : 'each right answer: a small push', 'green', s.since('easy') < 0 ? 1 : 0);
    cap('every advantage 0: nothing learned', '--ink-2', s.win('easy', 'none'));
    cap('std 0, + 1e-4: 0 / 0.0001 = 0', '--ink-2', s.win('none', 'sum'));
    cap(`sum of A = ${fmt(Math.abs(st.adv.reduce((a, b) => a + b, 0)) < 1e-9 ? 0 : st.adv.reduce((a, b) => a + b, 0))}`, 'green', s.win('sum', 'cost'));
    cap('no value model; more samples per question', '--ink-2', s.ease('cost', 0.6));
  },
};

// The worked problem: five answers, one right, std 0.4.
const TRY = [0, 1, 0, 0, 0];
const TA = TRY.map((r) => (r - 0.2) / 0.4);
const t1 = (v: number) => (v < 0 ? `−${-v}` : String(v));

const tryIt: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, 14);
    const lx = xs[0]! - 9 * s.u;
    const k = 1;
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      rich(s, [['G = 5', '--ink-2'], ['   std = 0.4', 'gold']], s.w / 2, s.h * 0.08, { size: 3.4, weight: 600 });
      TRY.forEach((r, i) => {
        s.text(String(i), xs[i]!, s.h * 0.15, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        s.cell(xs[i]! - 5 * s.u, s.h * 0.21 - 4 * s.u, 10 * s.u, 8 * s.u, r ? '✓' : '✗', r ? 'green' : 'red', { on: i === k ? s.ease('sub', 0.6) : 0, size: 3.6 });
      });
      rowLabel(s, 'r', lx, s.h * 0.31, 'gold', 3.6);
      cells(s, xs, s.h * 0.31, TRY.map(String), 'gold', { w: 9, h: 6.5, on: TRY.map((_, i) => (i === k ? s.win('sub', 'all') : 0)) });
    });
    s.alpha(s.ease('mean', 0.6, 0.4), () => rich(s, [['mean = 1 / 5 = ', '--ink-2'], ['0.2', 'gold']], s.w / 2, s.h * 0.42, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('sub', 0.6, 0.4), () => rich(s, [['answer 1: 1 − 0.2 = ', '--ink-2'], ['0.8', 'green']], s.w / 2, s.h * 0.5, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('div', 0.6, 0.4), () => rich(s, [['0.8 / 0.4 = ', '--ink-2'], ['2', 'green']], s.w / 2, s.h * 0.58, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('div', 0.6, 1), () => {
      rowLabel(s, 'A', lx, s.h * 0.7, 'green', 3.6);
      const all = after(s, 'all', 0.4);
      cells(s, xs, s.h * 0.7, TA.map((v, i) => (i === k || all > 0.5 ? t1(v) : '')), 'green', { w: 9, h: 6.5, on: TA.map((_, i) => (i === k ? 1 - all : 0)) });
    });
    s.alpha(after(s, 'all', 0.1), () => rich(s, [['wrong: (0 − 0.2) / 0.4 = ', '--ink-2'], ['−0.5', 'red']], s.w / 2, s.h * 0.81, { size: 3.3, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { group: groupScene, agree, try: tryIt };
