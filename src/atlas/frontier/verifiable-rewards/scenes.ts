import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';

/** Typographic minus and fixed places. */
const fmt = (v: number, places = 2) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(places).replace('-', '−'));

function stats(r: number[]): { mean: number; sd: number; adv: number[] } {
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
  return { mean, sd, adv: r.map((x) => (sd > 0 ? (x - mean) / sd : 0)) };
}

/** Fades in just after beat `a` starts and out as beat `b` starts, so texts that share a place never overlap. */
const seq = (s: Scene, a: string, b?: string) => s.ease(a, 0.4, 0.45) * (b ? 1 - s.ease(b, 0.4) : 1);

/** A caption centered on the stage. */
const cap = (s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.1) => s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });

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

/** A rounded box with a title, a line under it, and a big result at the bottom. */
function judgeBox(s: Scene, x: number, y: number, w: number, k: Ink, title: string, sub: string, out: string, o: { out: number; bad?: number }) {
  const u = s.u;
  const h = 22 * u;
  s.rrect(x - w / 2, y - h / 2, w, h, 1.6, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.75), lw: 0.35 });
  s.text(title, x, y - 6.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c(k) });
  s.text(sub, x, y - 1.5 * u, { size: 2.6, font: 'mono', color: s.c('--ink-2') });
  s.alpha(o.out, () => rich(s, [['r = ', '--ink-2'], [out, 'gold']], x, y + 5.5 * u, { size: 4.2, weight: 700 }));
  s.alpha(o.bad ?? 0, () => s.text('fooled', x, y + 13.5 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
}

const judge: SceneDef = {
  draw(s) {
    const u = s.u;
    // Reinforcement learning as a loop: try, get a reward, make what paid more likely.
    s.alpha(1 - s.ease('prompt', 0.5), () => {
      const steps: [string, string, Ink][] = [['tries', 'an answer', 'orange'], ['reward', 'how good', 'gold'], ['reinforce', 'more likely', 'green']];
      const xs = columns(s, 3, s.tall ? 35 : 40);
      const y = s.h * 0.42;
      const bw = (s.tall ? 29 : 32) * u;
      steps.forEach(([t, sub, k], i) => {
        s.alpha(s.ease('rl', 0.6, 0.3 + i * 0.7), () => {
          s.rrect(xs[i]! - bw / 2, y - 7 * u, bw, 14 * u, 1.6, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.7), lw: 0.3 });
          s.text(t, xs[i]!, y - 2 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c(k) });
          s.text(sub, xs[i]!, y + 3 * u, { size: 2.7, font: 'mono', color: s.c('--ink-2') });
          if (i) s.arrow(xs[i - 1]! + bw / 2 + 0.8 * u, y, xs[i]! - bw / 2 - 0.8 * u, y, s.c('--ink-3'), 0.35, 1.8);
        });
      });
      s.alpha(after(s, 'rl', 0.55), () => {
        cap(s, 'reinforcement learning: RL', s.h * 0.66, '--ink', 3.4);
        cap(s, 'what pays off is reinforced', s.h * 0.74);
      });
    });
    const pa = s.ease('prompt', 0.6, 0.3);
    s.alpha(pa, () => rich(s, [['prompt: ', '--ink-3'], ['9 × 7 = ?', '--ink']], s.w / 2, s.h * 0.13, { size: 4, weight: 650 }));
    // One sampled answer: confident, and wrong.
    const ay = s.h * 0.26;
    const said = '"… I am sure: 54"';
    s.alpha(s.ease('prompt', 0.6, 2.2), () => {
      const w = s.measure(said, { size: 3.3, font: 'mono' }) + 5 * u;
      s.cell(s.w / 2 - w / 2, ay - 3.8 * u, w, 7.6 * u, said, 'orange', { size: 3.3 });
    });
    s.alpha(after(s, 'prompt', 0.75) * (1 - s.ease('judge', 0.4)), () => cap(s, 'its reward: who gives it?', s.h * 0.4, 'gold', 3.3));
    const by = s.h * 0.58;
    const bw = (s.tall ? 46 : 52) * u;
    const lx = s.w / 2 - (s.tall ? 27 : 32) * u;
    const rx = s.w / 2 + (s.tall ? 27 : 32) * u;
    s.alpha(s.ease('judge', 0.6), () => {
      s.arrow(s.w / 2 - 4 * u, ay + 4.5 * u, lx, by - 11.8 * u, s.c('--ink-3'), 0.35, 1.8);
      judgeBox(s, lx, by, bw, 'red', 'learned judge', 'a network: scores 0 to 1', '0.9', { out: s.ease('hack', 0.6, 1.5), bad: after(s, 'hack', 0.55) });
    });
    s.alpha(s.ease('checker', 0.6), () => {
      s.arrow(s.w / 2 + 4 * u, ay + 4.5 * u, rx, by - 11.8 * u, s.c('--ink-3'), 0.35, 1.8);
      judgeBox(s, rx, by, bw, 'green', 'checker', "final answer == '63' ?", '0', { out: after(s, 'checker', 0.55) });
    });
    const y1 = s.h * 0.82;
    const y2 = s.h * 0.89;
    s.alpha(seq(s, 'hack', 'checker') * after(s, 'hack', 0.75), () => cap(s, 'reward hacking: a high score, still wrong', y1, 'red'));
    s.alpha(seq(s, 'checker', 'name') * after(s, 'checker', 0.7), () => cap(s, 'only a right answer earns 1', y1, 'green'));
    s.alpha(seq(s, 'name'), () => {
      cap(s, 'verifiable: a program can check it', y1, 'green');
      s.alpha(after(s, 'name', 0.6), () => rich(s, [['RLVR', '--ink'], [': RL with verifiable rewards', '--ink-2']], s.w / 2, y2, { size: 3.1, weight: 600 }));
    });
    cite(s, 'Tulu 3 · Lambert et al., 2024', s.ease('name', 0.6, 1.5));
  },
};

const check: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 15 : 16);
    const y = s.h * 0.22;
    rich(s, [['prompt: ', '--ink-3'], ['9 × 7 = ?', '--ink']], s.w / 2, s.h * 0.11, { size: 3.6, weight: 650 });
    s.alpha(s.ease('ans', 0.6, 0.4), () => answers(s, xs, y, ANS, R4, { checked: s.ease('check', 0.6, 0.3), reward: s.ease('check', 0.6, 1.2) }));
    s.alpha(seq(s, 'ans', 'check') * after(s, 'ans', 0.3), () => cap(s, 'four sampled answers: rewards?', s.h * 0.5, '--ink-3'));
    s.alpha(seq(s, 'check', 'code'), () => cap(s, "checker: final answer == '63' ?", s.h * 0.5, '--ink-3'));
    const y1 = s.h * 0.66;
    const y2 = s.h * 0.75;
    const o = { size: 3.1, weight: 600 };
    // Code: a program earns 1 only if every test passes.
    s.alpha(seq(s, 'code', 'r1'), () => {
      cap(s, 'run each program on its tests', s.h * 0.56, '--ink-2');
      rich(s, [['program A: ', '--ink-2'], ['✓ ✓ ✓', 'green'], ['  → r = ', '--ink-2'], ['1', 'gold']], s.w / 2, y1, o);
      s.alpha(after(s, 'code', 0.5), () => rich(s, [['program B: ', '--ink-2'], ['✓ ✗ ✓', 'red'], ['  → r = ', '--ink-2'], ['0', 'gold']], s.w / 2, y2, o));
    });
    s.alpha(seq(s, 'r1', 'format'), () => {
      cap(s, 'R1-Zero: GRPO, rewards from checkers', s.h * 0.6, '--ink');
      cap(s, 'no learned judge: it can be hacked', s.h * 0.68, 'red');
    });
    // Format: the steps between think tags, the final answer in a box a rule can find.
    s.alpha(seq(s, 'format'), () => {
      const ay = s.h * 0.6;
      const t1 = 'final answer: ';
      const w1 = s.measure(t1, { size: 3.4, font: 'mono' });
      const w2 = s.measure('63', { size: 3.4, font: 'mono' }) + 3 * u;
      const x0 = s.w / 2 - (w1 + w2) / 2;
      s.text(t1, x0, ay, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
      s.rrect(x0 + w1, ay - 3.2 * u, w2, 6.4 * u, 0.6, { stroke: s.c('green'), lw: 0.4 });
      s.text('63', x0 + w1 + w2 / 2, ay, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') });
      cap(s, 'a rule finds the box, then checks it', s.h * 0.69, '--ink-3', 2.9);
      s.alpha(after(s, 'format', 0.55), () => cap(s, '<think> steps </think>: + a format reward', s.h * 0.8, 'purple', 3));
    });
    cite(s, 'DeepSeek-R1 · DeepSeek-AI, 2025', s.ease('r1', 0.6));
  },
};

const group: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 15 : 16);
    const st = stats(R4);
    answers(s, xs, s.h * 0.09, ANS, R4, { checked: 1, reward: 1 });
    const y = s.h * 0.4;
    const o = { size: 3.2, weight: 600 };
    s.alpha(s.ease('mean', 0.6, 0.6), () => rich(s, [['mean = 3 / 4 = ', '--ink-2'], ['0.75', 'gold'], ['  (pass rate)', '--ink-3']], s.w / 2, y, o));
    s.alpha(seq(s, 'back', 'std'), () => rich(s, [['8 answers, mean 0.625: ', '--ink-2'], ['0.625 × 8 = 5', 'green']], s.w / 2, y + 6 * u, o));
    s.alpha(seq(s, 'std'), () => rich(s, [['std ≈ ', '--ink-2'], ['0.433', 'gold']], s.w / 2, y + 6 * u, o));
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
    s.alpha(seq(s, 'right', 'wrong'), () => rich(s, [['right: (1 − 0.75) / 0.433 ≈ ', '--ink-2'], ['0.58', 'green']], s.w / 2, cy, o));
    s.alpha(seq(s, 'wrong', 'scale'), () => rich(s, [['wrong: (0 − 0.75) / 0.433 ≈ ', '--ink-2'], ['−1.73', 'red']], s.w / 2, cy, o));
    s.alpha(seq(s, 'scale'), () => cap(s, 'r = 10 if right: the same A', cy, '--ink-2', 3.2));
  },
};

/** Answer length over training, a sketch: rising, with a little noise. */
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
      const a = j < 2 ? (j === 0 ? 1 : after(s, 'all', 0.55)) : s.ease('edge', 0.6);
      s.alpha(a * (1 - 0.6 * lg), () => {
        s.text(row.label, x0 - 3 * u, y, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
        row.r.forEach((v, i) => s.cell(x0 + i * (cw + 1) * u, y - 3.2 * u, cw * u, 6.4 * u, v ? '✓' : '✗', v ? 'green' : 'red', { size: 3.2, on: j === 2 ? s.win('edge', 'long') : 0 }));
        s.text(row.note, x0 + 4 * (cw + 1) * u + 2 * u, y, { size: 2.9, font: 'mono', weight: 600, align: 'left', color: s.c(row.k), halo: true });
      });
    });
    s.alpha(seq(s, 'all', 'edge'), () => cap(s, 'no signal: this prompt teaches nothing', s.h * 0.5, '--ink-2', 3));
    s.alpha(seq(s, 'edge', 'long'), () => cap(s, 'the edge: solved some of the time', s.h * 0.5, 'green', 3.2));
    // Answers grow longer over training.
    s.alpha(lg, () => {
      const l = s.w / 2 - (s.tall ? 38 : 44) * u;
      const r = s.w / 2 + (s.tall ? 38 : 44) * u;
      const t = s.h * 0.58;
      const b = s.h * 0.84;
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
    s.alpha(seq(s, 'why'), () => cap(s, 'rewarded: only the final answer', s.h * 0.5, 'gold', 3.2));
    cite(s, 'DeepSeek-R1 · DeepSeek-AI, 2025', s.ease('long', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { judge, check, group, edge };
