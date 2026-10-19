import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { type Plot, color, rgbOf, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { RLHF_SYMBOLS } from '../lib/rlhf-symbols';
import * as T from '../lib/rlhf-toy';
import { arrow, box, label, line, measure, sizeTo, wrap } from '../lib/rlhf-draw';

const ink = (k: '--ink' | '--ink-2' | '--ink-3' = '--ink'): string => color(k);

// ---------------------------------------------------------------- Fig 1: the pipeline

interface Chip {
  title: string;
  body: string;
  extra?: 'abcd' | 'rank';
}

const STAGES: { name: string; k: Color; chips: Chip[] }[] = [
  {
    name: '1. Supervised fine-tuning',
    k: 'orange',
    chips: [
      { title: 'A prompt', body: '“Explain the moon landing to a 6 year old”' },
      { title: 'A labeler writes an answer', body: '“Some people went to the moon...”' },
      { title: 'Fine-tune on the answers', body: 'cross-entropy on the answer tokens: the SFT model' },
    ],
  },
  {
    name: '2. Reward model',
    k: 'gold',
    chips: [
      { title: 'SFT writes several answers', body: '', extra: 'abcd' },
      { title: 'A labeler ranks them', body: '', extra: 'rank' },
      { title: 'Fit the reward model', body: 'on every pair, with the Bradley-Terry loss' },
    ],
  },
  {
    name: '3. Reinforcement learning',
    k: 'blue',
    chips: [
      { title: 'The policy answers', body: 'a new prompt; it starts as a copy of SFT' },
      { title: 'Score the answer', body: 'reward model, minus β times the KL to SFT' },
      { title: 'PPO update', body: 'then sample again with the new policy' },
    ],
  },
];

const PIPE_STEPS: [string | string[], string][] = [
  [['base', 'demo'], '**A prompt** from the prompt set. InstructGPT drew its prompts from labelers and from early users of the OpenAI API.'],
  ['demo', '**A labeler writes the answer they would want.** Demonstrations are slow to write, so this is the smallest dataset: about 13,000 prompts.'],
  ['sft', '**Supervised fine-tuning** ([Chapter 13](#/finetuning)): cross-entropy on those answers. The SFT model follows instructions, but only as well as it imitates.'],
  ['sample', '**The SFT model writes several answers** (4 to 9) to each of about 33,000 prompts.'],
  ['rank', '**A labeler ranks them**, best to worst. Ranking is much quicker than writing, and a ranking of $K$ answers holds $K(K-1)/2$ pairs.'],
  ['rm', '**The reward model** (in InstructGPT a 6-billion-parameter model with a scalar head) learns to score answers so that winners outscore losers.'],
  [['init', 'gen'], '**The policy starts as a copy of the SFT model** and answers about 31,000 new prompts. No human writes or ranks anything in this stage.'],
  ['score', '**The reward model scores each answer**, and a KL penalty charges for drifting away from the frozen SFT model.'],
  ['update', '**PPO updates the policy** toward higher-scoring answers, then samples again with the new policy, and repeats.'],
];

function pipelineFigure(f: Fig): void {
  let cur = 0;
  const pl = f.plot({
    aspect: 2.2,
    square: false,
    domain: [0, 1, 0, 1],
    draw: (p) => drawPipeline(p),
  });
  pl.canvas.classList.add('scroll-ok');
  function drawPipeline(p: Plot): void {
    const ctx = p.ctx;
    const w = p.w;
    const narrow = w < 600;
    const pad = 10;
    const gapX = 16;
    const colW = narrow ? w - 2 * pad : (w - 2 * pad - 2 * gapX) / 3;
    const fs = 12.5;
    const head = 24;
    const between = narrow ? 14 : 20;
    const chipW = (s: number) => colW - (s === 2 ? 18 : 0);
    const bodyLines = (c: Chip, cw: number) => (c.body ? wrap(ctx, c.body, cw - 20, { size: fs - 1 }) : []);
    const chipH = (c: Chip, cw: number) => 10 + 16 + (c.extra ? 24 : bodyLines(c, cw).length * 15) + 8;
    // Layout: chip rectangles in reading order.
    const rects: [number, number, number, number][] = [];
    const heads: [number, number][] = [];
    let total = 0;
    if (narrow) {
      let y = pad;
      STAGES.forEach((st, s) => {
        heads.push([pad, y]);
        y += head;
        st.chips.forEach((c, i) => {
          const cw = chipW(s);
          const hh = chipH(c, cw);
          rects.push([pad, y, cw, hh]);
          y += hh + (i < 2 ? between : 0);
        });
        y += 22;
      });
      total = y - 22 + pad;
    } else {
      STAGES.forEach((st, s) => {
        const x = pad + s * (colW + gapX);
        let y = pad;
        heads.push([x, y]);
        y += head;
        st.chips.forEach((c) => {
          const cw = chipW(s);
          const hh = chipH(c, cw);
          rects.push([x, y, cw, hh]);
          y += hh + between;
        });
        total = Math.max(total, y - between + pad);
      });
    }
    sizeTo(p, total);
    // Stage headers.
    STAGES.forEach((st, s) => {
      const [x, y] = heads[s]!;
      const active = Math.floor(cur / 3) === s;
      label(ctx, st.name, x + 2, y + 9, { size: 13, weight: 700, color: active ? color(st.k) : ink('--ink-2') });
    });
    // Arrows between chips.
    const arrowCol = (i: number) => (i === cur ? color(STAGES[Math.floor(i / 3)]!.k) : withAlpha(ink('--ink-3'), 0.7));
    for (let i = 0; i < 9; i++) {
      const [x, y, cw] = rects[i]!;
      if (i % 3 > 0) {
        const [px, py, , ph] = rects[i - 1]!;
        arrow(ctx, px + cw / 2, py + ph + 2, x + cw / 2, y - 2, arrowCol(i), 1.5, 7);
      } else if (i > 0 && narrow) {
        const [, py, , ph] = rects[i - 1]!;
        const ax = x + Math.min(cw, rects[i - 1]![2]) / 2;
        arrow(ctx, ax, py + ph + 2, ax, y - head - 2, arrowCol(i), 1.5, 7);
      }
    }
    if (!narrow) {
      // SFT feeds stage 2; the reward model feeds the scoring step.
      const [ax, ay, aw, ah] = rects[2]!;
      const [bx, by] = rects[3]!;
      arrow(ctx, ax + aw + 2, ay + ah / 2, bx - 3, by + 14, cur === 3 ? color('orange') : withAlpha(ink('--ink-3'), 0.7), 1.5, 7);
      const [cx, cy, cwid, ch] = rects[5]!;
      const [dx, dy, , dh] = rects[7]!;
      arrow(ctx, cx + cwid + 2, cy + ch / 2, dx - 3, dy + dh / 2, cur === 7 ? color('gold') : withAlpha(ink('--ink-3'), 0.7), 1.5, 7);
    }
    // The PPO loop: from the update back to sampling.
    {
      const [x0, y0, w0, h0] = rects[6]!;
      const [, y2, , h2] = rects[8]!;
      const xr = x0 + w0 + 10;
      const col = cur === 8 ? color('blue') : withAlpha(ink('--ink-3'), 0.7);
      ctx.beginPath();
      ctx.moveTo(x0 + w0 + 2, y2 + h2 / 2);
      ctx.lineTo(xr, y2 + h2 / 2);
      ctx.lineTo(xr, y0 + h0 / 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      arrow(ctx, xr, y0 + h0 / 2, x0 + w0 + 3, y0 + h0 / 2, col, 1.5, 7);
    }
    // Chips.
    STAGES.forEach((st, s) =>
      st.chips.forEach((c, i) => {
        const idx = s * 3 + i;
        const [x, y, cw, hh] = rects[idx]!;
        const on = idx === cur;
        const a = idx > cur ? 0.5 : 1;
        const k = color(st.k);
        ctx.globalAlpha = a;
        box(ctx, x, y, cw, hh, 8, withAlpha(k, on ? 0.2 : 0.07), on ? k : withAlpha(k, 0.5), on ? 2 : 1);
        label(ctx, c.title, x + 10, y + 10 + 8, { size: fs, weight: 650, color: ink() });
        if (c.extra === 'abcd') {
          ['A', 'B', 'C', 'D'].forEach((L, j) => {
            box(ctx, x + 10 + j * 30, y + 30, 24, 20, 4, withAlpha(k, 0.18), withAlpha(k, 0.7), 1);
            label(ctx, L, x + 22 + j * 30, y + 40.5, { size: 12, weight: 650, font: 'mono', align: 'center', color: ink() });
          });
        } else if (c.extra === 'rank') {
          label(ctx, 'D > C > A = B', x + 10, y + 40.5, { size: 13, weight: 650, font: 'mono', color: ink() });
        } else {
          bodyLines(c, cw).forEach((l, j) => label(ctx, l, x + 10, y + 10 + 16 + 8 + j * 15, { size: fs - 1, color: ink('--ink-2') }));
        }
        ctx.globalAlpha = 1;
      }),
    );
  }
  f.stepper({
    steps: PIPE_STEPS.length,
    interval: 2600,
    label: (k) => `step ${k + 1} / ${PIPE_STEPS.length}`,
    onStep: (k) => {
      cur = k;
      f.code.highlight(PIPE_STEPS[k]![0]);
      f.status(PIPE_STEPS[k]![1]);
      pl.redraw();
    },
  });
}

// ---------------------------------------------------------------- Fig 2: the reward model

const RM_LR = 0.05;
const RM_INIT: T.Pt = [-0.6, 0.1];
const RM_STEPS = 200;

function rewardModelFigure(f: Fig): void {
  const held = T.samplePairs(2000, 99);
  const ceiling = T.tasteAccuracy(held);
  let pairs = T.samplePairs(100, 7);
  const rm = new T.LinearRM();
  rm.w = [...RM_INIT];
  let step = 0;
  let showTaste = false;
  const L0 = 0;
  const L1 = 3.6;
  const Q0 = 0.32;
  const Q1 = 0.68;
  const pl = f.plot({
    aspect: 1.15,
    square: false,
    domain: [L0 - 0.38, L1, Q0 - 0.05, Q1],
    draw: (p) => {
      const ctx = p.ctx;
      const [gr, gg, gb] = rgbOf(color('gold'));
      p.field((l, q) => {
        if (l < L0 || q < Q0) return [0, 0, 0, 0];
        const t = T.sigmoid(rm.score([l, q]) / 1.6);
        return [gr, gg, gb, Math.round(10 + 150 * t * t)];
      }, 6);
      // frame and ticks
      const X0 = p.sx(L0);
      const Y0 = p.sy(Q0);
      ctx.strokeStyle = color('--axis');
      ctx.lineWidth = 1;
      ctx.strokeRect(X0, p.sy(Q1), p.sx(L1) - X0, Y0 - p.sy(Q1));
      for (let l = 0; l <= 3.5; l += 0.5) {
        line(ctx, p.sx(l), Y0, p.sx(l), Y0 + 4, color('--axis'));
        if (l % 1 === 0) label(ctx, String(l * 100), p.sx(l), Y0 + 13, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      }
      for (let q = 0.35; q <= 0.66; q += 0.1) {
        line(ctx, X0 - 4, p.sy(q), X0, p.sy(q), color('--axis'));
        label(ctx, q.toFixed(2), X0 - 6, p.sy(q), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      }
      label(ctx, 'length (tokens)', p.sx(L1) - 2, Y0 - 9, { size: 11, align: 'right', color: ink('--ink-2') });
      label(ctx, 'quality', X0 + 6, p.sy(Q1) + 11, { size: 11, color: ink('--ink-2') });
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0, p.sy(Q1), p.sx(L1) - X0, Y0 - p.sy(Q1));
      ctx.clip();
      // reward-model contours: straight lines, since the model is linear
      const [w0, w1] = rm.w;
      if (Math.abs(w1) > 1e-4)
        for (let c = -6; c <= 6; c++) {
          p.fn((l) => T.SFT.q + (T.SFT.sq * (c - (w0 * (l - T.SFT.l)) / T.SFT.sl)) / w1, withAlpha(color('gold'), c === 0 ? 0.95 : 0.6), c === 0 ? 1.6 : 1);
        }
      if (showTaste)
        for (let c = 4; c <= 9.5; c += 0.5) p.fn((l) => (c - 2.5 * l + 0.5 * l * l) / 10, withAlpha(color('green'), 0.85), 1.4, [5, 4]);
      for (let i = 0; i < 60; i++) {
        const pr = pairs[i];
        if (!pr) break;
        const [cx, cy] = [p.sx(pr.chosen[0]), p.sy(pr.chosen[1])];
        const [rx, ry] = [p.sx(pr.rejected[0]), p.sy(pr.rejected[1])];
        const ok = rm.score(pr.chosen) > rm.score(pr.rejected);
        line(ctx, cx, cy, rx, ry, withAlpha(ink('--ink-3'), ok ? 0.4 : 0.85), ok ? 1 : 1.4);
        ctx.beginPath();
        ctx.arc(rx, ry, 3.3, 0, Math.PI * 2);
        ctx.fillStyle = color('--paper');
        ctx.fill();
        ctx.strokeStyle = ink();
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = ink();
        ctx.fill();
      }
      ctx.restore();
    },
  });
  const stepRo = f.readout('step');
  const lossRo = f.readout('loss');
  const accRo = f.readout('held-out accuracy');
  f.readout('labelers’ ceiling').set(`${(ceiling * 100).toFixed(1)}%`);
  const sync = () => {
    const loss = rm.loss(pairs);
    stepRo.set(step);
    lossRo.set(fmt(loss, 3));
    accRo.set(`${(rm.accuracy(held) * 100).toFixed(1)}%`);
    f.code.setMany({ step, w0: fmt(rm.w[0], 3), w1: fmt(rm.w[1], 3), loss: fmt(loss, 3) });
  };
  let phase = 0;
  const loop = f.loop(() => {
    rm.step(pairs, RM_LR);
    step++;
    f.code.highlight(['score', 'margin', 'loss', 'grad', 'update'][Math.floor(phase++ / 4) % 5]!);
    sync();
    pl.redraw();
    if (step >= RM_STEPS) {
      stop();
      f.status(`Trained: ${RM_STEPS} steps. The reward model now ranks about ${Math.round(rm.accuracy(held) * 100)}% of new pairs the way the labelers did.`);
      return false;
    }
  });
  const stop = () => {
    loop.stop();
    btn.textContent = 'Train';
    f.code.highlight(null);
  };
  const btn = f.button(
    'Train',
    () => {
      if (loop.running()) stop();
      else {
        if (step >= RM_STEPS) reset();
        loop.start();
        btn.textContent = 'Pause';
        f.status('');
      }
    },
    { primary: true },
  );
  const reset = () => {
    stop();
    rm.w = [...RM_INIT];
    step = 0;
    sync();
    pl.redraw();
  };
  f.button('Reset', reset);
  f.segmented({
    label: 'pairs',
    options: [
      { value: '25', label: '25' },
      { value: '100', label: '100' },
      { value: '400', label: '400' },
    ],
    value: '100',
    slot: 'n',
    onChange: (v) => {
      pairs = T.samplePairs(Number(v), 7);
      reset();
    },
  });
  f.toggle({
    label: 'show the labelers’ hidden taste',
    value: false,
    onChange: (v) => {
      showTaste = v;
      pl.redraw();
    },
  });
  sync();
}

// ---------------------------------------------------------------- Fig 3: reusing a batch

function reuseFigure(f: Fig): void {
  let K = 1;
  let clip = false;
  let eps = 0.2;
  let runs = T.banditRuns(K, null);
  let shown = T.BANDIT.iters;
  const wrongRun = (r: T.BanditRun) => r.probs.indexOf(Math.max(...r.probs)) !== 0;
  const chart = f.plot({
    aspect: 1.45,
    square: false,
    domain: [-3.2, 31, -0.5, 1.8],
    draw: (p) => {
      const ctx = p.ctx;
      for (const v of [0, 0.5, 1, 1.5]) {
        line(ctx, p.sx(0), p.sy(v), p.sx(30), p.sy(v), color('--grid'));
        label(ctx, String(v), p.sx(0) - 5, p.sy(v), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      }
      for (let x = 0; x <= 30; x += 10) label(ctx, String(x), p.sx(x), p.sy(-0.5) - 9, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      label(ctx, 'batches collected', p.sx(30), p.sy(-0.5) - 24, { size: 11, align: 'right', color: ink('--ink-2') });
      label(ctx, 'expected reward', p.sx(0.4), p.sy(1.8) + 10, { size: 11, color: ink('--ink-2') });
      line(ctx, p.sx(0), p.sy(1.5), p.sx(30), p.sy(1.5), color('gold'), 1.4, [6, 4]);
      label(ctx, 'always “story”', p.sx(30), p.sy(1.5) - 10, { size: 11, align: 'right', color: color('gold') });
      const n = Math.max(1, Math.floor(shown));
      const lineOf = (J: number[], col: string, lw: number) => {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const x = p.sx(i);
          const y = p.sy(J[i]!);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.stroke();
      };
      for (const r of runs) lineOf(r.J, wrongRun(r) ? withAlpha(color('red'), 0.75) : withAlpha(color('blue'), 0.3), wrongRun(r) ? 1.5 : 1.2);
      const mean = runs[0]!.J.map((_, i) => runs.reduce((s, r) => s + r.J[i]!, 0) / runs.length);
      lineOf(mean, color('blue'), 3);
    },
  });
  const ends = f.plot({ height: 128, square: false, domain: [0, 1, 0, 1], draw: (p) => drawEnds(p.ctx, p.w, p.h) });
  ends.canvas.classList.add('scroll-ok');
  function drawEnds(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const counts = [0, 0, 0, 0, 0];
    if (shown >= T.BANDIT.iters) runs.forEach((r) => counts[r.probs.indexOf(Math.max(...r.probs))]!++);
    label(ctx, 'where the 16 runs ended (most likely answer)', 8, 12, { size: 11, color: ink('--ink-2') });
    const cw = w / 5;
    T.ANSWERS.forEach((name, k) => {
      const x = k * cw + cw / 2;
      const bh = ((h - 74) * counts[k]!) / 16;
      const col = k === 0 ? color('blue') : color('red');
      box(ctx, x - cw * 0.28, h - 34 - bh, cw * 0.56, Math.max(1, bh), 3, withAlpha(col, counts[k] ? 0.55 : 0.15));
      label(ctx, counts[k] ? String(counts[k]) : '', x, h - 40 - bh, { size: 11, font: 'mono', weight: 650, align: 'center', color: ink() });
      label(ctx, name, x, h - 22, { size: 11.5, weight: 600, align: 'center', color: ink() });
      label(ctx, `r = ${T.R_ANS[k]}`, x, h - 8, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
    });
  }
  const tenRo = f.readout('after 10 batches');
  const wrongRo = f.readout('runs on a worse answer');
  const objLine = () => (clip ? 'np.minimum(obj, clipped)' : 'obj');
  const recompute = () => {
    runs = T.banditRuns(K, clip ? eps : null);
    const mean10 = runs.reduce((s, r) => s + r.J[10]!, 0) / runs.length;
    tenRo.set(fmt(mean10, 3));
    wrongRo.set(`${runs.filter(wrongRun).length} / 16`);
    f.code.set('obj', objLine());
    f.code.highlight(clip ? ['ratio', 'clip'] : ['ratio', 'reuse']);
    shown = 0;
    anim.start();
  };
  const anim = f.loop((dt) => {
    shown = Math.min(T.BANDIT.iters, shown + dt * 30);
    chart.redraw();
    ends.redraw();
    if (shown >= T.BANDIT.iters) return false;
  });
  f.slider({
    label: 'steps per batch',
    min: 1,
    max: 20,
    step: 1,
    value: 1,
    slot: 'K',
    format: (v) => String(Math.round(v)),
    onInput: (v) => {
      K = Math.round(v);
      recompute();
    },
  });
  f.toggle({
    label: 'clip',
    value: false,
    onChange: (v) => {
      clip = v;
      recompute();
    },
  });
  f.slider({
    label: 'ε',
    sym: 'eps',
    min: 0.05,
    max: 0.5,
    step: 0.05,
    value: 0.2,
    slot: 'eps',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      eps = v;
      if (clip) recompute();
    },
  });
  const mean10 = runs.reduce((s, r) => s + r.J[10]!, 0) / runs.length;
  tenRo.set(fmt(mean10, 3));
  wrongRo.set(`${runs.filter(wrongRun).length} / 16`);
}

// ---------------------------------------------------------------- Fig 4: the clipped objective

function clipFigure(f: Fig): void {
  let A = 1;
  let eps = 0.2;
  let rho = 1.3;
  const pl = f.plot({
    aspect: 1.25,
    square: false,
    domain: [-0.2, 2.2, -2.6, 2.6],
    draw: (p) => {
      const ctx = p.ctx;
      const [, , y0, y1] = p.view();
      // trust band
      ctx.fillStyle = withAlpha(color('slate'), 0.13);
      ctx.fillRect(p.sx(1 - eps), p.sy(y1), p.sx(1 + eps) - p.sx(1 - eps), p.sy(y0) - p.sy(y1));
      for (let x = 0; x <= 2; x += 0.5) {
        line(ctx, p.sx(x), p.sy(y0), p.sx(x), p.sy(y1), color('--grid'));
        label(ctx, String(x), p.sx(x), p.sy(y0) - 9, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      }
      for (let v = -2; v <= 2; v += 1) {
        line(ctx, p.sx(-0.2), p.sy(v), p.sx(2.2), p.sy(v), v === 0 ? color('--axis') : color('--grid'));
        if (v) label(ctx, String(v), p.sx(0) - 4, p.sy(v), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      }
      line(ctx, p.sx(1), p.sy(y0), p.sx(1), p.sy(y1), withAlpha(ink('--ink-2'), 0.7), 1, [4, 4]);
      label(ctx, 'old policy', p.sx(1) + 4, p.sy(y1) + 10, { size: 11, color: ink('--ink-2') });
      label(ctx, 'ratio ρ', p.sx(2.2) - 2, p.sy(0) + 12, { size: 11, italic: true, align: 'right', color: color('purple') });
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.sx(-0.2), p.sy(y1), p.sx(2.2) - p.sx(-0.2), p.sy(y0) - p.sy(y1));
      ctx.clip();
      p.fn((r) => r * A, withAlpha(color('purple'), 0.7), 1.6, [6, 5]);
      p.fn((r) => T.clamp(r, 1 - eps, 1 + eps) * A, withAlpha(color('slate'), 0.9), 1.6, [2, 3]);
      // the objective, green where it still pushes and red where it is flat
      const N = 220;
      for (let i = 0; i < N; i++) {
        const a = -0.2 + (2.4 * i) / N;
        const b = -0.2 + (2.4 * (i + 1)) / N;
        if (b < 0) continue;
        const ra = Math.max(0, a);
        const flat = T.clipSlope((ra + b) / 2, A, eps) === 0;
        line(ctx, p.sx(ra), p.sy(T.clipObj(ra, A, eps)), p.sx(b), p.sy(T.clipObj(b, A, eps)), flat ? color('red') : color('green'), 3.2);
      }
      ctx.restore();
      // the dragged point and which way its gradient pushes
      const o = T.clipObj(rho, A, eps);
      const g = T.clipSlope(rho, A, eps);
      const px = p.sx(rho);
      const py = p.sy(o);
      if (g !== 0) arrow(ctx, px, py, px + Math.sign(g) * 40, py, color('green'), 2.2, 8);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = color('--paper');
      ctx.fill();
      ctx.strokeStyle = color('purple');
      ctx.lineWidth = 2.5;
      ctx.stroke();
      const msg = g === 0 ? 'flat: no push' : g > 0 ? 'pushes ρ up' : 'pushes ρ down';
      const ly = py + (o > 0 ? 22 : -20);
      const lx = T.clamp(px, 50, p.w - 50);
      label(ctx, msg, lx, ly, { size: 11.5, weight: 650, align: 'center', color: g === 0 ? color('red') : color('green') });
      // legend
      const lx0 = p.w - 152;
      const ly0 = A >= 0 ? p.sy(-1.3) : p.sy(2.3);
      box(ctx, lx0 - 8, ly0 - 10, 154, 56, 6, withAlpha(color('--card'), 0.92), color('--rule'));
      line(ctx, lx0, ly0, lx0 + 22, ly0, color('purple'), 1.6, [6, 5]);
      label(ctx, 'ρ Â (unclipped)', lx0 + 28, ly0, { size: 11, color: ink('--ink-2') });
      line(ctx, lx0, ly0 + 18, lx0 + 22, ly0 + 18, color('slate'), 1.6, [2, 3]);
      label(ctx, 'clip(ρ) Â', lx0 + 28, ly0 + 18, { size: 11, color: ink('--ink-2') });
      line(ctx, lx0, ly0 + 36, lx0 + 22, ly0 + 36, color('green'), 3.2);
      label(ctx, 'min of the two', lx0 + 28, ly0 + 36, { size: 11, color: ink('--ink-2') });
    },
  });
  const objRo = f.readout('objective');
  const slopeRo = f.readout('slope');
  const sync = () => {
    const u = rho * A;
    const c = T.clamp(rho, 1 - eps, 1 + eps) * A;
    const o = Math.min(u, c);
    const g = T.clipSlope(rho, A, eps);
    f.code.setMany({ rho: fmt(rho, 3), u: fmt(u, 3), c: fmt(c, 3), o: fmt(o, 3), g: fmt(g, 3) });
    f.code.highlight(u <= c ? ['u', 'o'] : ['c', 'o']);
    objRo.set(fmt(o, 3));
    slopeRo.set(g === 0 ? '0 (flat)' : fmt(g, 3));
    pl.redraw();
  };
  let drag = false;
  const move = (e: PointerEvent) => {
    if (!drag) return;
    rho = T.clamp(Math.round(pl.pointer(e)[0] * 100) / 100, 0.02, 2.18);
    sync();
  };
  pl.canvas.addEventListener('pointerdown', (e) => {
    drag = true;
    pl.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  pl.canvas.addEventListener('pointermove', move);
  pl.canvas.addEventListener('pointerup', () => (drag = false));
  f.slider({
    label: 'advantage Â',
    sym: 'A',
    min: -1,
    max: 1,
    step: 0.05,
    value: 1,
    slot: 'A',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      A = Math.abs(v) < 0.01 ? 0.05 : v;
      sync();
    },
  });
  f.slider({
    label: 'ε',
    sym: 'eps',
    min: 0.05,
    max: 0.5,
    step: 0.01,
    value: 0.2,
    slot: 'eps',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      eps = v;
      sync();
    },
  });
  sync();
}

// ---------------------------------------------------------------- Fig 5: GAE

function gaeFigure(f: Fig): void {
  const ros = T.rollouts(2000, 5);
  let lam = 0.95;
  let k = 0.6;
  let sel = 2;
  let shownRo = 0;
  let stats = T.gaeStats(ros, sel, lam, k);
  let curve: { lam: number; gap: number; spread: number }[] = [];
  const recompute = () => {
    stats = T.gaeStats(ros, sel, lam, k);
    curve = Array.from({ length: 21 }, (_, i) => {
      const l = i / 20;
      const st = T.gaeStats(ros, sel, l, k);
      return { lam: l, gap: st.gap, spread: st.spread };
    });
  };
  recompute();
  const N = T.GAE_T;
  const one = f.plot({
    aspect: 1.75,
    square: false,
    domain: [0, 1, 0, 1],
    draw: (p) => {
      const ctx = p.ctx;
      const ro = ros[shownRo]!;
      const { values, deltas, adv } = T.gae(ro, lam, k);
      const left = 30;
      const cw = (p.w - left - 34) / N;
      const xc = (t: number) => left + (t + 0.5) * cw;
      const xb = (t: number) => left + t * cw;
      const H = p.h;
      const bands = { v: [6, H * 0.32], tok: [H * 0.34, H * 0.445], d: [H * 0.515, H * 0.74], a: [H * 0.765, H * 0.99] };
      // values: the critic's guess before each token, and the reward after the last
      const vy = (v: number) => bands.v[1]! - ((bands.v[1]! - bands.v[0]! - 12) * v) / 10;
      label(ctx, 'V', 4, vy(5), { size: 13, italic: true, weight: 650, font: 'serif', color: color('teal') });
      line(ctx, xb(0), vy(0), xb(N), vy(0), color('--grid'));
      line(ctx, xb(0), vy(10), xb(N), vy(10), color('--grid'));
      label(ctx, '10', xb(N) + 4, vy(10), { size: 10.5, font: 'mono', color: ink('--ink-3') });
      label(ctx, '0', xb(N) + 4, vy(0), { size: 10.5, font: 'mono', color: ink('--ink-3') });
      ctx.beginPath();
      for (let t = 0; t < N; t++) (t ? ctx.lineTo.bind(ctx) : ctx.moveTo.bind(ctx))(xb(t), vy(values[t]!));
      ctx.strokeStyle = color('teal');
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let t = 0; t < N; t++) {
        ctx.beginPath();
        ctx.arc(xb(t), vy(values[t]!), 3, 0, Math.PI * 2);
        ctx.fillStyle = color('teal');
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(xb(N), vy(T.clamp(ro.R, 0, 10)), 5, 0, Math.PI * 2);
      ctx.fillStyle = color('gold');
      ctx.fill();
      label(ctx, `R = ${ro.R.toFixed(1)}`, xb(N) - 6, vy(T.clamp(ro.R, 0, 10)) - 12, { size: 11, font: 'mono', weight: 650, align: 'right', color: color('gold') });
      // tokens
      const tt = bands.tok;
      for (let t = 0; t < N; t++) {
        const on = t === sel;
        const col = ro.good[t] ? color('green') : color('slate');
        box(ctx, xc(t) - cw * 0.4, tt[0]!, cw * 0.8, tt[1]! - tt[0]!, 4, withAlpha(col, ro.good[t] ? 0.55 : 0.25), on ? color('--accent') : withAlpha(col, 0.8), on ? 2.5 : 1);
        label(ctx, String(t), xc(t), (tt[0]! + tt[1]!) / 2, { size: 11, font: 'mono', weight: 600, align: 'center', color: ink() });
      }
      // deltas and advantages, shaded by how much each delta counts toward the selected token
      const big = Math.max(0.6, ...deltas.map(Math.abs), ...adv.map(Math.abs));
      const bar = (band: number[], vals: number[], col: Color, alpha: (t: number) => number, sym: string) => {
        const mid = (band[0]! + band[1]!) / 2;
        const half = (band[1]! - band[0]!) / 2;
        const sc = (half - 1) / big;
        line(ctx, xb(0), mid, xb(N), mid, color('--axis'));
        label(ctx, sym, 4, mid, { size: 13, italic: true, weight: 650, font: 'serif', color: color(col) });
        for (let t = 0; t < N; t++) {
          const v = vals[t]!;
          ctx.fillStyle = withAlpha(color(col), alpha(t));
          const y = v >= 0 ? mid - v * sc : mid;
          ctx.fillRect(xc(t) - cw * 0.3, y, cw * 0.6, Math.max(1, Math.abs(v) * sc));
        }
      };
      bar(bands.d, deltas, 'teal', (t) => (t < sel ? 0.15 : 0.2 + 0.8 * Math.pow(lam, t - sel)), 'δ');
      bar(bands.a, adv, 'green', (t) => (t === sel ? 0.95 : 0.35), 'Â');
      // the kernel weights as numbers over the deltas
      for (let t = sel; t < N; t++) {
        const wgt = Math.pow(lam, t - sel);
        if (cw < 26 && t > sel && (t - sel) % 2 === 1) continue;
        label(ctx, wgt >= 0.995 ? '1' : wgt.toFixed(2).replace(/^0/, ''), xc(t), (bands.tok[1]! + bands.d[0]!) / 2 + 1, { size: 10.5, font: 'mono', align: 'center', color: ink('--ink-3') });
      }
    },
  });
  const strips = f.plot({
    aspect: 2.6,
    square: false,
    domain: [-4.6, 4.6, -0.75, 1.9],
    draw: (p) => {
      const ctx = p.ctx;
      for (let x = -4; x <= 4; x += 2) {
        line(ctx, p.sx(x), p.sy(-0.45), p.sx(x), p.sy(1.45), x === 0 ? color('--axis') : color('--grid'));
        label(ctx, String(x), p.sx(x), p.sy(-0.62), { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      }
      const row = (vals: number[], y: number, col: string, name: string) => {
        for (let i = 0; i < Math.min(80, vals.length); i++) {
          const jit = (((i * 7919) % 97) / 97 - 0.5) * 0.34;
          ctx.beginPath();
          ctx.arc(p.sx(T.clamp(vals[i]!, -4.5, 4.5)), p.sy(y + jit), 2.6, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(col, 0.55);
          ctx.fill();
        }
        const m = vals.reduce((s, v) => s + v, 0) / vals.length;
        line(ctx, p.sx(m), p.sy(y - 0.3), p.sx(m), p.sy(y + 0.3), col, 3);
        label(ctx, name, p.sx(-4.55), p.sy(y + 0.3), { size: 11, weight: 600, color: col });
        return m;
      };
      const mg = row(stats.good, 1, color('green'), 'good tokens');
      const mb = row(stats.bad, 0, color('slate'), 'bad tokens');
      const yb = p.sy(1.62);
      line(ctx, p.sx(mb), yb, p.sx(mg), yb, ink(), 1.5);
      line(ctx, p.sx(mb), yb - 4, p.sx(mb), yb + 4, ink(), 1.5);
      line(ctx, p.sx(mg), yb - 4, p.sx(mg), yb + 4, ink(), 1.5);
      label(ctx, `gap ${stats.gap.toFixed(2)} (true 1)`, Math.max(p.sx(mg), p.sx(mb)) + 8, yb, { size: 11.5, font: 'mono', weight: 650, color: ink() });
    },
  });
  const chart = f.plot({
    aspect: 3,
    square: false,
    domain: [-0.12, 1.04, -0.35, 2.2],
    draw: (p) => {
      const ctx = p.ctx;
      for (const v of [0, 1, 2]) {
        line(ctx, p.sx(0), p.sy(v), p.sx(1), p.sy(v), color('--grid'));
        label(ctx, String(v), p.sx(0) - 5, p.sy(v), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      }
      line(ctx, p.sx(0), p.sy(1), p.sx(1), p.sy(1), withAlpha(color('green'), 0.6), 1.2, [5, 4]);
      for (const x of [0, 0.5, 1]) label(ctx, `λ = ${x}`, p.sx(x), p.sy(-0.22), { size: 11, font: 'mono', align: x === 0 ? 'left' : x === 1 ? 'right' : 'center', color: ink('--ink-3') });
      const path = (key: 'gap' | 'spread', col: string) => {
        ctx.beginPath();
        curve.forEach((c, i) => (i ? ctx.lineTo(p.sx(c.lam), p.sy(c[key])) : ctx.moveTo(p.sx(c.lam), p.sy(c[key]))));
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      };
      path('gap', color('green'));
      path('spread', color('slate'));
      line(ctx, p.sx(lam), p.sy(-0.1), p.sx(lam), p.sy(2.1), color('--accent'), 1.5);
      label(ctx, 'gap (signal)', p.sx(0.03), p.sy(1.95), { size: 11, weight: 600, color: color('green') });
      label(ctx, 'noise', p.sx(0.03), p.sy(1.6), { size: 11, weight: 600, color: color('slate') });
    },
  });
  [one, strips, chart].forEach((pp) => pp.canvas.classList.add('scroll-ok'));
  const gapRo = f.readout('gap');
  const noiseRo = f.readout('noise');
  const sync = () => {
    gapRo.set(fmt(stats.gap, 3));
    noiseRo.set(fmt(stats.spread, 3));
    f.code.setMany({ t: sel, gap: stats.gap.toFixed(2), spread: stats.spread.toFixed(2) });
    one.redraw();
    strips.redraw();
    chart.redraw();
  };
  one.canvas.addEventListener('pointerdown', (e) => {
    const r = one.canvas.getBoundingClientRect();
    const cw = (one.w - 30 - 34) / N;
    const t = Math.floor((e.clientX - r.left - 30) / cw);
    if (t >= 0 && t < N && t !== sel) {
      sel = t;
      recompute();
      f.code.highlight(['delta', 'acc']);
      sync();
    }
  });
  f.slider({
    label: 'λ',
    sym: 'lam',
    min: 0,
    max: 1,
    step: 0.01,
    value: lam,
    slot: 'lam',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      lam = v;
      stats = T.gaeStats(ros, sel, lam, k);
      f.code.highlight('acc');
      sync();
    },
  });
  f.slider({
    label: 'critic error',
    sym: 'V',
    min: 0,
    max: 1,
    step: 0.05,
    value: k,
    slot: 'k',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      k = v;
      recompute();
      f.code.highlight('critic');
      sync();
    },
  });
  f.button('Another rollout', () => {
    shownRo = (shownRo + 1) % ros.length;
    one.redraw();
  });
  sync();
}

// ---------------------------------------------------------------- Fig 6: the per-token KL penalty

function klFigure(f: Fig): void {
  let beta = 0.1;
  let sel = 0;
  const L = T.LINE;
  const n = L.tokens.length;
  const pl = f.plot({
    aspect: 1.1,
    square: false,
    domain: [0, 1, 0, 1],
    draw: (p) => {
      const ctx = p.ctx;
      const rowH = 21;
      const top = 30;
      sizeTo(p, top + rowH * n + 40);
      const w = p.w;
      const tokX = 10;
      const klX = Math.min(150, w * 0.36);
      const barX0 = klX + 22;
      const barW = w - barX0 - 12;
      const zero = barX0 + barW * 0.42;
      const sc = (barW * 0.55) / 2;
      label(ctx, 'token', tokX, 12, { size: 11, weight: 650, color: ink('--ink-2') });
      label(ctx, 'log ratio', klX, 12, { size: 11, weight: 650, align: 'right', color: color('red') });
      label(ctx, 'reward on this token', zero, 12, { size: 11, weight: 650, align: 'center', color: ink('--ink-2') });
      line(ctx, zero, top - 4, zero, top + rowH * n + 2, color('--axis'));
      const rew = T.tokenRewards(beta);
      for (let t = 0; t < n; t++) {
        const y = top + t * rowH + rowH / 2;
        if (t === sel) box(ctx, 2, y - rowH / 2 + 1, w - 4, rowH - 2, 4, withAlpha(color('--accent'), 0.1));
        label(ctx, JSON.stringify(L.tokens[t]), tokX, y, { size: 12, font: 'mono', color: ink() });
        const kl = L.logp[t]! - L.logpRef[t]!;
        label(ctx, (kl >= 0 ? '+' : '') + kl.toFixed(1), klX, y, { size: 12, font: 'mono', align: 'right', color: color('red') });
        const pen = -beta * kl;
        const pw = pen * sc;
        ctx.fillStyle = withAlpha(color('red'), 0.75);
        ctx.fillRect(Math.min(zero, zero + pw), y - 6, Math.max(1, Math.abs(pw)), 12);
        if (t === n - 1) {
          ctx.fillStyle = withAlpha(color('gold'), 0.85);
          ctx.fillRect(zero + Math.max(0, pw), y - 6, L.reward * sc, 12);
          label(ctx, `+${L.reward} from the reward model`, Math.min(zero + Math.max(0, pw) + L.reward * sc + 6, w - 4), y + 14, { size: 11, align: 'right', color: color('gold'), weight: 600 });
        } else if (Math.abs(pen) > 0.004) {
          label(ctx, fmt(rew[t]!, 2), zero + Math.min(0, pw) - 4, y, { size: 10.5, font: 'mono', align: 'right', color: ink('--ink-3') });
        }
      }
    },
  });
  pl.canvas.classList.add('scroll-ok');
  const klSum = L.logp.reduce((s, v, t) => s + v - L.logpRef[t]!, 0);
  const totalRo = f.readout('total reward', { sym: 'r' });
  f.readout('sum of log ratios', { sym: 'kl' }).set(fmt(klSum, 3));
  const sync = () => {
    const total = T.tokenRewards(beta).reduce((s, v) => s + v, 0);
    totalRo.set(fmt(total, 3));
    f.code.setMany({ total: fmt(total, 3), kl: fmt(klSum, 2) });
    const kl = L.logp[sel]! - L.logpRef[sel]!;
    f.status(`Token ${JSON.stringify(L.tokens[sel])}: log-prob ${L.logp[sel]} under the policy, ${L.logpRef[sel]} under the reference. Log ratio ${kl >= 0 ? '+' : ''}${kl.toFixed(1)}: the policy finds it ${Math.exp(kl) >= 1 ? `${fmt(Math.exp(kl), 2)} times more` : `${fmt(1 / Math.exp(kl), 2)} times less`} likely.`);
    pl.redraw();
  };
  pl.canvas.addEventListener('pointerdown', (e) => {
    const r = pl.canvas.getBoundingClientRect();
    const t = Math.floor((e.clientY - r.top - 30) / 21);
    if (t >= 0 && t < n) {
      sel = t;
      f.code.highlight(t === n - 1 ? ['kl', 'pen', 'rm'] : ['kl', 'pen']);
      sync();
    }
  });
  f.slider({
    label: 'β',
    sym: 'beta',
    min: 0,
    max: 0.5,
    step: 0.01,
    value: beta,
    slot: 'beta',
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      beta = v;
      f.code.highlight('pen');
      sync();
    },
  });
  sync();
}

// ---------------------------------------------------------------- Fig 7: four models in memory

const MODELS: { key: string; name: string; k: Color; trained: boolean; out: string; size: 'policy' | 'rm' }[] = [
  { key: 'policy', name: 'policy', k: 'blue', trained: true, out: 'log-prob per token', size: 'policy' },
  { key: 'critic', name: 'value model', k: 'teal', trained: true, out: 'value per token', size: 'rm' },
  { key: 'ref', name: 'reference', k: 'orange', trained: false, out: 'log-prob per token', size: 'policy' },
  { key: 'rm', name: 'reward model', k: 'gold', trained: false, out: 'one score per answer', size: 'rm' },
];

function memoryFigure(f: Fig): void {
  let nPolicy = 7;
  let nRM = 7;
  let recipe: 'ppo' | 'grpo' | 'dpo' = 'ppo';
  const used = (key: string) => (recipe === 'ppo' ? true : recipe === 'grpo' ? key !== 'critic' : key === 'policy' || key === 'ref');
  const gb = (m: (typeof MODELS)[number]) => (used(m.key) ? (m.size === 'policy' ? nPolicy : nRM) * (m.trained ? T.BYTES_TRAIN : T.BYTES_FROZEN) : 0);
  const pl = f.plot({
    aspect: 1.5,
    square: false,
    domain: [0, 1, 0, 1],
    draw: (p) => {
      const ctx = p.ctx;
      const w = p.w;
      const narrow = w < 470;
      const pad = 8;
      const cols = narrow ? 2 : 4;
      const gap = 10;
      const bw = (w - 2 * pad - gap * (cols - 1)) / cols;
      const bh = 86;
      const rows = 4 / cols;
      const barTop = pad + rows * (bh + gap) + 18;
      sizeTo(p, barTop + 96);
      MODELS.forEach((m, i) => {
        const x = pad + (i % cols) * (bw + gap);
        const y = pad + Math.floor(i / cols) * (bh + gap);
        const on = used(m.key);
        const k = color(m.k);
        ctx.globalAlpha = on ? 1 : 0.35;
        box(ctx, x, y, bw, bh, 8, withAlpha(k, 0.1), k, m.trained ? 2 : 1);
        if (!m.trained) {
          ctx.save();
          ctx.setLineDash([4, 3]);
          box(ctx, x + 3, y + 3, bw - 6, bh - 6, 6, undefined, withAlpha(k, 0.5), 1);
          ctx.restore();
        }
        label(ctx, m.name, x + 10, y + 16, { size: 13, weight: 700, color: k });
        label(ctx, m.trained ? 'trained' : 'frozen', x + 10, y + 34, { size: 11, weight: 600, color: ink('--ink-2') });
        label(ctx, m.out, x + 10, y + 51, { size: 11, color: ink('--ink-2') });
        const g = gb(m);
        label(ctx, on ? `${fmt(g, 3)} GB` : recipe === 'grpo' && m.key === 'critic' ? 'not needed' : 'not needed', x + 10, y + 71, { size: 12.5, font: 'mono', weight: 650, color: on ? ink() : ink('--ink-3') });
        ctx.globalAlpha = 1;
      });
      // stacked memory bar with 80 GB ticks
      const total = MODELS.reduce((s, m) => s + gb(m), 0);
      const range = [160, 320, 640, 1280, 2560].find((r) => r >= total) ?? 2560;
      const scale = (w - 2 * pad) / range;
      let x = pad;
      const y = barTop;
      label(ctx, `total ${fmt(total, 4)} GB, before activations`, pad, y - 8, { size: 11.5, weight: 600, color: ink() });
      MODELS.forEach((m) => {
        const g = gb(m);
        if (!g) return;
        const ww = g * scale;
        box(ctx, x, y + 4, Math.max(1, ww - 1), 26, 3, withAlpha(color(m.k), m.trained ? 0.7 : 0.4));
        x += ww;
      });
      const gpus = Math.ceil(total / 80);
      for (let gi = 0; gi <= gpus; gi++) {
        const gx = pad + gi * 80 * scale;
        if (gx > w - pad + 0.5) break;
        line(ctx, gx, y + 1, gx, y + 36, withAlpha(ink(), 0.55), 1);
      }
      label(ctx, `${gpus} × 80 GB GPUs just to hold it`, pad, y + 50, { size: 11.5, color: ink('--ink-2') });
      label(ctx, `scale: ${range} GB`, w - pad, y + 50, { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      const sft = nPolicy * T.BYTES_TRAIN;
      label(ctx, `(supervised fine-tuning of the same policy: ${fmt(sft, 4)} GB)`, pad, y + 68, { size: 11, color: ink('--ink-3') });
    },
  });
  pl.canvas.classList.add('scroll-ok');
  const totalRo = f.readout('total');
  const sync = () => {
    const vals: Record<string, string> = {};
    for (const m of MODELS) vals[`${m.key}_gb`] = fmt((m.size === 'policy' ? nPolicy : nRM) * (m.trained ? T.BYTES_TRAIN : T.BYTES_FROZEN), 3);
    const total = MODELS.reduce((s, m) => s + gb(m), 0);
    totalRo.set(`${fmt(total, 4)} GB`);
    const skip = recipe === 'ppo' ? '[]' : recipe === 'grpo' ? '["critic"]' : '["critic", "reward"]';
    const why = recipe === 'ppo' ? 'PPO: all four' : recipe === 'grpo' ? 'GRPO: no critic' : 'DPO: two models';
    f.code.setMany({ ...vals, total: fmt(total, 4), np: fmt(nPolicy, 3), nr: fmt(nRM, 3), skip, recipe: why });
    f.code.highlight(MODELS.filter((m) => used(m.key)).map((m) => m.key));
    pl.redraw();
  };
  f.segmented({
    label: 'recipe',
    options: [
      { value: 'ppo', label: 'PPO' },
      { value: 'grpo', label: 'GRPO' },
      { value: 'dpo', label: 'DPO' },
    ],
    value: 'ppo',
    onChange: (v) => {
      recipe = v;
      sync();
    },
  });
  const sizes = [0.5, 1, 1.5, 3, 7, 13, 34, 70];
  const s1 = f.slider({
    label: 'policy size',
    min: 0,
    max: sizes.length - 1,
    step: 1,
    value: 4,
    map: (r) => sizes[Math.round(r)]!,
    format: (v) => `${v}B`,
    onInput: (v) => {
      nPolicy = v;
      sync();
    },
  });
  const s2 = f.slider({
    label: 'reward and value size',
    min: 0,
    max: sizes.length - 1,
    step: 1,
    value: 4,
    map: (r) => sizes[Math.round(r)]!,
    format: (v) => `${v}B`,
    onInput: (v) => {
      nRM = v;
      sync();
    },
  });
  for (const sl of [s1, s2]) sl.el.style.flexBasis = '100%';
  sync();
}

// ---------------------------------------------------------------- Fig 8: over-optimization

function overoptFigure(f: Fig): void {
  const rm = T.trainedRM();
  let beta = 0.05;
  let pol = new T.GaussPolicy(rm, beta);
  const start = { proxy: pol.proxy, gold: pol.gold };
  const trail: { m: T.Pt; kl: number; proxy: number; gold: number }[] = [{ m: [0, 0], kl: 0, proxy: 0, gold: 0 }];
  let steps = 0;
  // the whole KL-regularized path, for reference: m = s * w / |w|
  const wn = Math.hypot(rm.w[0], rm.w[1]);
  const path = Array.from({ length: 121 }, (_, i) => {
    const s = (i / 120) * 15;
    const m: T.Pt = [(s * rm.w[0]) / wn, (s * rm.w[1]) / wn];
    return { d: s / Math.SQRT2, proxy: s * wn, gold: T.expectedTaste(m) - start.gold };
  });
  const peak = path.reduce((a, b) => (b.gold > a.gold ? b : a));
  const world = f.plot({
    aspect: 1.35,
    square: false,
    domain: [-0.75, 8.35, 0.2, 1.2],
    draw: (p) => {
      const ctx = p.ctx;
      const [gr, gg, gb] = rgbOf(color('green'));
      p.field((l, q) => {
        if (l < 0 || q < 0.3) return [0, 0, 0, 0];
        const t = T.clamp((T.taste(l, q) - 2) / 10, 0, 1);
        return [gr, gg, gb, Math.round(15 + 120 * t * t)];
      }, 6);
      const X0 = p.sx(0);
      const Y0 = p.sy(0.3);
      ctx.strokeStyle = color('--axis');
      ctx.lineWidth = 1;
      ctx.strokeRect(X0, p.sy(1.2), p.sx(8) - X0, Y0 - p.sy(1.2));
      for (let l = 0; l <= 8; l += 2) label(ctx, String(l * 100), p.sx(l), Y0 + 12, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      for (const q of [0.4, 0.6, 0.8, 1.0]) label(ctx, q.toFixed(1), X0 - 5, p.sy(q), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      label(ctx, 'length (tokens)', p.sx(8) - 4, Y0 - 9, { size: 11, align: 'right', color: ink('--ink-2') });
      label(ctx, 'quality', X0 + 6, p.sy(1.2) + 11, { size: 11, color: ink('--ink-2') });
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0, p.sy(1.2), p.sx(8) - X0, Y0 - p.sy(1.2));
      ctx.clip();
      const [w0, w1] = rm.w;
      for (let c = -4; c <= 24; c += 4) p.fn((l) => T.SFT.q + (T.SFT.sq * (c - (w0 * (l - T.SFT.l)) / T.SFT.sl)) / w1, withAlpha(color('gold'), 0.75), 1.2);
      // the SFT cloud (reference) as a 2-sigma ellipse
      ctx.beginPath();
      ctx.ellipse(p.sx(T.SFT.l), p.sy(T.SFT.q), p.sx(T.SFT.l + 2 * T.SFT.sl) - p.sx(T.SFT.l), p.sy(T.SFT.q) - p.sy(T.SFT.q + 2 * T.SFT.sq), 0, 0, Math.PI * 2);
      ctx.strokeStyle = color('orange');
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const y of pol.samples) {
        ctx.beginPath();
        ctx.arc(p.sx(y[0]), p.sy(y[1]), 2.4, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(color('blue'), 0.5);
        ctx.fill();
      }
      ctx.beginPath();
      trail.forEach((tr, i) => {
        const [l, q] = T.unstd(tr.m);
        if (i) ctx.lineTo(p.sx(l), p.sy(q));
        else ctx.moveTo(p.sx(l), p.sy(q));
      });
      ctx.strokeStyle = color('blue');
      ctx.lineWidth = 2.2;
      ctx.stroke();
      const [ml, mq] = T.unstd(pol.m);
      ctx.beginPath();
      ctx.arc(p.sx(ml), p.sy(mq), 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color('blue');
      ctx.fill();
      ctx.strokeStyle = color('--paper');
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      label(ctx, 'SFT', p.sx(T.SFT.l), p.sy(T.SFT.q - 2 * T.SFT.sq) + 10, { size: 11, weight: 650, align: 'center', color: color('orange') });
    },
  });
  const chart = f.plot({
    aspect: 1.9,
    square: false,
    domain: [-1.1, 10.3, -15, 15],
    draw: (p) => {
      const ctx = p.ctx;
      for (const v of [-5, 0, 5, 10]) {
        line(ctx, p.sx(0), p.sy(v), p.sx(10), p.sy(v), v === 0 ? color('--axis') : color('--grid'));
        label(ctx, (v > 0 ? '+' : '') + v, p.sx(0) - 5, p.sy(v), { size: 11, font: 'mono', align: 'right', color: ink('--ink-3') });
      }
      for (let d = 0; d <= 10; d += 2) label(ctx, String(d), p.sx(d), p.sy(-15) - 26, { size: 11, font: 'mono', align: 'center', color: ink('--ink-3') });
      label(ctx, '√KL from the SFT model', p.sx(10), p.sy(-15) - 9, { size: 11, align: 'right', color: ink('--ink-2') });
      const curve = (xs: number[], ys: number[], col: string, lw: number, dash?: number[]) => {
        ctx.beginPath();
        xs.forEach((x, i) => (i ? ctx.lineTo(p.sx(x), p.sy(ys[i]!)) : ctx.moveTo(p.sx(x), p.sy(ys[i]!))));
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.setLineDash(dash ?? []);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const pd = path.filter((q) => q.d <= 10.2);
      curve(pd.map((q) => q.d), pd.map((q) => q.proxy), withAlpha(color('gold'), 0.35), 1.3, [4, 4]);
      curve(pd.map((q) => q.d), pd.map((q) => q.gold), withAlpha(color('green'), 0.35), 1.3, [4, 4]);
      const ds = trail.map((tr) => Math.sqrt(tr.kl));
      curve(ds, trail.map((tr) => tr.proxy), color('gold'), 2.6);
      curve(ds, trail.map((tr) => tr.gold), color('green'), 2.6);
      ctx.beginPath();
      ctx.arc(p.sx(peak.d), p.sy(peak.gold), 4, 0, Math.PI * 2);
      ctx.strokeStyle = color('green');
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(ctx, 'proxy: the reward model', p.sx(0.25), p.sy(14), { size: 11.5, weight: 650, color: color('gold') });
      label(ctx, 'true: the labelers’ taste', p.sx(0.25), p.sy(11.6), { size: 11.5, weight: 650, color: color('green') });
    },
  });
  [world, chart].forEach((pp) => pp.canvas.classList.add('scroll-ok'));
  const klRo = f.readout('KL', { sym: 'kl' });
  const proxyRo = f.readout('proxy gain', { sym: 'r' });
  const goldRo = f.readout('true gain');
  const sync = () => {
    const last = trail[trail.length - 1]!;
    klRo.set(fmt(last.kl, 3));
    proxyRo.set((last.proxy >= 0 ? '+' : '') + fmt(last.proxy, 3));
    goldRo.set((last.gold >= 0 ? '+' : '') + fmt(last.gold, 3));
    f.code.setMany({ kl: fmt(last.kl, 3), proxy: fmt(last.proxy, 3), gold: fmt(last.gold, 3), w0: fmt(rm.w[0], 3), w1: fmt(rm.w[1], 3) });
    world.redraw();
    chart.redraw();
  };
  let phase = 0;
  const loop = f.loop(() => {
    for (let i = 0; i < 2; i++) {
      pol.step();
      steps++;
      trail.push({ m: [...pol.m], kl: pol.kl, proxy: pol.proxy - start.proxy, gold: pol.gold - start.gold });
    }
    f.code.highlight(['sample', 'kl', 'reward', 'adv', 'step'][Math.floor(phase++ / 2) % 5]!);
    sync();
    if (steps >= 600 || T.unstd(pol.m)[0] > 7.6) {
      stop();
      const best = trail.reduce((a, b) => (b.gold > a.gold ? b : a));
      f.status(`Stopped after ${steps} steps. The true score peaked at +${best.gold.toFixed(2)} (KL ${best.kl.toFixed(1)}) and ended at ${trail[trail.length - 1]!.gold >= 0 ? '+' : ''}${trail[trail.length - 1]!.gold.toFixed(2)}, while the proxy kept rising.`);
      return false;
    }
  });
  const stop = () => {
    loop.stop();
    btn.textContent = 'Optimize';
    f.code.highlight(null);
  };
  const reset = () => {
    stop();
    pol = new T.GaussPolicy(rm, beta);
    trail.length = 1;
    steps = 0;
    f.status('');
    sync();
  };
  const btn = f.button(
    'Optimize',
    () => {
      if (loop.running()) stop();
      else {
        if (steps >= 600 || T.unstd(pol.m)[0] > 7.6) reset();
        loop.start();
        btn.textContent = 'Pause';
      }
    },
    { primary: true },
  );
  f.button('Reset', reset);
  f.slider({
    label: 'β',
    sym: 'beta',
    min: -1.7,
    max: 0,
    step: 0.05,
    value: Math.log10(beta),
    map: (r) => Math.pow(10, r),
    format: (v) => fmt(v, 2),
    slot: 'beta',
    onInput: (v) => {
      beta = v;
      pol.beta = v;
    },
  });
  sync();
}

// ---------------------------------------------------------------- the chapter

const chapter: ChapterDef = {
  symbols: RLHF_SYMBOLS,

  render(p) {
    p.prose(`
A pretrained language model is a superb mimic. Trained to predict the next token of an enormous amount of web text, it continues any document in the style it finds there, which is not the same thing as being helpful. Ask GPT-3 to "explain the moon landing to a 6 year old" and it may answer with more questions of the same kind, because on the web that is what such a line is often followed by.

Supervised fine-tuning on demonstrations ([Chapter 13](#/finetuning)) teaches the format of an assistant. But demonstrations are slow to write, they cap the model at the skill of whoever wrote them, and they only ever show what to do, never what to avoid. People are much better at *judging* answers than at *writing* them. **Reinforcement learning from human feedback** (RLHF) turns that judgment into a training signal in three moves: collect human comparisons between answers, fit a *reward model* that predicts them, then optimize the language model against the reward model with reinforcement learning.

The RL algorithm that made this work was **PPO**, and most of this chapter is about why PPO looks the way it does: the importance ratio, the clipped objective, the value head and GAE, the per-token KL penalty, and the four models it keeps in memory. The chapter ends with the way it all fails: optimize a learned reward hard enough and it stops measuring what you wanted.`);

    // ------------------------------------------------------------ recap
    p.h2('Where we left off', 'recap');
    p.prose(`
[The previous chapter](#/policy-gradients) set up the vocabulary. A prompt $x$ is the starting *state*; each generated token is an *action* chosen by the *policy* $\\sympi$, which is just the language model with weights $\\theta$; the state at step $t$, written $s_t$, is the prompt plus the tokens so far. When the answer $y$ is finished, a *reward* says how good it was.

The **policy gradient** raises the log-probability of every token the model wrote, in proportion to that token's **advantage** $\\symA_t$: how much better things turned out than a *baseline* expectation. Subtracting a baseline leaves the average gradient unchanged and makes it far less noisy. Its simplest form is REINFORCE:`);
    p.math({
      label: 'Policy gradient with advantages',
      tex: String.raw`\nabla_\theta J(\theta) = \mathbb{E}\Big[\sum_t \symA_t\, \nabla_\theta \log \sympi(a_t \mid s_t)\Big]`,
      codeTitle: 'reinforce.py',
      code: `
        logp = policy.logprobs(x, y)   # (T,) per token
        loss = -(adv * logp).sum()     # descend: J goes up
        loss.backward()
        opt.step()                     # then new samples
      `,
      terms: [
        [String.raw`\nabla_\theta J(\theta)`, 'the direction to nudge every weight so that the expected reward $J$ goes up'],
        [String.raw`\mathbb{E}[\cdot]`, 'an *expectation*: the average over prompts and over answers sampled from the policy. In code, the mean over a batch'],
        [String.raw`\sum_t`, 'add up over the tokens of the answer'],
        [String.raw`\symA_t`, 'the advantage of token $t$: positive if it turned out better than expected, negative if worse'],
        [String.raw`\nabla_\theta \log \sympi(a_t \mid s_t)`, 'the direction that makes token $a_t$ more likely in context $s_t$'],
      ],
      explain: 'Every token the model actually wrote gets pushed up if its advantage is positive and down if negative, by an amount proportional to the advantage. That is all REINFORCE does. PPO keeps this core and changes how it uses each expensive batch of samples.',
    });
    p.prose(`The last idea from that chapter is the **KL leash**. A frozen copy of the starting model, the *reference* $\\sympiref$, stays in memory, and the policy pays for drifting away from it. The *KL divergence* measures that drift: the average, over answers the policy writes, of how much more likely the policy finds them than the reference does, in log units. It is zero when the two models agree and grows as they part. RLHF optimizes reward minus that drift:`);
    p.math({
      label: 'The KL-regularized RLHF objective',
      tex: String.raw`\max_\theta\;\; \mathbb{E}_{x,\; y \sim \sympi}\big[\symr_\phi(x, y)\big] \;-\; \symbeta\, \symkl\big(\sympi(\cdot \mid x)\,\big\|\,\sympiref(\cdot \mid x)\big)`,
      codeTitle: 'objective.py',
      code: `
        y = policy.sample(x)             # an answer
        reward = rm(x, y)                # its score
        kl = (policy.logprob(x, y)
              - ref.logprob(x, y))       # one-sample KL
        objective = reward - beta * kl   # maximize
      `,
      terms: [
        [String.raw`y \sim \sympi`, 'answers sampled from the current policy'],
        [String.raw`\symr_\phi(x, y)`, 'the reward model\'s score for answer $y$ to prompt $x$; $\\phi$ (phi) names its weights'],
        [String.raw`\symkl(\cdot \,\|\, \cdot)`, 'the KL divergence from the policy to the reference: zero when they agree, larger as they part'],
        [String.raw`\symbeta`, 'how much one unit of drift costs, in reward units: a hyperparameter'],
      ],
      explain: 'Find a policy whose answers score high, but charge for every bit it moves away from the reference. Without the charge, the policy is free to find strange text that the reward model happens to love. The rest of the chapter builds the two pieces this needs: the reward model $\\symr_\\phi$, and an optimizer good enough to climb this objective on a model with billions of weights.',
    });

    // ------------------------------------------------------------ recipe
    p.h2('The InstructGPT recipe', 'recipe');
    p.prose(`
Christiano et al. (2017) first showed that a reward learned from human comparisons could train reinforcement-learning agents: Atari games, and a simulated robot that learned a backflip from under a thousand comparisons. Ziegler et al. (2019) and Stiennon et al. (2020) brought the idea to language models, for stylistic continuation and for summarization. **InstructGPT** (Ouyang et al., 2022) turned it into the standard recipe for assistants, in three stages:`);
    p.table(
      ['Stage', 'Data', 'Model', 'Loss'],
      [
        ['1. Supervised fine-tuning', 'about 13k prompts with answers written by labelers', 'GPT-3, fine-tuned', 'cross-entropy on the answer tokens'],
        ['2. Reward model', 'about 33k prompts, 4 to 9 SFT answers each, ranked by labelers', 'a 6B model with a scalar head', 'Bradley-Terry on every pair'],
        ['3. Reinforcement learning', 'about 31k prompts, no labels', 'the policy, starting from SFT', 'PPO on reward minus KL'],
      ],
      { caption: 'Dataset sizes are the training splits reported in the InstructGPT paper.' },
    );
    p.figure({
      title: 'The three stages of RLHF',
      layout: 'stack',
      codeTitle: 'instructgpt.py',
      code: `
        base = pretrained_lm("gpt-3")          # continues text     #@base
        demos = labelers_write(sft_prompts)    # ~13k prompts       #@demo
        sft = finetune(base, demos)            # cross-entropy      #@sft

        answers = {x: sft.sample(x, n=4) for x in rm_prompts}      #@sample
        ranks = labelers_rank(answers)         # D > C > A = B      #@rank
        rm = fit_bradley_terry(sft, ranks)     # a scalar head      #@rm

        policy, ref = copy(sft), frozen(copy(sft))                  #@init
        for x in ppo_prompts:                  # no labels needed
            y = policy.sample(x)                                    #@gen
            reward = rm(x, y) - beta * kl(policy, ref, x, y)        #@score
            ppo_update(policy, x, y, reward)                        #@update
      `,
      setup: pipelineFigure,
      caption: 'Step through the recipe; each step lights the line of code it corresponds to. Stage 1 needs people to *write*; stage 2 only needs them to *rank*; stage 3 needs no people at all, because the reward model stands in for them. That last fact is both the power of RLHF and, as the final section shows, its weak point.',
    });
    p.prose(`
The result was striking. Human labelers preferred the answers of a 1.3-billion-parameter InstructGPT model to those of the 175-billion-parameter GPT-3, a model more than a hundred times larger. ChatGPT, released that November, was trained with the same methods. InstructGPT also mixed ordinary pretraining gradients into the PPO stage (they called it PPO-ptx) to win back small regressions on standard benchmarks, the so-called *alignment tax*.`);

    // ------------------------------------------------------------ preferences
    p.h2('Preference data', 'preferences');
    p.prose(`
Why compare instead of score? Ask ten people to rate an answer from 1 to 10 and you get ten different scales: one person's 6 is another's 8, and the same person drifts over an afternoon. Ask which of two answers is better and they agree far more often. A comparison is also faster to give than a demonstration is to write, and it can capture qualities the rater could not produce: anyone can tell which of two proofs is clearer or which of two jokes is funnier.

A **preference dataset** is a list of triples $(x, y_w, y_l)$: a prompt, the answer the labeler preferred (the *winner*, or *chosen*), and the one they did not (the *loser*, or *rejected*). InstructGPT asked labelers to rank between 4 and 9 answers to a prompt at once. A ranking of $K$ answers contains $K(K-1)/2$ pairs, so 9 answers give 36 comparisons for the price of reading 9. Those pairs share answers and are strongly correlated, so InstructGPT treated all the pairs from one prompt as a single batch element rather than shuffling them independently, which overfit.

Labels are noisy. InstructGPT's labelers agreed with each other a little under three quarters of the time, and that agreement is roughly the ceiling for any reward model trained on their labels. Later systems replace some or all of the human labels with judgments from another model (*RLAIF*, as in Anthropic's Constitutional AI, 2022), but the rest of the recipe stays the same.`);

    // ------------------------------------------------------------ reward model
    p.h2('The reward model', 'reward-model');
    p.prose(`
The reward model is a language model whose vocabulary output is replaced by a single number. Take the SFT model, remove the *unembedding* (the layer that turns the final hidden state into logits over the vocabulary), and add a linear layer from the last token's hidden state to one scalar. It reads a prompt and an answer and returns $\\symr_\\phi(x, y)$.

To train it on comparisons, we need a model of how scores become choices. The **Bradley-Terry** model (Bradley and Terry, 1952, built for paired comparisons in general; chess's Elo ratings rest on the same idea) says the chance a person prefers one answer depends only on the difference between their scores:`);
    p.math({
      label: 'Bradley-Terry preference model',
      tex: String.raw`P(y_w \succ y_l \mid x) \;=\; \sigma\big(\symr_\phi(x, y_w) - \symr_\phi(x, y_l)\big), \qquad \sigma(z) = \frac{1}{1 + e^{-z}}`,
      codeTitle: 'bradley_terry.py',
      code: `
        def p_prefer(r_chosen, r_rejected):
            margin = r_chosen - r_rejected
            return 1 / (1 + np.exp(-margin))  # sigmoid

        p_prefer(2.0, 0.0)   # 0.881
        p_prefer(5.0, 3.0)   # 0.881: only the gap counts
      `,
      terms: [
        [String.raw`y_w \succ y_l`, '"$y_w$ is preferred to $y_l$": the labeler picks the winner'],
        [String.raw`\symr_\phi(x, y_w) - \symr_\phi(x, y_l)`, 'the *margin*: how much higher the reward model scores the winner'],
        [String.raw`\sigma(z)`, 'the sigmoid, which squashes any number into a probability between 0 and 1. $\\sigma(0) = 0.5$'],
      ],
      explain: 'A margin of 0 means a coin flip. A margin of 2 means the model is 88% sure the labeler preferred $y_w$; a margin of $-2$, 88% sure they preferred the other one. Adding the same constant to every reward changes nothing, so the reward scale has no natural zero: InstructGPT shifted it so that the labelers\' own demonstrations score 0 on average.',
    });
    p.math({
      label: 'Reward model loss',
      tex: String.raw`\mathcal{L}(\phi) \;=\; -\,\mathbb{E}_{(x, y_w, y_l)}\Big[\log \sigma\big(\symr_\phi(x, y_w) - \symr_\phi(x, y_l)\big)\Big]`,
      codeTitle: 'rm_loss.py',
      code: `
        r_chosen = rm(x, y_w)       # (B,) one per pair
        r_rejected = rm(x, y_l)     # (B,)
        margin = r_chosen - r_rejected
        loss = np.mean(np.logaddexp(0, -margin))
        # = log(1 + exp(-m)) = -log sigmoid(m)
      `,
      terms: [
        [String.raw`\log \sigma(\cdot)`, 'the log-probability the model assigns to what the labeler actually chose'],
        [String.raw`-\mathbb{E}[\cdot]`, 'averaged over the dataset and negated, so that lower is better'],
      ],
      explain: 'This is logistic regression on the margin: cross-entropy where the right answer is always "the chosen one wins". Its slope with respect to the margin is $-\\sigma(-\\text{margin})$: close to $-1$ when the model has a pair backwards, close to 0 when it already ranks the pair right with confidence, so training concentrates on the pairs it gets wrong. `np.logaddexp(0, -m)` computes $\\log(1 + e^{-m})$, which equals $-\\log\\sigma(m)$, without overflowing for large margins.',
    });
    p.prose(`
To watch a reward model learn, we need preferences we can see. In the toy below, an answer is a point with two features: its **length** and its **quality**. The SFT model's answers to a prompt form a cloud whose length varies a lot and whose quality varies only a little. Simulated labelers have a hidden taste: quality matters most, some extra length helps, and too much length hurts. Each comparison picks a winner with Bradley-Terry odds under that taste, so the labels are noisy the way real ones are. The reward model is the simplest possible: a weighted sum of the two features (each standardized by the SFT cloud's mean and spread), $\\symr(y) = w_0\\,\\text{length} + w_1\\,\\text{quality}$.`);
    p.figure({
      title: 'Training a reward model on pairs',
      codeTitle: 'train_rm.py',
      code: `
        # {{n:100}} pairs of (length, quality) features
        f_w, f_l = feats(chosen), feats(rejected)
        w = np.array([-0.6, 0.1])  # a random head
        for step in range(200):
            r_chosen = f_w @ w                   #@score
            r_rejected = f_l @ w                 #@score
            margin = r_chosen - r_rejected       #@margin
            loss = np.logaddexp(0, -margin).mean()   #@loss
            dm = -1 / (1 + np.exp(margin))       #@grad
            grad = (dm[:, None] * (f_w - f_l)).mean(0)   #@grad
            w -= 0.05 * grad                     #@update
        # step {{step:0}}  w = [{{w0:-0.6}}, {{w1:0.1}}]
        # loss {{loss:…}}
      `,
      setup: rewardModelFigure,
      caption: `Each gray segment is one labeled pair: the filled dot is the chosen answer, the open dot the rejected one (60 are drawn). The gold shading is the reward model's score, brighter where it is higher, and the gold lines are its contours. Press **Train**. The scalar head starts random (this one happens to prefer short answers, so it gets most pairs backwards); held-out accuracy climbs to within a point or two of the ceiling set by the labelers' own noise. Pairs the model still ranks backwards are drawn darker. Then show the hidden taste: its contours curve, because more length helps only up to a point, but a linear model can only draw straight lines, so it learns "longer is better" everywhere. Inside the cloud that is nearly right. Remember it for the last section.`,
    });

    // ------------------------------------------------------------ ratio
    p.h2('Reusing a batch: the importance ratio', 'ratio');
    p.prose(`
With a reward model in hand, stage 3 is reinforcement learning against it. In RLHF the expensive part is not the gradient step but the samples: every batch means generating full answers from a large model, one token at a time, then running them through the reward model and the reference. REINFORCE uses that batch for exactly one gradient step and throws it away. Why not take several steps on it?

Because after the first step the batch is stale. It was sampled from the policy as it was, call it $\\pi_{\\theta_\\text{old}}$, and the policy gradient assumes the samples come from the current one. **Importance sampling** fixes the bookkeeping: to average under one distribution using samples from another, weight each sample by how much more likely the new distribution makes it.`);
    p.math({
      label: 'Importance ratio and surrogate objective',
      tex: String.raw`\symrho_t(\theta) = \frac{\sympi(a_t \mid s_t)}{\sym{pi}{\pi_{\theta_\text{old}}}(a_t \mid s_t)}, \qquad L^{\text{IS}}(\theta) = \hat{\mathbb{E}}_t\big[\symrho_t(\theta)\, \symA_t\big]`,
      codeTitle: 'surrogate.py',
      code: `
        logp_old = policy.logprobs(x, y).detach()
        for epoch in range(4):        # reuse the batch
            logp = policy.logprobs(x, y)
            ratio = (logp - logp_old).exp()  # per token
            loss = -(ratio * adv).mean()
            loss.backward(); opt.step(); opt.zero_grad()
      `,
      terms: [
        [String.raw`\sym{pi}{\pi_{\theta_\text{old}}}`, 'the policy that generated the batch, frozen for the duration of the update'],
        [String.raw`\symrho_t(\theta)`, 'the importance ratio: above 1 if token $a_t$ has become more likely since sampling, below 1 if less'],
        [String.raw`\hat{\mathbb{E}}_t`, 'the average over every token in the batch'],
      ],
      explain: 'At the first step $\\theta = \\theta_\\text{old}$, every ratio is exactly 1, and the gradient of $\\symrho\\symA$ is exactly the REINFORCE gradient: the slope of $\\symrho$ is $\\symrho$ times the slope of $\\log\\sympi$, and $\\symrho = 1$. After that the ratios correct for the drift: a token that has become twice as likely counts twice as much, because the new policy would write it twice as often. Ratios are computed from log-probabilities, as `exp(logp - logp_old)`, because log-probabilities are what the model outputs and they stay accurate even for very unlikely tokens. The PPO paper writes this ratio $r_t(\\theta)$; this course uses $\\symrho$ (rho) to keep $\\symr$ for the reward.',
    });
    p.prose(`
The correction is exact on average, but only as good as the batch. A dozen samples cannot say much about a policy far from the one that produced them, and nothing at all about answers they never contain. Push the policy too far on one batch and it can collapse onto whatever got lucky. Worse, once an answer's probability is near zero, the policy stops sampling it, so it never gets the evidence that would change its mind. The figure runs exactly this loop on a prompt with five kinds of answer.`);
    p.figure({
      title: 'Several steps per batch, with and without clipping',
      codeTitle: 'ppo_bandit.py',
      code: `
        mean_r = np.array([1.5, 0.2, -2.0, 0.5, 0.8])
        logits = np.array([0.0, 0.4, -0.3, 0.5, 0.3])
        for it in range(30):            # fresh batch
            p_old = softmax(logits)
            a = rng.choice(5, size=12, p=p_old)
            reward = mean_r[a] + 1.5 * rng.normal(size=12)
            adv = reward - reward.mean()
            logp_old = np.log(p_old[a])
            for k in range({{K:1}}):       # reuse it   #@reuse
                logp = np.log(softmax(logits)[a])
                ratio = np.exp(logp - logp_old)       #@ratio
                obj = ratio * adv
                lo, hi = 1 - eps, 1 + eps  # eps {{eps:0.2}}   #@clip
                clipped = np.clip(ratio, lo, hi) * adv   #@clip
                loss = -np.mean({{obj:obj}})            #@clip
                logits -= 0.5 * grad(loss, logits)
        # grad(): any autograd, e.g. PyTorch's
      `,
      setup: reuseFigure,
      caption: `Each thin line is one of 16 independent training runs; the thick line is their average. The rewards are noisy, the way a reward model gives different scores to different answers of the same kind. With **1** step per batch, learning is steady but slow. Slide to **20** steps: the runs climb much faster, but some lurch onto "dry" or "jargon" (red) and never come back. Now switch **clip** on: the runs stay fast, and they all find "story". The next section explains what that switch does.`,
    });

    // ------------------------------------------------------------ clipping
    p.h2('The clipped surrogate', 'clipping');
    p.prose(`
TRPO (Schulman et al., 2015), PPO's predecessor, made the "do not go too far" rule explicit: maximize the surrogate subject to a limit on the KL divergence between the old and new policies, a *trust region*. Enforcing that constraint takes second-order machinery (conjugate gradients and a line search). **Proximal Policy Optimization** (Schulman et al., 2017) gets most of the benefit with a small change to the loss:`);
    p.math({
      label: 'PPO clipped objective',
      tex: String.raw`L^{\text{CLIP}}(\theta) = \hat{\mathbb{E}}_t\Big[\min\big(\symrho_t(\theta)\,\symA_t,\;\; \operatorname{clip}(\symrho_t(\theta),\, 1-\symeps,\, 1+\symeps)\,\symA_t\big)\Big]`,
      codeTitle: 'ppo_loss.py',
      code: `
        def ppo_loss(logp, logp_old, adv, eps=0.2):
            ratio = np.exp(logp - logp_old)
            unclipped = ratio * adv
            lo, hi = 1 - eps, 1 + eps
            clipped = np.clip(ratio, lo, hi) * adv
            return -np.minimum(unclipped, clipped).mean()
      `,
      terms: [
        [String.raw`\symrho_t\,\symA_t`, 'the plain surrogate from the previous section'],
        [String.raw`\operatorname{clip}(\symrho_t, 1-\symeps, 1+\symeps)`, 'the ratio forced into the band $[1-\\epsilon, 1+\\epsilon]$. The paper\'s default is $\\epsilon = 0.2$: a band from 0.8 to 1.2'],
        [String.raw`\min(\cdot,\cdot)`, 'keep the smaller, more pessimistic, of the two'],
      ],
      explain: 'Inside the band the two terms agree and nothing changes. Outside it, the min picks whichever term is smaller. When that is the clipped term, it is flat in $\\theta$, so its gradient is zero: that token stops pushing. As a result, no single batch rewards moving a token\'s probability by more than about 20% in the direction its advantage suggests.',
    });
    p.prose(`
Work through the four cases with $\\epsilon = 0.2$ and an advantage of $\\pm 2$:`);
    p.table(
      ['', '$\\symrho = 0.5$ (token now half as likely)', '$\\symrho = 1.5$ (token now 50% more likely)'],
      [
        ['$\\symA = +2$ (good token)', 'unclipped 1.0, clipped 1.6: min **1.0**, slope 2. Keep pushing it up', 'unclipped 3.0, clipped 2.4: min **2.4**, slope 0. Stop: it has gained enough'],
        ['$\\symA = -2$ (bad token)', 'unclipped −1.0, clipped −1.6: min **−1.6**, slope 0. Stop: it has dropped enough', 'unclipped −3.0, clipped −2.4: min **−3.0**, slope −2. Keep pushing it down'],
      ],
    );
    p.prose(`
For a good token ($\\symA > 0$) the objective rises with $\\symrho$ until $1 + \\epsilon$ and then goes flat: once the token is 20% more likely than when it was sampled, this batch stops asking for more. Below $1 - \\epsilon$ there is no clipping at all, so if an update somehow made a good token *less* likely, the full gradient remains to pull it back. A bad token ($\\symA < 0$) mirrors this: lowering $\\symrho$ helps until $1 - \\epsilon$, then the curve goes flat, while above $1 + \\epsilon$ (an update that made a bad token *more* likely) there is no clipping and the full penalty applies.

That asymmetry is what the min is for. Clipping only ever removes the incentive to keep improving the surrogate; it never hides a step in the wrong direction. The clipped objective is a pessimistic lower bound on the unclipped one.`);
    p.figure({
      title: 'The clipped objective for one token',
      codeTitle: 'clip_one_token.py',
      code: `
        eps = {{eps:0.2}}
        adv = {{A:1.0}}     # advantage
        ratio = {{rho:1.3}}   # new prob / old prob

        lo, hi = 1 - eps, 1 + eps
        unclipped = ratio * adv   # {{u}}            #@u
        clipped = np.clip(ratio, lo, hi) * adv   # {{c}}   #@c
        objective = min(unclipped, clipped)   # {{o}}  #@o
        # slope in ratio: {{g}}
      `,
      setup: clipFigure,
      caption: `The thick curve is the clipped objective as a function of the ratio $\\symrho$, green where it still has a slope and red where it is flat; the dashed purple line is the unclipped $\\symrho\\symA$. **Drag** along the plot to move the token's ratio; the arrow shows which way the gradient pushes it. Slide $\\symA$ below zero for the mirror image (the PPO paper's Figure 1 shows the same two shapes), and change $\\epsilon$ to widen or narrow the gray band. Then go back to the previous figure and switch clipping on.`,
    });
    p.callout('aside', `Clipping does not strictly keep every ratio inside the band. All tokens share the same weights, so the gradients of unclipped tokens can still drag a clipped one further. Implementations therefore also watch the measured KL between the old and new policy (and the *clip fraction*, the share of tokens being clipped), and end the epochs on a batch early when the KL grows too large.`, 'Not a hard wall');

    // ------------------------------------------------------------ gae
    p.h2('Advantages: the value head and GAE', 'gae');
    p.prose(`
PPO needs an advantage for every token, but the reward model scores only the finished answer. Which tokens deserve the credit? The tool is a **value function** $\\symV(s_t)$: a prediction, made at every position, of the total reward still to come from there. In RLHF it is a transformer with a scalar head that outputs one number per token; InstructGPT used a separate value model, initialized from the reward model, and trained it alongside the policy.`);
    p.math({
      label: 'TD error: the surprise at one token',
      tex: String.raw`\delta_t = r_t + \gamma\, \symV(s_{t+1}) - \symV(s_t)`,
      codeTitle: 'td_error.py',
      code: `
        # values[t] = V(s_t), and values[T] = 0
        delta = (rewards[t] + gamma * values[t + 1]
                 - values[t])
      `,
      terms: [
        [String.raw`\symV(s_t)`, 'what the value head expected, before token $t$'],
        [String.raw`r_t + \gamma\,\symV(s_{t+1})`, 'what it expects after token $t$: the reward that just arrived plus the new expectation'],
        [String.raw`\gamma`, 'gamma, a discount on later rewards. Language-model RLHF usually sets $\\gamma = 1$: answers are short and the end is what counts'],
      ],
      explain: '$\\delta_t$ is the *temporal-difference error*: how much better things look after the token than before it. If the token made the answer look more promising, $\\delta_t$ is positive. With the true value function, $\\delta_t$ is on average exactly the advantage of the token taken. With a learned one, it inherits the value head\'s mistakes.',
    });
    p.math({
      label: 'Generalized advantage estimation',
      tex: String.raw`\symA_t = \sum_{l=0}^{T-t-1} (\gamma\symlam)^l\, \delta_{t+l}`,
      codeTitle: 'gae.py',
      code: `
        def gae(rewards, values, gamma=1.0, lam=0.95):
            T = len(rewards)
            adv, last = np.zeros(T), 0.0
            for t in reversed(range(T)):
                delta = (rewards[t] + gamma * values[t + 1]
                         - values[t])
                last = delta + gamma * lam * last
                adv[t] = last
            return adv, adv + values[:T]  # + value targets
      `,
      terms: [
        [String.raw`\delta_{t+l}`, 'the surprise $l$ tokens later'],
        [String.raw`(\gamma\symlam)^l`, 'its weight: 1 for this token, then shrinking geometrically. $\\lambda$ (lambda) sets how fast'],
        [String.raw`\sum_{l}`, 'add up the weighted surprises from token $t$ to the end of the answer'],
      ],
      explain: 'Generalized advantage estimation (Schulman et al., 2015) blends every horizon at once. With $\\lambda = 0$, $\\symA_t = \\delta_t$: trust the value head completely after a single token. That has low variance but is biased whenever the value head is wrong. With $\\lambda = 1$ the sum *telescopes* (each $+\\symV(s_{t+1})$ cancels the next term\'s $-\\symV(s_{t+1})$) down to the actual reward from $t$ to the end minus $\\symV(s_t)$: the value head is only a baseline, so the estimate is unbiased, but every later random token adds noise. In between, $\\lambda$ trades bias for variance. The loop runs backwards because each advantage reuses the next one. RLHF implementations commonly use $\\gamma = 1$ and $\\lambda$ around 0.95.',
    });
    p.math({
      label: 'Value loss',
      tex: String.raw`L^{V} = \hat{\mathbb{E}}_t\Big[\big(\symV(s_t) - \hat{R}_t\big)^2\Big], \qquad \hat{R}_t = \symA_t + \symV_\text{old}(s_t)`,
      codeTitle: 'value_loss.py',
      code: `
        adv, returns = gae(rewards, values_old)  # once
        values = critic(x, y)          # every PPO step
        v_loss = np.mean((values - returns) ** 2)
      `,
      terms: [
        [String.raw`\hat{R}_t`, 'the return that GAE implies: the old value estimate plus the advantage'],
        [String.raw`(\symV(s_t) - \hat{R}_t)^2`, 'squared error: an ordinary regression'],
      ],
      explain: 'The value head regresses onto the returns it actually sees, in the same PPO epochs as the policy, usually by adding a weighted $L^V$ to the policy loss. The better it predicts, the more the low-$\\lambda$ end of the trade becomes affordable.',
    });
    p.prose(`
The figure makes the trade visible on a toy chain of ten tokens. Each token is "good" with probability one half, and the reward at the end is the number of good tokens plus noise. The true advantage of a good token is therefore exactly 1 more than that of a bad token. A useful estimator must recover that gap, and with little noise. The critic is deliberately flawed: a blend of the true value and a constant guess that ignores everything the answer has done so far.`);
    p.figure({
      title: 'GAE: bias against variance',
      codeTitle: 'gae_toy.py',
      code: `
        def gae(rewards, values, gamma=1.0, lam={{lam:0.95}}):
            T = len(rewards)
            adv, last = np.zeros(T), 0.0
            for t in reversed(range(T)):
                delta = (rewards[t] + gamma * values[t + 1]   #@delta
                         - values[t])                         #@delta
                last = delta + gamma * lam * last   #@acc
                adv[t] = last
            return adv

        # 10 tokens, each good with probability 0.5
        # reward at the end: number of good + noise
        k = {{k:0.6}}                     # critic error   #@critic
        values = (1 - k) * V_true + k * 5.0   # flawed   #@critic
        # token {{t:2}}: gap {{gap}} (true 1), noise {{spread}}
      `,
      setup: gaeFigure,
      caption: `**Top**: one rollout. Each token is good (green) or not (gray); the teal line is the critic's value before each token and the gold dot is the reward after the last. Below them, each token's surprise $\\delta$ and its advantage $\\symA$. **Tap a token**: the numbers are the weights $\\lambda^l$ with which later surprises count toward its advantage, and the shading follows them. **Middle**: that token's advantage across 2,000 rollouts, split by whether it was good or bad; the gap between the two averages should be 1. **Bottom**: the gap and the noise as $\\lambda$ varies. With a flawed critic, $\\lambda = 0$ is tight but wrong and $\\lambda = 1$ is right but noisy. Set the critic error to 0: now $\\lambda = 0$ is perfect, because all of GAE's bias comes from the value head.`,
    });
    p.callout('intuition', `[GRPO](#/grpo) drops the value head entirely. It samples several answers to the same prompt and gives every token of an answer the same advantage: that answer's reward compared with the group's. In the language of this section, that is $\\lambda = 1$ with a baseline computed from the other samples instead of from a learned critic.`, 'Looking ahead');

    // ------------------------------------------------------------ kl
    p.h2('The KL penalty, token by token', 'kl');
    p.prose(`
The KL leash has to become a per-token signal too. The log-probability of an answer is the sum of its tokens' log-probabilities (the chain rule of probability), so the log-ratio between policy and reference for a whole answer is a sum over its tokens. For each sampled token, $\\log\\sympi(a_t \\mid s_t) - \\log\\sympiref(a_t \\mid s_t)$ is a one-sample estimate of that token's share of the KL. RLHF implementations (Ziegler et al., 2019; InstructGPT) fold the penalty straight into the reward:`);
    p.math({
      label: 'Per-token reward',
      tex: String.raw`r_t \;=\; -\,\symbeta \log \frac{\sympi(a_t \mid s_t)}{\sympiref(a_t \mid s_t)} \;+\; \mathbf{1}[t = T]\; \symr_\phi(x, y)`,
      codeTitle: 'token_rewards.py',
      code: `
        kl = logp_old - logp_ref  # (T,), from sampling
        rewards = -beta * kl      # every token pays
        rewards[-1] += reward     # RM score at the end
        adv, returns = gae(rewards, values)
      `,
      terms: [
        [String.raw`\log \frac{\sympi(a_t \mid s_t)}{\sympiref(a_t \mid s_t)}`, 'how much more likely the policy finds this token than the reference does, in log units'],
        [String.raw`\mathbf{1}[t = T]`, 'an *indicator*: 1 on the last token, 0 everywhere else'],
        [String.raw`\symr_\phi(x, y)`, 'the reward model\'s score for the finished answer'],
      ],
      explain: 'Every token pays $\\beta$ times its log-ratio: a token the policy now finds far more likely than the reference did costs a lot; one they agree on costs almost nothing. The reward model\'s score arrives only at the end, and GAE spreads both kinds of reward across the tokens like any other reward. One token\'s log-ratio can be negative, since the policy may make a token less likely than the reference did, but its average over sampled answers is the KL, which never is. The log-probabilities come from sampling time and stay fixed during the PPO epochs. Some implementations adjust $\\beta$ during training to hold the KL near a target, as Ziegler et al. did.',
    });
    p.figure({
      title: 'Where the KL penalty bites',
      codeTitle: 'kl_penalty.py',
      code: `
        # prompt: "Describe the sea in one line."
        logp = policy.logprobs(prompt, tokens)  # (14,)   #@lp
        logp_ref = ref.logprobs(prompt, tokens)           #@lp
        kl = logp - logp_ref     # sum {{kl:5.9}}          #@kl
        rewards = -beta * kl     # beta {{beta:0.1}}       #@pen
        rewards[-1] += reward    # +1.8 from the RM      #@rm
        # total reward {{total}}
      `,
      setup: klFigure,
      caption: `One sampled answer with toy per-token log-probabilities. The policy has learned to open with "Sure!": the reference found that opening unlikely, so those two tokens carry most of the KL and most of the penalty, while the tokens that actually describe the sea cost almost nothing. **Tap a row** to see its two log-probabilities. Slide $\\symbeta$: at 0 the reward model's 1.8 is the whole story; near 0.3 the drift costs almost everything the reward model gave.`,
    });

    // ------------------------------------------------------------ four models
    p.h2('Four models in memory', 'four-models');
    p.prose(`
Put it all together and one PPO iteration in RLHF touches four networks, each often the size of the full model:`);
    p.table(
      ['Model', 'Role', 'Trained?', 'Gives'],
      [
        ['Policy $\\sympi$', 'writes the answers; the model we keep', 'yes', 'log-prob of each token'],
        ['Reference $\\sympiref$', 'the frozen SFT model, for the KL', 'no', 'log-prob of each token'],
        ['Reward model $\\symr_\\phi$', 'scores finished answers', 'no', 'one number per answer'],
        ['Value model $\\symV$', 'predicts reward to come, for GAE', 'yes', 'one number per token'],
      ],
    );
    p.prose(`
Training a model with Adam in mixed precision costs about 16 bytes per parameter before activations: 2 for the bf16 weights, 2 for their gradients, 4 for a float32 master copy and 8 for Adam's two moments. A frozen model in bf16 costs 2. On top of that sits the memory for generation (the KV cache) and for activations.`);
    p.figure({
      title: 'What sits in GPU memory',
      codeTitle: 'memory.py',
      code: `
        N_pol = {{np:7}}e9   # policy, reference
        N_rm = {{nr:7}}e9    # reward model, critic
        TRAIN, FROZEN = 16, 2   # bytes per param

        gb = {
          "policy": TRAIN * N_pol / 1e9,  # {{policy_gb}}   #@policy
          "critic": TRAIN * N_rm / 1e9,   # {{critic_gb}}   #@critic
          "reference": FROZEN * N_pol / 1e9,  # {{ref_gb}}  #@ref
          "reward": FROZEN * N_rm / 1e9,  # {{rm_gb}}       #@rm
        }
        skip = {{skip:[]}}   # {{recipe:PPO: all four}}
        total = sum(v for k, v in gb.items()
                    if k not in skip)    # {{total}} GB
      `,
      setup: memoryFigure,
      caption: `Boxes with a solid border are trained, dashed ones frozen; the bar stacks their memory, with a tick every 80 GB. A 7B policy with 7B helpers needs about 252 GB before a single activation, more than twice what supervised fine-tuning of the same model needs. InstructGPT kept its reward and value models at 6B even for a 175B policy; slide the second size down to see why. The recipe switch previews the next chapters: [GRPO](#/grpo) drops the critic, and [DPO](#/dpo) drops the reward model and the critic, keeping only the policy and its reference (whose log-probabilities can even be computed once, ahead of time).`,
    });
    p.prose(`
Here is one full iteration, written PyTorch-style. Everything in it has appeared above; the only new pieces are bookkeeping that real implementations need.`);
    p.code(
      `
      for iteration in range(num_iterations):
          x = sample_prompts(batch_size)
          with torch.no_grad():                          # rollout
              y, logp_old = policy.generate(x)           # (B, T) per token
              logp_ref = ref.logprobs(x, y)
              reward = rm(x, y)                          # (B,) one per answer
              values_old = critic(x, y)                  # (B, T + 1), 0 at the end
          rewards = -beta * (logp_old - logp_ref)        # per-token KL
          rewards[:, -1] += reward                       # last real token
          adv, returns = gae(rewards, values_old, gamma=1.0, lam=0.95)
          adv = (adv - adv.mean()) / (adv.std() + 1e-8)  # whiten

          for epoch in range(4):                         # reuse the batch
              for mb in minibatches(batch_size):
                  logp = policy.logprobs(x[mb], y[mb])
                  ratio = (logp - logp_old[mb]).exp()
                  pg_loss = -torch.min(ratio * adv[mb],
                      ratio.clamp(1 - eps, 1 + eps) * adv[mb]).mean()
                  v_loss = ((critic(x[mb], y[mb]) - returns[mb]) ** 2).mean()
                  (pg_loss + 0.5 * v_loss).backward()
                  opt.step(); opt.zero_grad()
      `,
      { title: 'ppo_rlhf.py' },
    );
    p.prose(`
A few details that the listing glosses over. Losses are averaged only over answer tokens: prompt and padding positions are masked out, and "the last token" means the last real one. Advantages are *whitened* (shifted to mean 0 and scaled to standard deviation 1 across the batch), which keeps the step size steady as rewards drift. And the rollout dominates the wall-clock time: generating long answers token by token is far slower than the gradient steps, which is exactly why PPO's batch reuse matters.`);

    // ------------------------------------------------------------ hacking
    p.h2('Reward hacking and over-optimization', 'hacking');
    p.prose(`
The reward model is not the labelers. It is a model fit to some tens of thousands of comparisons between SFT answers, and it is only accurate where those answers lived. The policy, meanwhile, is an optimizer pointed straight at it. Push hard enough and the policy finds answers the reward model scores highly for the wrong reasons. This is **Goodhart's law**, usually stated as "when a measure becomes a target, it ceases to be a good measure."

The failures are familiar to anyone who has used chat models:

- **Length.** Labelers mildly prefer more thorough answers, so reward models learn that longer is better, and RLHF'd models grow verbose. Studies of open RLHF pipelines have found that a large share of the reward gained comes from length alone.
- **Sycophancy.** People tend to prefer answers that agree with them, so the model learns to agree, even with a premise that is false.
- **Style over substance.** Confident tone, headers and bullet lists, and apologetic hedging can all earn reward without making an answer more correct.

The same thing happens in classic reinforcement learning: an agent in the boat-racing game CoastRunners, rewarded for points, learned to circle forever collecting the same respawning targets instead of finishing the race.

Gao, Schulman and Hilton (2022) measured over-optimization directly. A large "gold" reward model stood in for the labelers, and policies were trained against smaller proxy reward models fit to the gold model's preferences. As the policy moved away from its starting point (measured by the square root of its KL from the initial policy), the proxy reward kept rising, while the gold reward rose, peaked, and fell. Larger reward models and more comparison data pushed the peak further out, but did not remove it.

The toy reward model from earlier shows the same shape. Its policy is a cloud of answers whose center moves under policy-gradient steps on the reward model's score minus $\\symbeta$ times the KL. In this toy, the SFT model's answers vary a lot in length and very little in quality, so for the same KL the policy can lengthen its answers far more than it can improve them; and the reward model believes longer is always better.`);
    p.figure({
      title: 'Over-optimization: the proxy rises, the truth falls',
      codeTitle: 'overoptimize.py',
      code: `
        w_rm = np.array([{{w0}}, {{w1}}])  # trained RM
        beta = {{beta:0.05}}
        m = np.zeros(2)       # policy center: at SFT
        for step in range(600):
            e = rng.normal(size=(64, 2))    # 64 answers   #@sample
            y = m + e                                      #@sample
            # log pi(y) - log pi_ref(y), per answer
            kl = e @ m + m @ m / 2                         #@kl
            reward = y @ w_rm - beta * kl                  #@reward
            adv = reward - reward.mean()                   #@adv
            m += 0.05 * (adv[:, None] * e).mean(0)         #@step
        # KL {{kl}}  proxy {{proxy}}  true {{gold}}
      `,
      setup: overoptFigure,
      caption: `**Top**: the answer space. Green shading is the labelers' true taste, the gold lines are the reward model's contours, the orange ellipse is the SFT cloud (the reference), and the blue dots are the policy's current answers. **Bottom**: the gain in reward-model score (gold) and in true taste (green) against $\\sqrt{\\text{KL}}$, with faint dashed lines for the whole path. Press **Optimize** with $\\symbeta = 0.05$: answers get longer, the proxy climbs without end, and the true score peaks at the small circle and then collapses. Reset, set $\\symbeta$ near 0.3 and optimize again: the leash stops the policy close to the peak. With $\\symbeta = 1$ it stops early and safe, leaving gains on the table. That is what $\\symbeta$ is for, and why choosing it is hard: in a real run, nobody can see the green curve.`,
    });
    p.prose(`
Practical defenses all follow from the picture. The KL penalty keeps the policy where the reward model is trustworthy. Checkpoints are chosen by human or held-out evaluation, not by reward. Larger reward models, and *ensembles* of several, are harder to fool. Most effective of all is to refresh the reward model: collect new comparisons on the current policy's own answers and retrain it, so that the region the policy has moved into gets labeled. Anthropic's 2022 helpful-and-harmless assistant was trained this way, in rounds, and reported that the reward rose roughly in proportion to the square root of the KL.`);

    // ------------------------------------------------------------ next
    p.h2('What came next', 'next');
    p.prose(`
RLHF with PPO is powerful and heavy: four models, a generation loop inside the training loop, and a dozen hyperparameters ($\\symbeta$, $\\epsilon$, $\\lambda$, epochs, minibatch size, learning rates for two networks) that can all quietly go wrong. Two lines of work simplify it, and they are the next two chapters:

- [Direct preference optimization](#/dpo) notices that the KL-regularized objective at the top of this chapter has a closed-form optimal policy, and turns preference learning back into a classification loss on pairs: no reward model, no sampling, no value head.
- [GRPO](#/grpo) keeps PPO's clipped objective but drops the value head, comparing several answers to the same prompt instead. Paired with rewards that a program can check, such as a math answer or a unit test, it trained the reasoning models of 2025.`);
    p.callout(
      'idea',
      `RLHF learns a reward from human comparisons (a Bradley-Terry classifier on score differences), then optimizes the policy against it with PPO, leashed to the SFT model by a KL penalty folded into each token's reward. PPO reuses each expensive batch for several steps by weighting tokens with the importance ratio $\\symrho$, and clips that ratio pessimistically so no batch can move a token's probability far. A value head and GAE turn one end-of-answer score into per-token advantages, with $\\lambda$ trading bias for variance. The learned reward is a proxy: optimize it too hard and true quality falls, which is what the KL penalty, held-out evaluation and fresh comparisons are there to prevent.`,
      'Takeaways',
    );

    // ------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **The clipped loss (NumPy, 15 minutes).** Write \`ppo_loss(logp, logp_old, adv, eps)\` from the clipped-objective card. Check it on the four cases in the table above, then estimate its gradient with respect to \`logp\` by finite differences (nudge one entry by $10^{-5}$ and watch the loss). Success: the gradient is exactly zero for the two "stop" cells and equal to $-\\symA\\symrho/N$ for the two "keep pushing" cells, where $N$ is the number of tokens.

2. **GAE, both ends (NumPy, 30 minutes).** Implement \`gae(rewards, values, gamma, lam)\` with the backwards loop. Verify that $\\lambda = 0$ returns the TD errors $\\delta_t$ and that $\\lambda = 1$, $\\gamma = 1$ returns the reward-to-go minus $\\symV(s_t)$. Then reproduce the bottom panel of the GAE figure: simulate the ten-token chain, and plot the good-minus-bad gap and its noise against $\\lambda$ for a perfect and a flawed critic.

3. **A reward model from pairs (NumPy, 1 hour).** Generate answers as feature vectors, define a hidden utility, and sample pairs with Bradley-Terry labels. Fit a linear reward model with the loss in this chapter and report held-out pair accuracy against the ceiling (how often the hidden utility itself agrees with the labels). Then give the model a squared-length feature. Success: it learns the curved taste, and you can explain why real reward models cannot simply be given "the right features".

4. **PPO on a tiny language model (project, an evening).** Make a "language model" that writes three tokens from a six-word vocabulary, as a table of logits per position (or a small MLP). Write a reward function, make a frozen copy as the reference, and implement the full loop: sample a batch, per-token KL rewards, GAE with a learned value table, and several clipped epochs per batch. Plot the reward, the true objective you care about, and the KL across iterations. Success: lowering $\\symbeta$ shows the over-optimization curve, and turning clipping off with many epochs per batch makes training unstable.

5. **RLHF a real small model (project, a weekend).** Take a small pretrained GPT-2, prompts that open movie reviews, and an off-the-shelf sentiment classifier as the reward model; Hugging Face's TRL library has worked examples of this setup. Train with PPO to write positive reviews. Success: the mean reward rises while the KL to the starting model stays moderate and the text stays fluent. Then set $\\symbeta$ to 0 and find the point where the model starts repeating words like "great" over and over: reward hacking you can read.`);
  },
};

export default chapter;
