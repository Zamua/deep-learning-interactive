import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { Box, badge, fitCanvas, fitTxt, legend, mono, rrect, tag, txt, ui } from './reasoning-draw';
import {
  BestOfN,
  CUPS,
  GUESS,
  MARKERS,
  MARKERS_ANSWER,
  MAX_SWAPS,
  PRM_BAD,
  PRM_OK,
  P_GRID,
  SLIP,
  betaWeights,
  budgetCurve,
  coverage,
  cupsNoCotAccuracy,
  drawCandidates,
  drawVote,
  klBestOfN,
  makeSwaps,
  meanP,
  passAt,
  runCups,
  voteAccuracy,
  voteCeiling,
  workSteps,
} from './reasoning-math';

const pct = (v: number, d = 0): string => `${(v * 100).toFixed(d)}%`;
const pyf = (v: number, d = 2): string => (Number.isInteger(v) ? v.toFixed(1) : v.toFixed(d));
const log2 = Math.log2;

/** A pointer-drag handler on a canvas that also fires on the first press. */
function drag(cv: HTMLCanvasElement, fn: (e: PointerEvent) => void): void {
  let on = false;
  cv.addEventListener('pointerdown', (e) => {
    on = true;
    cv.setPointerCapture(e.pointerId);
    fn(e);
  });
  cv.addEventListener('pointermove', (e) => on && fn(e));
  cv.addEventListener('pointerup', () => (on = false));
  cv.addEventListener('pointercancel', () => (on = false));
}

// ---------------------------------------------------------------- serial steps: the cups

export function figCups(f: Fig): void {
  let seed = 5;
  let all = makeSwaps(seed);
  let n = 8;
  let L = 3;
  let cot = true;
  type St = { kind: 'layer' | 'write' | 'answer'; pass: number; k: number };
  let steps: St[] = [];
  let cur = 0;
  let run = runCups(all.slice(0, n), L, cot);
  const build = () => {
    run = runCups(all.slice(0, n), L, cot);
    steps = [];
    run.passes.forEach((ps, pi) => {
      for (let k = ps.from; k < ps.to; k++) steps.push({ kind: 'layer', pass: pi, k });
      steps.push({ kind: pi === run.passes.length - 1 ? 'answer' : 'write', pass: pi, k: ps.to });
    });
  };
  const stepOf = (pred: (s: St) => boolean) => steps.findIndex(pred);
  const label = (s: [number, number]) => `${s[0]}↔${s[1]}`;
  const geo = (w: number) => {
    const narrow = w < 470;
    const chipRows = narrow ? 2 : 1;
    const rowH = narrow ? 34 : 38;
    const top = 22 + chipRows * 30 + 18;
    return { narrow, chipRows, rowH, top };
  };
  const cv = fitCanvas(f, (w) => {
    const g = geo(w);
    return g.top + run.passes.length * g.rowH + 16 + 72;
  }, (ctx, w) => {
    const g = geo(w);
    const fs = g.narrow ? 10.5 : 12;
    txt(ctx, 'Where is the ball? It starts under cup 0.', 8, 11, ui(g.narrow ? 12 : 13, 650), color('--ink-2'));
    // the swaps, colored by the pass that applied them
    const perRow = g.chipRows === 2 ? 6 : MAX_SWAPS;
    const cw = Math.min(46, (w - 16) / perRow);
    for (let k = 0; k < n; k++) {
      const x = 8 + (k % perRow) * cw;
      const y = 24 + Math.floor(k / perRow) * 30;
      const pi = run.passes.findIndex((ps) => k >= ps.from && k < ps.to);
      const si = stepOf((s) => s.kind === 'layer' && s.k === k);
      const done = pi >= 0 && si <= cur;
      const col = pi < 0 ? color('--ink-3') : color('blue');
      rrect(ctx, x + 2, y, cw - 4, 24, 5, withAlpha(col, done ? 0.2 : 0.05), withAlpha(col, done ? 0.9 : 0.4), si === cur ? 2 : 1);
      txt(ctx, label(all[k]!), x + cw / 2, y + 12.5, mono(fs, 600), pi < 0 ? color('--ink-3') : color('--ink'), 'center');
      if (pi < 0) {
        ctx.strokeStyle = withAlpha(color('red'), 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 20);
        ctx.lineTo(x + cw - 5, y + 4);
        ctx.stroke();
      }
    }
    // one row per forward pass
    const inW = g.narrow ? 30 : 36;
    const outW = g.narrow ? 46 : 56;
    const ar = g.narrow ? 12 : 18;
    const x0 = 8;
    const cellW = Math.min(64, (w - 16 - inW - outW - 2 * ar) / L);
    const gx = x0 + inW + ar;
    txt(ctx, `${run.passes.length} forward pass${run.passes.length > 1 ? 'es' : ''}, ${L} layer${L > 1 ? 's' : ''} each`, 8, g.top - 9, ui(11), color('--ink-3'));
    run.passes.forEach((ps, pi) => {
      const y = g.top + pi * g.rowH;
      const h = g.rowH - 10;
      const startStep = stepOf((s) => s.pass === pi);
      const live = startStep <= cur;
      ctx.globalAlpha = live ? 1 : 0.35;
      // input: the question, or the token the last pass wrote
      const inCol = color(pi === 0 ? 'orange' : 'purple');
      rrect(ctx, x0, y, inW, h, 6, withAlpha(inCol, 0.14), inCol, 1.2);
      txt(ctx, pi === 0 ? 'x' : String(run.passes[pi - 1]!.ball), x0 + inW / 2, y + h / 2 + 0.5, pi === 0 ? `italic 650 ${fs + 3}px 'Source Serif 4 Variable', Georgia, serif` : mono(fs + 1, 650), inCol, 'center');
      for (let l = 0; l < L; l++) {
        const k = ps.from + l;
        const used = k < ps.to;
        const si = used ? stepOf((s) => s.kind === 'layer' && s.k === k) : -1;
        const on = used && si <= cur;
        const x = gx + l * cellW;
        rrect(ctx, x + 1.5, y, cellW - 3, h, 4, withAlpha(color('blue'), on ? 0.22 : 0.05), withAlpha(color('blue'), si === cur ? 1 : on ? 0.7 : 0.3), si === cur ? 2.2 : 1);
        if (used) txt(ctx, label(all[k]!), x + cellW / 2, y + h / 2 + 0.5, mono(fs, 600), on ? color('--ink') : color('--ink-3'), 'center');
        else txt(ctx, 'idle', x + cellW / 2, y + h / 2 + 0.5, ui(fs - 0.5), color('--ink-3'), 'center');
      }
      // arrows in and out of the layer stack
      ctx.strokeStyle = color('--ink-3');
      ctx.lineWidth = 1.2;
      const my = y + h / 2;
      for (const [a, b] of [[x0 + inW + 2, gx - 2], [gx + L * cellW + 2, gx + L * cellW + ar - 2]] as const) {
        ctx.beginPath();
        ctx.moveTo(a, my);
        ctx.lineTo(b, my);
        ctx.lineTo(b - 4, my - 3);
        ctx.moveTo(b, my);
        ctx.lineTo(b - 4, my + 3);
        ctx.stroke();
      }
      const last = pi === run.passes.length - 1;
      const ox = gx + L * cellW + ar;
      const wi = stepOf((s) => s.pass === pi && s.kind !== 'layer');
      const wrote = wi <= cur;
      const outCol = color(last ? 'green' : 'purple');
      rrect(ctx, ox, y, outW, h, 6, withAlpha(outCol, wrote ? 0.18 : 0.04), withAlpha(outCol, wrote ? 1 : 0.35), wi === cur ? 2.2 : 1.2);
      if (wrote) txt(ctx, last ? `a = ${ps.ball}` : `z: ${ps.ball}`, ox + outW / 2, y + h / 2 + 0.5, mono(fs, 650), outCol, 'center');
      // the written token goes back in at the bottom of the next pass
      if (!last && wrote) {
        ctx.strokeStyle = withAlpha(color('purple'), 0.7);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ox + outW / 2, y + h);
        ctx.lineTo(ox + outW / 2, y + h + 5);
        ctx.lineTo(x0 + inW / 2, y + h + 5);
        ctx.lineTo(x0 + inW / 2, y + g.rowH - 1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    });
    // the cups: ball under the truth, the model's answer ringed
    const done = cur >= steps.length - 1;
    const cy = g.top + run.passes.length * g.rowH + 16;
    const cupW = Math.min(52, (w - 150) / CUPS);
    const cx0 = w - 8 - CUPS * cupW;
    for (let c = 0; c < CUPS; c++) {
      const x = cx0 + c * cupW + cupW / 2;
      const isAns = done && c === run.answer;
      if (c === run.truth && done) {
        ctx.beginPath();
        ctx.arc(x, cy + 34, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = color('gold');
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(x - cupW * 0.3, cy + 40);
      ctx.lineTo(x - cupW * 0.2, cy + 8);
      ctx.lineTo(x + cupW * 0.2, cy + 8);
      ctx.lineTo(x + cupW * 0.3, cy + 40);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color('slate'), c === run.truth && done ? 0.25 : 0.55);
      ctx.fill();
      if (isAns) {
        ctx.strokeStyle = color(run.answer === run.truth ? 'green' : 'red');
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      txt(ctx, String(c), x, cy + 54, mono(11, 600), color('--ink-3'), 'center');
    }
    if (done) {
      const ok = run.answer === run.truth;
      badge(ctx, 18, cy + 22, 9, ok);
      txt(ctx, `answer ${run.answer}`, 34, cy + 16, mono(12, 650), color(ok ? 'green' : 'red'));
      txt(ctx, `truth ${run.truth}`, 34, cy + 33, mono(12, 500), color('--ink-2'));
    } else txt(ctx, 'computing…', 8, cy + 24, ui(12), color('--ink-3'));
  });
  cv.canvas.classList.add('scroll-ok');
  const stepsRo = f.readout('serial steps available', { sym: 'L' });
  const accRo = f.readout('right over random swap lists');
  const sync = () => {
    const shown = all.slice(0, Math.min(n, 3)).map((s) => `(${s[0]}, ${s[1]})`).join(', ') + (n > 3 ? ', …' : '');
    const left = run.passes[run.passes.length - 1]!.to;
    f.code.setMany({ sw: shown, n, ans: run.answer, truth: run.truth, left: n - left });
    stepsRo.set(`${L * run.passes.length} of ${n} needed`);
    accRo.set(cot ? '100%' : pct(cupsNoCotAccuracy(n, L)));
  };
  const st = f.stepper({
    steps: 1,
    interval: 650,
    label: (i) => `step ${i + 1} / ${steps.length}`,
    onStep: (i) => {
      cur = i;
      const s = steps[i];
      if (s) f.code.highlight(s.kind === 'layer' ? ['pass', 'layer'] : s.kind === 'write' ? 'write' : 'answer');
      cv.redraw();
    },
  });
  const rebuild = () => {
    build();
    cv.refit();
    sync();
    st.setSteps(steps.length);
    st.go(steps.length - 1);
  };
  f.slider({ label: 'swaps', min: 1, max: MAX_SWAPS, step: 1, value: n, format: (v) => String(v), onInput: (v) => { n = v; rebuild(); } });
  f.slider({ label: 'layers L', sym: 'L', min: 1, max: 6, step: 1, value: L, slot: 'L', format: (v) => String(v), onInput: (v) => { L = v; rebuild(); } });
  f.toggle({
    label: 'write the steps (chain of thought)',
    value: true,
    onChange: (v) => {
      cot = v;
      f.code.set('cot', v ? 'True' : 'False');
      rebuild();
    },
  });
  f.button('New swaps', () => {
    seed += 1;
    all = makeSwaps(seed);
    rebuild();
  }, { icon: 'shuffle' });
  build();
  sync();
  queueMicrotask(() => {
    st.setSteps(steps.length);
    st.go(steps.length - 1);
  });
}

// ---------------------------------------------------------------- majority vote

export function figVote(f: Fig): void {
  let p = 0.4;
  let q = 0.2;
  let n = 15;
  const NMAX = 128;
  let curve: number[] = [];
  const rng = new Rng(4);
  let draw = drawVote(rng, p, q, n);
  const recompute = () => {
    curve = [];
    for (let k = 1; k <= NMAX; k++) curve.push(voteAccuracy(p, q, k));
  };
  const geo = (w: number) => ({ narrow: w < 470, chartH: 214 });
  const cv = fitCanvas(f, (w) => geo(w).chartH + 126, (ctx, w) => {
    const g = geo(w);
    const left = 38;
    const lh = legend(ctx, [
      { label: 'majority vote', col: color('green') },
      { label: 'one sample', col: color('gold'), dash: [5, 4] },
      { label: 'any sample right (pass@n)', col: withAlpha(color('slate'), 0.9), dash: [2, 3] },
    ], 8, 10, w - 16, g.narrow ? 10.5 : 11);
    const by = Math.max(40, 10 + lh + 12);
    const B = new Box(left, by, w - left - 14, (g.chartH - 20) - by, [0, log2(NMAX), 0, 1]);
    B.yGrid(ctx, [0, 0.25, 0.5, 0.75, 1], (v) => pct(v));
    B.xTicks(ctx, [0, 1, 2, 3, 4, 5, 6, 7], (v) => String(2 ** v));
    B.frame(ctx);
    const xs = curve.map((_, i) => log2(i + 1));
    B.path(ctx, [0, log2(NMAX)], [p, p], color('gold'), 2, [5, 4]);
    B.path(ctx, xs, xs.map((x) => passAt(p, 2 ** x)), withAlpha(color('slate'), 0.9), 1.8, [2, 3]);
    B.path(ctx, xs, curve, color('green'), 2.6);
    const X = B.X(log2(n));
    ctx.strokeStyle = withAlpha(color('--ink-3'), 0.6);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X, B.y);
    ctx.lineTo(X, B.y + B.h);
    ctx.stroke();
    ctx.setLineDash([]);
    const acc = curve[n - 1]!;
    ctx.beginPath();
    ctx.arc(X, B.Y(acc), 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color('green');
    ctx.fill();
    ctx.strokeStyle = color('--paper');
    ctx.lineWidth = 2;
    ctx.stroke();
    const lab = `n = ${n}: ${pct(acc)}`;
    ctx.font = mono(11.5, 650);
    const lw = ctx.measureText(lab).width;
    const lx = X + 12 + lw > B.x + B.w ? X - 12 : X + 12;
    tag(ctx, lab, lx, Math.min(B.y + B.h - 12, B.Y(acc) + 16), mono(11.5, 650), color('green'), lx < X ? 'right' : 'left');
    txt(ctx, 'samples n (log scale)', B.x + B.w, B.y + B.h + 26, ui(10.5), color('--ink-3'), 'right');
    // one election
    const ey = g.chartH + 8;
    txt(ctx, `one vote with n = ${n}`, 8, ey + 6, ui(12, 650), color('--ink-2'));
    const bars = [
      { label: 'right answer', v: draw.right, col: 'green' as const },
      { label: 'common mistake', v: draw.common, col: 'red' as const },
      { label: draw.scattered ? `${draw.scattered} others, 1 each` : 'no others', v: draw.scattered ? 1 : 0, col: 'slate' as const },
    ];
    const lw2 = g.narrow ? 112 : 132;
    const bx = 8 + lw2;
    const bwMax = w - bx - 50;
    const vmax = Math.max(1, draw.right, draw.common);
    bars.forEach((b, i) => {
      const y = ey + 20 + i * 26;
      txt(ctx, b.label, bx - 8, y + 9, ui(g.narrow ? 11 : 12), color('--ink-2'), 'right');
      rrect(ctx, bx, y, Math.max(2, (bwMax * b.v) / vmax), 18, 4, withAlpha(color(b.col), 0.7));
      txt(ctx, String(b.v), bx + Math.max(2, (bwMax * b.v) / vmax) + 6, y + 9.5, mono(12, 650), color(b.col));
    });
    const top = Math.max(draw.right, draw.common, draw.scattered ? 1 : 0);
    const nTop = (draw.right === top ? 1 : 0) + (draw.common === top ? 1 : 0) + (top === 1 ? draw.scattered : 0);
    const verdict = draw.right === top && nTop === 1 ? 'the vote picks the right answer' : draw.right === top ? `a ${nTop}-way tie, broken at random` : 'the vote picks a wrong answer';
    const ok = draw.right === top && nTop === 1;
    txt(ctx, verdict, 8, ey + 104, ui(12, 650), color(ok ? 'green' : draw.right === top ? 'gold' : 'red'));
  });
  cv.canvas.classList.add('scroll-ok');
  const accRo = f.readout('vote accuracy');
  const limRo = f.readout('as n grows');
  const sync = () => {
    const acc = curve[n - 1]!;
    f.code.setMany({ p: pyf(p), q: pyf(q), n, acc: fmt(acc, 3) });
    accRo.set(pct(acc, 1));
    limRo.set(p > q + 1e-9 ? '→ 100%' : p < q - 1e-9 ? '→ 0%' : '→ 50%');
    f.code.highlight(['sum', 'win']);
    cv.redraw();
  };
  const room = () => Math.round((1 - p) * 100) / 100;
  f.slider({ label: 'accuracy p', sym: 'p', min: 0.05, max: 0.95, step: 0.01, value: p, format: (v) => v.toFixed(2), onInput: (v) => {
    p = v;
    if (q > room()) {
      q = room();
      qS.set(q, false);
    }
    recompute();
    draw = drawVote(rng, p, q, n);
    sync();
  } });
  const qS = f.slider({ label: 'mistake q', sym: 'q', min: 0, max: 0.9, step: 0.01, value: q, format: (v) => v.toFixed(2), onInput: (v) => {
    q = Math.min(v, room());
    if (q !== v) qS.set(q, false);
    recompute();
    draw = drawVote(rng, p, q, n);
    sync();
  } });
  f.slider({ label: 'samples n', min: 0, max: 1, step: 0.001, value: log2(n) / log2(NMAX), map: (t) => Math.max(1, Math.round(NMAX ** t)), format: (v) => String(v), onInput: (v) => {
    n = v;
    draw = drawVote(rng, p, q, n);
    sync();
  } });
  f.button('Vote again', () => {
    draw = drawVote(rng, p, q, n);
    cv.redraw();
  }, { icon: 'shuffle' });
  recompute();
  sync();
}

// ---------------------------------------------------------------- coverage over a benchmark

export function figCoverage(f: Fig): void {
  let mean = 0.25;
  let conc = 1;
  let c = 0.5;
  let w = betaWeights(mean, conc);
  const NMAX = 4;
  const geo = (W: number) => ({ narrow: W < 470, chartH: 224 });
  const cv = fitCanvas(f, (W) => geo(W).chartH + 112, (ctx, W) => {
    const g = geo(W);
    const left = 38;
    const lh = legend(ctx, [
      { label: 'pass@n: any sample right', col: color('teal') },
      { label: 'voting ceiling', col: color('green'), dash: [6, 4] },
      { label: 'one sample', col: color('gold'), dash: [5, 4] },
    ], 8, 10, W - 16, g.narrow ? 10.5 : 11);
    const by = Math.max(40, 10 + lh + 12);
    const B = new Box(left, by, W - left - 14, (g.chartH - 20) - by, [0, NMAX, 0, 1]);
    B.yGrid(ctx, [0, 0.25, 0.5, 0.75, 1], (v) => pct(v));
    B.xTicks(ctx, [0, 1, 2, 3, 4], (v) => ['1', '10', '100', '1k', '10k'][v]!);
    B.frame(ctx);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const lx = (NMAX * i) / 120;
      xs.push(lx);
      ys.push(coverage(w, 10 ** lx));
    }
    const m = meanP(w);
    const ceil = voteCeiling(w, c);
    B.path(ctx, [0, NMAX], [m, m], color('gold'), 2, [5, 4]);
    B.path(ctx, [0, NMAX], [ceil, ceil], color('green'), 2.2, [6, 4]);
    B.path(ctx, xs, ys, color('teal'), 2.8);
    txt(ctx, 'samples per problem (log scale)', B.x + B.w, B.y + B.h + 26, ui(10.5), color('--ink-3'), 'right');
    // the benchmark: how many problems sit at each per-sample accuracy
    const hy = g.chartH + 26;
    txt(ctx, 'problems by per-sample accuracy p', 8, hy, ui(11.5, 650), color('--ink-2'));
    const bins = 40;
    const hist = new Float64Array(bins);
    for (let i = 0; i < P_GRID.length; i++) hist[Math.min(bins - 1, Math.floor(P_GRID[i]! * bins))]! += w[i]!;
    const hmax = Math.sqrt(Math.max(...hist));
    const hx = left;
    const hw = W - left - 14;
    const hh = 46;
    const cut = c / (1 + c);
    for (let b = 0; b < bins; b++) {
      const x = hx + (b * hw) / bins;
      const bh = (hh * Math.sqrt(hist[b]!)) / hmax;
      const pm = (b + 0.5) / bins;
      rrect(ctx, x + 0.5, hy + 12 + hh - bh, hw / bins - 1, Math.max(0.5, bh), 1.5, withAlpha(color(pm > cut ? 'green' : 'red'), 0.65));
    }
    ctx.strokeStyle = color('--axis');
    ctx.beginPath();
    ctx.moveTo(hx, hy + 12 + hh + 0.5);
    ctx.lineTo(hx + hw, hy + 12 + hh + 0.5);
    ctx.stroke();
    txt(ctx, '0', hx, hy + hh + 24, mono(10.5), color('--ink-3'), 'center');
    txt(ctx, '1', hx + hw, hy + hh + 24, mono(10.5), color('--ink-3'), 'center');
    const cx = hx + cut * hw;
    ctx.strokeStyle = withAlpha(color('--ink-2'), 0.7);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, hy + 8);
    ctx.lineTo(cx, hy + 12 + hh);
    ctx.stroke();
    ctx.setLineDash([]);
    fitTxt(ctx, `vote can win right of p = ${cut.toFixed(2)}`, Math.min(cx + 4, hx + hw - 150), hy + hh + 24, 160, 10.5, 500, color('--ink-3'));
  });
  cv.canvas.classList.add('scroll-ok');
  const r1 = f.readout('pass@1', { sym: 'p' });
  const r100 = f.readout('pass@100');
  const r10k = f.readout('pass@10,000');
  const rc = f.readout('voting ceiling');
  const sync = () => {
    w = betaWeights(mean, conc);
    const a = mean * conc;
    const b = (1 - mean) * conc;
    f.code.setMany({ a: fmt(a, 2), b: fmt(b, 2), c: pyf(c), cov: `${pct(coverage(w, 1))}, ${pct(coverage(w, 100))}, ${pct(coverage(w, 1e4))}`, ceil: pct(voteCeiling(w, c)) });
    r1.set(pct(meanP(w)));
    r100.set(pct(coverage(w, 100)));
    r10k.set(pct(coverage(w, 1e4)));
    rc.set(pct(voteCeiling(w, c)));
    cv.redraw();
  };
  f.slider({ label: 'mean accuracy', sym: 'p', min: 0.05, max: 0.8, step: 0.01, value: mean, format: (v) => v.toFixed(2), onInput: (v) => { mean = v; sync(); } });
  f.slider({ label: 'spread', min: -0.7, max: 1.3, step: 0.01, value: 0, map: (r) => 10 ** r, format: (v) => fmt(v, 2), onInput: (v) => { conc = v; sync(); } });
  f.slider({ label: 'agree c', sym: 'q', min: 0, max: 1, step: 0.01, value: c, format: (v) => v.toFixed(2), onInput: (v) => { c = v; sync(); } });
  f.code.highlight(['cov', 'ceil']);
  sync();
}

// ---------------------------------------------------------------- best-of-n with a noisy verifier

export function figBestOfN(f: Fig): void {
  let p = 0.3;
  let d = 2;
  let eps = 0.02;
  let n = 16;
  const NMAX = 1024;
  let model = new BestOfN(p, d, eps);
  let curve: { n: number; acc: number }[] = [];
  let peak = { n: 1, acc: p };
  const rng = new Rng(4);
  let cands = drawCandidates(rng, p, d, eps, n);
  const recompute = () => {
    model = new BestOfN(p, d, eps);
    curve = [];
    const seen = new Set<number>();
    for (let i = 0; i <= 140; i++) {
      const k = Math.max(1, Math.round(NMAX ** (i / 140)));
      if (seen.has(k)) continue;
      seen.add(k);
      curve.push({ n: k, acc: model.at(k).acc });
    }
    peak = curve.reduce((a, b) => (b.acc > a.acc ? b : a), curve[0]!);
  };
  const geo = (W: number) => ({ narrow: W < 470, stripH: 112, chartH: 224 });
  const cv = fitCanvas(f, (W) => geo(W).stripH + geo(W).chartH + 8, (ctx, W) => {
    const g = geo(W);
    // the candidates of one draw, along the verifier's score axis
    const lo = -3.5;
    const hi = d + 4.5;
    const S = new Box(14, 26, W - 28, 40, [lo, hi, 0, 1]);
    txt(ctx, `one draw of n = ${n} answers, by verifier score V`, 8, 10, ui(g.narrow ? 11.5 : 12, 650), color('--ink-2'));
    ctx.strokeStyle = color('--axis');
    ctx.beginPath();
    ctx.moveTo(S.x, S.y + S.h + 0.5);
    ctx.lineTo(S.x + S.w, S.y + S.h + 0.5);
    ctx.stroke();
    let best = 0;
    cands.forEach((cd, i) => {
      if (cd.v > cands[best]!.v) best = i;
    });
    const r = new Rng(7);
    const rad = n > 256 ? 2.2 : n > 64 ? 3 : 4;
    cands.forEach((cd) => {
      const x = S.X(Math.max(lo, Math.min(hi, cd.v)));
      const y = S.y + 4 + r.next() * (S.h - 8);
      ctx.beginPath();
      if (cd.hack) {
        ctx.moveTo(x, y - rad * 1.4);
        ctx.lineTo(x + rad * 1.4, y);
        ctx.lineTo(x, y + rad * 1.4);
        ctx.lineTo(x - rad * 1.4, y);
        ctx.closePath();
      } else ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(color(cd.ok ? 'green' : 'red'), cd.hack ? 0.95 : 0.6);
      ctx.fill();
    });
    const b = cands[best]!;
    const bx = S.X(Math.max(lo, Math.min(hi, b.v)));
    ctx.strokeStyle = color('--ink');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, S.y + S.h / 2, 11, 0, Math.PI * 2);
    ctx.stroke();
    const pick = `picked: ${b.ok ? 'right' : b.hack ? 'an exploit' : 'wrong'}`;
    ctx.font = ui(11.5, 650);
    const pw = ctx.measureText(pick).width;
    txt(ctx, pick, Math.max(S.x + pw / 2, Math.min(S.x + S.w - pw / 2, bx)), S.y + S.h + 13, ui(11.5, 650), color(b.ok ? 'green' : 'red'), 'center');
    let lx = 8;
    const ly = S.y + S.h + 32;
    for (const [glyph, label, k] of [['●', 'right', 'green'], ['●', 'wrong', 'red'], ['◆', 'fools the verifier', 'red']] as const) {
      txt(ctx, glyph, lx, ly, ui(12), color(k));
      txt(ctx, label, lx + 14, ly, ui(10.5), color('--ink-3'));
      ctx.font = ui(10.5);
      lx += 14 + ctx.measureText(label).width + 14;
    }
    // accuracy of the pick versus n
    const top = g.stripH + 8;
    const left = 38;
    const lh = legend(ctx, [
      { label: 'best-of-n, this verifier', col: color('teal') },
      { label: 'pass@n', col: withAlpha(color('slate'), 0.9), dash: [2, 3] },
      { label: 'one sample', col: color('gold'), dash: [5, 4] },
    ], 8, top + 6, W - 16, g.narrow ? 10.5 : 11);
    const by = top + 6 + lh + 12;
    const B = new Box(left, by, W - left - 14, (top + g.chartH - 38) - by, [0, log2(NMAX), 0, 1]);
    B.yGrid(ctx, [0, 0.25, 0.5, 0.75, 1], (v) => pct(v));
    B.xTicks(ctx, [0, 2, 4, 6, 8, 10], (v) => String(2 ** v));
    B.frame(ctx);
    const xs = curve.map((c) => log2(c.n));
    B.path(ctx, [0, log2(NMAX)], [p, p], color('gold'), 2, [5, 4]);
    B.path(ctx, xs, curve.map((c) => passAt(p, c.n)), withAlpha(color('slate'), 0.9), 1.8, [2, 3]);
    B.path(ctx, xs, curve.map((c) => c.acc), color('teal'), 2.6);
    if (peak.n > 1 && peak.n < NMAX && peak.acc - curve[curve.length - 1]!.acc > 0.01) {
      const px = B.X(log2(peak.n));
      ctx.beginPath();
      ctx.arc(px, B.Y(peak.acc), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color('teal');
      ctx.fill();
      txt(ctx, `peak at n ≈ ${peak.n}`, px, B.Y(peak.acc) - 10, ui(10.5, 650), color('teal'), px > B.x + B.w - 60 ? 'right' : 'center');
    }
    const acc = model.at(n).acc;
    const X = B.X(log2(n));
    ctx.strokeStyle = withAlpha(color('--ink-3'), 0.6);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X, B.y);
    ctx.lineTo(X, B.y + B.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(X, B.Y(acc), 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color('teal');
    ctx.fill();
    ctx.strokeStyle = color('--paper');
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(ctx, 'samples n (log scale)', B.x + B.w, B.y + B.h + 26, ui(10.5), color('--ink-3'), 'right');
  });
  cv.canvas.classList.add('scroll-ok');
  const accRo = f.readout('accuracy of the pick');
  const peakRo = f.readout('best n');
  const klRo = f.readout('KL from the base model');
  const sync = () => {
    const r = model.at(n);
    f.code.setMany({ p: pyf(p), d: pyf(d, 1), eps: fmt(eps, 2), n, acc: fmt(r.acc, 3) });
    accRo.set(pct(r.acc, 1));
    peakRo.set(peak.n >= NMAX ? `${NMAX}+` : `${peak.n} (${pct(peak.acc)})`);
    klRo.set(`${klBestOfN(n).toFixed(2)} nats`);
    f.code.highlight(['top', 'acc']);
    cv.redraw();
  };
  const resample = () => (cands = drawCandidates(rng, p, d, eps, n));
  f.slider({ label: 'accuracy p', sym: 'p', min: 0.05, max: 0.9, step: 0.01, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; recompute(); resample(); sync(); } });
  f.slider({ label: 'separation d', sym: 'V', min: 0.5, max: 4, step: 0.1, value: d, format: (v) => v.toFixed(1), onInput: (v) => { d = v; recompute(); resample(); sync(); } });
  f.slider({ label: 'exploits ε', min: 0, max: 0.1, step: 0.002, value: eps, format: (v) => v.toFixed(3), onInput: (v) => { eps = v; recompute(); resample(); sync(); } });
  f.slider({ label: 'samples n', min: 0, max: 1, step: 0.001, value: log2(n) / log2(NMAX), map: (t) => Math.max(1, Math.round(NMAX ** t)), format: (v) => String(v), onInput: (v) => { n = v; resample(); sync(); } });
  f.button('Sample again', () => {
    resample();
    cv.redraw();
  }, { icon: 'shuffle' });
  recompute();
  sync();
}

// ---------------------------------------------------------------- outcome versus process rewards

export function figPrm(f: Fig): void {
  let slips = [false, false, false, false];
  const presets: Record<string, boolean[]> = {
    clean: [false, false, false, false],
    one: [false, true, false, false],
    cancel: [false, true, true, false],
  };
  const geo = (w: number) => ({ narrow: w < 470, rowH: w < 470 ? 40 : 42, head: w < 470 ? 60 : 44 });
  const cv = fitCanvas(f, (w) => {
    const g = geo(w);
    return g.head + 4 * g.rowH + 44 + 70;
  }, (ctx, w) => {
    const g = geo(w);
    const s = workSteps(slips);
    const fs = g.narrow ? 12 : 13;
    if (g.narrow) {
      txt(ctx, '4 boxes of 12 markers at $2 each,', 8, 12, ui(12.5, 600), color('orange'));
      txt(ctx, '$18 off, split by 3 classes. Each pays?', 8, 30, ui(12.5, 600), color('orange'));
    } else txt(ctx, '4 boxes of 12 markers at $2 each, $18 off, split by 3 classes. Each pays?', 8, 14, ui(13, 600), color('orange'));
    const colPrm = w - 70;
    txt(ctx, 'PRM: per step', colPrm + 30, g.head - 8, ui(10.5, 650), color('teal'), 'center');
    txt(ctx, 'tap a step to add a slip', 10, g.head - 8, ui(10.5), color('--ink-3'));
    s.shown.forEach((expr, i) => {
      const y = g.head + i * g.rowH;
      const h = g.rowH - 8;
      const bad = !s.ok[i];
      rrect(ctx, 8, y, colPrm - 18, h, 7, withAlpha(color(bad ? 'red' : 'purple'), bad ? 0.1 : 0.05), withAlpha(color(bad ? 'red' : 'purple'), bad ? 0.8 : 0.35), bad ? 1.5 : 1);
      txt(ctx, String(i + 1), 22, y + h / 2, mono(fs, 700), color('purple'), 'center');
      const shownExpr = expr.replace('*', '×').replace('/', '÷').replace('-', '−');
      fitTxt(ctx, `${shownExpr} = ${s.vals[i]} ${MARKERS[i]!.unit}`, 38, y + h / 2, colPrm - 70, fs + 1, 550, color('--ink'), 'left', true);
      if (slips[i]) txt(ctx, 'slip', colPrm - 18, y + h / 2, ui(10.5, 650), color('red'), 'right');
      badge(ctx, colPrm + 12, y + h / 2, 9, s.ok[i]!);
      txt(ctx, s.stepP[i]!.toFixed(2), colPrm + 28, y + h / 2, mono(12, 650), color('teal'));
    });
    // the final answer and the outcome check
    const ay = g.head + 4 * g.rowH;
    const right = s.vals[3] === MARKERS_ANSWER;
    rrect(ctx, 8, ay, colPrm - 18, 34, 7, withAlpha(color('green'), 0.08), withAlpha(color('green'), 0.6), 1.2);
    txt(ctx, `answer a = ${s.vals[3]}`, 22, ay + 17, mono(fs + 1, 700), color('green'));
    txt(ctx, 'ORM', colPrm + 12, ay - 4, ui(10.5, 650), color('teal'), 'center');
    badge(ctx, colPrm + 12, ay + 17, 9, right);
    txt(ctx, s.orm.toFixed(1), colPrm + 28, ay + 17, mono(12, 650), color('teal'));
    // the verdict
    const vy = ay + 50;
    txt(ctx, `ORM (answer only): ${s.orm.toFixed(1)}`, 8, vy, mono(12.5, 650), color(s.orm ? 'green' : 'red'));
    txt(ctx, `PRM (product of steps): ${s.prm < 0.01 ? s.prm.toFixed(4) : s.prm.toFixed(2)}`, 8, vy + 20, mono(12.5, 650), color(s.prm > 0.5 ? 'green' : 'red'));
    const nBad = s.ok.filter((o) => !o).length;
    const note = nBad === 0 ? 'every step checks out' : right ? 'right answer, wrong reasoning: only the PRM objects' : `wrong from step ${s.ok.indexOf(false) + 1}: both object, the PRM says where`;
    fitTxt(ctx, note, 8, vy + 42, w - 16, 12, 650, color(nBad === 0 ? 'green' : right ? 'gold' : '--ink-2'));
  });
  const ormRo = f.readout('ORM');
  const prmRo = f.readout('PRM');
  const update = (focus = -1) => {
    const s = workSteps(slips);
    const lines: Record<string, string> = {};
    s.shown.forEach((e, i) => (lines[`l${i + 1}`] = `${e} = ${s.vals[i]}`));
    f.code.setMany({ ...lines, orm: s.orm.toFixed(1), prm: s.prm < 0.01 ? s.prm.toFixed(4) : s.prm.toFixed(2) });
    ormRo.set(s.orm.toFixed(1));
    prmRo.set(s.prm < 0.01 ? s.prm.toFixed(4) : s.prm.toFixed(2));
    f.code.highlight(focus >= 0 ? [`s${focus + 1}`, 'prm'] : ['orm', 'prm']);
    cv.redraw();
  };
  cv.canvas.addEventListener('pointerdown', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const g = geo(r.width);
    const i = Math.floor((e.clientY - r.top - g.head) / g.rowH);
    if (i < 0 || i > 3) return;
    slips = slips.map((v, k) => (k === i ? !v : v));
    seg.set('custom', false);
    update(i);
  });
  cv.canvas.classList.add('scroll-ok');
  const seg = f.segmented<string>({
    label: 'solution',
    options: [
      { value: 'clean', label: 'clean' },
      { value: 'one', label: 'one slip' },
      { value: 'cancel', label: 'two that cancel' },
    ],
    value: 'clean',
    onChange: (v) => {
      slips = [...presets[v]!];
      update();
    },
  });
  update();
}

// ---------------------------------------------------------------- thinking budget

export function figBudget(f: Fig): void {
  let T = 16;
  let fix = 0.3;
  let brk = 0.03;
  const TMAX = 48;
  const EASY = 2;
  const HARD = 12;
  let easy = budgetCurve(EASY, TMAX, fix, brk);
  let hard = budgetCurve(HARD, TMAX, fix, brk);
  const geo = (w: number) => ({ narrow: w < 470, chartH: w < 470 ? 200 : 220 });
  const cv = fitCanvas(f, (w) => geo(w).chartH + 104, (ctx, w) => {
    const g = geo(w);
    const left = 38;
    const lh = legend(ctx, [
      { label: `easy: ${EASY} steps`, col: color('green') },
      { label: `hard: ${HARD} steps`, col: color('purple') },
    ], 8, 10, w - 16, 11);
    const by = Math.max(36, 10 + lh + 10);
    const B = new Box(left, by, w - left - 14, (g.chartH - 24) - by, [0, TMAX, 0, 1]);
    B.yGrid(ctx, [0, 0.25, 0.5, 0.75, 1], (v) => pct(v));
    B.xTicks(ctx, [0, 8, 16, 24, 32, 40, 48], (v) => String(v));
    B.frame(ctx);
    const xs = Array.from({ length: TMAX + 1 }, (_, i) => i);
    B.path(ctx, xs, Array.from(easy), color('green'), 2.6);
    B.path(ctx, xs, Array.from(hard), color('purple'), 2.6);
    const X = B.X(T);
    ctx.strokeStyle = withAlpha(color('slate'), 0.8);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X, B.y);
    ctx.lineTo(X, B.y + B.h);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [arr, k] of [[easy, 'green'], [hard, 'purple']] as const) {
      ctx.beginPath();
      ctx.arc(X, B.Y(arr[T]!), 5, 0, Math.PI * 2);
      ctx.fillStyle = color(k);
      ctx.fill();
    }
    txt(ctx, 'thinking budget T (tokens)', B.x + B.w, B.y + B.h + 26, ui(10.5), color('--ink-3'), 'right');
    // where the tokens go
    const ty = g.chartH + 8;
    const cw = (w - 16 - 52) / TMAX;
    [[EASY, 'easy', 'green'], [HARD, 'hard', 'purple']].forEach(([d, name, k], row) => {
      const y = ty + row * 30;
      txt(ctx, String(name), 8, y + 9, ui(11.5, 650), color(k as 'green'));
      for (let t = 0; t < T; t++) {
        const work = t < (d as number);
        rrect(ctx, 52 + t * cw + 0.5, y, Math.max(1, cw - 1), 18, 2, withAlpha(color(work ? 'blue' : 'slate'), work ? 0.75 : 0.3));
      }
    });
    const wasted = Math.max(0, T - EASY);
    rrect(ctx, 8, ty + 60, 10, 10, 2, withAlpha(color('blue'), 0.75));
    txt(ctx, 'work', 22, ty + 65, ui(10.5), color('--ink-3'));
    rrect(ctx, 56, ty + 60, 10, 10, 2, withAlpha(color('slate'), 0.3));
    txt(ctx, 're-check', 70, ty + 65, ui(10.5), color('--ink-3'));
    fitTxt(ctx, `easy: ${wasted} of ${T} tokens come after it was done`, 8, ty + 84, w - 16, 11, 600, color(wasted > 0 ? 'green' : '--ink-3'));
  });
  const eRo = f.readout('easy');
  const hRo = f.readout('hard');
  const sync = () => {
    f.code.setMany({ easy: pct(easy[T]!, 1), hard: pct(hard[T]!, 1), fix: pyf(fix), brk: pyf(brk) });
    eRo.set(pct(easy[T]!, 1));
    hRo.set(pct(hard[T]!, 1));
    f.code.highlight(T < EASY ? 'done' : ['work', 'check']);
    cv.redraw();
  };
  const recompute = () => {
    easy = budgetCurve(EASY, TMAX, fix, brk);
    hard = budgetCurve(HARD, TMAX, fix, brk);
  };
  const tS = f.slider({ label: 'budget T', sym: 'T', min: 0, max: TMAX, step: 1, value: T, slot: 'T', format: (v) => String(v), onInput: (v) => { T = v; sync(); } });
  f.slider({ label: 'fix rate', min: 0, max: 0.8, step: 0.01, value: fix, format: (v) => v.toFixed(2), onInput: (v) => { fix = v; recompute(); sync(); } });
  f.slider({ label: 'break rate', min: 0, max: 0.15, step: 0.005, value: brk, format: (v) => v.toFixed(3), onInput: (v) => { brk = v; recompute(); sync(); } });
  const drop = () => f.status(`Each work step slips with probability ${SLIP}; an unfinished answer is a guess, right ${pct(GUESS)} of the time.`);
  drop();
  drag(cv.canvas, (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const left = 38;
    const t = Math.round(((e.clientX - r.left - left) / (r.width - left - 14)) * TMAX);
    if (t >= 0 && t <= TMAX && t !== T) tS.set(t);
  });
  sync();
}
