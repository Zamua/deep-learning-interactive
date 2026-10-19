import { fmt } from '../../core/code';
import type { Scene, SceneDef } from '../../lecture/scene';
import { frob, lowRank, noise, svd, updateLike } from '../../lib/finetuning-linalg';
import { type K, box, chip, chipH, current, flowLayout, frame, heat, path, wsub } from './kit';
import { SFT_STEPS, TOY_PROMPTS, gensAt, toy } from './toy';

// ---------------------------------------------------------------- toy and forgetting

/** Prompt rows: a label column, then chips; returns the y after the last row. */
function rows(s: Scene, items: { label: string; words: string[]; k?: (w: string) => K; dim?: boolean; on?: number }[], x: number, y: number, w: number, size: number): number {
  const { u } = s;
  const lw = s.measure('no replay →', { font: 'ui', size: 3.1, weight: 600 }) + u * 2.5;
  for (const it of items) {
    s.text(it.label, x, y + chipH(s, size) / 2, { font: 'ui', size: 3.1, weight: 600, align: 'left', color: s.c('--ink-3') });
    const L = flowLayout(s, it.words, x + lw, y, w - lw, size);
    it.words.forEach((wd, i) => {
      const p = L.pos[i]!;
      const sp = wd.startsWith('<');
      s.alpha(it.dim ? 0.6 : 1, () => chip(s, p.x, p.y, wd, it.k?.(wd) ?? (sp ? 'purple' : '--ink-3'), { size, sp, on: it.on ?? 0 }));
    });
    y += L.height + u * 2.2;
  }
  return y;
}

const ansK = (wd: string): K => (wd === '<end>' ? 'green' : wd.startsWith('<') ? 'purple' : '--ink-2');

/** The loss chart shared by the two toy scenes. */
function lossChart(s: Scene, y: number, hh: number, o: { plainUpto: number; replayUpto?: number; focus?: 'web' | null }) {
  const { w, u } = s;
  const x = u * 5;
  const cw = w - u * 10;
  const T = toy();
  const { X, Y } = frame(s, x, y, cw, hh, SFT_STEPS, 0, 3.3, { grid: [1, 2, 3], labels: ['1', '2', '3'], xs: [100, 200, 300] });
  const pts = (j: 1 | 2, run: typeof T.plain) => run.curve.map((q) => [q[0], q[j]] as [number, number]);
  const webW = o.focus === 'web' ? 1 : 0.6;
  const dim = o.replayUpto !== undefined ? 0.45 : 1;
  path(s, pts(1, T.plain), X, Y, s.tint('red', dim), 0.6, o.plainUpto);
  path(s, pts(2, T.plain), X, Y, s.tint('purple', dim), webW, o.plainUpto);
  if (o.replayUpto !== undefined) {
    path(s, pts(1, T.replay), X, Y, s.c('red'), 0.6, o.replayUpto);
    path(s, pts(2, T.replay), X, Y, s.c('purple'), 1, o.replayUpto);
  }
  s.text('loss on demonstrations', x + cw - u * 2, y + u * 3.6, { font: 'ui', size: 3, weight: 650, align: 'right', color: s.c('red') });
  s.text('loss on held-out web text', x + cw - u * 2, y + u * 7.6, { font: 'ui', size: 3, weight: 650, align: 'right', color: s.c('purple') });
  if (o.replayUpto !== undefined) s.text('faint: no replay   bright: replay', x + cw - u * 2, y + u * 11.6, { font: 'ui', size: 2.9, align: 'right', color: s.c('--ink-3') });
}

const PAGES = [
  'facts : the capital of japan is tokyo . the capital of peru is lima .',
  'quiz : what is the capital of italy ? what is the capital of kenya ? what is',
  'q : what is the capital of spain ? a : madrid .',
];

const toyScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const size = s.tall ? 3 : 3.1;
    const T = toy();
    // The setup: the model and its web.
    s.alpha(s.win('setup', 'base'), () => {
      const bw = Math.min(w - u * 12, u * 110);
      const x0 = (w - bw) / 2;
      box(s, x0, h * 0.06, bw, u * 14, 'blue', { fill: 0.1 });
      s.text('a tiny language model', w / 2, h * 0.06 + u * 5, { size: 4.2, font: 'display', weight: 600, color: s.c('blue') });
      s.text('3,807 weights · reads the last 4 tokens · 40 words', w / 2, h * 0.06 + u * 10.5, { size: 3.2, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('web', 0.6), () => {
        s.text('600 made-up web pages, like these', x0, h * 0.06 + u * 21, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('--ink-3') });
        let y = h * 0.06 + u * 25;
        PAGES.forEach((pg, i) => {
          s.alpha(s.ease('web', 0.5, 0.6 + i * 0.8), () => {
            const L = flowLayout(s, pg.split(' '), x0 + u * 2, y + u * 2, bw - u * 4, 2.8);
            box(s, x0, y, bw, L.height + u * 4, '--ink-3', { fill: 0.03 });
            pg.split(' ').forEach((wd, j) => {
              const p = L.pos[j]!;
              chip(s, p.x, p.y, wd, '--ink-3', { size: 2.8, fill: 0.04 });
            });
            y += L.height + u * 7;
          });
        });
      });
    });
    const mA = s.ease('base', 0.6);
    if (mA <= 0) return;
    s.alpha(mA, () => {
      const stepNow = Math.round(SFT_STEPS * s.span('curve', 'answers'));
      const gens = gensAt(T.plain, stepNow);
      const pt = T.plain.curve[Math.min(T.plain.curve.length - 1, Math.round(stepNow / 4))]!;
      s.slot('step', stepNow);
      s.slot('dl', fmt(pt[1], 3));
      const x0 = u * 5;
      const cw = w - u * 10;
      const items: Parameters<typeof rows>[1] = [];
      const showChat = s.since('chat') >= 0;
      const P = [0, 1];
      for (const pi of P) {
        if (pi === 1 && !showChat) continue;
        items.push({ label: pi === 0 ? 'prompt' : 'prompt', words: TOY_PROMPTS[pi]!.split(' '), dim: true });
        items.push({ label: 'base →', words: T.base[pi]!, k: () => '--ink-3' });
        if (s.since('demos') >= 0 && stepNow > 0) items.push({ label: `step ${stepNow} →`, words: gens[pi]!, k: ansK, on: pi === 1 && s.since('knew') >= 0 ? 0.5 : 0.2 });
      }
      const yEnd = rows(s, items, x0, u * 4, cw, size);
      // a demonstration
      s.alpha(s.win('demos', 'curve'), () => {
        const demo = '<user> where is egypt ? <bot> egypt is in africa . <end>'.split(' ');
        const L = flowLayout(s, demo, x0, yEnd + u * 6, cw, size);
        s.text('one of 16 demonstrations (loss on the gold tokens)', x0, yEnd + u * 3, { font: 'ui', size: 3, align: 'left', color: s.c('gold') });
        demo.forEach((wd, i) => {
          const p = L.pos[i]!;
          chip(s, p.x, p.y, wd, i >= 6 ? 'gold' : wd.startsWith('<') ? 'purple' : '--ink-3', { size, sp: wd.startsWith('<'), on: i >= 6 ? 0.6 : 0 });
        });
      });
      const cA = s.ease('curve', 0.6);
      if (cA > 0) {
        const cy = Math.max(yEnd + u * 4, h * 0.55);
        s.alpha(cA, () => lossChart(s, cy, h - cy - u * 4, { plainUpto: stepNow }));
      }
    });
  },
};

const forget: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const size = s.tall ? 3 : 3.1;
    const T = toy();
    const cur = current(s, ['purple', 'broken', 'name', 'why', 'shared', 'gentle', 'replay', 'flat', 'others']);
    const x0 = u * 5;
    const cw = w - u * 10;
    const replayUpto = s.since('replay') >= 0 ? Math.round(SFT_STEPS * s.span('replay', 'flat')) : undefined;
    const top = u * 4;
    const panelH = h * 0.5 - top;
    // Top panel: forgetting in the completions, then the explanation, then replay.
    const pA = s.win('purple', 'name');
    s.alpha(pA, () => {
      rows(s, [
        { label: 'prompt', words: TOY_PROMPTS[0]!.split(' '), dim: true },
        { label: 'base →', words: T.base[0]!, k: () => '--ink-3' },
        { label: 'step 400 →', words: gensAt(T.plain, 400)[0]!, k: (wd) => (wd === '<end>' ? 'red' : '--ink-2'), on: s.ease('broken', 0.6) },
      ], x0, top, cw, size);
      s.alpha(s.ease('broken', 0.6), () => s.text('the bare question is broken', w / 2, top + panelH - u * 4, { size: 3.6, italic: true, color: s.c('red') }));
    });
    s.alpha(s.win('name', 'gentle'), () => {
      s.text('catastrophic forgetting', w / 2, top + panelH * 0.22, { size: 6.4, font: 'display', weight: 600 });
      s.alpha(s.ease('why', 0.6), () => s.text('the loss sees only the new batch', w / 2, top + panelH * 0.52, { size: 4, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('shared', 0.6), () => s.text('and every weight is shared by old and new skills', w / 2, top + panelH * 0.74, { size: 4, italic: true, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('gentle', 0.6), () => {
      const g = current(s, ['gentle', 'replay', 'others']);
      if (g === 'gentle') {
        s.text('remedy 1: be gentle', w / 2, top + panelH * 0.3, { size: 5.4, font: 'display', weight: 600 });
        s.text('a smaller learning rate, fewer passes', w / 2, top + panelH * 0.58, { size: 4, italic: true, color: s.c('--ink-2') });
        return;
      }
      const stepR = replayUpto ?? 0;
      rows(s, [
        { label: 'prompt', words: TOY_PROMPTS[0]!.split(' '), dim: true },
        { label: 'no replay →', words: gensAt(T.plain, 400)[0]!, k: () => '--ink-3', dim: true },
        { label: 'replay →', words: gensAt(T.replay, stepR)[0]!, k: ansK, on: s.ease('flat', 0.6) * 0.6 },
      ], x0, top, cw, size);
      if (g === 'others')
        s.alpha(s.ease('others', 0.6), () => {
          s.text('or: penalize drift from the start · train far fewer weights', w / 2, top + panelH - u * 3, { size: s.tall ? 3.1 : 3.6, italic: true, color: s.c('green') });
        });
      else s.text('remedy 2: replay old data in every batch', w / 2, top + panelH - u * 3, { size: 3.6, italic: true, color: s.c('purple') });
    });
    const cy = h * 0.53;
    lossChart(s, cy, h - cy - u * 4, { plainUpto: SFT_STEPS, replayUpto, focus: cur === 'purple' || cur === 'broken' ? 'web' : null });
  },
};

// ---------------------------------------------------------------- cost

const BYTES: [string, number, K][] = [
  ['weight', 2, 'blue'],
  ['gradient', 2, 'teal'],
  ['fp32 copy', 4, 'slate'],
  ['Adam m, v', 8, 'red'],
];

const cost: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const bw = Math.min(w - u * 12, u * 120);
    const x0 = (w - bw) / 2;
    const cs = bw / 16;
    const y0 = h * 0.14;
    s.text('bytes per parameter, full fine-tuning with Adam', w / 2, y0 - u * 5, { size: 3.6, font: 'ui', weight: 600, color: s.c('--ink-2') });
    let k = 0;
    const lit = [s.ease('wg', 0.5), s.ease('wg', 0.5, 1.2), s.ease('ma', 0.5), s.ease('ma', 0.5, 1.6)];
    BYTES.forEach(([lab, n, col], gi) => {
      const a = lit[gi]!;
      for (let i = 0; i < n; i++, k++) s.rrect(x0 + k * cs + u * 0.2, y0, cs - u * 0.4, cs * 1.2, 0.6, { fill: s.tint(col, 0.08 + 0.5 * a), stroke: s.tint(col, 0.3 + 0.6 * a), lw: 0.25 });
      s.alpha(a, () => {
        const cx = x0 + (k - n / 2) * cs;
        s.text(String(n), cx, y0 + cs * 0.62, { font: 'mono', size: 3.6, weight: 650 });
        s.text(lab, cx, y0 + cs * 1.2 + u * 4, { font: 'ui', size: s.tall ? 2.8 : 3.2, color: s.c(col) });
      });
    });
    s.alpha(s.ease('bytes', 0.6), () => s.text('= 16 bytes', x0 + bw, y0 + cs * 1.2 + u * 10, { font: 'mono', size: 4, weight: 650, align: 'right' }));
    // 7B in gigabytes, against one GPU.
    s.alpha(s.win('total', 'peft'), () => {
      const y = h * 0.46;
      const max = 120;
      const X = (gb: number) => x0 + (bw * gb) / max;
      s.text('Llama 2 7B, full fine-tuning', x0, y - u * 4, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c('--ink-2') });
      const p = s.ease('total', 1.2, 0.4);
      s.rrect(x0, y, X(107.8 * p) - x0, u * 8, 1, { fill: s.tint('red', 0.5), stroke: s.c('red'), lw: 0.3 });
      s.text(`${Math.round(107.8 * p)} GB`, X(107.8 * p) + u * 2, y + u * 4.2, { font: 'mono', size: 3.6, weight: 650, align: 'left' });
      s.line(X(80), y - u * 2, X(80), y + u * 11, s.c('--ink-2'), 0.35, [1, 0.8]);
      s.text('one 80 GB GPU', X(80), y + u * 14, { font: 'ui', size: 3.2, color: s.c('--ink-2') });
    });
    // A full copy per task.
    s.alpha(s.win('copy', 'peft'), () => {
      const y = h * 0.72;
      const tasks = ['support', 'legal', 'code', 'medical', 'tutor'];
      const n = Math.min(tasks.length, Math.floor(s.since('copy') * 1.5) + 1);
      const tw = Math.min((bw - u * 4 * 4) / 5, u * 22);
      tasks.slice(0, n).forEach((t, i) => {
        const x = x0 + i * (tw + u * 4);
        box(s, x, y, tw, u * 13, 'blue', { fill: 0.14 });
        s.text(t, x + tw / 2, y + u * 4.5, { font: 'ui', size: 3, weight: 600, color: s.c('blue') });
        s.text('13.5 GB', x + tw / 2, y + u * 9.5, { font: 'mono', size: 2.8, color: s.c('--ink-2') });
      });
      s.text('a whole copy of the model per task', w / 2, y + u * 20, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('peft', 0.6), () => {
      s.text('parameter-efficient fine-tuning', w / 2, h * 0.56, { size: 5.4, font: 'display', weight: 600 });
      s.text('freeze the pretrained weights, train something small', w / 2, h * 0.66, { size: 4, italic: true, color: s.c('--ink-2') });
      s.text('the winner: LoRA', w / 2, h * 0.76, { size: 4.4, font: 'display', weight: 600, color: s.c('green') });
    });
  },
};

// ---------------------------------------------------------------- rank

const UPD = updateLike();
const UPD_SVD = svd(UPD);
const NOI = noise();
const NOI_SVD = svd(NOI);
const ERR = (M: typeof UPD, d: typeof UPD_SVD, r: number) => frob(lowRank(d, M.n, M.m, r).map((v, i) => v - M.a[i]!)) / frob(M.a);
const UPD_SC = 0.6 * Math.max(...Array.from(UPD.a, Math.abs));
const NOI_SC = 0.7 * Math.max(...Array.from(NOI.a, Math.abs));

const rank: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['idea', 'simple', 'r1', 'rankr', 'cost', 'svd', 'best', 'grow', 'small', 'noise', 'evidence']) ?? 'idea';
    const N = UPD.n;
    // W0 + dW = W
    s.alpha(s.win('idea', 'r1'), () => {
      const S = Math.min((w - u * 30) / 3, h * 0.42);
      const y = h * 0.42 - S / 2;
      const x0 = (w - 3 * S - u * 20) / 2;
      const big = s.ease('simple', 0.8);
      s.rrect(x0, y, S, S, 1, { fill: s.tint('blue', 0.25), stroke: s.c('blue'), lw: 0.4 });
      wsub(s, x0 + S / 2, y + S / 2, 7, s.c('blue'));
      s.text('+', x0 + S + u * 5, y + S / 2, { size: 6, color: s.c('--ink-2') });
      heat(s, UPD.a, N, N, x0 + S + u * 10, y, S, UPD_SC);
      s.text('ΔW', x0 + S * 1.5 + u * 10, y - u * 4, { size: 5, italic: true, weight: 600, color: s.c('teal') });
      s.text('=', x0 + 2 * S + u * 15, y + S / 2, { size: 6, color: s.c('--ink-2') });
      s.rrect(x0 + 2 * S + u * 20, y, S, S, 1, { fill: s.tint('blue', 0.18), stroke: s.tint('blue', 0.7), lw: 0.4 });
      s.text('W', x0 + 2.5 * S + u * 20, y + S / 2, { size: 7, italic: true, weight: 600, color: s.c('--ink') });
      s.alpha(big, () => {
        s.text(`${N} × ${N} = ${N * N} numbers, learned freely`, w / 2, y + S + u * 9, { size: 3.8, font: 'ui', color: s.c('--ink-2') });
        s.text('…but made of only a few directions?', w / 2, y + S + u * 16, { size: 3.8, italic: true, color: s.c('teal') });
      });
    });
    // Rank 1: a column times a row.
    s.alpha(s.win('r1', 'rankr'), () => {
      const S = Math.min(w * 0.42, h * 0.5);
      const t = Math.max(u * 3, S / N * 2.2);
      const x = w / 2 - S / 2 + t;
      const y = h * 0.16 + t;
      const sv = UPD_SVD.s[0]!;
      const uu = Array.from({ length: N }, (_, i) => UPD_SVD.U[i * UPD_SVD.k]!);
      const vv = Array.from({ length: N }, (_, j) => UPD_SVD.Vt[j]!);
      heat(s, uu, N, 1, x - t - u * 2, y, t, 0.25, { height: S });
      heat(s, vv, 1, N, x, y - t - u * 2, S, 0.25, { height: t });
      const R1 = new Float64Array(N * N);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) R1[i * N + j] = sv * uu[i]! * vv[j]!;
      heat(s, R1, N, N, x, y, S, UPD_SC);
      s.text('u', x - t / 2 - u * 2, y + S + u * 4, { size: 4.4, italic: true, weight: 600 });
      s.text('vᵀ', x + S + u * 4, y - t / 2 - u * 2, { size: 4.4, italic: true, weight: 600 });
      s.text('rank 1: every row is a multiple of one row', w / 2, y + S + u * 11, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // B times A.
    s.alpha(s.win('rankr', 'svd'), () => {
      const r = 4;
      const S = Math.min(w * 0.38, h * 0.42);
      const cell = S / N;
      const tB = cell * r * 2.2;
      const y = h * 0.12 + tB + u * 3;
      const total = tB + u * 4 + S + u * 10 + S;
      const x0 = (w - total) / 2;
      s.rrect(x0, y, tB, S, 0.6, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.4 });
      s.text('B', x0 + tB / 2, y + S + u * 4.5, { size: 4.6, italic: true, weight: 600, color: s.c('green') });
      s.text('d × r', x0 + tB / 2, y + S + u * 9.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
      const ax = x0 + tB + u * 4;
      s.rrect(ax, y - tB - u * 3, S, tB, 0.6, { fill: s.tint('orange', 0.4), stroke: s.c('orange'), lw: 0.4 });
      s.text('A', ax + S / 2, y - tB / 2 - u * 3, { size: 4.6, italic: true, weight: 600, color: s.c('orange') });
      s.text('r × k', ax + S + u * 5, y - tB / 2 - u * 3, { size: 3, font: 'mono', color: s.c('--ink-3') });
      heat(s, lowRank(UPD_SVD, N, N, r), N, N, ax, y, S, UPD_SC);
      s.text('B A, rank r', ax + S / 2, y + S + u * 4.5, { size: 3.8, font: 'ui', weight: 600, color: s.c('teal') });
      s.alpha(s.ease('cost', 0.6), () => {
        const yy = y + S + u * 13;
        s.text('r (d + k)  numbers, not  d k', w / 2, yy, { size: 4.2, font: 'mono', weight: 650 });
        s.text('d = k = 4096, r = 8:  65,536  vs  16,777,216', w / 2, yy + u * 7, { size: s.tall ? 3 : 3.6, font: 'mono', color: s.c('--ink-2') });
      });
    });
    // SVD: the original, the truncation, and the spectrum.
    const dA = s.ease('svd', 0.6);
    if (dA > 0)
      s.alpha(dA, () => {
        const isNoise = cur === 'noise';
        const M = isNoise ? NOI : UPD;
        const d = isNoise ? NOI_SVD : UPD_SVD;
        const sc = isNoise ? NOI_SC : UPD_SC;
        let r = 1;
        if (cur === 'grow') r = 1 + Math.floor(7 * s.prog('grow'));
        if (cur === 'small' || cur === 'noise' || cur === 'evidence') r = 5;
        if (cur === 'grow' && s.prog('grow') >= 1) r = 8;
        const gap = u * 6;
        const S = Math.min((w - gap - u * 10) / 2, h * 0.44);
        const x0 = (w - 2 * S - gap) / 2;
        const y0 = h * 0.08;
        heat(s, M.a, M.n, M.m, x0, y0 + u * 3, S, sc);
        heat(s, lowRank(d, M.n, M.m, r), M.n, M.m, x0 + S + gap, y0 + u * 3, S, sc);
        s.text(isNoise ? 'random noise' : 'update-like M', x0 + S / 2, y0, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') });
        s.text(`rank ${r}: B A`, x0 + S * 1.5 + gap, y0, { size: 3.4, font: 'ui', weight: 600, color: s.c('green') });
        const err = ERR(M, d, r);
        s.text(`error ${(100 * err).toFixed(1)}%`, x0 + S * 1.5 + gap, y0 + S + u * 8, { size: 4, font: 'mono', weight: 650, color: s.c(err < 0.1 ? 'green' : 'red') });
        s.slot('r', r);
        s.slot('err', fmt(err, 3));
        // spectrum
        const sy = y0 + S + u * 14;
        const sh = h - sy - u * 6;
        const bw = (w - u * 12) / d.k;
        const smax = d.s[0]!;
        const ly = (v: number) => sy + sh * (Math.log10(Math.max(v / smax, 1e-3)) / -3);
        for (let i = 0; i < d.k; i++) {
          const yy = ly(d.s[i]!);
          s.ctx.fillStyle = i < r ? s.c('green') : s.tint('--ink-3', 0.45);
          s.ctx.fillRect(u * 6 + i * bw + bw * 0.12, yy, Math.max(1, bw * 0.76), sy + sh - yy);
        }
        s.text('singular values, strongest first (log scale)', u * 6, sy - u * 2.5, { font: 'ui', size: 3, align: 'left', color: s.c('--ink-3') });
        s.alpha(s.ease('best', 0.6) * (cur === 'best' ? 1 : 0), () => s.text('best possible: Eckart and Young, 1936', w / 2, sy + sh + u * 3.5, { size: 3.2, italic: true, color: s.c('--ink-2') }));
      });
  },
};

export const scenesB: Record<string, SceneDef> = { toy: toyScene, forget, cost, rank };
