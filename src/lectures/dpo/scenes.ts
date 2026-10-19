import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { ANSWERS, DpoRun, KEYS, LOG_REF, PAIRS, PI_REF, R_TRUE, gapRun, kl, logSigmoid, objective, piStar, sigmoid, softmax } from '../../lib/dpo-toy';
import { type K, type Rect, Frame, area, bars, box, fit, fmt2, keys, mark, pill, pillW, split } from './kit';

// ---------------------------------------------------------------- shared data

const SHORT = ANSWERS.map((a) => a.short);
const SNIPPET = ['xs[::-1]', 'a long, rambling essay', 'xs.sort(reverse=True)', '"Sorry, I can\'t help."'];
const f3 = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);

/** pi_ref tilted by exp(t r), renormalized: the path from pi_ref toward the best answer. */
const tilt = (t: number) => softmax(LOG_REF.map((l, i) => l + t * R_TRUE[i]!));

/** The DPO run of the chapter's toy, beta = 0.5, recorded once. */
const RUN = (() => {
  const run = new DpoRun(0.5);
  const pis = [run.pi];
  const losses = [run.loss];
  for (let t = 0; t < 400; t++) {
    run.step();
    pis.push(run.pi);
    losses.push(run.loss);
  }
  return { pis, losses, acc: run.acc };
})();
const STAR_RUN = piStar(0.5).p;

/** Six pairs of one mini-batch, stepped with the DPO weight or the naive constant one. */
const BATCH: [number, number][] = [[0, 1], [1, 2], [0, 2], [1, 3], [2, 3], [1, 0]];
function batchTraj(naive: boolean, steps = 9) {
  const theta = [...LOG_REF];
  const out: { m: number; wt: number }[][] = [];
  for (let t = 0; t <= steps; t++) {
    const lp = softmax(theta).map(Math.log);
    const rows = BATCH.map(([w, l]) => {
      const m = lp[w]! - LOG_REF[w]! - (lp[l]! - LOG_REF[l]!);
      const mr = Math.abs(m) < 1e-9 ? 0 : m;
      return { m: mr, wt: naive ? 0.5 : sigmoid(-mr) };
    });
    out.push(rows);
    const push = [0, 0, 0, 0];
    rows.forEach((r, k) => {
      push[BATCH[k]![0]]! += r.wt;
      push[BATCH[k]![1]]! -= r.wt;
    });
    for (let i = 0; i < 4; i++) theta[i]! += 0.5 * push[i]!;
  }
  return out;
}
const TRAJ = batchTraj(false);
const TRAJ_NAIVE = batchTraj(true);

const GAP_DPO = gapRun('dpo', 1, 0.2, 600);
const GAP_IPO = gapRun('ipo', 1, 0.2, 600);

/** Labeled answers scattered around the data the pairs came from, and around where the policy drifts. */
const DOTS = (() => {
  const r = new Rng(5);
  const data = Array.from({ length: 26 }, () => ({ x: 3 + r.randn() * 0.9, y: 3 + r.randn() * 0.75, good: r.next() < 0.5 }));
  const fresh = Array.from({ length: 12 }, () => ({ x: 7 + r.randn() * 0.6, y: 3.2 + r.randn() * 0.6, good: r.next() < 0.5 }));
  return { data, fresh };
})();

/** A line of answer letters with green / red tags for a pair. */
function pairTag(s: Scene, w: number, l: number, x: number, y: number, size = 3.6, align: 'left' | 'center' = 'left'): number {
  const a = KEYS[w]!;
  const b = KEYS[l]!;
  const wa = s.measure(a, { font: 'ui', size, weight: 700 });
  const wg = s.measure(' ≻ ', { font: 'ui', size });
  const wb = s.measure(b, { font: 'ui', size, weight: 700 });
  const x0 = align === 'center' ? x - (wa + wg + wb) / 2 : x;
  s.text(a, x0, y, { font: 'ui', size, weight: 700, color: s.c('green'), align: 'left' });
  s.text(' ≻ ', x0 + wa, y, { font: 'ui', size, color: s.c('--ink-3'), align: 'left' });
  s.text(b, x0 + wa + wg, y, { font: 'ui', size, weight: 700, color: s.c('red'), align: 'left' });
  return wa + wg + wb;
}

/** Rows of pairs with a signed margin bar and a weight bar, the picture of one mini-batch. */
function batchRows(s: Scene, r: Rect, rows: { m: number; wt: number }[], naive: number): void {
  const [x, y, w, h] = r;
  const u = s.u;
  const rh = h / 7.2;
  const size = Math.min(3.6, (rh / u) * 0.42);
  const cM = x + w * 0.24;
  const cMw = w * 0.4;
  const cW = x + w * 0.7;
  const cWw = w * 0.3;
  s.text('pair', x, y + rh * 0.5, { font: 'ui', size: size * 0.9, weight: 600, color: s.c('--ink-3'), align: 'left' });
  s.text('margin m', cM + cMw / 2, y + rh * 0.5, { font: 'ui', size: size * 0.9, weight: 600, color: s.c('purple') });
  s.text(naive > 0.5 ? 'weight: always ½' : 'weight σ(−m)', cW + cWw / 2, y + rh * 0.5, { font: 'ui', size: size * 0.9, weight: 600, color: s.c('teal') });
  rows.forEach((row, k) => {
    const cy = y + rh * (k + 1.6);
    const [wi, li] = BATCH[k]!;
    pairTag(s, wi, li, x, cy, size);
    if (k === 5) s.text('noisy', x + s.measure('B ≻ A ', { font: 'ui', size }) + u, cy, { font: 'ui', size: size * 0.8, color: s.c('--ink-3'), align: 'left' });
    const mid = cM + cMw / 2;
    s.rrect(cM, cy - rh * 0.3, cMw, rh * 0.6, 0.8, { fill: s.tint('--ink-3', 0.1) });
    s.line(mid, cy - rh * 0.38, mid, cy + rh * 0.38, s.c('--axis'), 0.25);
    const mm = Math.max(-6, Math.min(6, row.m));
    const bw = (mm / 6) * (cMw / 2);
    if (Math.abs(bw) > 0.5) s.rrect(Math.min(mid, mid + bw), cy - rh * 0.22, Math.abs(bw), rh * 0.44, 0.5, { fill: s.tint('purple', 0.75) });
    s.text(fmt2(row.m), mm >= 0 ? mid - u : mid + u, cy, { font: 'mono', size: size * 0.85, align: mm >= 0 ? 'right' : 'left', halo: true });
    s.rrect(cW, cy - rh * 0.3, cWw, rh * 0.6, 0.8, { fill: s.tint('teal', 0.12) });
    if (row.wt > 0.004) s.rrect(cW, cy - rh * 0.22, cWw * row.wt, rh * 0.44, 0.5, { fill: s.tint('teal', 0.8) });
    s.text(fmt2(row.wt), cW + cWw - u * 0.8, cy, { font: 'mono', size: size * 0.85, align: 'right', halo: true });
  });
}

// ---------------------------------------------------------------- 1 intro

/** The three RLHF stages, then DPO folding the last two into one box. */
function pipeline(s: Scene): void {
  const { u } = s;
  const [ax, ay, aw, ah] = area(s, 0.16);
  const rects: Rect[] = s.tall
    ? [0, 1, 2].map((i) => [ax + aw * 0.1, ay + ah * (0.02 + i * 0.235), aw * 0.8, ah * 0.18] as Rect)
    : [0, 1, 2].map((i) => [ax + aw * (0.02 + i * 0.34), ay + ah * 0.08, aw * 0.28, ah * 0.3] as Rect);
  const names: [string, string, K][] = [
    ['SFT', 'learn from demos', 'slate'],
    ['reward model', 'learn from pairs', 'gold'],
    ['PPO', 'sample, score, update', 'red'],
  ];
  const p = s.prog('stages');
  const lit = (i: number) => (s.since('stages') < 0 ? 0 : s.since('heavy') >= 0 ? (i === 2 ? 1 : 0) : [p < 0.3, p >= 0.3 && p < 0.6, p >= 0.6][i] ? 1 : 0);
  const merge = s.ease('paper', 1.2, 0.4);
  const size = s.tall ? 4.2 : 4.4;
  rects.forEach((r, i) => {
    const a = (i === 0 ? 1 : 1 - merge) * s.ease('recall', 0.5, 0.3 * i);
    s.alpha(a, () => box(s, r[0], r[1], r[2], r[3], names[i]![0], names[i]![2], { sub: names[i]![1], size, fill: 0.06 + 0.14 * lit(i), lw: 0.3 + 0.3 * lit(i) }));
    if (i < 2) {
      const n = rects[i + 1]!;
      s.alpha(s.ease('recall', 0.5, 0.3 * i + 0.2) * (i === 1 ? 1 - merge : 1), () => {
        if (s.tall) s.arrow(r[0] + r[2] / 2, r[1] + r[3] + u * 0.6, n[0] + n[2] / 2, n[1] - u * 0.6, s.c('--ink-3'), 0.45, 2.2);
        else s.arrow(r[0] + r[2] + u * 0.6, r[1] + r[3] / 2, n[0] - u * 0.6, n[1] + n[3] / 2, s.c('--ink-3'), 0.45, 2.2);
      });
    }
  });
  // what PPO keeps in memory
  const heavy = s.ease('heavy', 0.6) * (1 - merge);
  const chips = ['policy', 'reference', 'reward', 'value'];
  const ppo = rects[2]!;
  const belowY = ppo[1] + ppo[3] + u * (s.tall ? 5.5 : 6);
  s.alpha(heavy, () => {
    if (s.tall) {
      const ws = chips.map((c) => pillW(s, c, 3.3, 'ui'));
      const tot = ws.reduce((a, b) => a + b, 0) + u * 1.5 * 3;
      let xx = ax + (aw - tot) / 2;
      chips.forEach((c, k) => {
        pill(s, c, xx, belowY, 'red', { size: 3.3, font: 'ui', align: 'left' });
        xx += ws[k]! + u * 1.5;
      });
    } else {
      chips.forEach((c, k) => pill(s, c, ppo[0] + ppo[2] * (k % 2 ? 0.74 : 0.26), belowY + Math.floor(k / 2) * u * 6.5, 'red', { size: 3.3, font: 'ui' }));
    }
  });
  // DPO replaces the last two boxes
  const r1 = rects[1]!;
  const r2 = rects[2]!;
  const dpo: Rect = s.tall ? [r1[0], r1[1], r1[2], r2[1] + r2[3] - r1[1]] : [r1[0], r1[1], r2[0] + r2[2] - r1[0], r1[3]];
  s.alpha(merge, () => box(s, dpo[0], dpo[1], dpo[2], dpo[3], 'DPO', '--accent', { sub: 'one loss on the pairs', size: 5.5, fill: 0.08, lw: 0.6 }));
  const gone = ['reward model', 'RL loop', 'sampling'];
  const ws = gone.map((g) => pillW(s, g, 3.3, 'ui'));
  const tot = ws.reduce((a, b) => a + b, 0) + u * 2 * 2;
  let gx = ax + (aw - tot) / 2;
  const gy = s.tall ? dpo[1] + dpo[3] + u * 6 : dpo[1] + dpo[3] + u * 7;
  gone.forEach((g, k) => {
    const a = s.ease('same', 0.4, 0.9 * k);
    s.alpha(a, () => pill(s, g, gx, gy, '--ink-3', { size: 3.3, font: 'ui', align: 'left', strike: s.ease('same', 0.5, 0.9 * k + 0.4), ink: s.c('--ink-2') }));
    gx += ws[k]! + u * 2;
  });
  s.alpha(s.ease('title', 0.7), () => {
    const q = '“Your language model is secretly a reward model.”';
    const size2 = fit(s, q, aw, 4.4, { italic: true });
    s.text(q, ax + aw / 2, gy + u * 10, { size: size2, italic: true, color: s.c('--accent') });
  });
}

const STEPS = ['the KL-regularized objective', 'its best policy, in closed form', 'turned around: reward from policy', 'the prompt term cancels', 'the DPO loss'];

/** Five numbered steps, `on` of them lit. */
function stepList(s: Scene, r: Rect, appear: (i: number) => number, sub?: (i: number) => string, check?: (i: number) => number): void {
  const [x, y, w, h] = r;
  const u = s.u;
  const rh = Math.min(h / 5, u * (sub ? 15 : 10));
  const y0 = y + (h - rh * 5) / 2;
  STEPS.forEach((t, i) => {
    const a = appear(i);
    if (a <= 0.003) return;
    const cy = y0 + rh * (i + 0.5);
    s.alpha(a, () => {
      s.rrect(x, cy - rh * 0.42, w, rh * 0.84, 1.8, { fill: s.tint('--accent', 0.06), stroke: s.tint('--accent', 0.35), lw: 0.3 });
      s.circle(x + u * 5, cy, u * 3, { fill: s.c('--accent') });
      s.text(String(i + 1), x + u * 5, cy + u * 0.2, { font: 'ui', size: 3.6, weight: 700, color: '#fff' });
      const size = fit(s, t, w - u * 13, 3.9);
      s.text(t, x + u * 10, sub ? cy - rh * 0.16 : cy, { size, align: 'left', weight: 560 });
      if (sub) s.text(sub(i), x + u * 10, cy + rh * 0.2, { font: 'mono', size: fit(s, sub(i), w - u * 13, 3.1, { font: 'mono' }), align: 'left', color: s.c('--ink-2') });
      if (check && check(i) > 0) s.alpha(check(i), () => mark(s, x + w - u * 4.5, cy, u * 2.3, true));
    });
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'recall'), () => {
      const t = 'Direct preference optimization';
      s.text(t, w / 2, h * 0.44, { size: fit(s, t, w * 0.9, 8.5, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      s.text('one loss instead of a pipeline', w / 2, h * 0.57, { size: 4.6, italic: true, color: s.c('--ink-2') });
    });
    const pA = s.win('recall', 'plan');
    if (pA > 0) s.alpha(pA, () => pipeline(s));
    const sA = s.win('plan', 'toy');
    if (sA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.16);
      const bw = Math.min(aw, u * 120);
      s.alpha(sA, () => stepList(s, [ax + (aw - bw) / 2, ay, bw, ah], (i) => s.ease('plan', 0.5, 0.35 * i)));
    }
    const tA = s.ease('toy', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const [ax, ay, aw, ah] = area(s, 0.15);
        const q = '“How do I reverse a list in Python?”';
        s.text(q, ax + aw / 2, ay + u * 3, { size: fit(s, q, aw, 4.6, { italic: true }), italic: true, weight: 560 });
        const top = ay + u * 12;
        const rh = (ah - u * 12) / 4.4;
        const colR = ax + aw * 0.5;
        const colRw = aw * 0.25;
        const colP = ax + aw * 0.8;
        const colPw = aw * 0.09;
        const rA = s.ease('reward', 0.6);
        const pA2 = s.ease('ref', 0.6);
        s.alpha(rA, () => s.text('reward', colR + colRw / 2, top - u * 1, { font: 'ui', size: 3.3, weight: 600, color: s.c('gold') }));
        s.alpha(pA2, () => s.text('π_ref', colP + colPw / 2, top - u * 1, { font: 'ui', size: 3.3, weight: 600, color: s.c('orange') }));
        const p = s.prog('answers');
        for (let i = 0; i < 4; i++) {
          const a = s.since('answers') < 0 ? 0 : s.since('reward') >= 0 ? 1 : clamp01((p - [0.12, 0.33, 0.58, 0.8][i]!) * 10);
          if (a <= 0) continue;
          const cy = top + rh * (i + 0.65);
          s.alpha(a, () => {
            s.circle(ax + u * 3.4, cy, u * 3, { fill: s.tint('--accent', 0.15), stroke: s.c('--accent'), lw: 0.35 });
            s.text(KEYS[i]!, ax + u * 3.4, cy + u * 0.2, { font: 'ui', size: 3.6, weight: 700, color: s.c('--accent') });
            const tx = ax + u * 9;
            const tw = colR - tx - u * 2;
            s.text(SHORT[i]!, tx, cy - u * 2.2, { font: 'ui', size: 3.5, weight: 600, align: 'left' });
            s.text(SNIPPET[i]!, tx, cy + u * 2.3, { font: 'mono', size: fit(s, SNIPPET[i]!, tw, 3.1, { font: 'mono' }), align: 'left', color: s.c('--ink-2') });
            s.alpha(rA, () => {
              const mid = colR + colRw / 2;
              const len = (R_TRUE[i]! / 1.8) * (colRw / 2) * rA;
              s.line(mid, cy - rh * 0.32, mid, cy + rh * 0.32, s.c('--axis'), 0.25);
              s.rrect(Math.min(mid, mid + len), cy - rh * 0.17, Math.abs(len), rh * 0.34, 0.5, { fill: s.tint('gold', 0.75) });
              s.text(String(R_TRUE[i]), len >= 0 ? mid - u : mid + u, cy, { font: 'mono', size: 3.3, align: len >= 0 ? 'right' : 'left', halo: true });
            });
            s.alpha(pA2, () => {
              const len = (PI_REF[i]! / 0.5) * colPw * pA2;
              s.rrect(colP, cy - rh * 0.17, Math.max(1, len), rh * 0.34, 0.5, { fill: s.tint('orange', 0.25), stroke: s.c('orange'), lw: 0.3 });
              s.text(String(PI_REF[i]), colP + Math.max(len, 0) + u, cy, { font: 'mono', size: 3.3, align: 'left', halo: true });
            });
          });
        }
      });
    }
  },
};

// ---------------------------------------------------------------- 2 Bradley-Terry

const bt: SceneDef = {
  marks: {
    bt: { tex: String.raw`P(\symyw \succ \symyl) = \sigma\big(\symr(\symyw) - \symr(\symyl)\big)`, x: 0.5, y: 0.22, size: 5 },
  },
  draw(s) {
    const { u } = s;
    s.show('bt', s.ease('sig', 0.7));
    const [cards, plot] = split(s, area(s, 0.32), s.tall ? 0.38 : 0.4, 5);
    // the two answers
    const c = s.since('diff') >= 0 && s.since('rm') < 0 ? Math.sin(clamp01(s.since('diff') / 6) * Math.PI * 2) * 1.2 : 0;
    const rw = 1.6 + c;
    const rl = -0.8 + c;
    s.slot('rw', fmt2(rw));
    s.slot('rl', fmt2(rl));
    const pa = s.ease('pair', 0.6);
    s.alpha(pa, () => {
      const [x, y, w, h] = cards;
      const two: [number, string, number, K][] = [[0, 'y_w', rw, 'green'], [2, 'y_l', rl, 'red']];
      two.forEach(([ai, tag, rv, k], j) => {
        const cw = s.tall ? w * 0.46 : w * 0.8;
        const ch = s.tall ? h * 0.95 : h * 0.36;
        const cx = s.tall ? x + w * (j ? 0.75 : 0.25) - cw / 2 : x + (w - cw) / 2;
        const cy = s.tall ? y + (h - ch) / 2 : y + h * (j ? 0.42 : 0);
        const named = s.ease('names', 0.6);
        s.rrect(cx, cy, cw, ch, 2, { fill: s.tint(named > 0.5 ? k : '--ink-3', 0.08), stroke: s.tint(named > 0.5 ? k : '--ink-3', 0.7), lw: 0.4 });
        s.text(KEYS[ai]!, cx + u * 3.5, cy + ch * 0.25, { font: 'display', size: 5.5, weight: 600, align: 'left' });
        s.text(SHORT[ai]!, cx + u * 9.5, cy + ch * 0.25, { font: 'ui', size: 3.4, align: 'left', color: s.c('--ink-2') });
        s.alpha(named, () => s.text(tag === 'y_w' ? 'y_w: chosen' : 'y_l: rejected', cx + u * 3.5, cy + ch * 0.52, { font: 'mono', size: 3.4, weight: 600, align: 'left', color: s.c(k) }));
        s.alpha(s.ease('bt', 0.6), () => s.text(`r = ${fmt2(rv)}`, cx + u * 3.5, cy + ch * 0.79, { font: 'mono', size: 3.6, weight: 650, align: 'left', color: s.c('gold') }));
        if (j === 0) s.alpha(s.ease('pair', 0.5, 2.2), () => mark(s, cx + cw - u * 4, cy + ch * 0.25, u * 2.4, true));
      });
    });
    // the sigmoid
    const pl = s.ease('sig', 0.6);
    if (pl > 0) {
      const f = new Frame(s, [plot[0] + u * 6, plot[1] + u * 3, plot[2] - u * 8, plot[3] - u * 11], [-5, 5, 0, 1]);
      s.alpha(pl, () => {
        f.hline(0, s.c('--axis'), 0.35);
        f.hline(1, s.c('--grid'), 0.3);
        f.hline(0.5, s.c('--grid'), 0.3, [1, 1]);
        f.vline(0, s.c('--grid'), 0.3);
        s.text('1', f.X(-5) - u * 1.5, f.Y(1), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('½', f.X(-5) - u * 1.5, f.Y(0.5), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('0', f.X(-5) - u * 1.5, f.Y(0), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('reward gap  r(y_w) − r(y_l)', f.X(0), f.Y(0) + u * 5, { font: 'ui', size: 3.3, color: s.c('--ink-3') });
        const draw = s.ease('sig', 1.6, 0.3);
        f.fn((z) => sigmoid(z), s.c('--ink'), 0.7, -5, -5 + 10 * draw);
        const g = s.since('gap') >= 0 ? lerp(0, 2.4, s.ease('gap', 1.2, 0.8)) : 0;
        const dA = s.ease('curve', 0.5, 0.4);
        const pv = sigmoid(g);
        s.slot('p', f3(pv));
        s.alpha(dA, () => {
          s.line(f.X(g), f.Y(0), f.X(g), f.Y(pv), s.tint('--ink-3', 0.8), 0.3, [1, 1]);
          s.line(f.X(-5), f.Y(pv), f.X(g), f.Y(pv), s.tint('--ink-3', 0.8), 0.3, [1, 1]);
          f.dot(g, pv, 1.6, s.c('--accent'));
          s.text(`P = ${f3(pv)}`, f.X(g) - u * 2.5, f.Y(pv) - u * 4, { font: 'mono', size: 3.6, weight: 650, align: 'right', halo: true, color: s.c('--accent') });
          s.text(`gap ${fmt2(g)}`, f.X(g), f.Y(0) - u * 2.5, { font: 'mono', size: 3.3, halo: true, color: s.c('--ink-2') });
        });
        s.alpha(s.ease('rm', 0.6), () => {
          const t = `loss = −log P = ${f3(-Math.log(pv))}`;
          if (s.tall) s.text(t, f.X(-4.8), f.Y(0.74), { font: 'mono', size: 3.3, weight: 600, align: 'left', halo: true, color: s.c('red') });
          else s.text(t, cards[0] + cards[2] * 0.1, cards[1] + cards[3] * 0.9, { font: 'mono', size: fit(s, t, cards[2] * 0.9, 3.3, { font: 'mono' }), weight: 600, align: 'left', color: s.c('red') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 3 the objective

function tugT(s: Scene): number {
  if (s.since('tug') >= 0) return keys(s.since('tug'), [[0.3, 0], [2.4, 3], [4.6, 0.3], [6.4, 1]]);
  if (s.since('kl') >= 0) return keys(s.since('kl'), [[0.5, 3.5], [2.5, 0]]);
  if (s.since('greedy') >= 0) return keys(s.since('greedy'), [[0.6, 0], [3.2, 3.5]]);
  return 0;
}

const objectiveScene: SceneDef = {
  marks: {
    J: { tex: String.raw`J(\sympi) = \mathbb{E}_{y \sim \sympi}\big[\symr(y)\big] - \symbeta\, \mathrm{KL}(\sympi \,\|\, \sympiref)`, x: 0.5, y: 0.22, size: 4.6 },
  },
  draw(s) {
    const { u } = s;
    s.show('J', s.ease('goal', 0.7));
    const t = tugT(s);
    const pi = tilt(t);
    const o = objective(pi, 1);
    s.slot('er', f3(o.er));
    s.slot('kl', f3(o.kl));
    s.slot('J', f3(o.J));
    const [left, right] = split(s, area(s, 0.3), s.tall ? 0.56 : 0.52, 4);
    const blue = s.ease('policy', 0.6);
    const { f } = bars(s, [left[0], left[1], left[2], left[3] - u * 7], [
      { vals: PI_REF, k: 'orange', kind: 'line' },
      { vals: pi, k: 'blue', kind: 'fill', a: blue },
    ], { hi: 0.85, values: blue > 0.5 ? 1 : undefined });
    // readouts under the bars
    const ry = left[1] + left[3] - u * 2;
    const items: [string, K, number][] = [
      [`E[r] ${f3(o.er)}`, 'gold', s.ease('reward', 0.5)],
      [`KL ${f3(o.kl)}`, 'slate', s.ease('leash', 0.5)],
      [`J ${f3(o.J)}`, '--accent', s.ease('beta', 0.5)],
    ];
    const ws = items.map(([t2]) => pillW(s, t2, 3.3));
    let xx = left[0] + (left[2] - ws.reduce((a, b) => a + b, 0) - u * 4) / 2;
    items.forEach(([t2, k, a], i) => {
      s.alpha(a, () => pill(s, t2, xx, ry, k, { size: 3.3, align: 'left' }));
      xx += ws[i]! + u * 2;
    });
    void f;
    // the tug of war along the tilt path
    const pA = s.ease('reward', 0.6);
    if (pA > 0) {
      const fr = new Frame(s, [right[0] + u * 5, right[1] + u * 3, right[2] - u * 6, right[3] - u * 8], [0, 4, -0.7, 1.8]);
      s.alpha(pA, () => {
        fr.hline(0, s.c('--axis'), 0.3);
        s.text('0', fr.X(0) - u * 1.5, fr.Y(0), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('1', fr.X(0) - u * 1.5, fr.Y(1), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        fr.hline(1, s.c('--grid'), 0.25);
        s.text('more probability on A  →', fr.X(4), fr.Y(-0.7) + u * 3.5, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
        fr.fn((x) => objective(tilt(x), 1).er, s.c('gold'), 0.6);
        s.text('expected reward', fr.X(4), fr.Y(objective(tilt(4), 1).er) - u * 3, { font: 'ui', size: 3.3, align: 'right', color: s.c('gold'), halo: true });
        s.alpha(s.ease('beta', 0.8), () => {
          fr.fn((x) => objective(tilt(x), 1).J, s.c('--ink'), 0.7);
          const jw = s.measure('J = reward − β·KL', { font: 'ui', size: 3.3 });
          s.line(fr.X(4) - jw - u * 6, fr.Y(-0.32), fr.X(4) - jw - u * 2, fr.Y(-0.32), s.c('--ink'), 0.7);
          s.text('J = reward − β·KL', fr.X(4), fr.Y(-0.32), { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink') });
        });
        fr.dot(t, o.er, 1.3, s.c('gold'));
        s.alpha(s.ease('beta', 0.5), () => fr.dot(t, o.J, 1.5, s.c('--accent')));
        s.alpha(s.ease('tug', 0.6, 6), () => {
          fr.vline(1, s.tint('--accent', 0.8), 0.3, [1, 1]);
          s.text('best', fr.X(1), fr.Y(1.8) - u * 1, { font: 'ui', size: 3.3, weight: 600, color: s.c('--accent'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 4 the optimal policy

function betaOpt(s: Scene): number {
  if (s.since('why') >= 0) return keys(s.since('why'), [[0, 4], [1.2, 1]]);
  if (s.since('beta') >= 0) return keys(s.since('beta'), [[0.4, 1], [3, 0.2], [4.6, 0.2], [7.6, 4]]);
  return 1;
}

const optimal: SceneDef = {
  marks: {
    star: { tex: String.raw`\sympistar(y) = \frac{1}{\symZ}\, \sympiref(y)\, e^{\symr(y)/\symbeta}`, x: 0.5, y: 0.22, size: 5 },
    J: { tex: String.raw`J(\sympi) = \symbeta \log \symZ - \symbeta\, \mathrm{KL}(\sympi \,\|\, \sympistar)`, x: 0.5, y: 0.22, size: 4.8 },
    Zsum: { tex: String.raw`\symZ(x) = \sum_{\text{every answer } y} \sympiref(y \mid x)\, e^{\symr(x, y)/\symbeta}`, x: 0.5, y: 0.5, size: 4.8 },
  },
  draw(s) {
    const { u } = s;
    s.show('star', s.win('tilt', 'why'));
    s.show('J', s.win('why', 'catch'));
    s.show('Zsum', s.ease('catch', 0.7));
    const beta = betaOpt(s);
    s.slot('beta', fmt2(beta));
    const mult = PI_REF.map((_, i) => Math.exp(R_TRUE[i]! / 1));
    const un = PI_REF.map((p, i) => p * mult[i]!);
    const Z1 = un.reduce((a, b) => a + b, 0);
    const { p: st, Z } = piStar(beta);
    s.slot('Z', fmt2(Z));
    const g = s.ease('grow', 1.5, 0.2);
    const n = s.ease('norm', 1.5, 0.9);
    const inBeta = s.since('beta') >= 0;
    const cur = inBeta ? st : PI_REF.map((p, i) => lerp(lerp(p, un[i]!, g), un[i]! / Z1, n));
    const pol = s.since('why') >= 0 ? PI_REF.map((p, i) => lerp(p, st[i]!, s.ease('zero', 2, 0.3))) : null;
    const dim = 1 - s.ease('catch', 0.6);
    const r = area(s, 0.33);
    s.alpha(s.win('surprise', 'tilt'), () => {
      const t = 'step 2: the best policy, in closed form';
      s.text(t, s.w / 2, s.h * 0.22, { size: fit(s, t, s.w * 0.9, 4.6, { italic: true }), italic: true, color: s.c('--accent') });
    });
    s.alpha(dim, () => {
      const sets: { vals: readonly number[]; k: K; kind: 'fill' | 'line' | 'dash'; a?: number }[] = [{ vals: PI_REF, k: 'orange', kind: 'line' }];
      if (pol) sets.push({ vals: pol, k: 'blue', kind: 'fill' }, { vals: st, k: 'blue', kind: 'dash' });
      else sets.push({ vals: cur, k: 'blue', kind: 'fill', a: s.ease('grow', 0.4) });
      const { f, x } = bars(s, [r[0], r[1] + u * 4, r[2], r[3] - u * 4], sets, { hi: 1.15, short: SHORT, values: s.since('result') >= 0 ? (pol ? 2 : 1) : undefined });
      // the multipliers
      s.alpha(s.win('tilt', 'norm'), () => {
        for (let i = 0; i < 4; i++) s.text(`×${fmt2(mult[i]!)}`, f.X(i + 0.5), f.Y(Math.max(PI_REF[i]!, cur[i]!)) - u * 4.5, { font: 'mono', size: 3.4, weight: 650, color: s.c('gold'), halo: true });
      });
      // the total before and after dividing
      const zt = s.win('grow', 'beta');
      s.alpha(zt, () => {
        const total = cur.reduce((a, b) => a + b, 0);
        s.text(n > 0.98 ? 'total = 1' : `total Z = ${fmt2(total)}`, r[0] + r[2], r[1], { font: 'mono', size: 3.6, weight: 650, align: 'right', color: s.c('slate') });
      });
      s.alpha(s.win('beta', 'why'), () => pill(s, `β = ${fmt2(beta)}`, r[0] + r[2], r[1] + u * 1, 'slate', { size: 3.6, align: 'right' }));
      s.alpha(s.ease('why', 0.6), () => {
        const pv = pol ?? PI_REF;
        const o = objective(pv, 1);
        const lines = [`β log Z = ${f3(Math.log(Z))}`, `J(π) = ${f3(o.J)}`, `β·KL(π‖π*) = ${f3(kl(pv, st))}`];
        lines.forEach((l, k) => s.text(l, r[0] + r[2], r[1] + u * (k * 4.6 - 1), { font: 'mono', size: 3.3, weight: 600, align: 'right', color: s.c(k === 2 ? 'blue' : '--ink'), halo: true }));
      });
      void x;
    });
    // Z is a sum over every possible answer
    const cA = s.ease('catch', 0.8, 0.8);
    s.alpha(cA, () => {
      const rng = new Rng(3);
      const y0 = s.h * 0.66;
      for (let k = 0; k < 120; k++) {
        const fx = rng.next();
        const xx = r[0] + fx * r[2];
        const yy = y0 + rng.next() * s.h * 0.16;
        s.circle(xx, yy, u * 0.55, { fill: s.tint('slate', 0.75 * (1 - fx * 0.7)) });
      }
      s.text('more possible answers than atoms in the universe', s.w / 2, y0 + s.h * 0.22, { size: fit(s, 'more possible answers than atoms in the universe', r[2], 3.8, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- 5 invert

const invert: SceneDef = {
  marks: {
    star: { tex: String.raw`\sympistar = \tfrac{1}{\symZ}\, \sympiref\, e^{\symr/\symbeta}`, x: 0.5, y: 0.22, size: 5 },
    inv: { tex: String.raw`\symr(y) = \underbrace{\symbeta \log \frac{\sympistar(y)}{\sympiref(y)}}_{\text{implicit reward } \hat r} + \symbeta \log \symZ`, x: 0.5, y: 0.25, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('star', s.win('back', 'logs'));
    s.show('inv', s.ease('logs', 0.7));
    // reward <-> policy
    const dA = s.win('back', 'bars');
    if (dA > 0) {
      s.alpha(dA, () => {
        const y = h * 0.6;
        const xl = w * 0.27;
        const xr = w * 0.73;
        pill(s, 'reward r', xl, y, 'gold', { size: 4.4, font: 'ui' });
        pill(s, 'policy π*', xr, y, 'blue', { size: 4.4, font: 'ui' });
        const gap = u * 13;
        s.arrow(xl + gap, y - u * 4, xr - gap, y - u * 4, s.c('--ink-2'), 0.5, 2.4);
        s.text('step 2', w / 2, y - u * 8, { font: 'ui', size: 3.3, color: s.c('--ink-2') });
        s.alpha(s.ease('back', 0.6, 2.4), () => {
          s.arrow(xr - gap, y + u * 4, xl + gap, y + u * 4, s.c('--accent'), 0.6, 2.4);
          s.text('step 3: read it backwards', w / 2, y + u * 8.5, { font: 'ui', size: 3.4, weight: 600, color: s.c('--accent') });
        });
        s.alpha(s.ease('implicit', 0.6), () => s.text('raised above π_ref  →  positive implicit reward', w / 2, h * 0.84, { font: 'ui', size: fit(s, 'raised above π_ref  →  positive implicit reward', w * 0.9, 3.5, { font: 'ui' }), color: s.c('purple') }));
      });
    }
    const bA = s.ease('bars', 0.7);
    if (bA > 0) {
      const { p: st, Z } = piStar(1);
      const blz = Math.log(Z);
      const rh = st.map((v, i) => Math.log(v / PI_REF[i]!));
      const r = area(s, 0.42);
      s.alpha(bA, () => {
        const { f, x } = bars(s, r, [
          { vals: R_TRUE, k: 'gold', kind: 'fill' },
          { vals: rh, k: 'purple', kind: 'fill' },
        ], { lo: -2.4, hi: 2.0 });
        const sh = s.ease('shift', 0.8, 0.3);
        s.alpha(sh, () => {
          for (let i = 0; i < 4; i++) {
            const xc = x(i, 1);
            const x0 = f.X(xc - 0.12);
            const x1 = f.X(xc + 0.12);
            const c = s.ctx;
            c.save();
            c.setLineDash([u * 0.8, u * 0.6]);
            s.rrect(x0, f.Y(R_TRUE[i]!), x1 - x0, f.Y(rh[i]!) - f.Y(R_TRUE[i]!), 0.3, { stroke: s.c('slate'), lw: 0.35 });
            c.restore();
          }
          s.text(`β log Z ≈ ${fmt2(blz)}`, f.X(x(0, 1) + 0.18), f.Y((R_TRUE[0]! + rh[0]!) / 2), { font: 'mono', size: 3.3, weight: 650, align: 'left', color: s.c('slate'), halo: true });
        });
        s.alpha(s.ease('bars', 0.6, 0.5), () => {
          const lx = f.X(2.1);
          const ly = f.Y(1.75);
          s.rrect(lx, ly - u * 1.4, u * 2.8, u * 2.8, 0.4, { fill: s.tint('gold', 0.7) });
          s.text('true reward r', lx + u * 4, ly, { font: 'ui', size: 3.3, align: 'left', color: s.c('--ink-2') });
          s.rrect(lx, ly + u * 3.6, u * 2.8, u * 2.8, 0.4, { fill: s.tint('purple', 0.7) });
          s.text('implicit r̂', lx + u * 4, ly + u * 5, { font: 'ui', size: 3.3, align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(s.win('secret', 'stuck'), () => s.text('a policy is a reward model in disguise', w / 2, r[1] - u * 3.5, { size: fit(s, 'a policy is a reward model in disguise', w * 0.9, 4.2, { italic: true }), italic: true, color: s.c('--accent'), halo: true }));
        s.alpha(s.ease('stuck', 0.6), () => pill(s, 'Z(x): one number per prompt', w / 2, r[1] - u * 3.5, 'slate', { size: 3.6, font: 'ui' }));
      });
      s.slot('blz', f3(blz));
    }
  },
};

// ---------------------------------------------------------------- 6 cancel

const cancel: SceneDef = {
  marks: {
    bt: { tex: String.raw`P(\symyw \succ \symyl) = \sigma\big(\symr(\symyw) - \symr(\symyl)\big)`, x: 0.5, y: 0.22, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('bt', s.win('step4', 'check'));
    s.alpha(s.win('step4', 'sub'), () => {
      const t = 'only the difference of two rewards, same prompt';
      s.text(t, w / 2, h * 0.5, { size: fit(s, t, w * 0.9, 4.2, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
    const rowsA = s.win('sub', 'check');
    const size = s.tall ? 3.4 : 3.8;
    const lw = s.measure('r(y_w) = ', { font: 'mono', size, weight: 600 });
    const wR = pillW(s, 'β log ratio(y_w)', size);
    const wZ = pillW(s, 'β log Z(x)', size);
    const wp = s.measure(' + ', { font: 'mono', size });
    const tot = lw + wR + wp + wZ;
    const x0 = (w - tot) / 2;
    const glow = s.since('two') >= 0 && s.since('cancel') < 0 ? 0.12 + 0.12 * Math.sin(s.since('two') * 5) : 0.12;
    const strike = s.ease('cancel', 0.8, 0.2);
    const zFade = 1 - 0.7 * s.ease('cancel', 0.8, 1.2);
    const rowY = [h * 0.36, h * 0.47];
    s.alpha(rowsA, () => {
      (['w', 'l'] as const).forEach((which, j) => {
        const a = s.ease('sub', 0.5, j * 1.2);
        s.alpha(a, () => {
          const y = rowY[j]!;
          s.text(`r(y_${which}) = `, x0, y, { font: 'mono', size, weight: 600, align: 'left', color: s.c('gold') });
          pill(s, `β log ratio(y_${which})`, x0 + lw, y, which === 'w' ? 'green' : 'red', { size, align: 'left' });
          s.text(' + ', x0 + lw + wR, y, { font: 'mono', size, align: 'left' });
          s.alpha(zFade, () => pill(s, 'β log Z(x)', x0 + lw + wR + wp, y, 'slate', { size, align: 'left', fill: glow, strike }));
        });
      });
      s.alpha(s.ease('sub', 0.5, 2), () => {
        s.line(x0, h * 0.535, x0 + tot, h * 0.535, s.c('--ink-2'), 0.35);
        if (x0 > u * 5) s.text('−', x0 - u * 2.5, h * 0.47, { font: 'mono', size: 4.4, weight: 600, align: 'center', color: s.c('--ink-2') });
      });
      const left = s.ease('left', 0.7);
      s.alpha(left, () => {
        const pre = 'P(y_w ≻ y_l) = σ(';
        const pw = s.measure(pre, { font: 'mono', size, weight: 600 });
        const wl = pillW(s, 'β log ratio(y_l)', size);
        const wm = s.measure(' − ', { font: 'mono', size });
        const twoLines = pw + wR + wm + wl + u * 3 > w * 0.94;
        if (twoLines) {
          s.text(pre, w / 2, h * 0.62, { font: 'mono', size, weight: 600 });
          const t2 = wR + wm + wl + s.measure(')', { font: 'mono', size });
          const xa = (w - t2) / 2;
          pill(s, 'β log ratio(y_w)', xa, h * 0.72, 'green', { size, align: 'left' });
          s.text(' − ', xa + wR, h * 0.72, { font: 'mono', size, align: 'left' });
          pill(s, 'β log ratio(y_l)', xa + wR + wm, h * 0.72, 'red', { size, align: 'left' });
          s.text(')', xa + wR + wm + wl + u * 0.8, h * 0.72, { font: 'mono', size, weight: 600, align: 'left' });
        } else {
          const t2 = pw + wR + wm + wl + s.measure(')', { font: 'mono', size });
          const xa = (w - t2) / 2;
          s.text(pre, xa, h * 0.64, { font: 'mono', size, weight: 600, align: 'left' });
          pill(s, 'β log ratio(y_w)', xa + pw, h * 0.64, 'green', { size, align: 'left' });
          s.text(' − ', xa + pw + wR, h * 0.64, { font: 'mono', size, align: 'left' });
          pill(s, 'β log ratio(y_l)', xa + pw + wR + wm, h * 0.64, 'red', { size, align: 'left' });
          s.text(')', xa + pw + wR + wm + wl + u * 0.8, h * 0.64, { font: 'mono', size, weight: 600, align: 'left' });
        }
      });
      s.alpha(s.ease('gone', 0.6), () => {
        const t = 'no reward model, no Z: only log-probabilities';
        s.text(t, w / 2, h * 0.86, { size: fit(s, t, w * 0.9, 4, { italic: true }), italic: true, color: s.c('--accent') });
      });
    });
    // the check on the toy
    const cA = s.ease('check', 0.6);
    if (cA > 0) {
      const c = keys(s.since('check'), [[0.6, 0], [3, 1.5], [5.4, -1.5], [7.4, 1.5]]);
      const r = R_TRUE.map((v) => v + c);
      const { p: st, Z } = piStar(1, r);
      const p = sigmoid(r[0]! - r[2]!);
      s.slot('c', fmt2(c));
      s.slot('Z', fmt2(Z));
      s.slot('p', f3(p));
      s.alpha(cA, () => {
        const rows: [string, string, K, boolean][] = [
          ['shift every reward by c', fmt2(c), 'gold', true],
          ['Z', fmt2(Z), 'slate', true],
          ['π*(A)', f3(st[0]!), 'blue', false],
          ['P(A ≻ C)', f3(p), '--accent', false],
        ];
        const bw = Math.min(w * 0.86, u * 110);
        const bx = (w - bw) / 2;
        rows.forEach(([lab, val, k, moves], i) => {
          const y = h * (0.3 + i * 0.14);
          s.rrect(bx, y - u * 4.5, bw, u * 9, 1.6, { fill: s.tint(k, 0.07), stroke: s.tint(k, 0.4), lw: 0.3 });
          s.text(lab, bx + u * 4, y, { font: 'ui', size: 3.8, align: 'left', color: s.c('--ink') });
          s.text(val, bx + bw - u * 22, y, { font: 'mono', size: 4.2, weight: 650, align: 'right', color: s.c(k) });
          s.text(moves ? 'changes' : 'fixed', bx + bw - u * 3, y, { font: 'ui', size: 3.3, align: 'right', color: s.c(moves ? '--ink-3' : 'green'), weight: moves ? 400 : 700 });
        });
        s.alpha(s.ease('never', 0.6), () => {
          const t = 'a constant per prompt changes no preference';
          s.text(t, w / 2, h * 0.88, { size: fit(s, t, w * 0.9, 4, { italic: true }), italic: true, color: s.c('--accent') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 7 the loss

const lossScene: SceneDef = {
  marks: {
    loss: { tex: String.raw`\begin{aligned} \mathcal{L} &= -\log \sigma(\symm) \\ \symm &= \symbeta \log \frac{\sympi(\symyw)}{\sympiref(\symyw)} - \symbeta \log \frac{\sympi(\symyl)}{\sympiref(\symyl)} \end{aligned}`, x: 0.5, y: 0.27, size: 4.3 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('loss', s.ease('replace', 0.7));
    const first = s.win('step5', 'replace');
    s.alpha(first, () => {
      const t = 'step 5: a training rule';
      s.text(t, w / 2, h * 0.5, { font: 'display', size: 6.5, weight: 600 });
    });
    // the chain: gap -> margin -> loss
    const chainA = s.win('replace', 'curve');
    if (chainA > 0) {
      s.alpha(chainA, () => {
        const items: [string, K, string, number][] = [
          ['log-ratio gap h', 'blue', 'replace', 0.3],
          ['× β  =  margin m', 'purple', 'loss', 0.3],
          ['−log σ(m)  =  loss', 'red', 'loss', 1.4],
        ];
        const ys = [0.5, 0.64, 0.78].map((f) => h * f);
        items.forEach(([t, k, b, d], i) => {
          const a = s.ease(b, 0.5, d);
          s.alpha(a, () => {
            pill(s, t, w / 2, ys[i]!, k, { size: 3.9, font: 'ui' });
            if (i) s.arrow(w / 2, ys[i - 1]! + u * 3.8, w / 2, ys[i]! - u * 3.8, s.c('--ink-3'), 0.4, 1.8);
          });
        });
        s.alpha(s.ease('classify', 0.6), () => {
          const t = 'logistic regression; the label is always "y_w won"';
          s.text(t, w / 2, h * 0.9, { size: fit(s, t, w * 0.9, 3.7, { italic: true }), italic: true, color: s.c('--accent') });
        });
      });
    }
    const cA = s.ease('curve', 0.6);
    if (cA > 0) {
      const r = area(s, 0.43);
      const f = new Frame(s, [r[0] + u * 6, r[1] + u * 2, r[2] - u * 7, r[3] - u * 9], [-6, 6, 0, 5]);
      s.alpha(cA, () => {
        f.hline(0, s.c('--axis'), 0.35);
        f.vline(0, s.c('--grid'), 0.3);
        for (const y of [1, 2, 3, 4]) {
          f.hline(y, s.c('--grid'), 0.2);
          s.text(String(y), f.X(-6) - u * 1.5, f.Y(y), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        }
        s.text('margin m  →', f.X(6), f.Y(0) + u * 4.5, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('← rejected favored', f.X(-6), f.Y(0) + u * 4.5, { font: 'ui', size: 3.3, align: 'left', color: s.c('--ink-3') });
        f.fn((m) => -logSigmoid(m), s.c('--ink'), 0.7, -6, -6 + 12 * s.ease('curve', 1.4, 0.3));
        const m = s.since('right') >= 0 ? keys(s.since('right'), [[0.3, 0], [2.6, 4], [5.2, -4]]) : s.since('same') >= 0 ? 3 : 0;
        const mm = s.since('same') >= 0 ? keys(s.since('same'), [[0, -4], [1.2, 3]]) : m;
        const L = -logSigmoid(mm);
        const dA = s.ease('start', 0.5);
        s.alpha(dA, () => {
          f.dot(mm, L, 1.6, s.c('--accent'));
          const lab = Math.abs(mm) < 0.05 ? 'log 2 ≈ 0.693' : `loss ${fmt2(L)}`;
          s.text(lab, f.X(mm) + u * 3, f.Y(L) - u * 3.5, { font: 'mono', size: 3.6, weight: 650, align: 'left', color: s.c('--accent'), halo: true });
        });
        s.alpha(s.ease('same', 0.6, 1), () => {
          const t = 'its minimum: π_θ = π*';
          s.text(t, f.X(6), f.Y(4.5), { font: 'ui', size: 3.8, weight: 600, align: 'right', color: s.c('blue'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 8 the gradient

const gradient: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const p1 = s.win('diff', 'batch');
    if (p1 > 0) {
      const [left, right] = split(s, area(s, 0.16), s.tall ? 0.48 : 0.42, 4);
      const m = s.since('right') >= 0 ? lerp(-3, 4, s.ease('right', 1.6, 0.4)) : s.since('wrong') >= 0 ? lerp(0, -3, s.ease('wrong', 1.6, 0.4)) : 0;
      const wt = sigmoid(-m);
      s.alpha(p1, () => {
        // the pair and its arrows
        const [x, y, ww, hh] = left;
        const bw = Math.min(ww * 0.3, u * 22);
        const bh = Math.min(hh * 0.3, u * 13);
        const cy = y + hh * 0.5;
        const room = hh / 2 - bh / 2 - u * 2;
        const xs = [x + ww * 0.28, x + ww * 0.72];
        (['y_w', 'y_l'] as const).forEach((t, j) => {
          const k: K = j ? 'red' : 'green';
          s.rrect(xs[j]! - bw / 2, cy - bh / 2, bw, bh, 2, { fill: s.tint(k, 0.1), stroke: s.c(k), lw: 0.45 });
          s.text(t, xs[j]!, cy - u * 1.5, { font: 'mono', size: 4.2, weight: 700, color: s.c(k) });
          s.text(j ? 'rejected' : 'chosen', xs[j]!, cy + u * 3, { font: 'ui', size: 3.3, color: s.c('--ink-2') });
          const a = s.ease(j ? 'down' : 'up', 0.5);
          const len = Math.max(u * 2, (u * 2.5 + (room - u * 2.5) * wt) * a);
          s.alpha(a, () => {
            const y0 = j ? cy + bh / 2 + u : cy - bh / 2 - u;
            const y1 = j ? y0 + len : y0 - len;
            s.arrow(xs[j]!, y0, xs[j]!, y1, s.c('teal'), 0.9, 2.6);
            s.text(j ? 'lower' : 'raise', xs[j]! + u * 2.5, (y0 + y1) / 2, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c('teal'), halo: true });
          });
        });
        // the weight curve
        const cA = s.ease('weight', 0.6);
        s.alpha(cA, () => {
          const f = new Frame(s, [right[0] + u * 5, right[1] + u * 2, right[2] - u * 6, right[3] - u * 8], [-6, 6, 0, 1]);
          f.hline(0, s.c('--axis'), 0.35);
          f.hline(1, s.c('--grid'), 0.25);
          f.vline(0, s.c('--grid'), 0.3);
          s.text('1', f.X(-6) - u * 1.5, f.Y(1), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
          s.text('0', f.X(-6) - u * 1.5, f.Y(0), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
          s.text('weight σ(−m)', f.X(6), f.Y(0.88), { font: 'ui', size: 3.4, weight: 600, align: 'right', color: s.c('teal'), halo: true });
          s.text('margin m  →', f.X(6), f.Y(0) + u * 4, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
          f.fn((z) => sigmoid(-z), s.c('teal'), 0.7, -6, -6 + 12 * s.ease('weight', 1.2, 0.2));
          f.dot(m, wt, 1.5, s.c('teal'));
          s.text(`${fmt2(wt)}`, f.X(m) + u * 2.5, f.Y(wt) - u * 3.5, { font: 'mono', size: 3.6, weight: 650, align: 'left', color: s.c('teal'), halo: true });
          s.alpha(s.win('wrong', 'right'), () => s.text('ranked wrong: pull hard', f.X(-6), f.Y(0) + u * 4, { font: 'ui', size: 3.3, weight: 600, align: 'left', color: s.c('teal') }));
          s.alpha(s.ease('right', 0.6, 1.2), () => s.text('already right: let go', f.X(-6), f.Y(0) + u * 4, { font: 'ui', size: 3.3, weight: 600, align: 'left', color: s.c('teal') }));
        });
      });
    }
    // the mini-batch
    const p2 = s.win('batch', 'nosample');
    if (p2 > 0) {
      const naive = s.since('naive') >= 0 ? 1 : 0;
      const k = naive ? Math.min(9, Math.floor(s.prog('naive') * 1.25 * 9.99)) : s.since('steps') >= 0 ? Math.min(9, Math.floor(s.prog('steps') * 1.2 * 9.99)) : 0;
      const rows = (naive ? TRAJ_NAIVE : TRAJ)[k]!;
      s.slot('t', k);
      const r = area(s, 0.2);
      const bw = Math.min(r[2], u * 130);
      s.alpha(p2, () => {
        const label = naive ? `naive version, step ${k}` : `DPO, step ${k}`;
        s.text(label, w / 2, h * 0.17, { font: 'ui', size: 3.6, weight: 600, color: s.c(naive ? 'red' : '--accent') });
        batchRows(s, [r[0] + (r[2] - bw) / 2, r[1] + u * 2, bw, r[3] - u * 2], rows, naive);
      });
    }
    const p3 = s.ease('nosample', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const bw = Math.min(w * 0.86, u * 120);
        const bx = (w - bw) / 2;
        const rows: [string, string, boolean][] = [
          ['needs', 'log π of two answers someone already wrote', true],
          ['never', 'a sample from the policy', false],
        ];
        rows.forEach(([a, b, ok], i) => {
          const y = h * (0.36 + i * 0.22);
          s.rrect(bx, y - u * 7, bw, u * 14, 2, { fill: s.tint(ok ? 'green' : 'red', 0.07), stroke: s.tint(ok ? 'green' : 'red', 0.5), lw: 0.35 });
          mark(s, bx + u * 7, y, u * 3, ok);
          s.text(a, bx + u * 13, y - u * 2.6, { font: 'ui', size: 3.6, weight: 700, align: 'left', color: s.c(ok ? 'green' : 'red') });
          s.text(b, bx + u * 13, y + u * 2.6, { font: 'ui', size: fit(s, b, bw - u * 16, 3.6, { font: 'ui' }), align: 'left' });
        });
        const t = 'supervised learning, with a cleverly chosen loss';
        s.text(t, w / 2, h * 0.84, { size: fit(s, t, w * 0.9, 4.2, { italic: true }), italic: true, color: s.c('--accent') });
      });
    }
  },
};

// ---------------------------------------------------------------- 9 beta

const betaScene: SceneDef = {
  draw(s) {
    const { u } = s;
    const p1 = s.win('twice', 'loss');
    if (p1 > 0) {
      const beta = s.since('large') >= 0 ? keys(s.since('large'), [[0.3, 0.15], [2.5, 4]]) : s.since('small') >= 0 ? keys(s.since('small'), [[0.3, 1], [2.5, 0.15]]) : 1;
      s.slot('beta', fmt2(beta));
      const st = piStar(beta).p;
      const r = area(s, 0.2);
      s.alpha(p1, () => {
        s.text('π* (blue) against π_ref (orange)', r[0], r[1] + u * 1, { font: 'ui', size: 3.3, align: 'left', color: s.c('--ink-2') });
        pill(s, `β = ${fmt2(beta)}`, r[0] + r[2], r[1] + u * 1, 'slate', { size: 3.8, align: 'right' });
        bars(s, [r[0], r[1] + u * 8, r[2], r[3] - u * 8], [
          { vals: PI_REF, k: 'orange', kind: 'line' },
          { vals: st, k: 'blue', kind: 'fill' },
        ], { hi: 1.05, short: SHORT, values: 1 });
      });
    }
    const p2 = s.ease('loss', 0.6);
    if (p2 > 0) {
      const typ = s.since('typical') >= 0;
      s.slot('beta', typ ? '0.1' : '(1, 0.3, 0.1)');
      const r = area(s, 0.17);
      const f = new Frame(s, [r[0] + u * 6, r[1] + u * 3, r[2] - u * 7, r[3] - u * 11], [-5, 40, 0, 1.25]);
      const betas: [number, number, string][] = [[1, 1, 'loss'], [0.3, 0.62, 'stretch'], [0.1, 0.38, 'stretch']];
      const ex = s.ease('example', 0.6, 0.6);
      s.alpha(p2, () => {
        f.hline(0, s.c('--axis'), 0.35);
        f.vline(0, s.c('--grid'), 0.3);
        for (const y of [0.5, 1]) {
          f.hline(y, s.c('--grid'), 0.2);
          s.text(String(y), f.X(-5) - u * 1.5, f.Y(y), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        }
        s.alpha(1 - ex, () => {
          for (const x of [0, 10, 20, 30]) s.text(String(x), f.X(x), f.Y(0) + u * 3.2, { font: 'mono', size: 3.3, color: s.c('--ink-3') });
        });
        s.text('loss for one pair', f.X(19), f.Y(1.2), { font: 'ui', size: 3.3, color: s.c('--ink-3') });
        s.text('log-ratio gap h  →', f.X(40), f.Y(0) + u * 7.5, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
        betas.forEach(([b, a, beat], i) => {
          const e = s.ease(beat, 1.2, i === 2 ? 1.6 : 0.3);
          const hot = typ && b === 0.1 ? 1 : 0;
          s.alpha(e, () => {
            f.fn((x) => -logSigmoid(b * x), s.tint(hot ? '--accent' : '--ink', hot ? 1 : a), 0.6 + 0.3 * hot);
            const ly = f.Y(1.12) + i * u * 5;
            const lx = f.X(40);
            s.line(lx - u * 22, ly, lx - u * 17, ly, s.tint(hot ? '--accent' : '--ink', hot ? 1 : a), 0.7);
            s.text(`β = ${b}`, lx - u * 15, ly, { font: 'mono', size: 3.4, weight: 650, align: 'left', color: s.c(hot ? '--accent' : '--ink'), halo: true });
          });
        });
        s.alpha(ex, () => {
          const L = -logSigmoid(3);
          for (const [hx, lab] of [[3, 'h = 3'], [30, 'h = 30']] as [number, string][]) {
            s.line(f.X(hx), f.Y(0), f.X(hx), f.Y(L), s.c('--accent'), 0.35, [1, 0.8]);
            f.dot(hx, L, 1.3, s.c('--accent'));
            s.text(lab, f.X(hx), f.Y(0) + u * 3.4, { font: 'mono', size: 3.4, weight: 650, color: s.c('--accent') });
          }
          s.text('same margin m = 3', f.X(16.5), f.Y(0.42), { font: 'ui', size: 3.4, color: s.c('--ink-2'), halo: true });
        });
        s.alpha(s.ease('price', 0.6), () => {
          s.text('β is a price, not a wall', f.X(17), f.Y(0.75), { size: 4.4, italic: true, color: s.c('--accent'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 10 the run

const run: SceneDef = {
  draw(s) {
    const { u } = s;
    const p = s.since('loop') < 0 ? 0 : clamp01((s.t - s.at('loop')) / Math.max(0.1, s.at('land') - s.at('loop')));
    const k = Math.round(400 * Math.pow(p, 2.2));
    s.slot('step', k);
    s.slot('loss', f3(RUN.losses[k]!));
    const [left, right] = split(s, area(s, 0.15), s.tall ? 0.6 : 0.58, 4);
    const items: [string, K, number][] = [['π_ref', 'orange', 1], ['π_θ', 'blue', 1], ['π* (dashed)', 'blue', s.ease('init', 0.6)]];
    let lx = left[0];
    for (const [t, kk, a] of items) {
      s.alpha(a, () => s.text(t, lx, left[1] + u * 5, { font: 'ui', size: 3.3, weight: 600, align: 'left', color: s.c(kk) }));
      lx += s.measure(t, { font: 'ui', size: 3.3, weight: 600 }) + u * 3;
    }
    bars(s, [left[0], left[1] + u * 9, left[2], left[3] - u * 9], [
      { vals: PI_REF, k: 'orange', kind: 'line' },
      { vals: RUN.pis[k]!, k: 'blue', kind: 'fill' },
      { vals: STAR_RUN, k: 'blue', kind: 'dash', a: s.ease('init', 0.6) },
    ], { hi: 0.75, short: SHORT, values: 1 });
    const [x, y, w, h] = right;
    // the data, until training starts
    s.alpha(s.win('data', 'loop'), () => {
      const top = PAIRS.flatMap((row, wi) => row.map((c, li) => ({ wi, li, c }))).filter((q) => q.c > 0).sort((a, b) => b.c - a.c).slice(0, 4);
      s.text('1,000 pairs, fixed, for example:', x + w / 2, y + u * 3, { font: 'ui', size: 3.6, weight: 600 });
      top.forEach((q, i) => {
        const cols = s.tall ? 2 : 1;
        const cx = x + (s.tall ? w * (0.12 + 0.5 * (i % cols)) : w * 0.3);
        const yy = y + u * 10 + Math.floor(i / cols) * u * 6.5;
        const tw = pairTag(s, q.wi, q.li, cx, yy, 3.6);
        s.text(`× ${q.c}`, cx + tw + u * 2, yy, { font: 'mono', size: 3.4, align: 'left', color: s.c('--ink-2') });
      });
    });
    const lA = s.ease('loop', 0.6);
    s.alpha(lA, () => {
      const plotW = s.tall ? w * 0.58 : w - u * 7;
      const plotH = s.tall ? h - u * 6 : h * 0.45;
      const f = new Frame(s, [x + u * 6, y + u * (s.tall ? 3 : 9), plotW - u * 6, plotH], [0, 400, 0.38, 0.72]);
      f.hline(Math.LN2, s.tint('--ink-3', 0.8), 0.25, [1, 1]);
      for (const v of [0.4, 0.5, 0.6, 0.7]) s.text(v.toFixed(1), f.X(0) - u * 1.5, f.Y(v), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
      f.hline(0.38, s.c('--axis'), 0.3);
      s.text('loss', f.X(400), f.Y(0.72) - u * 1.5, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-2') });
      const xs = Array.from({ length: k + 1 }, (_, i) => i);
      f.path(xs, RUN.losses, s.c('--ink'), 0.6, k + 1);
      const tx = s.tall ? x + plotW + u * 3 : x + u * 6;
      const ty = s.tall ? y + u * 5 : f.rect[1] + f.rect[3] + u * 6;
      const lines: [string, K, number][] = [
        [`step ${k}`, '--ink', 1],
        [`loss ${f3(RUN.losses[k]!)}`, '--ink', 1],
        ['sampled: 0', '--accent', s.ease('never', 0.5)],
        [`accuracy ${Math.round(RUN.acc * 100)}%`, 'purple', s.ease('noisy', 0.5)],
      ];
      lines.forEach(([t, kk, a], i) => s.alpha(a, () => s.text(t, tx, ty + i * u * 5.6, { font: 'mono', size: 3.4, weight: i > 1 ? 650 : 500, align: 'left', color: s.c(kk) })));
    });
  },
};

// ---------------------------------------------------------------- 11 the recipe

const TOK_P = ['How', ' do', ' I', ' reverse', ' a', ' list', '?'];
const TOK_Y = ['xs', '[::', '-1', ']'];
const TOK_LP = [-0.4, -1.2, -0.3, -0.1];

const recipe: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const p1 = s.win('real', 'two');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const size = 3.4;
        const seqA = s.ease('seq', 0.6);
        const rows: { toks: string[]; ans: boolean; y: number }[] = [
          { toks: TOK_P, ans: false, y: h * 0.3 },
          { toks: TOK_Y, ans: true, y: h * 0.47 },
        ];
        rows.forEach((row) => {
          const ws = row.toks.map((t, i) => Math.max(pillW(s, t.trim(), size), row.ans ? s.measure(String(TOK_LP[i]).replace('-', '−'), { font: 'mono', size: 3.4 }) + u * 2.5 : 0));
          const tot = ws.reduce((a, b) => a + b + u, -u);
          let xx = (w - tot) / 2;
          s.alpha(row.ans ? seqA : 1, () => {
            row.toks.forEach((t, i) => {
              pill(s, t.trim(), xx, row.y, row.ans ? 'blue' : '--ink-3', { size, align: 'left', fill: row.ans ? 0.14 : 0.06 });
              if (row.ans) s.text(String(TOK_LP[i]).replace('-', '−'), xx + ws[i]! / 2, row.y + u * 6, { font: 'mono', size: 3.4, color: s.c('blue') });
              xx += ws[i]! + u;
            });
          });
          if (!row.ans) s.alpha(seqA, () => s.text('the prompt: masked out', w / 2, row.y + u * 6, { font: 'ui', size: 3.3, color: s.c('--ink-3') }));
        });
        s.alpha(seqA * s.ease('seq', 0.6, 3), () => {
          const t = 'log π(y | x) = −0.4 − 1.2 − 0.3 − 0.1 = −2.0';
          s.text(t, w / 2, h * 0.66, { font: 'mono', size: fit(s, t, w * 0.92, 3.8, { font: 'mono' }), weight: 600, color: s.c('blue') });
          s.text('example numbers: one forward pass, then a sum', w / 2, h * 0.73, { font: 'ui', size: 3.3, color: s.c('--ink-3') });
        });
        s.alpha(1 - seqA, () => s.text('on a real language model', w / 2, h * 0.75, { font: 'display', size: 5.5, weight: 600 }));
      });
    }
    const p2 = s.win('two', 'compare');
    if (p2 > 0) {
      s.alpha(p2, () => {
        const [ax, ay, aw, ah] = area(s, 0.16);
        const bw = Math.min(aw * 0.4, u * 40);
        const bh = Math.min(ah * 0.2, u * 16);
        const my = ay + ah * 0.45;
        const px = ax + aw * 0.28;
        const rx = ax + aw * 0.72;
        box(s, px - bw / 2, my - bh / 2, bw, bh, 'policy', 'blue', { sub: 'trains', size: 4.2 });
        box(s, rx - bw / 2, my - bh / 2, bw, bh, 'reference', 'orange', { sub: 'frozen', size: 4.2 });
        s.alpha(s.ease('cache', 0.6), () => pill(s, 'computed once', rx, my - bh / 2 - u * 4, 'orange', { size: 3.3, font: 'ui' }));
        // the pairs
        s.alpha(s.ease('pairs', 0.6), () => {
          const py = ay + ah * 0.1;
          for (let k = 0; k < 3; k++) {
            s.rrect(ax + aw / 2 - u * 14 + k * u * 1.2, py - u * 4 + k * u * 1.2, u * 12, u * 8, 1, { fill: s.tint('green', 0.15), stroke: s.c('green'), lw: 0.3 });
            s.rrect(ax + aw / 2 + u * 2 + k * u * 1.2, py - u * 4 + k * u * 1.2, u * 12, u * 8, 1, { fill: s.tint('red', 0.15), stroke: s.c('red'), lw: 0.3 });
          }
          s.text('y_w', ax + aw / 2 - u * 6.6, py + u * 1.6, { font: 'mono', size: 3.3, weight: 700, color: s.c('green') });
          s.text('y_l', ax + aw / 2 + u * 9.4, py + u * 1.6, { font: 'mono', size: 3.3, weight: 700, color: s.c('red') });
          s.arrow(ax + aw / 2 - u * 6, py + u * 6, px, my - bh / 2 - u * 1, s.c('--ink-3'), 0.35, 2);
          s.arrow(ax + aw / 2 + u * 6, py + u * 6, rx, my - bh / 2 - u * (s.ease('cache', 0.6) > 0.5 ? 8 : 1), s.c('--ink-3'), 0.35, 2);
        });
        s.alpha(s.ease('train', 0.6), () => {
          const ly = ay + ah * 0.82;
          box(s, ax + aw / 2 - bw / 2, ly - bh / 2, bw, bh, 'DPO loss', '--accent', { sub: 'a few passes, small lr', size: 4.2 });
          s.arrow(px, my + bh / 2 + u, ax + aw / 2 - bw * 0.25, ly - bh / 2 - u, s.c('--ink-3'), 0.35, 2);
          s.arrow(rx, my + bh / 2 + u, ax + aw / 2 + bw * 0.25, ly - bh / 2 - u, s.c('--ink-3'), 0.35, 2);
          s.text('gradient flows back to the policy', ax + aw / 2, ly + bh / 2 + u * 4, { font: 'ui', size: 3.3, color: s.c('teal') });
          s.line(ax + aw / 2 - bw / 2 - u, ly, px - bw / 2 + u * 2, my + bh / 2 + u * 2, s.c('teal'), 0.4, [1, 0.8]);
        });
      });
    }
    const p3 = s.ease('compare', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const bw = Math.min(w * 0.9, u * 140);
        const bx = (w - bw) / 2;
        const c0 = bx + bw * 0.03;
        const c1 = bx + bw * 0.52;
        const c2 = bx + bw * 0.8;
        const top = h * 0.22;
        s.text('PPO', c1, top, { font: 'display', size: 4.6, weight: 600, color: s.c('red') });
        s.text('DPO', c2, top, { font: 'display', size: 4.6, weight: 600, color: s.c('--accent') });
        const rows: [string, string, string][] = [
          ['models in memory', '4', '2'],
          ['samples per step', 'many', '0'],
          ['main settings', 'many', 'β, lr'],
        ];
        rows.forEach(([a, b, c], i) => {
          const y = top + u * 11 + i * u * 10;
          const a2 = s.ease('compare', 0.5, 1 + i * 1.6);
          s.alpha(a2, () => {
            s.rrect(bx, y - u * 4.2, bw, u * 8.4, 1.4, { fill: s.tint('--ink-3', 0.06) });
            s.text(a, c0, y, { font: 'ui', size: fit(s, a, c1 - c0 - u * 8, 3.6, { font: 'ui' }), align: 'left' });
            s.text(b, c1, y, { font: 'mono', size: 3.8, weight: 600, color: s.c('red') });
            s.text(c, c2, y, { font: 'mono', size: 3.8, weight: 650, color: s.c('--accent') });
          });
        });
        s.alpha(s.ease('spread', 0.6), () => {
          const y = top + u * 46;
          const t1 = 'Zephyr · 2023';
          const t2 = 'Llama 3 · 2024';
          const w1 = pillW(s, t1, 3.6, 'ui');
          const w2 = pillW(s, t2, 3.6, 'ui');
          const x0 = (w - w1 - w2 - u * 4) / 2;
          pill(s, t1, x0, y, '--accent', { size: 3.6, font: 'ui', align: 'left' });
          pill(s, t2, x0 + w1 + u * 4, y, '--accent', { size: 3.6, font: 'ui', align: 'left' });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 12 limits and variants

const limits: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const p1 = s.win('same', 'certain');
    if (p1 > 0) {
      const r = area(s, 0.2);
      const f = new Frame(s, [r[0], r[1] + u * 4, r[2], r[3] - u * 4], [0, 10, 0, 6]);
      const dx = lerp(3, 7, s.ease('explore', 2.5, 2));
      s.alpha(p1, () => {
        s.circle(f.X(3), f.Y(3), Math.min(f.kx, f.ky) * 2.1, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.3), lw: 0.3 });
        for (const d of DOTS.data) s.circle(f.X(d.x), f.Y(d.y), u * 0.9, { fill: s.c(d.good ? 'green' : 'red') });
        s.text('labeled pairs', f.X(3), f.Y(5.6), { font: 'ui', size: 3.4, weight: 600, color: s.c('--ink-2') });
        s.circle(f.X(dx), f.Y(3.2), Math.min(f.kx, f.ky) * 1.1, { fill: s.tint('blue', 0.18), stroke: s.c('blue'), lw: 0.5 });
        s.text('policy', f.X(dx), f.Y(3.2) + u * 0.3, { font: 'ui', size: 3.4, weight: 650, color: s.c('blue'), halo: true });
        const away = s.ease('explore', 0.8, 4.5) * (1 - s.ease('online', 0.8, 1));
        s.alpha(away, () => {
          for (const [ox, oy] of [[-1, 1.3], [1.2, 1.1], [1.4, -1.1], [-0.6, -1.4]]) s.text('?', f.X(7 + ox!), f.Y(3.2 + oy!), { font: 'display', size: 5, weight: 600, color: s.c('--ink-3') });
          s.text('text nobody judged', f.X(7), f.Y(0.6), { font: 'ui', size: 3.4, color: s.c('--ink-2') });
        });
        const nOn = Math.floor(s.prog('online') * 1.3 * DOTS.fresh.length);
        if (s.since('online') >= 0) for (let i = 0; i < Math.min(nOn, DOTS.fresh.length); i++) s.circle(f.X(DOTS.fresh[i]!.x), f.Y(DOTS.fresh[i]!.y), u * 0.9, { fill: s.c(DOTS.fresh[i]!.good ? 'green' : 'red') });
        s.alpha(s.ease('online', 0.6, 1), () => s.text('online DPO: sample, label, retrain', f.X(5), f.Y(0.3), { font: 'ui', size: 3.4, weight: 600, color: s.c('--accent') }));
      });
    }
    const p2 = s.win('certain', 'both');
    if (p2 > 0) {
      const r = area(s, 0.2);
      const f = new Frame(s, [r[0] + u * 6, r[1] + u * 6, r[2] - u * 7, r[3] - u * 14], [0, 600, 0, 17]);
      const nd = Math.floor(600 * clamp01((s.t - s.at('certain') - 0.8) / Math.max(1, s.at('ipo') - s.at('certain'))));
      const ni = Math.floor(600 * s.ease('ipo', 2.5, 0.5));
      s.alpha(p2, () => {
        s.text('every label: A ≻ B', r[0], r[1] + u * 1, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c('--ink-2') });
        f.hline(0, s.c('--axis'), 0.35);
        for (const y of [5, 10, 15]) {
          f.hline(y, s.c('--grid'), 0.2);
          s.text(String(y), f.X(0) - u * 1.5, f.Y(y), { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
        }
        s.text('training step  →', f.X(600), f.Y(0) + u * 4.5, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
        s.text('log-ratio gap h', f.X(0) + u * 1, f.Y(17) - u * 1, { font: 'ui', size: 3.3, align: 'left', color: s.c('--ink-3') });
        const xs = Array.from({ length: 601 }, (_, i) => i);
        f.path(xs, GAP_DPO, s.c('purple'), 0.7, nd + 1);
        if (nd > 30) s.text('DPO: still climbing', f.X(nd), f.Y(GAP_DPO[nd]!) - u * 4, { font: 'ui', size: 3.4, weight: 650, align: nd > 400 ? 'right' : 'left', color: s.c('purple'), halo: true });
        s.alpha(s.ease('push', 0.6, 1), () => s.text(`π(B) = ${sigmoid(-GAP_DPO[Math.max(1, nd)]!).toExponential(1)}`, f.X(600), f.Y(8.5), { font: 'mono', size: 3.4, weight: 650, align: 'right', color: s.c('purple'), halo: true }));
        if (ni > 0) {
          f.path(xs, GAP_IPO, s.c('teal'), 0.7, ni + 1);
          s.alpha(s.ease('ipo', 0.6, 1.5), () => s.text('IPO: stops at 1/(2τ)', f.X(600), f.Y(GAP_IPO[600]!) - u * 3.5, { font: 'ui', size: 3.4, weight: 650, align: 'right', color: s.c('teal'), halo: true }));
        }
      });
    }
    const p3 = s.win('both', 'kto');
    if (p3 > 0) {
      s.alpha(p3, () => {
        const cases: [number, number][] = [[1, -1], [0, -2], [-2, -4]];
        const r = area(s, 0.2);
        const top = r[1] + u * 8;
        const cw = r[2] / 3;
        const f = new Frame(s, [r[0], top, r[2], h * 0.4], [0, 3, -4.5, 1.5]);
        s.text('change in log π during training', w / 2, r[1] + u * 1, { font: 'ui', size: 3.4, weight: 600, color: s.c('--ink-2') });
        f.hline(0, s.c('--axis'), 0.35);
        cases.forEach(([dw, dl], i) => {
          const a = s.ease('both', 0.5, 1.2 + i * 0.9);
          s.alpha(a, () => {
            const xs = [i + 0.34, i + 0.66];
            [dw, dl].forEach((v, j) => {
              const k: K = j ? 'red' : 'green';
              const x0 = f.X(xs[j]! - 0.12);
              const x1 = f.X(xs[j]! + 0.12);
              s.rrect(x0, Math.min(f.Y(0), f.Y(v)), x1 - x0, Math.max(1, Math.abs(f.Y(v) - f.Y(0))), 0.4, { fill: s.tint(k, 0.7) });
              s.text((v > 0 ? '+' : '') + v, f.X(xs[j]!), v >= 0 ? f.Y(v) - u * 2.5 : f.Y(v) + u * 2.8, { font: 'mono', size: 3.3, weight: 600, halo: true });
            });
            s.text('gap 2', f.X(i + 0.5), f.Y(-4.5) + u * 4, { font: 'mono', size: 3.3, color: s.c('purple') });
          });
        });
        s.alpha(s.ease('both', 0.6, 4), () => {
          const t = 'same gap, same loss: the loss cannot tell them apart';
          s.text(t, w / 2, f.rect[1] + f.rect[3] + u * 11, { size: fit(s, t, w * 0.9, 3.8, { italic: true }), italic: true, color: s.c('--accent') });
        });
        s.alpha(s.ease('length', 0.6), () => {
          const t = 'longer chosen answers teach: longer is better';
          pill(s, t, w / 2, f.rect[1] + f.rect[3] + u * 20, 'gold', { size: fit(s, t, w * 0.8, 3.5, { font: 'ui' }), font: 'ui' });
        });
        void cw;
      });
    }
    const p4 = s.ease('kto', 0.6);
    if (p4 > 0) {
      s.alpha(p4, () => {
        const cards: [string, string, string, string][] = [
          ['IPO', '2023', 'squared loss, fixed target gap', 'kto'],
          ['KTO', '2024', 'thumbs up or down, no pairs', 'kto'],
          ['SimPO', '2024', 'no reference; mean log π per token', 'simpo'],
        ];
        const bw = Math.min(w * 0.88, u * 120);
        const bx = (w - bw) / 2;
        cards.forEach(([n, y, d, b], i) => {
          const a = s.ease(b, 0.5, b === 'kto' && i === 1 ? 1.4 : 0.2);
          const cy = h * (0.3 + i * 0.2);
          s.alpha(a, () => {
            s.rrect(bx, cy - u * 7, bw, u * 14, 2, { fill: s.tint('--accent', 0.06), stroke: s.tint('--accent', 0.4), lw: 0.35 });
            s.text(n, bx + u * 4, cy - u * 2.4, { font: 'display', size: 4.8, weight: 600, align: 'left', color: s.c('--accent') });
            s.text(y, bx + bw - u * 4, cy - u * 2.4, { font: 'mono', size: 3.3, align: 'right', color: s.c('--ink-3') });
            s.text(d, bx + u * 4, cy + u * 3.4, { font: 'ui', size: fit(s, d, bw - u * 8, 3.6, { font: 'ui' }), align: 'left', color: s.c('--ink-2') });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 13 outro

const SUBS = ['E[r] − β·KL(π ‖ π_ref)', 'π* = π_ref · e^(r/β) / Z', 'r = β log(π*/π_ref) + β log Z', 'only differences of r: Z drops out', '−log σ(β · log-ratio gap)'];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const ids = ['s1', 's2', 's3', 's4', 's5'];
    const fadeOut = 1 - s.ease('next', 0.6);
    const [ax, ay, aw, ah] = area(s, 0.19);
    const bw = Math.min(aw, u * 130);
    s.alpha(fadeOut, () => {
      stepList(s, [ax + (aw - bw) / 2, ay, bw, ah * 0.86], (i) => s.ease('recap', 0.6) * (0.35 + 0.65 * s.ease(ids[i]!, 0.5)), (i) => SUBS[i]!, (i) => s.ease(ids[i]!, 0.4, 1.5));
      s.alpha(s.ease('grad', 0.6), () => pill(s, 'gradient weight σ(−m): how wrong, how hard', w / 2, ay + ah * 0.93, 'teal', { size: fit(s, 'gradient weight σ(−m): how wrong, how hard', aw * 0.85, 3.6, { font: 'ui' }), font: 'ui' }));
    });
    s.alpha(s.ease('next', 0.7, 0.3), () => {
      s.text('next: verifiable rewards', w / 2, h * 0.42, { size: fit(s, 'next: verifiable rewards', w * 0.9, 6.2, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      const t = 'a program grades the answer, and GRPO learns';
      s.text(t, w / 2, h * 0.55, { size: fit(s, t, w * 0.9, 3.9, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  bt,
  objective: objectiveScene,
  optimal,
  invert,
  cancel,
  loss: lossScene,
  gradient,
  beta: betaScene,
  run,
  recipe,
  limits,
  outro,
};
