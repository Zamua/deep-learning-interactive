import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { GRPO_SYMBOLS } from '../lib/grpo-symbols';
import { ANSWER, CHECKERS, COMPLETIONS, type CheckerId, check } from '../lib/grpo-verify';
import { DEFAULTS, D_MAX, T_MAX, ToyGrpo, advantages, baseLogits, makeProblem, rollout, type Problem, type Rollout } from '../lib/grpo-toy';
import { advColor, badge, fitCanvas, fitTxt, mono, rrect, tokenRow, twoUp, txt, ui } from '../lib/grpo-draw';

const sgn = (v: number, d = 2): string => (v > 0 ? '+' : v < 0 ? '−' : ' ') + Math.abs(v).toFixed(d);
const pyNum = (v: number, d = 2): string => (Math.abs(v) < 5e-7 ? '0.0' : v.toFixed(d));

/** A policy after `n` GRPO steps on the toy world, trained once per figure that needs it. */
function trainedPolicy(n = 300, seed = 7): Float64Array {
  const t = new ToyGrpo({ ...DEFAULTS }, seed);
  for (let i = 0; i < n; i++) t.step();
  return t.th;
}

// ---------------------------------------------------------------- figures

function figChecker(f: Fig): void {
  let mode: CheckerId = 'strict';
  let sel = -1;
  const rowH = (w: number) => (w < 460 ? 50 : 46);
  const cv = fitCanvas(f, (w) => 30 + COMPLETIONS.length * rowH(w) + 8, (ctx, w) => {
    const rh = rowH(w);
    const narrow = w < 460;
    txt(ctx, 'What is 437 + 285?   (answer: 722)', 10, 16, ui(narrow ? 12 : 13, 600), color('--ink-2'));
    COMPLETIONS.forEach((c, i) => {
      const y = 30 + i * rh;
      const { reward, saw } = check(mode, c.text);
      const exploit = reward === 1 && c.deserves === 0;
      const missed = reward === 0 && c.deserves === 1;
      const k = exploit ? 'red' : missed ? 'gold' : reward ? 'green' : '--ink-3';
      rrect(ctx, 6, y + 2, w - 12, rh - 6, 8, withAlpha(color(k), sel === i ? 0.2 : exploit || missed ? 0.1 : 0.04), withAlpha(color(k), exploit || missed || sel === i ? 0.9 : 0.35), sel === i ? 2 : 1);
      const fs = narrow ? 11 : 12.5;
      txt(ctx, c.text, 16, y + rh * 0.36, mono(fs, 500), color('--ink'));
      const note = exploit ? 'exploit passes' : missed ? 'right, but rejected' : c.kind;
      txt(ctx, `sees: ${saw}`, 16, y + rh * 0.72, mono(fs - 1.5, 500), color('--ink-3'));
      txt(ctx, note, w - 54, y + rh * 0.72, ui(fs - 1, exploit || missed ? 650 : 400), exploit ? color('red') : missed ? color('gold') : color('--ink-3'), 'right');
      badge(ctx, w - 28, y + rh / 2 - 1, narrow ? 10 : 11, reward === 1);
    });
  });
  cv.canvas.classList.add('scroll-ok');
  const exRo = f.readout('exploits rewarded');
  const missRo = f.readout('right answers rejected');
  const lines: Record<CheckerId, string> = { strict: 'strict', string: 'string', anybox: 'anybox', anynum: 'anynum' };
  const update = () => {
    let ex = 0;
    let miss = 0;
    COMPLETIONS.forEach((c) => {
      const r = check(mode, c.text).reward;
      if (r === 1 && c.deserves === 0) ex++;
      if (r === 0 && c.deserves === 1) miss++;
    });
    exRo.set(ex);
    missRo.set(miss);
    if (sel >= 0) {
      const c = COMPLETIONS[sel]!;
      const g = check(mode, c.text);
      f.code.set('row', `answer ${sel + 1}: sees ${g.saw.length > 12 ? 'numbers' : g.saw}, reward ${g.reward.toFixed(1)}`);
    } else f.code.set('row', 'tap an answer to grade it');
    f.code.highlight(lines[mode]);
    cv.redraw();
  };
  cv.canvas.addEventListener('pointerdown', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - 30) / rowH(r.width));
    sel = i >= 0 && i < COMPLETIONS.length ? (sel === i ? -1 : i) : -1;
    update();
  });
  f.segmented({
    label: 'checker',
    options: CHECKERS.map((c) => ({ value: c.id, label: c.label })),
    value: 'strict',
    onChange: (v) => {
      mode = v;
      f.code.set('mode', CHECKERS.find((c) => c.id === v)!.label);
      update();
    },
  });
  update();
}

function figClip(f: Fig): void {
  let A = 1;
  let eps = 0.2;
  let rho = 1.3;
  const obj = (x: number) => Math.min(x * A, Math.max(1 - eps, Math.min(1 + eps, x)) * A);
  const slope = (x: number) => {
    const un = x * A;
    const cl = Math.max(1 - eps, Math.min(1 + eps, x)) * A;
    if (un <= cl) return A;
    return x > 1 - eps && x < 1 + eps ? A : 0;
  };
  const pl = f.plot({
    aspect: 1.35,
    square: false,
    domain: [0, 2.2, -2.5, 2.5],
    draw: (p) => {
      const c = p.ctx;
      // the clip band
      c.fillStyle = withAlpha(color('slate'), 0.1);
      c.fillRect(p.sx(1 - eps), p.sy(2.5), p.sx(1 + eps) - p.sx(1 - eps), p.sy(-2.5) - p.sy(2.5));
      p.axes({ grid: 0.5 });
      for (const v of [0.5, 1, 1.5, 2]) p.text(String(v), v, -2.3, { align: 'center', size: 11, mono: true, color: color('--ink-3') });
      for (const v of [-2, -1, 1, 2]) p.text(String(v), 0.04, v + 0.1, { size: 11, mono: true, color: color('--ink-3') });
      p.text('ratio ρ', 2.17, 0.18, { align: 'right', size: 12, color: color('red') });
      p.text(`1−ε`, 1 - eps, 2.28, { align: 'center', size: 11, mono: true, color: color('slate') });
      p.text(`1+ε`, 1 + eps, 2.28, { align: 'center', size: 11, mono: true, color: color('slate') });
      p.fn((x) => x * A, withAlpha(color('--ink-3'), 0.9), 1.5, [5, 5]);
      // flat stretches: where the objective ignores the token
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i <= 220; i++) {
        const x = (i / 220) * 2.2;
        xs.push(x);
        ys.push(obj(x));
      }
      p.path(xs, ys, color('teal'), 3);
      const flatFrom = A > 0 ? 1 + eps : 0;
      const flatTo = A > 0 ? 2.2 : 1 - eps;
      const fy = A > 0 ? 1 + eps : -(1 - eps);
      p.path([flatFrom, flatTo], [fy, fy], withAlpha(color('teal'), 0.35), 9);
      p.text('flat: no gradient', (flatFrom + flatTo) / 2, fy - 0.42, { align: 'center', size: 11, color: color('teal') });
      p.text(A > 0 ? 'A > 0: push this token up' : 'A < 0: push this token down', 0.25, A > 0 ? -1.15 : 1.65, { size: 12, color: color('--ink-2') });
      p.text('dashed: ρ·A, unclipped', 0.25, A > 0 ? -1.6 : 1.2, { size: 11, color: color('--ink-3') });
      // the reader's token
      p.path([rho, rho], [0, obj(rho)], withAlpha(color('red'), 0.6), 1.5, [3, 3]);
      p.dot(rho, obj(rho), 6.5, color('red'), color('--paper'));
      p.dot(rho, 0, 4, color('red'));
    },
  });
  const objRo = f.readout('objective');
  const gRo = f.readout('slope');
  const update = () => {
    const un = rho * A;
    const cl = Math.max(1 - eps, Math.min(1 + eps, rho)) * A;
    f.code.setMany({ rho: `ρ = ${rho.toFixed(2)}`, obj: fmt(Math.min(un, cl), 3), grad: slope(rho) === 0 ? '0 (clipped)' : fmt(slope(rho), 2) });
    objRo.set(Math.min(un, cl).toFixed(2));
    gRo.set(slope(rho) === 0 ? '0 (clipped)' : fmt(slope(rho), 2));
    f.code.highlight(un <= cl ? ['un', 'min'] : ['cl', 'min']);
    pl.redraw();
  };
  let drag = false;
  const move = (e: PointerEvent) => {
    const [x] = pl.pointer(e);
    rho = Math.max(0.05, Math.min(2.15, x));
    update();
  };
  pl.canvas.addEventListener('pointerdown', (e) => {
    drag = true;
    pl.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  pl.canvas.addEventListener('pointermove', (e) => drag && move(e));
  pl.canvas.addEventListener('pointerup', () => (drag = false));
  f.segmented({
    label: 'advantage',
    options: [
      { value: '+1.0', label: 'A = +1' },
      { value: '-1.0', label: 'A = −1' },
    ],
    value: '+1.0',
    slot: 'A',
    onChange: (v) => {
      A = Number(v);
      update();
    },
  });
  f.slider({ label: 'clip ε', sym: 'eps', min: 0.05, max: 0.5, step: 0.01, value: 0.2, slot: 'eps', format: (v) => v.toFixed(2), onInput: (v) => { eps = v; update(); } });
  update();
}

function figGroup(f: Fig): void {
  const base = baseLogits();
  const trained = trainedPolicy();
  let pol: 'base' | 'trained' = 'base';
  let d = 3;
  let G = 8;
  let std = true;
  const rng = new Rng(21);
  let prob: Problem = { a: 437, b: 285, d: 3 };
  let group: Rollout[] = [];
  let A: number[] = [];
  const sample = (fresh: boolean) => {
    if (fresh) prob = makeProblem(rng, d);
    const th = pol === 'base' ? base : trained;
    group = Array.from({ length: G }, () => rollout(th, base, prob, rng));
    recompute();
  };
  const recompute = () => {
    A = advantages(group.map((g) => g.reward), std);
    const r = group.map((g) => g.reward);
    const mean = r.reduce((a, b) => a + b, 0) / G;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / G);
    const part = (a: number, b: number) => A.slice(a, b).map((v) => pyNum(v)).join(', ');
    f.code.setMany({
      q: `${prob.a} + ${prob.b}`,
      G,
      r: r.slice(0, 8).map((v) => v.toFixed(0)).join(', ') + (G > 8 ? ', …' : ''),
      mean: mean.toFixed(2),
      std: sd.toFixed(2),
      A1: part(0, 4),
      A2: G > 4 ? part(4, 8) + (G > 8 ? ', …' : '') : '',
    });
    meanRo.set(mean.toFixed(2));
    f.status(r.every((v) => v === r[0]) ? `Every output got reward ${r[0]}: the mean equals each reward, so **every advantage is 0** and this group teaches nothing.` : '');
    f.code.highlight(['adv', 'tok']);
    cv.redraw();
  };
  const rowH = (w: number) => (w < 460 ? 24 : 26);
  const cv = fitCanvas(f, (w) => 40 + G * rowH(w) + 10, (ctx, w) => {
    const rh = rowH(w);
    const narrow = w < 460;
    txt(ctx, `q:  ${prob.a} + ${prob.b} = ?`, 10, 18, mono(narrow ? 13 : 14, 650), color('orange'));
    txt(ctx, 'A', w - 12, 18, `italic 650 ${narrow ? 14 : 15}px 'Source Serif 4 Variable', Georgia, serif`, color('teal'), 'right');
    const cw = narrow ? 19 : 22;
    group.forEach((ro, i) => {
      const y = 40 + i * rh;
      badge(ctx, 18, y + rh / 2, narrow ? 8 : 9, ro.reward === 1);
      tokenRow(ctx, ro, 34, y + 2, cw, rh - 4, { tint: A[i]!, maxW: w - 34 - 62 });
      txt(ctx, sgn(A[i]!), w - 12, y + rh / 2, mono(narrow ? 12 : 13, 650), advColor(A[i]!), 'right');
    });
  });
  cv.canvas.classList.add('scroll-ok');
  const meanRo = f.readout('mean reward (pass rate)');
  f.segmented({
    label: 'digits',
    options: [1, 2, 3, 4].map((v) => ({ value: String(v), label: String(v) })),
    value: '3',
    onChange: (v) => {
      d = Number(v);
      sample(true);
    },
  });
  f.segmented({
    label: 'policy',
    options: [
      { value: 'base', label: 'base model' },
      { value: 'trained', label: 'after 300 GRPO steps' },
    ],
    value: 'base',
    onChange: (v) => {
      pol = v;
      sample(false);
    },
  });
  f.segmented({
    label: 'G',
    options: [4, 8, 16].map((v) => ({ value: String(v), label: String(v) })),
    value: '8',
    onChange: (v) => {
      G = Number(v);
      cv.refit();
      sample(false);
    },
  });
  f.toggle({
    label: 'divide by std',
    value: true,
    onChange: (v) => {
      std = v;
      f.code.set('advexpr', v ? '(r - r.mean()) / (r.std() + 1e-4)' : 'r - r.mean()');
      recompute();
    },
  });
  f.button('Resample', () => sample(false), { primary: true, icon: 'shuffle' });
  f.button('New problem', () => sample(true));
  sample(false);
}

function figMemory(f: Fig): void {
  const SIZES = [0.5, 1, 1.5, 3, 7, 8, 14, 32, 70].map((b) => b * 1e9);
  let N = 7e9;
  const parts = [
    { key: 'policy', label: 'policy (trained)', col: 'blue' as const, bytes: 16 },
    { key: 'value', label: 'value model (trained)', col: 'orange' as const, bytes: 16 },
    { key: 'ref', label: 'reference (frozen)', col: 'green' as const, bytes: 2 },
    { key: 'rm', label: 'reward model (frozen)', col: 'gold' as const, bytes: 2 },
  ];
  const rows: { name: string; has: string[] }[] = [
    { name: 'PPO', has: ['policy', 'value', 'ref', 'rm'] },
    { name: 'GRPO', has: ['policy', 'ref', 'rm'] },
    { name: 'GRPO + verifier', has: ['policy', 'ref'] },
  ];
  const gb = (row: { has: string[] }) => row.has.reduce((a, k) => a + parts.find((p) => p.key === k)!.bytes, 0) * N / 1e9;
  const cv = fitCanvas(f, (w) => (w < 460 ? 262 : 250), (ctx, w, h) => {
    const narrow = w < 460;
    const left = narrow ? 10 : 14;
    const labelH = 16;
    const top = 18;
    const barH = narrow ? 24 : 26;
    const gap = narrow ? 28 : 26;
    const max = gb(rows[0]!) * 1.04;
    const sx = (v: number) => left + ((w - left - 14) * v) / max;
    // GPU-sized gridlines
    const step = max > 1200 ? 400 : max > 600 ? 160 : 80;
    for (let v = step; v < max; v += step) {
      ctx.strokeStyle = withAlpha(color('--ink-3'), 0.28);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx(v), top);
      ctx.lineTo(sx(v), top + rows.length * (barH + gap) - gap + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      txt(ctx, `${v} GB`, sx(v), top + rows.length * (barH + gap) - gap + 16, mono(10.5), color('--ink-3'), 'center');
    }
    rows.forEach((row, i) => {
      const y = top + i * (barH + gap);
      let x = 0;
      txt(ctx, `${row.name}: ${Math.round(gb(row))} GB`, left, y + labelH * 0.45, ui(narrow ? 12 : 13, 650), color('--ink'));
      row.has.forEach((k) => {
        const part = parts.find((p) => p.key === k)!;
        const v = (part.bytes * N) / 1e9;
        rrect(ctx, sx(x) + 0.5, y + labelH, sx(x + v) - sx(x) - 1, barH - 6, 4, withAlpha(color(part.col), 0.75));
        x += v;
      });
    });
    // legend, two per line
    ctx.font = ui(11);
    const colW = (w - left * 2) / 2;
    parts.forEach((p, i) => {
      const lx = left + (i % 2) * colW;
      const ly = h - 34 + Math.floor(i / 2) * 18;
      rrect(ctx, lx, ly - 5, 10, 10, 2, withAlpha(color(p.col), 0.8));
      txt(ctx, p.label, lx + 14, ly, ui(11), color('--ink-2'));
    });
  });
  cv.canvas.classList.add('scroll-ok');
  const saveRo = f.readout('saved by dropping the critic');
  const update = () => {
    const name = N >= 1e9 ? `${fmt(N / 1e9, 2)}e9` : `${fmt(N / 1e8, 2)}e8`;
    f.code.setMany({ N: name, ppo: Math.round(gb(rows[0]!)), grpo: Math.round(gb(rows[1]!)), rlvr: Math.round(gb(rows[2]!)) });
    saveRo.set(`${Math.round((16 * N) / 1e9)} GB`);
    cv.redraw();
  };
  f.slider({
    label: 'parameters per model',
    min: 0,
    max: SIZES.length - 1,
    step: 1,
    value: 4,
    map: (i) => SIZES[Math.round(i)]!,
    format: (v) => (v >= 1e9 ? `${fmt(v / 1e9, 2)}B` : `${Math.round(v / 1e6)}M`),
    onInput: (v) => {
      N = v;
      update();
    },
  });
  update();
}

function figTrain(f: Fig): void {
  const t = new ToyGrpo({ ...DEFAULTS }, 7);
  const STEPS = 400;
  let shown: { ro: Rollout[]; A: number[] } = { ro: [], A: [] };
  let byD: number[] = t.evalByDigits();
  const avg = (k: 'acc' | 'len' | 'zeroVar', i: number, win = 12) => {
    const h = t.history;
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      s += h[j]![k];
      n++;
    }
    return s / Math.max(1, n);
  };
  const [colA, colB] = twoUp(f);
  const curves = f.plot({
    height: 200,
    square: false,
    domain: [0, STEPS, 0, 1],
    draw: (p) => {
      p.axes({ grid: 100 });
      const c = p.ctx;
      for (const v of [0.25, 0.5, 0.75, 1]) {
        c.strokeStyle = withAlpha(color('--ink-3'), 0.15);
        c.beginPath();
        c.moveTo(p.sx(0), p.sy(v));
        c.lineTo(p.sx(STEPS), p.sy(v));
        c.stroke();
      }
      const n = t.history.length;
      if (n === 0) txt(c, 'press Train to start', p.w / 2, p.h / 2, ui(12), color('--ink-3'), 'center');
      if (n > 1) {
        const xs = t.history.map((_, i) => i);
        p.path(xs, t.history.map((_, i) => avg('zeroVar', i)), withAlpha(color('slate'), 0.85), 1.5, [4, 4]);
        p.path(xs, t.history.map((_, i) => avg('len', i) / T_MAX), color('purple'), 2.2);
        p.path(xs, t.history.map((_, i) => avg('acc', i)), color('gold'), 2.6);
      }
      txt(c, 'accuracy', 8, 12, ui(11, 650), color('gold'));
      txt(c, 'length (0 to 12 tokens)', 70, 12, ui(11, 650), color('purple'));
      txt(c, 'groups with no signal', 8, 27, ui(11), color('slate'));
      txt(c, `step ${t.steps}`, p.w - 8, p.h - 10, mono(11), color('--ink-3'), 'right');
    },
  });
  curves.canvas.classList.add('scroll-ok');
  colA.append(curves.canvas);
  const rowH = (w: number) => (w < 460 ? 23 : 25);
  const cv = fitCanvas(f, (w) => 62 + Math.min(8, t.opts.G) * rowH(w) + 8, (ctx, w) => {
    const narrow = w < 460;
    const rh = rowH(w);
    // accuracy by digits
    txt(ctx, 'accuracy by digits', 10, 12, ui(11), color('--ink-3'));
    const bw = narrow ? 34 : 42;
    byD.forEach((v, i) => {
      const x = 10 + i * (bw + 8);
      rrect(ctx, x, 20, bw, 12, 3, withAlpha(color('--ink-3'), 0.15));
      rrect(ctx, x, 20, Math.max(3, bw * v), 12, 3, withAlpha(color('gold'), 0.85));
      txt(ctx, `${i + 1}: ${Math.round(v * 100)}%`, x + bw / 2, 40, mono(10), color('--ink-2'), 'center');
    });
    const g = shown.ro;
    if (!g.length) return;
    const pr = g[0]!.prob;
    txt(ctx, `${pr.a} + ${pr.b} = ?`, w - 10, 14, mono(narrow ? 12 : 13, 650), color('orange'), 'right');
    txt(ctx, 'one group, live', w - 10, 32, ui(11), color('--ink-3'), 'right');
    g.slice(0, 8).forEach((ro, i) => {
      const y = 56 + i * rh;
      badge(ctx, 16, y + rh / 2, 8, ro.reward === 1);
      tokenRow(ctx, ro, 30, y + 2, narrow ? 18 : 20, rh - 4, { tint: shown.A[i]!, maxW: w - 30 - 56 });
      txt(ctx, sgn(shown.A[i]!), w - 10, y + rh / 2, mono(12, 650), advColor(shown.A[i]!), 'right');
    });
  }, colB);
  cv.canvas.classList.add('scroll-ok');
  const accRo = f.readout('accuracy', { sym: 'r' });
  const lenRo = f.readout('mean length');
  const zvRo = f.readout('no-signal groups');
  const sync = () => {
    const i = t.history.length - 1;
    const acc = i >= 0 ? avg('acc', i) : 0;
    const len = i >= 0 ? avg('len', i) : 0;
    f.code.setMany({ step: t.steps, acc: i >= 0 ? `${Math.round(acc * 100)}%` : '…', len: i >= 0 ? len.toFixed(1) : '…' });
    accRo.set(i >= 0 ? `${Math.round(acc * 100)}%` : '–');
    lenRo.set(i >= 0 ? `${len.toFixed(1)} tokens` : '–');
    zvRo.set(i >= 0 ? `${Math.round(avg('zeroVar', i) * 100)}%` : '–');
  };
  let phase = 0;
  const loop = f.loop(() => {
    t.step();
    t.step();
    if (t.steps % 6 === 0 || t.steps === 2) {
      // prefer a group that carries signal, so the advantages are worth reading
      const gi = Math.max(0, t.last.adv.findIndex((a) => a.some((v) => Math.abs(v) > 1e-6)));
      shown = { ro: t.last.groups[gi] ?? [], A: t.last.adv[gi] ?? [] };
    }
    if (t.steps % 25 === 0) byD = t.evalByDigits();
    f.code.highlight(['sample', 'reward', 'adv', 'loss', 'update'][Math.floor(phase++ / 2) % 5]!);
    sync();
    curves.redraw();
    cv.redraw();
    if (t.steps >= STEPS) {
      stop();
      f.status(`Done: ${STEPS} steps. Press **Reset** to train again, perhaps with a different G or β.`);
      return false;
    }
  });
  const stop = () => {
    loop.stop();
    btn.textContent = 'Train';
    f.code.highlight(null);
    byD = t.evalByDigits();
    cv.redraw();
  };
  const btn = f.button('Train', () => {
    if (loop.running()) stop();
    else {
      if (t.steps >= STEPS) reset();
      loop.start();
      btn.textContent = 'Pause';
      f.status('');
    }
  }, { primary: true });
  const reset = () => {
    loop.stop();
    btn.textContent = 'Train';
    t.reset(7 + Math.floor(Math.random() * 1000));
    byD = t.evalByDigits();
    shown = { ro: [], A: [] };
    first();
    sync();
    curves.redraw();
    cv.redraw();
  };
  f.button('Reset', reset);
  f.segmented({
    label: 'G',
    options: [4, 8, 16].map((v) => ({ value: String(v), label: String(v) })),
    value: '8',
    slot: 'G',
    onChange: (v) => {
      t.opts.G = Number(v);
      cv.refit();
    },
  });
  f.slider({ label: 'KL β', sym: 'beta', min: 0, max: 0.3, step: 0.01, value: DEFAULTS.beta, slot: 'beta', format: (v) => v.toFixed(2), onInput: (v) => (t.opts.beta = v) });
  f.toggle({
    label: 'dynamic sampling',
    value: false,
    onChange: (v) => {
      t.opts.dynamic = v;
      f.code.set('dyn', v ? 'True' : 'False');
    },
  });
  // A first group to look at before training starts.
  const first = () => {
    const rng = new Rng(3);
    const prob = makeProblem(rng, 3);
    const g = Array.from({ length: t.opts.G }, () => rollout(t.th, t.ref, prob, rng));
    shown = { ro: g, A: advantages(g.map((x) => x.reward), true) };
  };
  first();
  sync();
  f.status('Press **Train**. The base model answers early and is right about 30% of the time.');
}

function figPipeline(f: Fig): void {
  interface Box { title: string; sub: string; out?: string; line: string; note: string }
  const boxes: Box[] = [
    { title: 'DeepSeek-V3-Base', sub: '671B MoE, 37B active', line: 'base', note: 'Both models start from the same pretrained base, a mixture-of-experts model that has never been fine-tuned to chat.' },
    { title: 'GRPO, rule rewards only', sub: 'accuracy + format, no SFT', out: 'R1-Zero', line: 'zero', note: '**R1-Zero**: GRPO straight from the base, rewarded only by an answer checker (and test cases for code) plus a format rule. Long chains of thought and self-checking emerge, but the text is hard to read and mixes languages.' },
    { title: '1  cold start', sub: 'SFT: thousands of long CoTs', line: 'cold', note: '**Stage 1, cold start.** A few thousand long chain-of-thought examples in a clean, readable format, used for supervised fine-tuning so RL starts from a model that writes legibly.' },
    { title: '2  reasoning RL', sub: 'rules + language consistency', line: 'rl1', note: '**Stage 2, reasoning RL.** The R1-Zero recipe again, plus a reward for keeping the chain of thought in one language (it costs a little accuracy and buys readability).' },
    { title: '3a  rejection sampling', sub: 'keep ~600k correct traces', line: 'rs', note: '**Stage 3a.** Sample many answers from the stage-2 model and keep only the good ones: about 600k reasoning samples, plus about 200k non-reasoning ones (writing, factual QA, translation).' },
    { title: '3b  SFT, from the base again', sub: '~800k samples, 2 epochs', line: 'sft2', note: '**Stage 3b.** Fine-tune DeepSeek-V3-Base itself (not the RL model) on those ~800k samples for two epochs.' },
    { title: '4  RL for all prompts', sub: 'rules + reward models', out: 'R1', line: 'rl2', note: '**Stage 4.** A final RL stage over every kind of prompt: rule-based rewards where answers can be checked, learned reward models for helpfulness and harmlessness elsewhere. The result is **R1**.' },
    { title: 'distillation', sub: 'SFT Qwen, Llama: 1.5B to 70B', out: 'R1-Distill', line: 'distill', note: '**Distillation.** Fine-tune small open models on the same ~800k samples: supervised learning only, no RL. The paper found this beat running large-scale RL on a small model directly.' },
  ];
  let cur = 0;
  const rowH = (w: number) => (w < 460 ? 46 : 44);
  const cv = fitCanvas(f, (w) => 14 + boxes.length * (rowH(w) + 12) + 14, (ctx, w) => {
    const narrow = w < 460;
    const rh = rowH(w);
    const bx = 30;
    const bw = w * (narrow ? 0.67 : 0.62) - bx;
    const ox = bx + bw + (narrow ? 12 : 30);
    const ow = w - ox - 8;
    boxes.forEach((b, i) => {
      const y = 14 + i * (rh + 12);
      const done = i <= cur;
      const on = i === cur;
      const k = i === 1 ? 'purple' : i === boxes.length - 1 ? 'teal' : i === 0 ? 'slate' : 'blue';
      ctx.globalAlpha = done ? 1 : 0.5;
      if (i === 1) ctx.setLineDash([5, 4]);
      rrect(ctx, bx, y, bw, rh, 8, withAlpha(color(k), on ? 0.22 : 0.08), withAlpha(color(k), on ? 1 : 0.6), on ? 2 : 1);
      ctx.setLineDash([]);
      fitTxt(ctx, b.title, bx + 10, y + rh * 0.34, bw - 16, narrow ? 12 : 13, 650, color('--ink'));
      fitTxt(ctx, b.sub, bx + 10, y + rh * 0.72, bw - 16, narrow ? 10.5 : 11.5, 400, color('--ink-2'));
      // the arrow into this box
      if (i > 0 && i !== 2) {
        const ay = y - 12;
        ctx.strokeStyle = color('--ink-3');
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(bx + 22, ay + 1);
        ctx.lineTo(bx + 22, y - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 18, y - 6);
        ctx.lineTo(bx + 22, y - 1);
        ctx.lineTo(bx + 26, y - 6);
        ctx.stroke();
      }
      if (b.out) {
        ctx.strokeStyle = color('--ink-3');
        ctx.beginPath();
        ctx.moveTo(bx + bw + 3, y + rh / 2);
        ctx.lineTo(ox - 3, y + rh / 2);
        ctx.stroke();
        rrect(ctx, ox, y + 6, ow, rh - 12, 999, withAlpha(color(k), done ? 0.85 : 0.12), withAlpha(color(k), 0.8));
        fitTxt(ctx, b.out, ox + ow / 2, y + rh / 2 + 0.5, ow - 10, narrow ? 12 : 13, 700, done ? '#ffffff' : color(k), 'center');
      }
      ctx.globalAlpha = 1;
    });
    // R1 restarts from the base: a bracket from box 0 down to box 2, skipping R1-Zero
    const y0 = 14 + rh / 2;
    const y2 = 14 + 2 * (rh + 12) + rh / 2;
    ctx.globalAlpha = cur >= 2 ? 1 : 0.4;
    ctx.strokeStyle = color('blue');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 2, y0);
    ctx.lineTo(12, y0);
    ctx.lineTo(12, y2);
    ctx.lineTo(bx - 4, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 9, y2 - 4);
    ctx.lineTo(bx - 3, y2);
    ctx.lineTo(bx - 9, y2 + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // the 800k samples feed distillation as well
    const y5 = 14 + 5 * (rh + 12) + rh / 2;
    const y7 = 14 + 7 * (rh + 12) + rh / 2;
    ctx.globalAlpha = cur >= 7 ? 1 : 0.4;
    ctx.strokeStyle = color('teal');
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(bx - 2, y5);
    ctx.lineTo(18, y5);
    ctx.lineTo(18, y7);
    ctx.lineTo(bx - 4, y7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });
  cv.canvas.classList.add('scroll-ok');
  f.stepper({
    steps: boxes.length,
    interval: 2200,
    label: (k) => `${k + 1} / ${boxes.length}`,
    onStep: (k) => {
      cur = k;
      f.code.highlight(boxes[k]!.line);
      f.status(boxes[k]!.note);
      cv.redraw();
    },
  });
}

function figBias(f: Fig): void {
  const A = [1, 1, -1, -1];
  const L = [3, 10, 2, 11];
  let norm: 'grpo' | 'dr' = 'grpo';
  let k = 7;
  const wTok = (i: number) => A[i]! / (norm === 'grpo' ? L[i]! : T_MAX);
  const rowH = (w: number) => (w < 460 ? 30 : 32);
  const cv = fitCanvas(f, (w) => 26 + 4 * rowH(w) + 10, (ctx, w) => {
    const narrow = w < 460;
    const rh = rowH(w);
    txt(ctx, norm === 'grpo' ? 'GRPO: per-token weight Â / |o|' : 'Dr. GRPO: per-token weight Â / 12', 10, 13, ui(narrow ? 11.5 : 12.5, 650), color('--ink-2'));
    const left = 34;
    const right = 70;
    const cw = (w - left - right) / T_MAX;
    const wmax = 1 / 2;
    for (let i = 0; i < 4; i++) {
      const y = 26 + i * rh;
      badge(ctx, 16, y + rh / 2, 8, A[i]! > 0);
      const wv = wTok(i);
      const a = Math.min(1, Math.abs(wv) / wmax);
      for (let t = 0; t < T_MAX; t++) {
        const x = left + t * cw;
        if (t < L[i]!) rrect(ctx, x + 1, y + 4, cw - 2, rh - 8, 3, withAlpha(advColor(A[i]!), 0.1 + 0.8 * a), withAlpha(advColor(A[i]!), 0.9));
        else rrect(ctx, x + 1, y + 4, cw - 2, rh - 8, 3, undefined, withAlpha(color('--ink-3'), 0.25));
      }
      // drag handle
      const hx = left + L[i]! * cw;
      ctx.fillStyle = color('--ink-2');
      ctx.fillRect(hx - 1, y + 2, 2, rh - 4);
      txt(ctx, sgn(wv, 3), w - 8, y + rh / 2, mono(narrow ? 11.5 : 12.5, 650), advColor(A[i]!), 'right');
    }
  });
  const pl = f.plot({
    aspect: 1.75,
    square: false,
    domain: [-0.04, 1.04, -0.12, 1.62],
    draw: (p) => {
      p.axes({ grid: 0.25 });
      const c = p.ctx;
      const fs = (x: number) => Math.sqrt(x * (1 - x)) / 0.5;
      const fr = (x: number) => (x * (1 - x)) / 0.25;
      const xs = Array.from({ length: 201 }, (_, i) => i / 200);
      p.path(xs, xs.map(fs), color('teal'), 2.5);
      p.path(xs, xs.map(fr), withAlpha(color('slate'), 0.9), 2.5, [6, 4]);
      for (let j = 1; j < 8; j++) {
        p.dot(j / 8, fs(j / 8), j === k ? 6 : 3, color('teal'));
        p.dot(j / 8, fr(j / 8), j === k ? 6 : 3, color('slate'));
      }
      p.path([k / 8, k / 8], [0, 1.08], withAlpha(color('--ink-3'), 0.6), 1, [3, 3]);
      txt(c, 'pull of one question vs its pass rate (1 = a 50/50 question)', 8, 12, ui(11), color('--ink-3'));
      txt(c, 'with ÷ std (GRPO)', 8, 28, ui(11, 650), color('teal'));
      txt(c, 'without (Dr. GRPO)', 8, 43, ui(11, 650), color('slate'));
      p.text('0', 0.01, -0.1, { align: 'left', size: 10, mono: true, color: color('--ink-3') });
      p.text('pass rate', 0.5, -0.1, { align: 'center', size: 10, color: color('--ink-3') });
      p.text('1', 0.99, -0.1, { align: 'right', size: 10, mono: true, color: color('--ink-3') });
    },
  });
  pl.canvas.classList.add('scroll-ok');
  const update = () => {
    f.code.setMany({ L: L.join(', '), den: norm === 'grpo' ? 'lengths' : String(T_MAX), w: L.map((_, i) => pyNum(wTok(i), 3)).join(', '), k });
    const r: number[] = Array.from({ length: 8 }, (_, j) => (j < k ? 1 : 0));
    const mean = k / 8;
    const sd = Math.sqrt(mean * (1 - mean));
    const pullStd = r.reduce((a, v) => a + Math.abs((v - mean) / sd), 0) / 8;
    const pullRaw = r.reduce((a, v) => a + Math.abs(v - mean), 0) / 8;
    const ref = { s: 1, r: 0.5 };
    f.code.setMany({ pull: `${pullStd.toFixed(2)}, ${pullRaw.toFixed(2)}`, rel: `${Math.round((pullStd / ref.s) * 100)}% vs ${Math.round((pullRaw / ref.r) * 100)}%` });
    f.code.highlight(norm === 'grpo' ? ['len', 'std'] : ['len', 'raw']);
    cv.redraw();
    pl.redraw();
  };
  let drag = -1;
  const pos = (e: PointerEvent) => {
    const r = cv.canvas.getBoundingClientRect();
    const rh = rowH(r.width);
    const cw = (r.width - 34 - 70) / T_MAX;
    return { i: Math.floor((e.clientY - r.top - 26) / rh), n: Math.round((e.clientX - r.left - 34) / cw) };
  };
  cv.canvas.addEventListener('pointerdown', (e) => {
    const { i } = pos(e);
    if (i < 0 || i > 3) return;
    drag = i;
    cv.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  const move = (e: PointerEvent) => {
    if (drag < 0) return;
    L[drag] = Math.max(1, Math.min(T_MAX, pos(e).n));
    update();
  };
  cv.canvas.addEventListener('pointermove', move);
  cv.canvas.addEventListener('pointerup', () => (drag = -1));
  f.segmented({
    label: 'normalize by',
    options: [
      { value: 'grpo', label: 'GRPO: 1/|o|, ÷ std' },
      { value: 'dr', label: 'Dr. GRPO: constant' },
    ],
    value: 'grpo',
    onChange: (v) => {
      norm = v;
      update();
    },
  });
  f.slider({ label: 'right answers k (of 8)', min: 1, max: 7, step: 1, value: 7, format: (v) => String(v), onInput: (v) => { k = v; update(); } });
  update();
}

function figClipHigher(f: Fig): void {
  let lo = 0.2;
  let hi = 0.28;
  let sel = 0.01;
  const up = (p: number, e: number) => Math.min(1, p * (1 + e)) - p;
  const pl = f.plot({
    aspect: 1.3,
    square: false,
    domain: [-3.08, 0.04, -0.27, 0.43],
    draw: (p) => {
      const c = p.ctx;
      for (const e of [-3, -2, -1, 0]) {
        p.path([e, e], [-0.27, 0.34], withAlpha(color('--ink-3'), 0.18), 1);
        p.text(e === 0 ? '1' : `0.${'0'.repeat(-e - 1)}1`, e, -0.255, { align: e === -3 ? 'left' : e === 0 ? 'right' : 'center', size: 10.5, mono: true, color: color('--ink-3') });
      }
      for (const v of [-0.2, -0.1, 0.1, 0.2]) {
        p.path([-3.08, 0.04], [v, v], withAlpha(color('--ink-3'), 0.12), 1);
        p.text(`${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`, -3.04, v + 0.012, { size: 10.5, mono: true, color: color('--ink-3') });
      }
      p.path([-3.08, 0.04], [0, 0], color('--axis'), 1.2);
      const xs: number[] = [];
      const yH: number[] = [];
      const y2: number[] = [];
      const yL: number[] = [];
      for (let i = 0; i <= 240; i++) {
        const lp = -3 + (3 * i) / 240;
        const pp = 10 ** lp;
        xs.push(lp);
        yH.push(up(pp, hi));
        y2.push(up(pp, 0.2));
        yL.push(-lo * pp);
      }
      c.beginPath();
      xs.forEach((x, i) => (i ? c.lineTo(p.sx(x), p.sy(yH[i]!)) : c.moveTo(p.sx(x), p.sy(yH[i]!))));
      for (let i = xs.length - 1; i >= 0; i--) c.lineTo(p.sx(xs[i]!), p.sy(yL[i]!));
      c.closePath();
      c.fillStyle = withAlpha(color('teal'), 0.08);
      c.fill();
      p.path(xs, y2, withAlpha(color('slate'), 0.9), 1.6, [6, 4]);
      p.path(xs, yH, color('teal'), 2.6);
      p.path(xs, yL, color('red'), 2);
      txt(c, 'probability one batch can add (A > 0)', 8, 13, ui(11, 650), color('teal'));
      txt(c, 'or remove (A < 0), by old probability', 8, 28, ui(11), color('--ink-3'));
      txt(c, `ε_high = ${hi.toFixed(2)}`, p.sx(-2.55), p.sy(0.2), ui(11, 650), color('teal'));
      txt(c, 'ε = 0.2', p.sx(-2.55), p.sy(0.155), ui(11, 650), color('slate'));
      txt(c, `ε_low = ${lo.toFixed(2)}`, p.sx(-2.55), p.sy(-0.12), ui(11, 650), color('red'));
      txt(c, 'old probability (log scale) →', p.w - 8, p.sy(-0.205), ui(10.5), color('--ink-3'), 'right');
      const lp = Math.log10(sel);
      p.path([lp, lp], [-lo * sel, up(sel, hi)], withAlpha(color('--ink-2'), 0.7), 1.5, [3, 3]);
      p.dot(lp, up(sel, hi), 6, color('teal'), color('--paper'));
      p.dot(lp, -lo * sel, 5, color('red'), color('--paper'));
    },
  });
  const addRo = f.readout('can add');
  const remRo = f.readout('can remove');
  const update = () => {
    const u = up(sel, hi);
    f.code.setMany({ sel: fmt(sel, 2), up: `+${fmt(u, 2)}`, down: `−${fmt(sel * lo, 2)}` });
    addRo.set(`+${fmt(u, 2)}`);
    remRo.set(`−${fmt(sel * lo, 2)}`);
    pl.redraw();
  };
  let drag = false;
  const move = (e: PointerEvent) => {
    const [x] = pl.pointer(e);
    sel = 10 ** Math.max(-3, Math.min(0, x));
    update();
  };
  pl.canvas.addEventListener('pointerdown', (e) => {
    drag = true;
    pl.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  pl.canvas.addEventListener('pointermove', (e) => drag && move(e));
  pl.canvas.addEventListener('pointerup', () => (drag = false));
  f.slider({ label: 'ε_high', sym: 'eps', min: 0.1, max: 0.5, step: 0.01, value: 0.28, slot: 'hi', format: (v) => v.toFixed(2), onInput: (v) => { hi = v; update(); } });
  f.slider({ label: 'ε_low', sym: 'eps', min: 0.1, max: 0.4, step: 0.01, value: 0.2, slot: 'lo', format: (v) => v.toFixed(2), onInput: (v) => { lo = v; update(); } });
  update();
}

// ---------------------------------------------------------------- the chapter

const chapter: ChapterDef = {
  symbols: GRPO_SYMBOLS,

  render(p) {
    p.prose(`
The last two chapters taught a model from human preferences. [RLHF](#/rlhf) trains a reward model on pairs of answers that people compared, then pushes the language model toward high reward with PPO. [DPO](#/dpo) folds the reward model away and fits the preference pairs directly. Both share a weakness: the reward is a *learned guess* about what people like, and a policy optimized hard against a guess finds the places where the guess is wrong.

For some tasks we do not have to guess. A math problem has an answer that can be checked. A program has tests that can be run. When a few lines of code can grade the answer, the reward is very hard to fool, so reinforcement learning can run for far longer than RLHF allows. This is **reinforcement learning from verifiable rewards** (RLVR). Paired with **GRPO**, a lean variant of PPO that needs no value network, it is the recipe behind DeepSeek-R1 and much of the 2025 wave of reasoning models.

This chapter builds it from the ground up: what a verifier is and how it can still be gamed, a one-page recap of PPO, the GRPO objective term by term, why dropping the critic matters, a toy GRPO run in your browser, the R1-Zero and R1 recipes, and the failure modes that later work (Dr. GRPO, DAPO) found and fixed.`);

    // ------------------------------------------------------------ verifiable rewards
    p.h2('Rewards a program can check', 'verifiable');
    p.prose(`
In RLHF the reward is a neural network: it reads the prompt and the answer and outputs a score. It was trained on a few hundred thousand human comparisons, so it is right about typical answers and wrong about unusual ones. The policy is a far stronger optimizer than the reward model is a judge. Give it enough steps and it finds outputs the reward model loves for the wrong reasons, the over-optimization curve of the [RLHF chapter](#/rlhf). That is why RLHF keeps a short KL leash and stops early.

A **verifiable reward** replaces the network with a program. For a math problem with a known answer, extract the model's final answer and compare it with the reference. For a coding problem, run the code against test cases. The reward is binary, cheap, and exact on the thing it checks. The name RLVR comes from AI2's Tülu 3 (Lambert et al., 2024); DeepSeek-R1 calls the same thing *rule-based rewards*.`);
    p.math({
      label: 'A verifiable reward',
      tex: String.raw`\symr(q, \symo) = \mathbf{1}\big[\,\text{extract}(\symo) = a^\star(q)\,\big]`,
      codeTitle: 'reward.py',
      code: `
        def reward(q, o):
            pred = extract_boxed(o)   # or None
            if pred is None:
                return 0.0            # wrong format
            ok = equal(pred, answer[q])
            return 1.0 if ok else 0.0
      `,
      terms: [
        [String.raw`q`, 'the prompt: a question with a known answer'],
        [String.raw`\symo`, 'the output the model wrote, reasoning and all'],
        [String.raw`\text{extract}(\symo)`, 'a parser that pulls out the final answer, for example the text inside `\\boxed{}`'],
        [String.raw`a^\star(q)`, 'the reference answer stored with the question'],
        [String.raw`\mathbf{1}[\cdot]`, 'the *indicator*: 1 if the statement inside is true, 0 if not'],
      ],
      explain: 'The reward is 1 when the extracted answer matches the reference and 0 otherwise. Nothing about the reasoning is graded, only the final answer. DeepSeek-R1 adds a second rule, a *format reward* for putting the reasoning between `<think>` and `</think>` tags, so the answer is always in a predictable place.',
    });
    p.prose(`
Why does this resist reward hacking? A reward model is a network, and networks have adversarial inputs: strange outputs that score high. A checker that compares a number with 722 has no such inputs. The only way to get its reward is to produce what it checks. That is the property that let DeepSeek train R1-Zero for thousands of RL steps with no learned reward at all.

### How a verifier can still be gamed

The policy optimizes what the checker checks, not what you meant. Two kinds of gap show up again and again:

- **Format exploits.** A loose parser can be satisfied without committing to an answer. If the checker accepts *any* boxed answer that matches, the policy learns to box several guesses. If it accepts any number in the text, the policy learns to spray numbers. Format rewards can be gamed the same way: empty \`<think>\` tags satisfy a tag check.
- **Partial checkers.** A test suite with three tests rewards code that passes three tests, including code that special-cases them. A checker that only reads the final answer gives full credit to a lucky guess or a flawed derivation that lands on the right number, and multiple-choice questions can be guessed a quarter of the time. In agentic coding setups, models have been reported editing the tests or making a check always pass when the environment allowed it.

The opposite failure costs less but is real too: a checker that compares strings rejects \`722.0\`, so right answers get reward 0, which is noise in the training signal. Good verifiers parse strictly, compare by mathematical equivalence, and are kept out of the policy's reach.`);
    p.figure({
      title: 'Six answers, four checkers',
      codeTitle: 'verify.py',
      code: `
        import re
        BOX = r"\\\\boxed\\{([^}]*)\\}"
        answer = "${ANSWER}"               # 437 + 285

        def reward(text, mode):
            boxes = re.findall(BOX, text)
            nums = re.findall(r"\\d+", text)
            if mode == "last box (text)":
                ok = boxes[-1:] == [answer]       #@string
            elif mode == "any box":
                ok = answer in boxes              #@anybox
            elif mode == "any number":
                ok = answer in nums               #@anynum
            else:              # "one box": a number
                ok = (len(boxes) == 1 and         #@strict
                      num(boxes[0]) == num(answer))  #@strict
            return float(ok)
        # mode = "{{mode:one box}}"
        # {{row:tap an answer to grade it}}
      `,
      setup: figChecker,
      caption: `Six outputs for the same question, graded by four checkers. Green: rewarded and deserved. **Red: an exploit that gets reward 1** without committing to one answer. Gold: a right answer the checker rejects. Switch checkers and watch the counts: *any number* rewards the number spray, *any box* and *last box (text)* reward the hedge, and *last box (text)* also rejects \`722.0\` because it compares strings. The strict *one box* checker (exactly one box, compared as a number) rejects the unboxed answer on purpose: the format is part of the task, and models learn it within a few steps. Tap an answer to see its grade in the code.`,
    });
    p.callout('warning', `A policy under RL is a search process aimed at your checker. Every gap between "passes the check" and "is correct" will eventually be found, because finding such gaps is exactly what the optimization does. Treat the verifier as part of the training code: test it against adversarial outputs before a long run, not after.`, 'The checker is the objective');

    // ------------------------------------------------------------ PPO recap
    p.h2('PPO in one page', 'ppo-recap');
    p.prose(`
GRPO is a modification of PPO, so here is the part of PPO it keeps. The full story, with derivations, is in [policy gradients](#/policy-gradients) and [RLHF](#/rlhf).

A language model is a **policy**: given the prompt $q$ and the tokens written so far, it outputs a probability for every possible next token, $\\sympi(o_t \\mid q, o_{<t})$. A whole output's probability is the product of its tokens' probabilities. The policy gradient says: to raise the expected reward, raise the log-probability of outputs that did *better than expected*, and lower it for outputs that did worse. "Better than expected" is the **advantage** $\\symA$: the reward minus a baseline, an estimate of what the model usually gets from this situation. Subtracting the baseline does not change the direction the gradient points on average, but it removes most of the noise.

PPO adds one more idea. Sampling outputs from a big model is expensive, so PPO samples a batch with the current policy, calls it $\\pi_{\\text{old}}$, and takes several gradient steps on that same batch. After the first step the policy being trained is no longer the one that sampled, so each token is reweighted by the **probability ratio** $\\symrho = \\sympi / \\pi_{\\text{old}}$. And because a few large steps on one batch can wreck a model, PPO **clips** the ratio: once a token's probability has moved more than a factor $1 \\pm \\symeps$ from where it was sampled, the objective stops rewarding further movement.`);
    p.math({
      label: 'PPO clipped objective (per token)',
      tex: String.raw`\begin{aligned}\mathcal{L}^{\text{clip}} &= \mathbb{E}_t\big[\min(\symrho_t\,\symA_t,\ c_t\,\symA_t)\big]\\[2pt] c_t &= \operatorname{clip}(\symrho_t,\,1-\symeps,\,1+\symeps)\\[2pt] \symrho_t &= \frac{\sympi(o_t\mid s_t)}{\pi_{\text{old}}(o_t\mid s_t)}\end{aligned}`,
      codeTitle: 'ppo_clip.py',
      code: `
        ratio = np.exp(logp - old_logp)  # per token
        unclipped = ratio * A
        clipped = np.clip(ratio, 1 - eps, 1 + eps) * A
        objective = np.minimum(unclipped, clipped)
        J = objective.mean()             # maximize
      `,
      terms: [
        [String.raw`\symrho_t`, 'how much more (or less) likely token $t$ is now than when it was sampled. $\\symrho = 1$ means unchanged'],
        [String.raw`\symA_t`, 'the advantage of that token: positive means "do more of this"'],
        [String.raw`\symrho_t\,\symA_t`, 'the plain objective: raising the probability of a good token raises it'],
        [String.raw`c_t`, 'the ratio, clipped: held inside the band from $1-\\symeps$ to $1+\\symeps$ (typically $\\symeps = 0.2$)'],
        [String.raw`\min(\cdot,\cdot)`, 'take the smaller, more pessimistic of the two'],
        [String.raw`\mathbb{E}_t`, 'average over all tokens in the batch'],
      ],
      explain: 'For a good token ($\\symA > 0$) the objective grows as its probability grows, until the ratio reaches $1+\\symeps$; beyond that it is flat, so the gradient is zero and the token stops being pushed. For a bad token the same happens below $1-\\symeps$. Clipping never punishes a step; it just stops rewarding steps that go too far. The `min` makes sure the clip can only remove incentive, never add it.',
    });
    p.figure({
      title: 'The clipped objective for one token',
      codeTitle: 'ppo_clip.py',
      code: `
        ratio = np.exp(logp - old_logp)  # {{rho:ρ = 1.30}}
        A = {{A:+1.0}}            # this token's advantage
        eps = {{eps:0.2}}

        unclipped = ratio * A                     #@un
        clipped = np.clip(ratio, 1 - eps,         #@cl
                          1 + eps) * A            #@cl
        objective = np.minimum(unclipped, clipped)  #@min
        # objective = {{obj}}
        # slope wrt the ratio: {{grad}}
      `,
      setup: figClip,
      caption: `The teal curve is the objective for one token as its ratio $\\symrho$ moves; the dashed line is the unclipped $\\symrho\\symA$. **Drag** along the plot to move the token. With $\\symA = +1$, raising the token's probability helps until $\\symrho = 1+\\symeps$, then the curve goes flat and the slope reads 0: the token is ignored for the rest of this batch. Flip to $\\symA = -1$: now the flat stretch is on the left, below $1-\\symeps$. Widen $\\symeps$ and the policy may move further per batch.`,
    });
    p.prose(`
### Where PPO gets its advantage, and what that costs

In the PPO setup used for RLHF, the baseline comes from a **value network** (the *critic*) $V(s_t)$, trained alongside the policy to predict the reward still to come from each prefix of the output. The advantage of each token is then built from the critic's predictions with generalized advantage estimation (GAE). This works, but the critic is a whole second network, usually as large as the policy (InstructGPT initialized it from the reward model), with its own gradients and optimizer state. It must learn to predict, at every token, a reward that only arrives at the very end, and its errors leak into every advantage.

So PPO for language models keeps four models in memory: the **policy** and the **critic** (both trained), plus the **reference** model for the KL penalty and the **reward model** (both frozen). GRPO removes the critic. With a verifier, the reward model goes too.`);

    // ------------------------------------------------------------ GRPO
    p.h2('GRPO: the group is the baseline', 'grpo');
    p.prose(`
Group Relative Policy Optimization was introduced by Shao et al. in **DeepSeekMath** (2024), at first with a learned reward model for math. The idea fits in one sentence: instead of training a critic to predict how well the model usually does on a question, *sample several answers to that question and look*.

For each question $q$, draw a **group** of $G$ outputs $\\symo_1, \\dots, \\symo_G$ from $\\pi_{\\text{old}}$. Score each one, giving rewards $\\symr_1, \\dots, \\symr_G$. The group's average reward is an estimate of what the model usually gets on this question, exactly the number a critic tries to learn, computed fresh and specific to this prompt. Each output's advantage is how far it lands above or below its siblings, in units of the group's spread.`);
    p.math({
      label: 'Group-relative advantage',
      tex: String.raw`\symA_{i,t} = \frac{\symr_i - \operatorname{mean}(\symr_1, \dots, \symr_G)}{\operatorname{std}(\symr_1, \dots, \symr_G)}`,
      codeTitle: 'advantage.py',
      code: `
        r = np.array([verify(q, o) for o in outputs])
        A = (r - r.mean()) / (r.std() + 1e-4)
        # token t of output i is trained with A[i]
      `,
      terms: [
        [String.raw`\symr_i`, 'the reward of output $i$, here 1 (accepted) or 0'],
        [String.raw`\operatorname{mean}(\symr_1..\symr_G)`, 'the group average. For 0/1 rewards it is the fraction of the group that was right: the model\'s current *pass rate* on this question'],
        [String.raw`\operatorname{std}(\cdot)`, 'the standard deviation: how spread out the rewards are. Dividing by it puts every question\'s advantages on a similar scale'],
        [String.raw`\symA_{i,t}`, 'the advantage of token $t$ of output $i$. It does not depend on $t$: every token of an output gets the same value'],
      ],
      explain: 'A right answer on a hard question (where most of the group failed) gets a large positive advantage; a right answer on an easy question gets a small one, because being right there was expected. Wrong answers get negative advantages. Within a group the advantages always add up to zero, so GRPO pushes probability from the worse outputs toward the better ones without changing the total. The small `1e-4` keeps the division safe when every reward is the same.',
    });
    p.figure({
      title: 'A group of answers and their advantages',
      codeTitle: 'group.py',
      code: `
        q = "{{q:437 + 285}}"
        outputs = [policy.sample(q)
                   for _ in range({{G:8}})]           #@sample
        r = np.array([verify(q, o) for o in outputs])  #@verify
        # r = [{{r}}]
        # mean {{mean}}, std {{std}}
        A = {{advexpr:(r - r.mean()) / (r.std() + 1e-4)}}  #@adv
        # A[:4] = [{{A1}}]
        # A[4:8] = [{{A2}}]
        # every token of outputs[i] gets A[i]  #@tok
      `,
      setup: figGroup,
      caption: `Each row is one output sampled from a small toy policy (introduced properly in the [training figure](#/grpo/toy) below): blue chips are column-by-column work, orange ✓ chips re-check the work, and the purple chip is the final answer, graded by the verifier. Every chip in a row is washed in that row's advantage color: **the same $\\symA_i$ for every token**. Press **Resample** a few times and notice the advantages always sum to zero. Try 1-digit problems with the trained policy: often every output is right, all advantages are 0, and the group teaches nothing. Try 4 digits with the base model: when a single output is right, it earns a big advantage.`,
    });
    p.callout('intuition', `Why is a group of samples a good baseline? The critic in PPO is trying to estimate one number per situation: the expected reward. GRPO estimates that number at the start of each output by brute force, averaging $G$ real attempts. The estimate is noisy for small $G$, but it is unbiased and needs no training, and for reasoning tasks sampling many answers is something you were going to pay for anyway.`, 'A baseline by sampling');

    p.prose(`
### The KL penalty, added to the loss

Like RLHF, GRPO keeps the policy near a frozen **reference** model $\\sympiref$ (usually the starting checkpoint), so it does not drift into degenerate text. PPO in RLHF usually subtracts the KL penalty from the reward at every token, which then flows into the critic and the advantages. GRPO instead adds the penalty straight to the loss, which keeps the advantage a clean function of the rewards. It uses an estimator of the KL divergence that is computed from the sampled token alone and is never negative.`);
    p.callout('math', `The **KL divergence** $\\mathrm{KL}(\\pi \\,\\|\\, \\pi_{\\text{ref}})$ measures how different two probability distributions are: it is the average, over outputs drawn from $\\pi$, of $\\log \\pi - \\log \\pi_{\\text{ref}}$. It is zero when the two agree and grows as they diverge. An **expectation** $\\mathbb{E}[\\cdot]$ is just a probability-weighted average; in code, the mean over samples. The [policy-gradient chapter](#/policy-gradients) introduces both properly.`, 'Math help: KL and expectations');
    p.math({
      label: 'Per-token KL estimator',
      tex: String.raw`\mathbb{D}_{i,t} = \frac{\sympiref(o_{i,t}\mid\cdot)}{\sympi(o_{i,t}\mid\cdot)} - \log\frac{\sympiref(o_{i,t}\mid\cdot)}{\sympi(o_{i,t}\mid\cdot)} - 1`,
      codeTitle: 'kl.py',
      code: `
        x = np.exp(ref_logp - logp)  # pi_ref / pi
        kl = x - np.log(x) - 1       # >= 0
      `,
      terms: [
        [String.raw`\frac{\sympiref(o_{i,t}\mid\cdot)}{\sympi(o_{i,t}\mid\cdot)}`, 'how likely the reference finds the sampled token, relative to the policy. Call it $x$'],
        [String.raw`x - \log x - 1`, 'a curve that touches zero at $x = 1$ and is positive everywhere else'],
        [String.raw`\mathbb{D}_{i,t}`, 'the penalty for token $t$ of output $i$'],
      ],
      explain: 'On average over tokens sampled from the policy, the $x$ part averages to exactly 1 and the $-\\log x$ part averages to the true KL, so the estimate is unbiased; and unlike the naive $-\\log x$ alone, it is never negative for a single token, which makes it less noisy. It is one of the estimators in John Schulman\'s 2020 note on approximating KL.',
    });
    p.prose(`
### The whole objective

Put together: average the clipped PPO term over every token of every output in the group, using the group advantage, and subtract the KL penalty. Here it is as the DeepSeekMath paper writes it.`);
    p.math({
      label: 'The GRPO objective',
      tex: String.raw`\begin{aligned}\mathcal{J}(\theta) &= \mathbb{E}\Bigg[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|\symo_i|}\sum_{t=1}^{|\symo_i|}\ell_{i,t}\Bigg]\\[2pt] \ell_{i,t} &= \min\big(\symrho_{i,t}\symA_{i,t},\ c_{i,t}\symA_{i,t}\big) - \symbeta\,\mathbb{D}_{i,t}\\[2pt] c_{i,t} &= \operatorname{clip}(\symrho_{i,t},\,1-\symeps,\,1+\symeps)\end{aligned}`,
      codeTitle: 'grpo_loss.py',
      code: `
        def grpo_loss(logp, old_logp, ref_logp, A,
                      mask, eps=0.2, beta=0.04):
            # arrays are (G, T); A is (G,)
            ratio = np.exp(logp - old_logp)
            adv = A[:, None]        # every token
            c = np.clip(ratio, 1 - eps, 1 + eps)
            surr = np.minimum(ratio * adv, c * adv)
            x = np.exp(ref_logp - logp)
            kl = x - np.log(x) - 1
            ell = surr - beta * kl
            # 1/|o_i|: mean over each output's tokens
            seq = (ell * mask).sum(1) / mask.sum(1)
            return -seq.mean()      # maximize J
      `,
      terms: [
        [String.raw`\mathbb{E}[\cdot]`, 'average over questions $q$ and over groups of outputs sampled from $\\pi_{\\text{old}}$ for each'],
        [String.raw`\frac{1}{G}\sum_{i=1}^{G}`, 'average over the $G$ outputs in a group'],
        [String.raw`\frac{1}{|\symo_i|}\sum_{t=1}^{|\symo_i|}`, 'average over the tokens of output $i$; $|\\symo_i|$ is its length. Hold on to this one: it causes trouble later'],
        [String.raw`\symrho_{i,t}`, 'the ratio $\\sympi(o_{i,t}\\mid q, o_{i,<t}) / \\pi_{\\text{old}}(o_{i,t}\\mid q, o_{i,<t})$ for that token'],
        [String.raw`\ell_{i,t}`, 'what one token contributes: the PPO clipped term (with $c_{i,t}$ the clipped ratio), using the group advantage in place of a critic\'s'],
        [String.raw`\symbeta\,\mathbb{D}_{i,t}`, 'minus the KL penalty toward $\\sympiref$, weighted by $\\symbeta$'],
      ],
      explain: 'Read it inside out. For each token: the clipped "do more of this if the output beat its group" term, minus a little KL. Average over the output\'s tokens, then over the group, then over questions. Training maximizes it, which in code means minimizing its negative. Compared with PPO, the critic is gone: the advantages come from the group\'s rewards and nothing else, and the KL sits in the loss rather than in the reward.',
    });
    p.table(
      ['', 'PPO (RLHF style)', 'GRPO'],
      [
        ['Baseline for the advantage', 'a learned critic $V(s_t)$, per token', 'the mean reward of $G$ samples, per question'],
        ['Advantage within an output', 'differs token by token (GAE)', 'the same for every token'],
        ['KL to the reference', 'subtracted from the reward, per token', 'added to the loss directly'],
        ['Models in memory', 'policy, critic, reference, reward model', 'policy, reference (and a reward model, unless a verifier scores)'],
        ['Samples per prompt', 'usually one', '$G$, often in the tens'],
      ],
      { caption: 'What GRPO keeps from PPO and what it changes.' },
    );

    // ------------------------------------------------------------ memory
    p.h2('Why dropping the critic matters', 'no-critic');
    p.prose(`
Training a model with Adam in mixed precision costs about **16 bytes per parameter** before counting activations: 2 for the bf16 weights, 2 for their gradients, 4 for an fp32 master copy of the weights, and 4 each for Adam's two running averages (see [training across many GPUs](#/parallelism)). A frozen model used only for inference costs 2 bytes per parameter for its bf16 weights.

The critic is a model you *train*, so it costs the full 16 bytes per parameter, the same as the policy. Dropping it removes about as much memory as the policy itself, and with it the compute for the critic's forward and backward passes. A verifier removes the reward model as well. The freed memory goes to what RL for language models actually spends its time on: generating long outputs, many per prompt.`);
    p.figure({
      title: 'Memory for the models in an RL run',
      codeTitle: 'memory.py',
      code: `
        N = {{N:7e9}}         # params per model
        trained = 16 * N      # bf16 w and grads,
                              # fp32 w, Adam m, v
        frozen = 2 * N        # bf16 weights only

        ppo = 2*trained + 2*frozen  # +critic   #@ppo
        grpo = trained + 2*frozen   # +reward model  #@grpo
        rlvr = trained + frozen     # reward: code  #@rlvr
        # GB: PPO {{ppo}}, GRPO {{grpo}},
        #     GRPO + verifier {{rlvr}}
      `,
      setup: figMemory,
      caption: `Bars show the memory for model weights and optimizer state alone, assuming every model has the same size (in practice the critic and reward model are sometimes smaller). Dashed gridlines fall on multiples of 80 GB, the memory of one large GPU. Slide the model size: at 7 billion parameters PPO needs about 250 GB before a single activation or KV-cache entry, and GRPO with a verifier needs half that. Activations, the KV cache for generation, and sharding across GPUs (FSDP) come on top.`,
    });

    // ------------------------------------------------------------ toy run
    p.h2('GRPO in your browser', 'toy');
    p.prose(`
To watch GRPO work, we need a policy small enough to train in a web page that still has the shape of the real thing: it writes a sequence of tokens, a verifier grades the result, and getting it right takes effort. Here is a toy world built for that.

The prompt is an addition problem with 1 to 4 digits, like $437 + 285$. The policy writes one token at a time from a vocabulary of three:

- **work**: add the next column (rightmost first) and write its digit. Each column has a 15% chance of a slip that writes the wrong digit. Once every column is done, a work token does nothing: it is filler, drawn as "…".
- **check**: re-add the columns done so far. Each wrong digit gets fixed with probability 70%.
- **answer**: write the number and stop. Columns never worked out are guessed.

Outputs are cut off at 12 tokens. The verifier compares the written number with the true sum: reward 1 or 0. The policy is a softmax over the three tokens in each situation (how many digits, how many columns done, how many checks so far): 60 situations, 180 numbers in all, a tabular stand-in for a language model. Its starting point, the "base model", answers too early and rarely checks: it is right about 60% of the time on 1-digit problems and 12% on 4-digit ones.

GRPO trains it exactly as the equations say: groups of $G$ outputs per problem, 8 problems per batch, group-normalized advantages, two clipped gradient passes per batch, and the KL estimator toward the base model.`);
    p.figure({
      title: 'Training a toy policy with GRPO',
      layout: 'stack',
      codeTitle: 'grpo_train.py',
      code: `
        G, beta = {{G:8}}, {{beta:0.02}}
        for step in range(400):     # step {{step:0}}
            old = policy.copy()     # pi_old samples
            batch = []
            while len(batch) < 8:   # 8 problems
                q = sample_problem()  # "437 + 285"
                outputs = [old.sample(q)
                           for _ in range(G)]     #@sample
                r = np.array([verify(q, o)
                              for o in outputs])  #@reward
                if {{dyn:False}} and r.std() == 0:
                    continue        # dynamic sampling
                A = (r - r.mean()) / (r.std() + 1e-4)  #@adv
                batch.append((q, outputs, A))
            for _ in range(2):      # clipped passes
                loss = grpo_loss(policy, old, ref,
                                 batch, beta)     #@loss
                loss.backward(); opt.step()       #@update
        # accuracy {{acc:…}}, length {{len:…}} tokens
      `,
      setup: figTrain,
      caption: `Press **Train** and watch two curves rise together: **accuracy** (gold) climbs from about 30% to nearly 90%, and **output length** (purple) climbs from under 3 tokens to over 5. Nobody asked for longer outputs: the policy learned that working every column and spending a token on a check pays, so it writes more. Most of the extra length is that useful work (about one more column and one more check per answer); about half a token of the growth is filler, the "…" chips that redo work after the last column, which nothing in the reward discourages. That is R1's length growth in miniature, and the orange ✓ chips multiplying in the live group are its self-verification. The dashed line is the fraction of groups with no signal (every output right, or every output wrong): around 15% at the start, mostly hard problems the base model never solves, then a dip, then a climb toward 40% as easy problems become always right. Raise $\\symbeta$ to 0.3 before training and the KL leash holds the policy near the base model: accuracy stalls near 65%. Turn on **dynamic sampling** to skip no-signal groups; here it buys a small but consistent gain.`,
    });

    // ------------------------------------------------------------ R1
    p.h2('R1-Zero and R1', 'r1');
    p.prose(`
In January 2025 DeepSeek released **DeepSeek-R1**, an open reasoning model, and with it a striking experiment: **DeepSeek-R1-Zero**, trained with GRPO and rule-based rewards directly on the pretrained base model, with no supervised fine-tuning at all.

### R1-Zero: pure RL from the base

The setup is spare. A simple template asks the model to reason inside \`<think>\` tags and then give its answer. The rewards are an accuracy check (a boxed final answer for math, test cases for code) and a format check for the tags. There is no neural reward model: the paper says it avoided one because of reward hacking at scale and the cost of retraining it. Everything else is left for the model to discover.

What it discovered:

- **Accuracy.** On the AIME 2024 math competition, the paper reports pass@1 (the chance a single sample is right) rising from 15.6% to 71.0% over training, and 86.7% with majority voting over 64 samples.
- **Length.** The average response length grew steadily through training, from hundreds of tokens toward many thousands. The model learned on its own to spend more test-time computation on harder problems.
- **Self-verification.** Reflection, re-checking, and trying another approach emerged. The paper shows an intermediate checkpoint stopping mid-solution to re-evaluate its first approach, writing "Wait, wait. Wait. That's an aha moment I can flag here.", and calls it the **aha moment**.

R1-Zero also had problems: its reasoning was hard to read and it mixed languages within a single answer.

### R1: a multi-stage recipe

R1 keeps the RL and wraps it in stages that fix readability and broaden the model. Step through them below.`);
    p.figure({
      title: 'The R1-Zero and R1 recipes',
      codeTitle: 'r1_recipe.py',
      code: `
        base = load("DeepSeek-V3-Base")        #@base
        r1_zero = grpo(base, math_code,
                       reward=rules)           #@zero

        m = sft(base, cold_start_cot)  # 1000s  #@cold
        m = grpo(m, math_code,
                 reward=rules + language)      #@rl1
        data = rejection_sample(m)   # ~600k   #@rs
        data += general_sft_data     # ~200k   #@rs
        m = sft(base, data)          # 2 epochs  #@sft2
        r1 = grpo(m, all_prompts,
                  reward=rules + reward_models)  #@rl2

        # distillation: SFT only, no RL
        small = sft(load("Qwen2.5-Math-7B"), data)  #@distill
      `,
      setup: figPipeline,
      caption: `Press play or step through. The dashed box is R1-Zero, one RL run straight from the base. R1 goes back to the same base (the blue bracket) and adds a supervised **cold start**, then the same reasoning RL, then a round of rejection sampling and fine-tuning that mixes in ordinary assistant data, then a last RL stage over all kinds of prompts. The teal bracket marks the reuse of the ~800k samples: the same data that fine-tunes R1 also distills it into small models.`,
    });
    p.prose(`
### Distillation

The last stage is the cheapest and, for most people, the most useful. DeepSeek fine-tuned six open models (Qwen2.5 and Llama, from 1.5B to 70B parameters) on the ~800k samples produced by the R1 pipeline: plain supervised learning on R1's outputs, no RL. The distilled models reason far better than their bases. The paper also ran large-scale RL directly on a 32B base model, and that model ended up well behind the 32B model distilled from R1. The lesson: reasoning behavior that a very large model discovers through RL can be handed to a small model with ordinary fine-tuning, which is far cheaper than discovering it again.`);
    p.table(
      ['', 'R1-Zero', 'R1', 'R1-Distill'],
      [
        ['Starts from', 'DeepSeek-V3-Base', 'DeepSeek-V3-Base', 'existing Qwen2.5 or Llama models'],
        ['Supervised data', 'none', 'cold start, then ~800k', '~800k samples from R1\'s pipeline'],
        ['RL', 'GRPO, rule rewards', 'two GRPO stages', 'none'],
        ['Known weakness', 'hard to read, mixes languages', 'slower and costlier to train', 'bounded by its teacher'],
      ],
      { caption: 'Three models from one paper (DeepSeek-AI, January 2025).' },
    );
    p.callout('aside', `How much does RL create, and how much does it uncover? Later work suggests a bit of both. Liu et al. (2025) found self-reflection like the "aha" phrase already present in base models before any RL, and argued that part of the length growth comes from a bias in the GRPO objective (next section). Yue et al. (2025) compared pass@k, the chance that at least one of $k$ samples is right: RL-trained models win at $k = 1$, but at large $k$ the base model often catches up or passes them, which suggests RLVR mostly makes the model reliably find answers it could already reach. Both findings are active research, not settled facts.`, 'Does RL teach reasoning?');

    // ------------------------------------------------------------ failure modes
    p.h2('When GRPO goes wrong', 'failure-modes');
    p.prose(`
GRPO is simple, and its simplicity hides some sharp edges. Four came up again and again in the open reproductions of R1-Zero during 2025.

### 1. Groups with no signal

If all $G$ outputs get the same reward, the mean equals every reward, so every advantage is exactly zero (you saw this in the group figure). The question contributes only its KL term: the compute spent sampling it is wasted. This gets *worse* as training succeeds: questions the model has mastered become all-right groups, and questions far beyond it are all-wrong. The effective batch shrinks and the gradient gets noisier.

The fix in **DAPO** (Yu et al., 2025) is **dynamic sampling**: sample more questions than needed, drop every group whose accuracy is exactly 0 or exactly 1, and keep drawing until the batch is full of groups that carry signal. Filtering the training set by pass rate before or during training does the same job more cheaply.

### 2. Length bias from the $1/|\\symo_i|$

The objective averages each output's tokens, dividing by its length $|\\symo_i|$. So each token of output $i$ is weighted by $\\symA_i / |\\symo_i|$. Look at what that does:

- among **right** answers ($\\symA > 0$), a short one's tokens get a bigger push than a long one's, so short right answers are favored;
- among **wrong** answers ($\\symA < 0$), a long one's tokens get a *smaller* penalty than a short one's, so being long softens the blow of being wrong.

Liu et al. (2025), in the paper that names the fix **Dr. GRPO** ("GRPO done right"), argue that this second effect makes wrong answers grow longer and longer during training, inflating the length curve without adding reasoning.

### 3. Difficulty bias from the std

Dividing by the group's standard deviation rescales each question. With 0/1 rewards and a pass rate $p$, the std is $\\sqrt{p(1-p)}$, which is small when $p$ is near 0 or 1. So questions that are almost always right or almost always wrong get their advantages *inflated* relative to 50/50 questions. Dr. GRPO argues this over-weights questions that are too easy or too hard.`);
    p.figure({
      title: 'Two normalizations, two biases',
      codeTitle: 'biases.py',
      code: `
        # length: two right, two wrong outputs
        A = np.array([1.0, 1.0, -1.0, -1.0])
        lengths = np.array([{{L}}])
        w_token = A / {{den:lengths}}         #@len
        # = [{{w}}]

        # difficulty: 8 samples, k = {{k:7}} right
        r = np.array([1.0]*k + [0.0]*(8 - k))
        A_std = (r - r.mean()) / r.std()  # GRPO  #@std
        A_raw = r - r.mean()         # Dr. GRPO  #@raw
        pull = [np.abs(A_std).mean(),
                np.abs(A_raw).mean()]  # {{pull}}
        # vs a 50/50 question: {{rel}}
      `,
      setup: figBias,
      caption: `**Top:** four outputs, two right and two wrong, each a row of tokens; color depth is the per-token weight. **Drag** a row to change its length. Under GRPO, the long wrong output's tokens are barely penalized while the short wrong one's are hit hard; switch to Dr. GRPO and every token of every wrong output gets the same penalty, whatever its length. **Bottom:** how strongly one question pulls on the update as its pass rate changes. Dividing by the std (teal) gives a 7-of-8 question 66% of the pull of a 4-of-8 question; without it (slate) the 7-of-8 question gets 44%. Slide $k$ to the edges and the gap widens.`,
    });
    p.math({
      label: 'Dr. GRPO: remove both normalizations',
      tex: String.raw`\begin{aligned}\mathcal{J}_{\text{Dr}}(\theta) &= \mathbb{E}\Bigg[\frac{1}{G}\sum_{i=1}^{G}\sum_{t=1}^{|\symo_i|}\ell_{i,t}\Bigg]\\[2pt] \symA_{i,t} &= \symr_i - \operatorname{mean}(\symr_1, \dots, \symr_G)\end{aligned}`,
      codeTitle: 'dr_grpo.py',
      code: `
        A = r - r.mean()             # no / std
        adv = A[:, None]
        c = np.clip(ratio, 1 - eps, 1 + eps)
        surr = np.minimum(ratio * adv, c * adv)
        total = (surr * mask).sum()  # no 1/|o_i|
        loss = -total / (G * MAX_LEN)  # constant
      `,
      terms: [
        [String.raw`\ell_{i,t}`, 'the same per-token term as in GRPO'],
        [String.raw`\sum_{t=1}^{|\symo_i|}`, 'a plain sum over tokens: the $1/|\\symo_i|$ is gone, so a token\'s weight no longer depends on how long its output is'],
        [String.raw`\symr_i - \operatorname{mean}(\cdot)`, 'the advantage without dividing by the std: questions are no longer rescaled by how spread out their rewards are'],
      ],
      explain: 'Both changes make the update an unbiased policy gradient with the group mean as baseline. In code the summed loss is divided by a fixed constant, such as the maximum generation length, only to keep its scale steady; because the constant is the same for every output it introduces no bias. Liu et al. report that this keeps the length of wrong answers from ballooning without hurting accuracy.',
    });
    p.prose(`
### 4. Entropy collapse

The **entropy** of the policy measures how spread out its next-token probabilities are. Under RL it tends to fall fast: the policy grows confident, the $G$ samples of a group become nearly identical, and identical samples mean identical rewards, which means groups with no signal and no exploration. The DAPO authors traced part of this to the clip itself.

The clip bounds the *ratio*, so how far a token can move in one batch is proportional to where it started. A token sampled with probability 0.9 may rise to $0.9 \\times 1.2 = 1.08$: no real limit. A token sampled with probability 0.01 may rise only to $0.012$. Rare tokens, the ones that open new lines of reasoning, can barely grow, while confident tokens grow freely. The fix, **clip-higher**, decouples the two ends of the band and raises the upper one: DAPO uses $\\symeps_{\\text{low}} = 0.2$ and $\\symeps_{\\text{high}} = 0.28$.`);
    p.math({
      label: 'How far one batch can raise a token',
      tex: String.raw`\sympi(o_t) \;\lesssim\; (1+\symeps_{\text{high}})\,\pi_{\text{old}}(o_t)\quad\text{when } \symA > 0`,
      codeTitle: 'headroom.py',
      code: `
        p_old = np.array([0.01, 0.1, 0.5, 0.9])
        p_max = np.minimum(1, p_old * (1 + eps_high))
        room = p_max - p_old
        # eps_high=0.28: [0.0028, 0.028, 0.14, 0.1]
      `,
      terms: [
        [String.raw`\pi_{\text{old}}(o_t)`, 'the probability of the token when it was sampled'],
        [String.raw`(1+\symeps_{\text{high}})`, 'the top of the clip band: past this ratio the objective stops rewarding increases'],
        [String.raw`\lesssim`, '"roughly at most": the clip zeroes the gradient past the bound rather than forbidding the step, so a step can overshoot a little'],
      ],
      explain: 'The headroom is $\\symeps_{\\text{high}} \\times \\pi_{\\text{old}}$: proportional to the starting probability. Raising $\\symeps_{\\text{high}}$ from 0.2 to 0.28 gives every token 40% more room, which matters most for the rare ones because they had almost none.',
    });
    p.figure({
      title: 'Clip-higher: room for rare tokens',
      codeTitle: 'clip_higher.py',
      code: `
        eps_low, eps_high = {{lo:0.2}}, {{hi:0.28}}
        p_old = {{sel:0.01}}          # drag to pick
        up = min(1, p_old * (1 + eps_high)) - p_old
        down = p_old * eps_low
        # can add {{up}}, can remove {{down}}
      `,
      setup: figClipHigher,
      caption: `For a token sampled with probability $p$ (on a log scale, from 0.001 to 1), the teal curve is how much probability one batch can still reward adding when its advantage is positive, $\\symeps_{\\text{high}}\\,p$, and the red curve is how much it can reward removing when the advantage is negative. The dashed slate curve is the old symmetric $\\symeps = 0.2$. Rare tokens sit at the left, where both curves hug zero: a token at 0.01 can gain at most about 0.003 per batch, a token at 0.5 can gain 0.14. **Drag** to pick a token, and raise $\\symeps_{\\text{high}}$ to give the rare ones more room. The curve turns down on the right because no probability can pass 1.`,
    });
    p.prose(`
### DAPO, all together

DAPO (Decoupled Clip and Dynamic sAmpling Policy Optimization; ByteDance Seed and Tsinghua, 2025) packaged four changes and released the full training system. Starting from a 32B base model it reached about 50 points on AIME 2024, beating the R1 paper's RL-from-a-32B-base result with half the training steps.`);
    p.math({
      label: 'The DAPO objective',
      tex: String.raw`\begin{aligned}\mathcal{J}_{\text{DAPO}}(\theta) &= \mathbb{E}\Bigg[\frac{1}{\sum_{i}|\symo_i|}\sum_{i=1}^{G}\sum_{t=1}^{|\symo_i|}\ell_{i,t}\Bigg]\\[2pt] \ell_{i,t} &= \min(\symrho_{i,t}\symA_{i,t},\ c_{i,t}\symA_{i,t})\\[2pt] c_{i,t} &= \operatorname{clip}(\symrho_{i,t},1-\symeps_{\text{low}},1+\symeps_{\text{high}})\\[2pt] 0 &< \#\{i : \symo_i \text{ correct}\} < G\end{aligned}`,
      codeTitle: 'dapo_loss.py',
      code: `
        n = r.sum(1)                 # right per group
        keep = (n > 0) & (n < G)     # has signal
        mu = r.mean(1, keepdims=True)
        sd = r.std(1, keepdims=True)
        A = (r - mu) / (sd + 1e-4)   # (groups, G)
        ratio = np.exp(logp - old_logp)  # (.., T)
        adv = A[..., None]
        c = np.clip(ratio, 1 - eps_low, 1 + eps_high)
        surr = np.minimum(ratio * adv, c * adv)
        m = mask[keep]
        loss = -(surr[keep] * m).sum() / m.sum()
      `,
      terms: [
        [String.raw`\ell_{i,t}`, 'the clipped per-token term, with no KL penalty'],
        [String.raw`\frac{1}{\sum_i |\symo_i|}\sum_i\sum_t`, '**token-level loss**: one average over every token in the batch, so a long output counts in proportion to its length instead of being squeezed into one vote'],
        [String.raw`c_{i,t}`, '**clip-higher**: the clip band is wider above than below ($\\symeps_{\\text{low}} = 0.2$, $\\symeps_{\\text{high}} = 0.28$ in the paper)'],
        [String.raw`0 < \#\{\cdot\} < G`, '**dynamic sampling**: only groups with at least one right and one wrong output enter the batch'],
      ],
      explain: 'There is no KL term: DAPO argues that for long chain-of-thought training the policy should be allowed to move far from its starting point. The advantage still divides by the std. A fourth change, **overlong reward shaping**, handles outputs cut off at the length limit: rather than scoring a truncated but possibly sound answer as plain wrong, it masks truncated samples or adds a penalty that grows smoothly as an output nears the limit.',
    });
    p.table(
      ['Failure', 'Symptom', 'Fix'],
      [
        ['No-signal groups', 'many all-right or all-wrong groups; noisy gradients', 'dynamic sampling (DAPO); filter questions by pass rate'],
        ['Length bias', 'wrong answers grow long', 'drop $1/\\vert o_i \\vert$ (Dr. GRPO) or a token-level mean (DAPO)'],
        ['Difficulty bias', 'too-easy and too-hard questions over-weighted', 'drop the std (Dr. GRPO)'],
        ['Entropy collapse', 'samples in a group look alike; exploration stops', 'clip-higher (DAPO)'],
        ['Reward hacking', 'reward rises, real accuracy does not', 'strict verifiers, hidden tests'],
      ],
      { caption: 'GRPO\'s known failure modes and the 2025 fixes.' },
    );

    // ------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Group advantages (10 minutes, NumPy).** Write \`group_advantages(r)\` for a $(B, G)$ array of rewards. Check that each row sums to zero, that a row of all ones gives all zeros (and no warning), and that for $G = 8$ with $k$ right answers a right answer's advantage is $\\sqrt{(8-k)/k}$. Success: you can say from memory what a lone right answer in a group of 8 earns.

2. **The GRPO loss, checked by finite differences (30 minutes).** Implement \`grpo_loss\` from this chapter for a toy softmax policy over 5 tokens with sequences of length 3, including the mask and the KL estimator. Compute the gradient with respect to the logits analytically and compare it with a finite-difference estimate. Then verify two facts: with \`old_logp == logp\` and $\\symbeta = 0$, the gradient equals the plain policy gradient $\\symA \\nabla \\log \\sympi$ averaged per token; and a token whose ratio is past $1 + \\symeps$ with $\\symA > 0$ contributes nothing.

3. **Break a verifier (1 hour).** Write \`reward(text, answer)\` for GSM8K-style problems. Then play the policy: write ten outputs that a lenient version rewards without deserving it (hedges, sprays, answers hidden in the reasoning, unicode digits). Harden the checker until all ten fail while real answers in different forms (\`722\`, \`722.0\`, \`$722$\`) still pass. Success: an adversarial test file you would run before every training job.

4. **Reproduce the toy run (an afternoon).** Rebuild this chapter's addition world in Python with a tabular policy. Train with GRPO and plot accuracy, mean length, length of right versus wrong answers, entropy, and the fraction of no-signal groups. Then add Dr. GRPO's normalization, DAPO's dynamic sampling and clip-higher one at a time, each over several seeds. Success: a plot per change and a sentence on which effects are real in this world and which are within the noise.

5. **GRPO on a real model (a weekend project).** Fine-tune a small instruct model (around 0.5B parameters) on grade-school math with a rule-based reward, using TRL's \`GRPOTrainer\` or your own loop built on the loss above. Log reward, held-out accuracy, response length and the share of no-signal groups. Success: held-out accuracy rises above the starting model's, and you can explain each bump in the length curve by reading samples.`);
    p.callout('idea', `RLVR swaps a learned reward model for a program that checks answers, which makes the reward far harder to hack, as long as the checker is strict and complete. GRPO is PPO without the critic: sample $G$ answers per question, use the group's mean reward as the baseline, broadcast each output's normalized advantage to all its tokens, clip the ratio, and add a KL penalty to the loss. That saves a policy-sized model in memory. R1-Zero showed that this alone, from a strong base model, grows long chains of thought and self-checking; R1 added a cold start and more stages for readability and breadth, and distillation handed the result to small models. Watch for no-signal groups, the length and difficulty biases of GRPO's normalizations, and entropy collapse; Dr. GRPO and DAPO fix them.`, 'Takeaways');
  },
};

export default chapter;
