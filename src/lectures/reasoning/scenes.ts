import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { MARKERS } from '../../lib/reasoning-math';
import {
  BALL_AT,
  BEAM,
  BENCH_CEIL,
  BENCH_HIST,
  BENCH_MEAN,
  BENCH_X,
  BENCH_Y,
  BON0_Y,
  BON_NS,
  BON_PROXY,
  BON_X,
  BON_Y,
  BUDGET_T,
  COV1_X,
  COV1_Y,
  CUPS_COT,
  CUPS_NO,
  DRAW16,
  DRAW256,
  EASY,
  EASY_BRK,
  HARD,
  HARD_BRK,
  JITTER,
  NEVER,
  PASS_Y,
  SOMETIMES,
  SWAPS,
  VOTE_BAD,
  VOTE_COMMON,
  VOTE_GOOD,
  VOTE_N,
  VOTE_SCATTER,
  WORK_CANCEL,
  WORK_CLEAN,
  WORK_SLIP,
} from './data';
import { Frame, type K, badge, card, chip, fit, fitText, pill } from './kit';

/** Vertical layout in u, centered on stages taller than 100u. */
function rows(s: Scene): (v: number) => number {
  const oy = Math.max(0, (s.h - 100 * s.u) / 2);
  return (v) => oy + v * s.u;
}

const VX = VOTE_N.map((n) => Math.log2(n));
const pct = (v: number): string => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------- intro

const ROAD = ['depth per token', 'CoT prompting', 'voting', 'pass@k', 'best-of-n', 'grading steps', 'search versus size', 'reasoning models', 'thinking budgets', 'distillation'];

function fan(s: Scene, x: number, y: number, len: number, a: number): void {
  const ok = [true, false, true, true, false];
  ok.forEach((g, i) => {
    const ty = y + (i - 2) * len * 0.22;
    s.line(x, y, x + len, ty, s.tint('purple', 0.55), 0.35);
    s.circle(x + len, ty, s.u * 1.3, { fill: s.tint(g ? 'green' : 'red', 0.9 * a + 0.1) });
  });
  s.circle(x, y, s.u * 1.5, { fill: s.c('orange') });
}

function tree(s: Scene, x: number, y: number, len: number): void {
  const lv = [[0], [-1, 1], [-1.5, -0.5, 0.5, 1.5]];
  const pt = (l: number, i: number): [number, number] => [x + l * len * 0.45, y + lv[l]![i]! * len * 0.2];
  for (let l = 1; l < 3; l++) lv[l]!.forEach((_, i) => {
    const [x0, y0] = pt(l - 1, l === 1 ? 0 : Math.floor(i / 2));
    const [x1, y1] = pt(l, i);
    const dead = l === 2 && i < 2;
    s.line(x0, y0, x1, y1, s.tint(dead ? '--ink-3' : 'teal', dead ? 0.4 : 0.8), 0.35);
  });
  lv.forEach((row, l) => row.forEach((_, i) => {
    const [px, py] = pt(l, i);
    const dead = l === 2 && i < 2;
    s.circle(px, py, s.u * 1.4, { fill: dead ? s.tint('--ink-3', 0.5) : s.c('teal') });
  }));
}

const intro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    s.alpha(s.win('hello', 'before'), () => {
      const sz = fit(s, 'test-time compute', w - 14 * u, 9.5, { font: 'display', weight: 600 });
      s.text('Reasoning and', w / 2, Y(34), { size: sz, font: 'display', weight: 600 });
      s.text('test-time compute', w / 2, Y(34) + sz * 1.25 * u, { size: sz, font: 'display', weight: 600, color: s.c('purple') });
      fitText(s, 'spending compute while the model answers', w / 2, Y(72), w - 12 * u, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('before', 'long'), () => {
      const lw = 30 * u;
      const bx = 6 * u + lw;
      const bw = w - bx - 8 * u;
      s.text('training', bx - 3 * u, Y(32), { font: 'ui', size: 4.4, weight: 650, align: 'right', color: s.c('blue') });
      s.rrect(bx, Y(27), bw * s.ease('before', 1.2), 10 * u, 1.5, { fill: s.tint('blue', 0.55) });
      s.text('answering', bx - 3 * u, Y(56), { font: 'ui', size: 4.4, weight: 650, align: 'right', color: s.c('teal') });
      const grow = lerp(0.05, 0.6, s.ease('more', 1.4));
      s.rrect(bx, Y(51), bw * grow * s.ease('before', 0.8, 1), 10 * u, 1.5, { fill: s.tint('teal', 0.55) });
      s.alpha(s.win('before', 'more') * s.ease('before', 0.6, 2.5), () => {
        for (let i = 0; i < 6; i++) chip(s, bx + i * 7 * u, Y(64), 6 * u, 6 * u, '', 'purple', { on: 0.3 });
        s.text('one token at a time', bx, Y(76), { font: 'ui', size: 3.8, align: 'left', italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('more', 0.6, 0.8), () => fitText(s, 'more compute for each question', bx + bw * 0.3, Y(70), bw, { font: 'ui', size: 4, italic: true, color: s.c('teal') }));
    });
    const cA = s.win('long', 'models');
    if (cA > 0)
      s.alpha(cA, () => {
        const gap = 3 * u;
        const cw = (w - 12 * u - 2 * gap) / 3;
        const ch = 54 * u;
        const y0 = Y(20);
        const items: [string, string, string, K][] = [
          ['long', 'longer', 'steps first', 'purple'],
          ['wide', 'wider', 'vote or verify', 'green'],
          ['smart', 'smarter', 'graded search', 'teal'],
        ];
        items.forEach(([beat, title, sub, k], i) => {
          const a = s.ease(beat, 0.6);
          if (a <= 0) return;
          const x = 6 * u + i * (cw + gap);
          const on = s.win(beat, i < 2 ? items[i + 1]![0] : 'models');
          s.alpha(a, () => {
            s.rrect(x, y0, cw, ch, 2.5, { fill: s.tint(k, 0.06 + 0.1 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.2 * on });
            fitText(s, title, x + cw / 2, y0 + 8 * u, cw - 4 * u, { font: 'display', size: 6, weight: 600, color: s.c(k) });
            const gx = x + cw * 0.16;
            const gy = y0 + 26 * u;
            const gw = cw * 0.68;
            if (i === 0) {
              const n = 5;
              const cwi = gw / (n + 1.6);
              for (let j = 0; j < n; j++) s.alpha(clamp01(s.since('long') * 2 - j * 0.4), () => chip(s, gx + j * cwi, gy - 3 * u, cwi - 0.6 * u, 6 * u, '', 'purple', { on: 0.4 }));
              s.alpha(clamp01(s.since('long') * 2 - 2.4), () => chip(s, gx + n * cwi, gy - 3 * u, cwi * 1.6, 6 * u, 'a', 'green', { on: 0.7 }));
            } else if (i === 1) fan(s, gx, gy, gw, s.ease('wide', 0.6, 1));
            else tree(s, gx, gy, gw);
            fitText(s, sub, x + cw / 2, y0 + ch - 9 * u, cw - 4 * u, { font: 'ui', size: 3.8, color: s.c('--ink-2') });
          });
        });
      });
    const rA = s.ease('models', 0.6);
    if (rA > 0)
      s.alpha(rA, () => {
        const gap = 3 * u;
        const tw = (w - 12 * u - gap) / 2;
        const th = 12 * u;
        const y0 = Y(14);
        const lit = s.prog('models') * 11;
        ROAD.forEach((name, i) => {
          const col = Math.floor(i / 5);
          const row = i % 5;
          const x = 6 * u + col * (tw + gap);
          const y = y0 + row * (th + 3 * u);
          const on = i < lit ? 1 : 0;
          s.rrect(x, y, tw, th, 2, { fill: s.tint('purple', 0.05 + 0.13 * on), stroke: s.tint('purple', 0.3 + 0.6 * on), lw: 0.3 });
          s.text(String(i + 1), x + 4.5 * u, y + th / 2, { font: 'mono', size: 4, weight: 700, color: s.c('purple') });
          fitText(s, name, x + 9 * u, y + th / 2, tw - 11 * u, { font: 'ui', size: 4.2, weight: 550, align: 'left' });
        });
      });
  },
};

// ---------------------------------------------------------------- serial

/** The cups and swaps figure in rows: one row per forward pass. */
function passRow(s: Scene, Y: (v: number) => number, r: number, opts: { on: number; lit: number; out: 'none' | 'z' | 'a-bad' | 'a-good'; dim?: number }): { right: number; y: number } {
  const { w, u } = s;
  const inW = 10 * u;
  const outW = 17 * u;
  const ar = 4 * u;
  const cellW = Math.min(18 * u, (w - 16 * u - inW - outW - 2 * ar) / 3);
  const total = inW + ar + 3 * cellW + ar + outW;
  const x0 = (w - total) / 2;
  const y = Y(24 + r * 16);
  const h = 10 * u;
  const ps = CUPS_COT.passes[r]!;
  s.alpha(opts.on * (opts.dim ?? 1), () => {
    if (r === 0) {
      chip(s, x0, y, inW, h, '', 'orange', { on: 0.5 });
      s.text('x', x0 + inW / 2, y + h / 2, { size: 5.2, italic: true, weight: 650, color: s.c('orange') });
    } else chip(s, x0, y, inW, h, String(CUPS_COT.passes[r - 1]!.ball), 'purple', { on: 0.6, size: 4.4, ink: s.c('purple') });
    s.arrow(x0 + inW + 0.5 * u, y + h / 2, x0 + inW + ar - 0.5 * u, y + h / 2, s.c('--ink-3'), 0.3, 1.6);
    const gx = x0 + inW + ar;
    for (let l = 0; l < 3; l++) {
      const k = ps.from + l;
      const used = k < ps.to;
      const on = used && l < opts.lit ? 1 : 0;
      chip(s, gx + l * cellW + 0.5 * u, y, cellW - u, h, used ? `${SWAPS[k]![0]}↔${SWAPS[k]![1]}` : 'idle', used ? 'blue' : '--ink-3', { on: 0.15 + 0.85 * on, size: 3.8, ink: used ? s.c('--ink') : s.c('--ink-3') });
    }
    const ox = gx + 3 * cellW + ar;
    s.arrow(gx + 3 * cellW, y + h / 2, ox - 0.5 * u, y + h / 2, s.c('--ink-3'), 0.3, 1.6);
    if (opts.out === 'z') chip(s, ox, y, outW, h, `z: ${ps.ball}`, 'purple', { on: 0.7, size: 4.2, ink: s.c('purple') });
    else if (opts.out === 'a-good') chip(s, ox, y, outW, h, `a = ${ps.ball}`, 'green', { on: 0.8, size: 4.2, ink: s.c('green') });
    else if (opts.out === 'a-bad') chip(s, ox, y, outW, h, `a = ${CUPS_NO.answer}`, 'red', { on: 0.8, size: 4.2, ink: s.c('red') });
  });
  return { right: x0 + total, y };
}

function feedback(s: Scene, Y: (v: number) => number, r: number, a: number): void {
  const { w, u } = s;
  const inW = 10 * u;
  const outW = 17 * u;
  const ar = 4 * u;
  const cellW = Math.min(18 * u, (w - 16 * u - inW - outW - 2 * ar) / 3);
  const total = inW + ar + 3 * cellW + ar + outW;
  const x0 = (w - total) / 2;
  const y = Y(24 + r * 16) + 10 * u;
  const midY = y + 3 * u;
  s.alpha(a, () => {
    const c = s.ctx;
    c.setLineDash([u * 0.8, u * 0.6]);
    c.strokeStyle = s.tint('purple', 0.8);
    c.lineWidth = 0.35 * u;
    c.beginPath();
    c.moveTo(x0 + total - outW / 2, y);
    c.lineTo(x0 + total - outW / 2, midY);
    c.lineTo(x0 + inW / 2, midY);
    c.stroke();
    c.setLineDash([]);
    s.arrow(x0 + inW / 2, midY, x0 + inW / 2, y + 6 * u, s.tint('purple', 0.8), 0.35, 1.5);
  });
}

const serial: SceneDef = {
  marks: {
    steps: { tex: String.raw`\text{serial steps} \approx \symL \cdot (\symT + 1)`, x: 0.5, y: 0.84, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const Y = rows(s);
    s.alpha(s.win('puzzle', 'fixed'), () => {
      fitText(s, 'Why would writing steps', w / 2, Y(40), w - 12 * u, { font: 'display', size: 7, weight: 600 });
      fitText(s, 'help a network at all?', w / 2, Y(52), w - 12 * u, { font: 'display', size: 7, weight: 600, color: s.c('purple') });
    });
    // one pass through a fixed stack of layers
    const nA = s.win('fixed', 'cups');
    if (nA > 0)
      s.alpha(nA, () => {
        const bw = 44 * u;
        const bx = w / 2 - bw / 2;
        const ys = [62, 48, 34];
        chip(s, w / 2 - 6 * u, Y(78), 12 * u, 9 * u, '', 'orange', { on: 0.5 });
        s.text('x', w / 2, Y(82.5), { size: 5.2, italic: true, weight: 650, color: s.c('orange') });
        ys.forEach((yy, i) => {
          s.alpha(s.ease('fixed', 0.5, 0.4 + i * 0.4), () => {
            s.rrect(bx, Y(yy), bw, 10 * u, 1.5, { fill: s.tint('blue', 0.14), stroke: s.tint('blue', 0.7), lw: 0.3 });
            s.text(`layer ${i + 1}`, w / 2, Y(yy + 5), { font: 'ui', size: 4, color: s.c('blue') });
          });
          s.arrow(w / 2, Y(yy + 15) - u * 0.5, w / 2, Y(yy + 10) + u * 0.5, s.c('--ink-3'), 0.35, 1.8);
        });
        s.arrow(w / 2, Y(34), w / 2, Y(25), s.c('--ink-3'), 0.35, 1.8);
        s.alpha(s.ease('fixed', 0.5, 2), () => chip(s, w / 2 - 12 * u, Y(15), 24 * u, 9 * u, 'next token', 'purple', { on: 0.5, font: 'ui', size: 3.8, ink: s.c('purple') }));
        s.alpha(s.ease('fixed', 0.5, 1.5), () => {
          s.line(bx - 4 * u, Y(34), bx - 4 * u, Y(72), s.c('blue'), 0.35);
          s.text('L', bx - 7.5 * u, Y(53), { size: 5.5, italic: true, weight: 650, color: s.c('blue') });
        });
        s.alpha(s.ease('chain', 0.6), () => {
          s.line(w / 2 + bw / 2 + 4 * u, Y(76), w / 2 + bw / 2 + 4 * u, Y(18), s.c('teal'), 0.6);
          s.arrow(w / 2 + bw / 2 + 4 * u, Y(24), w / 2 + bw / 2 + 4 * u, Y(17), s.c('teal'), 0.6, 2);
          fitText(s, 'at most L dependent steps per pass', w / 2, Y(94), w - 10 * u, { font: 'ui', size: 4, color: s.c('teal') });
        });
      });
    // the swaps, colored by what has been applied
    const chipsA = s.ease('cups', 0.6);
    if (chipsA > 0)
      s.alpha(chipsA, () => {
        const cw = Math.min(13 * u, (w - 12 * u) / 8);
        const cx0 = (w - 8 * cw) / 2;
        const inCups = s.since('cartoon') < 0;
        const step = inCups && s.since('serial') >= 0 ? Math.min(7, Math.floor(s.prog('serial') * 8)) : -1;
        const failA = s.win('fail', 'write');
        const rowsShown = s.since('three') >= 0 ? 3 : s.since('readback') >= 0 ? 2 : s.since('cartoon') >= 0 ? 1 : 0;
        SWAPS.forEach((sw, k) => {
          const x = cx0 + k * cw;
          const applied = !inCups && Math.floor(k / 3) < rowsShown && (s.since('write') >= 0 || k < 3);
          const struck = failA > 0 && k >= 3;
          const on = k === step ? 1 : applied ? 0.75 : 0.2;
          chip(s, x + 0.4 * u, Y(5), cw - 0.8 * u, 8 * u, `${sw[0]}↔${sw[1]}`, struck ? 'red' : 'blue', { on, size: 3.6, ink: struck ? s.c('red') : s.c('--ink') });
          if (struck) s.alpha(failA, () => s.line(x + 1.5 * u, Y(11.5), x + cw - 1.5 * u, Y(6.5), s.c('red'), 0.4));
        });
      });
    // five cups, the ball moving swap by swap
    const cupA = s.win('cups', 'cartoon');
    if (cupA > 0)
      s.alpha(cupA, () => {
        const k = s.since('serial') >= 0 ? Math.min(8, 1 + Math.floor(s.prog('serial') * 8)) : 0;
        const ball = BALL_AT[k]!;
        const cupW = Math.min(17 * u, (w - 20 * u) / 5);
        const x0 = (w - 5 * cupW) / 2;
        for (let c = 0; c < 5; c++) {
          const cx = x0 + c * cupW + cupW / 2;
          if (c === ball) s.circle(cx, Y(56), 2.6 * u, { fill: s.c('gold') });
          const ctx = s.ctx;
          ctx.beginPath();
          ctx.moveTo(cx - cupW * 0.3, Y(58));
          ctx.lineTo(cx - cupW * 0.2, Y(36));
          ctx.lineTo(cx + cupW * 0.2, Y(36));
          ctx.lineTo(cx + cupW * 0.3, Y(58));
          ctx.closePath();
          ctx.fillStyle = s.tint('slate', c === ball ? 0.3 : 0.6);
          ctx.fill();
          s.text(String(c), cx, Y(64), { font: 'mono', size: 4, color: s.c('--ink-3') });
        }
        const msg = k === 0 ? 'the ball starts under cup 0' : `after swap ${k}: cup ${ball}`;
        s.text(msg, w / 2, Y(76), { font: 'ui', size: 4.4, color: s.c('--ink-2') });
        s.alpha(s.ease('serial', 0.6, 2), () => fitText(s, 'each swap needs the result of the last', w / 2, Y(88), w - 10 * u, { font: 'ui', size: 4, italic: true, color: s.c('teal') }));
      });
    // forward passes
    const rowA = s.ease('cartoon', 0.6);
    if (rowA > 0) {
      const dim = 1 - 0.45 * s.ease('formula', 0.6);
      const lit0 = s.since('cartoon') < 0 ? 0 : 1 + Math.floor(s.prog('cartoon') * 3.2);
      const cot = s.since('write') >= 0;
      const out0 = s.since('write') >= 0 ? 'z' : s.since('fail') >= 0 ? 'a-bad' : 'none';
      const r0 = passRow(s, Y, 0, { on: rowA, lit: lit0, out: out0, dim });
      if (!cot && s.since('fail') >= 0)
        s.alpha(s.ease('fail', 0.5, 0.6) * (1 - s.ease('write', 0.4)), () => {
          badge(s, Math.min(w - 5 * u, r0.right + 5 * u), r0.y + 5 * u, 3 * u, false);
          fitText(s, `${CUPS_NO.passes[0]!.to - CUPS_NO.passes[0]!.from} of 8 swaps applied; truth: cup ${CUPS_NO.truth}`, w / 2, Y(48), w - 10 * u, { font: 'ui', size: 4.2, color: s.c('red') });
        });
      if (cot) {
        feedback(s, Y, 0, s.ease('readback', 0.6) * dim);
        passRow(s, Y, 1, { on: s.ease('readback', 0.6, 0.6), lit: 3, out: 'z', dim });
        feedback(s, Y, 1, s.ease('three', 0.6) * dim);
        const r2 = passRow(s, Y, 2, { on: s.ease('three', 0.6, 0.5), lit: 3, out: 'a-good', dim });
        s.alpha(s.ease('three', 0.5, 1.4) * dim, () => badge(s, Math.min(w - 5 * u, r2.right + 5 * u), r2.y + 5 * u, 3 * u, true));
        s.alpha(s.win('write', 'readback'), () => fitText(s, 'write where the ball is', w / 2, Y(48), w - 10 * u, { font: 'ui', size: 4.2, color: s.c('purple') }));
      }
    }
    const steps = Y(84) / h;
    s.show('steps', s.ease('formula', 0.6) * (1 - s.ease('cost', 0.5)), { y: steps });
    s.alpha(s.ease('cost', 0.6), () => pill(s, 'one full forward pass per token', w / 2, Y(84), 'slate', { size: 4.2, maxW: w - 10 * u }));
  },
};

// ---------------------------------------------------------------- chain-of-thought prompting

const FEW: [string, K][] = [
  ['Q: 3 trays of 8 rolls; 10 sold. Left?', '--ink'],
  ['A: 3 × 8 = 24 rolls. 24 − 10 = 14.', 'purple'],
  ['   The answer is 14.', 'green'],
  ['Q: 5 shelves of 40 books; 65 lent.', 'orange'],
  ['A: 5 × 40 = 200. 200 − 65 = 135.', 'purple'],
  ['   The answer is 135.', 'green'],
];

const cot: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    s.alpha(s.win('seen', 'show'), () => {
      const items = ['textbook solutions', 'proofs', 'answers that explain themselves'];
      items.forEach((t, i) => s.alpha(s.ease('seen', 0.5, 0.5 + i * 0.8), () => pill(s, t, w / 2, Y(30 + i * 16), 'purple', { size: 4.4, maxW: w - 12 * u })));
      s.alpha(s.ease('seen', 0.5, 3), () => fitText(s, 'all in the pretraining data', w / 2, Y(82), w - 12 * u, { font: 'ui', size: 4, italic: true, color: s.c('--ink-2') }));
    });
    const pA = s.win('show', 'palm');
    if (pA > 0)
      s.alpha(pA, () => {
        const x = 5 * u;
        const cw = w - 10 * u;
        s.text('a few-shot chain-of-thought prompt', x, Y(7), { font: 'ui', size: 3.8, align: 'left', color: s.c('--ink-3') });
        s.rrect(x, Y(11), cw, 54 * u, 2, { fill: s.tint('--paper', 0.5), stroke: s.c('--rule'), lw: 0.3 });
        const size = fit(s, FEW[3]![0], cw - 8 * u, 4.2, { font: 'mono' });
        FEW.forEach(([t, k], i) => {
          let a = i < 3 ? s.ease('show', 0.5, 0.3 * i) : i === 3 ? s.ease('show', 0.5, 2) : 0;
          let str = t;
          if (i >= 4) {
            const p = clamp01(s.prog('exemplar') * 1.6 - (i - 4) * 0.55);
            a = p > 0 ? 1 : 0;
            str = t.slice(0, Math.ceil(t.length * Math.min(1, p * 1.8)));
          }
          s.alpha(a, () => s.text(str, x + 4 * u, Y(19 + i * 8.5), { font: 'mono', size, align: 'left', weight: k === '--ink' ? 500 : 600, color: s.c(k) }));
        });
        s.alpha(s.ease('exemplar', 0.6, 0.4), () => {
          s.text('purple: reasoning (z)', x, Y(73), { font: 'ui', size: 3.8, align: 'left', weight: 650, color: s.c('purple') });
          s.text('green: answer (a)', x, Y(80), { font: 'ui', size: 3.8, align: 'left', weight: 650, color: s.c('green') });
        });
      });
    // where it helps: model size
    const sA = s.win('palm', 'zero');
    if (sA > 0)
      s.alpha(sA, () => {
        const ax0 = 10 * u;
        const ax1 = w - 10 * u;
        const X = (lg: number) => ax0 + ((lg - 8.6) / (11.9 - 8.6)) * (ax1 - ax0);
        const y = Y(62);
        s.alpha(s.ease('emerge', 0.6), () => {
          s.rrect(X(11), y - 22 * u, ax1 - X(11), 22 * u, 1, { fill: s.tint('green', 0.12) });
          s.text('helps', (X(11) + ax1) / 2, y - 11 * u, { font: 'ui', size: 4.2, weight: 650, color: s.c('green') });
          fitText(s, 'little or no help', (ax0 + X(11)) / 2, y - 11 * u, X(11) - ax0, { font: 'ui', size: 4.2, color: s.c('--ink-3') });
          fitText(s, 'chain of thought helps only at scale', w / 2, Y(36), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('green') });
        });
        s.line(ax0, y, ax1, y, s.c('--axis'), 0.35);
        for (const [lg, lab] of [[9, '1B'], [10, '10B'], [11, '100B'], [11.73, '540B']] as const) {
          s.line(X(lg), y - 1.2 * u, X(lg), y + 1.2 * u, s.c('--axis'), 0.35);
          s.text(lab, X(lg), y + 5 * u, { font: 'mono', size: 3.6, color: s.c('--ink-3') });
        }
        s.text('model size (parameters)', w / 2, y + 12 * u, { font: 'ui', size: 3.8, color: s.c('--ink-3') });
        s.circle(X(11.73), y, 2 * u, { fill: s.c('purple') });
        pill(s, 'PaLM 540B: state of the art on GSM8K', w / 2, Y(18), 'purple', { size: 4, maxW: w - 10 * u });
      });
    // zero-shot
    const zA = s.win('zero', 'caveat');
    if (zA > 0)
      s.alpha(zA, () => {
        const x = 5 * u;
        const cw = w - 10 * u;
        s.rrect(x, Y(6), cw, 36 * u, 2, { fill: s.tint('--paper', 0.5), stroke: s.c('--rule'), lw: 0.3 });
        const lines: [string, K, string][] = [
          ['Q: 5 shelves of 40 books; 65 lent.', 'orange', 'zero'],
          ["A: Let's think step by step.", 'gold', 'zero'],
          ['   5 × 40 = 200 books. 200 − 65 = 135.', 'purple', 'extract'],
          ['Therefore, the answer is 135.', 'green', 'extract'],
        ];
        const size = fit(s, lines[2]![0], cw - 8 * u, 4.2, { font: 'mono' });
        lines.forEach(([t, k, b], i) => s.alpha(s.ease(b, 0.5, b === 'zero' ? 0.6 * i : 0.6 * (i - 2)), () => s.text(t, x + 4 * u, Y(13 + i * 8), { font: 'mono', size, align: 'left', weight: 600, color: s.c(k) })));
        s.alpha(s.ease('numbers', 0.6), () => {
          const bx = x + 34 * u;
          const bw = cw - 34 * u - 14 * u;
          const bars: [string, number, K][] = [['zero-shot', 0.104, 'slate'], ['+ step by step', 0.407, 'gold']];
          bars.forEach(([lab, v, k], i) => {
            const y = Y(54 + i * 12);
            s.text(lab, bx - 2 * u, y + 3.5 * u, { font: 'ui', size: 3.8, align: 'right', color: s.c('--ink-2') });
            s.rrect(bx, y, bw * v * s.ease('numbers', 1, 0.3 + i * 0.5), 7 * u, 1, { fill: s.tint(k, 0.7) });
            s.text(`${(v * 100).toFixed(1)}%`, bx + bw * v + 2 * u, y + 3.5 * u, { font: 'mono', size: 3.8, align: 'left', weight: 650, color: s.c(k) });
          });
          fitText(s, 'GSM8K with InstructGPT (Kojima et al., 2022)', w / 2, Y(84), w - 10 * u, { font: 'ui', size: 3.6, color: s.c('--ink-3') });
        });
      });
    s.alpha(s.ease('caveat', 0.6), () => {
      const cx = w / 2;
      const ty = Y(30);
      const c = s.ctx;
      c.beginPath();
      c.moveTo(cx, ty - 9 * u);
      c.lineTo(cx + 9 * u, ty + 7 * u);
      c.lineTo(cx - 9 * u, ty + 7 * u);
      c.closePath();
      c.fillStyle = s.tint('gold', 0.25);
      c.fill();
      c.strokeStyle = s.c('gold');
      c.lineWidth = 0.5 * u;
      c.stroke();
      s.text('!', cx, ty + 1.5 * u, { font: 'ui', size: 7, weight: 800, color: s.c('gold') });
      fitText(s, 'a readable chain of thought', cx, Y(56), w - 12 * u, { font: 'display', size: 6, weight: 600 });
      fitText(s, 'is not always the real reason', cx, Y(68), w - 12 * u, { font: 'display', size: 6, weight: 600, color: s.c('gold') });
    });
  },
};

// ---------------------------------------------------------------- self-consistency

const ANS = [135, 135, 125, 135, 145, 135, 125];
const GROUPS: [number, number][] = [[135, 4], [125, 2], [145, 1]];

const vote: SceneDef = {
  marks: {
    pa: { tex: String.raw`p(\syma \mid \symx) = \sum_{\symz} p(\symz \mid \symx)\, p(\syma \mid \symx, \symz)`, x: 0.5, y: 0.9, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    const Y = rows(s);
    const qx = 5 * u;
    const qy = Y(42);
    chip(s, qx, qy - 5 * u, 10 * u, 10 * u, '', 'orange', { on: 0.5 });
    s.text('x', qx + 5 * u, qy, { size: 5.5, italic: true, weight: 650, color: s.c('orange') });
    const ax = w * 0.46;
    const grow = clamp01(s.span('diff', 'sc') * 1.3);
    const settle = s.ease('count', 0.8);
    ANS.forEach((a, i) => {
      const ay = Y(6 + i * 10.6);
      const f = clamp01(grow * 1.6 - i * 0.09);
      if (f <= 0) return;
      const pts: [number, number][] = [];
      const x0 = qx + 10 * u;
      for (let t = 0; t <= 40; t++) {
        const tt = t / 40;
        const wig = Math.sin(tt * Math.PI * (2 + (i % 3))) * 2.2 * u * (1 - tt) * (a === 135 ? 0.6 : 1.4);
        pts.push([lerp(x0, ax, tt), lerp(qy, ay + 4 * u, tt * tt * (3 - 2 * tt)) + wig]);
      }
      const n = Math.max(2, Math.round(pts.length * f));
      const c = s.ctx;
      c.beginPath();
      pts.slice(0, n).forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.strokeStyle = s.tint('purple', 0.55 * (1 - 0.5 * settle));
      c.lineWidth = 0.4 * u;
      c.stroke();
      if (f >= 1) chip(s, ax, ay, 13 * u, 8 * u, String(a), a === 135 ? 'green' : 'red', { on: 0.6 - 0.3 * settle, size: 4 });
    });
    s.alpha(s.ease('diff', 0.5), () => s.text('z', qx + 22 * u, Y(14), { size: 5, italic: true, weight: 650, color: s.c('purple') }));
    // tally
    if (settle > 0)
      s.alpha(settle, () => {
        const bx = ax + 16 * u;
        const unit = Math.min(6 * u, (w - bx - 18 * u) / 4);
        GROUPS.forEach(([a, n], i) => {
          const y = Y(18 + i * 17);
          s.text(String(a), bx, y + 3.5 * u, { font: 'mono', size: 4, weight: 650, align: 'left', color: s.c(a === 135 ? 'green' : 'red') });
          const x = bx + 10 * u;
          s.rrect(x, y, unit * n * settle, 7 * u, 1, { fill: s.tint(a === 135 ? 'green' : 'red', 0.6) });
          s.text(String(n), x + unit * n + 1.5 * u, y + 3.5 * u, { font: 'mono', size: 4, weight: 650, align: 'left' });
          s.alpha(s.ease('estimate', 0.5), () => s.text(`≈ ${n}/7`, x, y + 12.8 * u, { font: 'mono', size: 3.6, align: 'left', color: s.c('--ink-3') }));
          if (i === 0) s.alpha(s.ease('count', 0.5, 1), () => s.rrect(bx - 2 * u, y - 2.5 * u, x + unit * 4 + 6.5 * u - bx, 12 * u, 2, { stroke: s.c('green'), lw: 0.5 }));
        });
        s.alpha(s.ease('count', 0.5, 1.2), () => s.text('â = 135', bx, Y(72), { font: 'mono', size: 4.4, weight: 700, align: 'left', color: s.c('green') }));
      });
    s.show('pa', s.win('sum', 'gain'), { y: Y(90) / h });
    s.alpha(s.win('gain', 'need'), () => pill(s, '+17.9 points on GSM8K (Wang et al., 2022)', w / 2, Y(90), 'green', { size: 4, maxW: w - 10 * u }));
    s.alpha(s.ease('need', 0.6), () => pill(s, 'needs answers you can compare: numbers, letters', w / 2, Y(90), 'slate', { size: 4, maxW: w - 10 * u }));
  },
};

// ---------------------------------------------------------------- voting math

const votemath: SceneDef = {
  marks: {
    bin: { tex: String.raw`P_{\text{vote}}(n) = \sum_{k > n/2} \binom{n}{k}\, \symp^{k} (1-\symp)^{n-k}`, x: 0.5, y: 0.1, size: 4.6 },
    lim: { tex: String.raw`\lim_{n\to\infty} P_{\text{vote}} = \begin{cases} 1 & \symp > \symq \\ 0 & \symp < \symq \end{cases}`, x: 0.5, y: 0.1, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const Y = rows(s);
    const F = new Frame(s, 14 * u, Y(20), w - 22 * u, 56 * u, [0, 6, 0, 1.14]);
    s.alpha(s.ease('simple', 0.6), () => F.axes([0, 1, 2, 3, 4, 5, 6].map((v) => [v, String(2 ** v)]), [[0, '0%'], [0.5, '50%'], [1, '100%']], 'samples n (log scale)'));
    s.alpha(s.ease('simple', 0.5, 1), () => F.path([0, 6], [0.5, 0.5], s.tint('--ink-3', 0.6), 0.3, 1, [1, 1]));
    const dimBin = 1 - 0.7 * s.ease('scatter', 0.6);
    s.alpha(dimBin, () => {
      F.path(VX, VOTE_GOOD, s.c('green'), 0.7, s.prog('good'));
      F.path(VX, VOTE_BAD, s.c('red'), 0.7, s.prog('bad'));
    });
    s.alpha(s.ease('good', 0.5, 2) * (1 - s.ease('bad', 0.5)), () => F.dot(0, 0.6, 1.4, s.c('green')));
    F.path(VX, VOTE_SCATTER, s.c('teal'), 0.7, s.prog('weak'));
    F.path(VX, VOTE_COMMON, s.c('red'), 0.7, s.prog('flip'), [1.6, 1]);
    // legend in the empty top-left corner of the chart
    const items: [string, K, string, number[] | undefined, number][] = [
      ['p = 0.6', 'green', 'good', undefined, dimBin],
      ['p = 0.4', 'red', 'bad', undefined, dimBin],
      ['p = 0.3, scattered', 'teal', 'weak', undefined, 1],
      ['p = 0.3, q = 0.4', 'red', 'flip', [1.6, 1], 1],
    ];
    const lx = F.x + 2 * u;
    const lw = Math.min(38 * u, F.w * 0.4);
    const shown = items.filter(([, , b]) => s.since(b) >= 0).length;
    if (shown > 0)
      s.alpha(s.ease('good', 0.5), () => {
        s.rrect(lx - u, F.Y(1.14) + u, lw, (shown * 4.6 + 1.5) * u, 1.2, { fill: s.tint('--card', 0.9), stroke: s.c('--rule'), lw: 0.2 });
        items.forEach(([t, k, b, dash, a], i) => {
          if (s.since(b) < 0) return;
          const y = F.Y(1.14) + (4.2 + i * 4.6) * u;
          s.alpha(s.ease(b, 0.4) * (0.4 + 0.6 * a), () => {
            const c = s.ctx;
            c.setLineDash(dash ? dash.map((d) => d * u) : []);
            s.line(lx + 0.5 * u, y, lx + 5 * u, y, s.c(k), 0.7);
            c.setLineDash([]);
            fitText(s, t, lx + 7 * u, y + 0.2 * u, lw - 9 * u, { font: 'ui', size: 3.6, weight: 600, align: 'left', color: s.c(k) });
          });
        });
      });
    // scattered and common wrong answers
    s.alpha(s.win('scatter', 'flip'), () => {
      const xs = [w / 2 - 16 * u, w / 2, w / 2 + 16 * u];
      ['125', '145', '98'].forEach((t, i) => s.alpha(s.ease('scatter', 0.4, 0.5 + 0.5 * i) * (1 - s.ease('common', 0.4)), () => chip(s, xs[i]! - 6 * u, Y(87), 12 * u, 7 * u, t, 'red', { on: 0.4, size: 3.8 })));
      s.alpha(s.ease('common', 0.5), () => pill(s, 'common mistake: 125, share q = 0.4', w / 2, Y(90.5), 'red', { size: 4, maxW: w - 10 * u }));
    });
    s.alpha(s.ease('plural', 0.6), () => fitText(s, 'voting converges on the plurality', w / 2, Y(90.5), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('--ink-2') }));
    s.show('bin', s.win('coin', 'scatter'), { y: Y(10) / h });
    s.show('lim', s.ease('plural', 0.6), { y: Y(10) / h });
  },
};

// ---------------------------------------------------------------- coverage

const coverageScene: SceneDef = {
  marks: {
    pk: { tex: String.raw`\text{pass@}k = 1 - (1 - \symp)^k`, x: 0.5, y: 0.1, size: 5.2 },
    est: { tex: String.raw`\widehat{\text{pass@}k} = 1 - \tbinom{n-c}{k} \big/ \tbinom{n}{k}`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const Y = rows(s);
    // a pile of samples with one right answer in it
    s.alpha(s.win('other', 'passk'), () => {
      const cols = 6;
      const cw = Math.min(14 * u, (w - 20 * u) / cols);
      const x0 = (w - cols * cw) / 2;
      for (let i = 0; i < 18; i++) {
        const ok = i === 10;
        chip(s, x0 + (i % cols) * cw + 0.5 * u, Y(28 + Math.floor(i / cols) * 11), cw - u, 8 * u, ok ? '135' : String(100 + ((i * 37) % 60)), ok ? 'green' : 'red', { on: ok ? 0.9 : 0.25, size: 3.6 });
      }
      fitText(s, 'is the right answer anywhere in here?', w / 2, Y(70), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('--ink-2') });
    });
    const A1 = s.win('passk', 'bench');
    if (A1 > 0)
      s.alpha(A1, () => {
        const F = new Frame(s, 14 * u, Y(22), w - 22 * u, 52 * u, [0, 3, 0, 1]);
        F.axes([[0, '1'], [1, '10'], [2, '100'], [3, '1000']], [[0, '0%'], [0.5, '50%'], [1, '100%']], 'samples k (log scale)');
        F.path(COV1_X, COV1_Y, s.c('teal'), 0.8, s.prog('passk') * 1.2);
        s.alpha(s.ease('passk', 0.5, 1), () => s.text('p = 0.015', F.X(0.1), F.Y(0.1), { font: 'ui', size: 3.8, align: 'left', color: s.c('gold'), halo: true }));
        s.alpha(s.ease('tries', 0.5), () => {
          F.path([2, 2], [0, COV1_Y[40]!], s.tint('--ink-3', 0.7), 0.3, 1, [1, 1]);
          F.dot(2, COV1_Y[40]!, 1.6, s.c('teal'));
          s.text(`100 tries: ${pct(COV1_Y[40]!)}`, F.X(2) - 2 * u, F.Y(COV1_Y[40]!) - 3 * u, { font: 'mono', size: 4, weight: 650, align: 'right', color: s.c('teal'), halo: true });
        });
        s.alpha(s.ease('tests', 0.5), () => pill(s, 'unit tests: a perfect checker for code', w / 2, Y(90), 'green', { size: 4, maxW: w - 10 * u }));
      });
    s.show('pk', s.win('passk', 'est'), { y: Y(10) / h });
    s.show('est', s.win('est', 'bench'), { y: Y(10) / h });
    const A2 = s.ease('bench', 0.6);
    if (A2 > 0)
      s.alpha(A2, () => {
        const F = new Frame(s, 14 * u, Y(14), w - 22 * u, 60 * u, [0, 4, 0, 1]);
        F.axes([[0, '1'], [1, '10'], [2, '100'], [3, '1k'], [4, '10k']], [[0, '0%'], [0.5, '50%'], [1, '100%']], 'samples per problem (log scale)');
        s.alpha(s.ease('gap', 0.6), () => {
          const c = s.ctx;
          c.beginPath();
          BENCH_X.forEach((x, i) => (i ? c.lineTo(F.X(x), F.Y(BENCH_Y[i]!)) : c.moveTo(F.X(x), F.Y(BENCH_Y[i]!))));
          c.lineTo(F.X(4), F.Y(BENCH_CEIL));
          c.lineTo(F.X(BENCH_X[1]!), F.Y(BENCH_CEIL));
          c.closePath();
          c.fillStyle = s.tint('teal', 0.12);
          c.fill();
          s.text('the prize for a verifier', F.X(2.6), F.Y(0.62), { font: 'ui', size: 4, weight: 650, color: s.c('teal'), halo: true });
        });
        F.path(BENCH_X, BENCH_Y, s.c('teal'), 0.8, s.prog('bench') * 1.15);
        s.alpha(s.ease('bench', 0.5, 2.5), () => s.text('pass@n', F.X(3.9), F.Y(BENCH_Y[78]!) + 4.5 * u, { font: 'ui', size: 3.8, weight: 650, align: 'right', color: s.c('teal'), halo: true }));
        s.alpha(s.ease('ceiling', 0.6), () => {
          F.path([0, 4], [BENCH_CEIL, BENCH_CEIL], s.c('green'), 0.6, s.prog('ceiling') * 1.5, [1.6, 1]);
          s.text(`voting ceiling ${pct(BENCH_CEIL)}`, F.X(4), F.Y(BENCH_CEIL) + 4.5 * u, { font: 'ui', size: 3.8, weight: 650, align: 'right', color: s.c('green'), halo: true });
          F.path([0, 4], [BENCH_MEAN, BENCH_MEAN], s.tint('gold', 0.8), 0.4, 1, [1, 1]);
        });
        s.alpha(s.win('why', 'ceiling'), () => {
          const hw = Math.min(40 * u, F.w * 0.45);
          const hx = F.x + F.w - hw - 2 * u;
          const hh = 9 * u;
          const hy = F.y + F.h - hh - 7 * u;
          s.rrect(hx - 1.5 * u, hy - 1.5 * u, hw + 3 * u, hh + 10 * u, 1.5, { fill: s.tint('--card', 0.92), stroke: s.c('--rule'), lw: 0.25 });
          const bw = hw / BENCH_HIST.length;
          BENCH_HIST.forEach((v, i) => s.rrect(hx + i * bw + 0.15 * u, hy + hh * (1 - v), bw - 0.3 * u, hh * v + 0.3 * u, 0.3, { fill: s.tint('gold', 0.75) }));
          s.text('0', hx, hy + hh + 4 * u, { font: 'mono', size: 3.4, color: s.c('--ink-3') });
          s.text('1', hx + hw, hy + hh + 4 * u, { font: 'mono', size: 3.4, color: s.c('--ink-3') });
          s.text('problems by p', hx + hw / 2, hy + hh + 4 * u, { font: 'ui', size: 3.4, color: s.c('--ink-3') });
        });
      });
  },
};

// ---------------------------------------------------------------- best-of-n

function bump(s: Scene, F: Frame, m: number, scale: number, k: K, a: number, dash = false): void {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 80; i++) {
    const v = F.dom[0] + ((F.dom[1] - F.dom[0]) * i) / 80;
    xs.push(v);
    ys.push(scale * Math.exp(-((v - m) ** 2) / 2));
  }
  s.alpha(a, () => F.path(xs, ys, s.c(k), 0.5, 1, dash ? [1, 0.8] : undefined));
}

const bon: SceneDef = {
  marks: {
    kl: { tex: String.raw`\mathrm{KL} = \log n - \frac{n-1}{n}`, x: 0.5, y: 0.14, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const Y = rows(s);
    // a verifier reads a solution and outputs a probability
    s.alpha(s.win('verifier', 'bon'), () => {
      const bw = Math.min(56 * u, w * 0.48);
      const bx = 6 * u;
      s.rrect(bx, Y(26), bw, 30 * u, 2, { fill: s.tint('purple', 0.06), stroke: s.tint('purple', 0.6), lw: 0.3 });
      const lines = ['5 × 40 = 200', '200 − 65 = 135', 'the answer is 135'];
      const sz = fit(s, lines[2]!, bw - 6 * u, 3.8, { font: 'mono' });
      lines.forEach((t, i) => s.text(t, bx + 3 * u, Y(33 + i * 8), { font: 'mono', size: sz, align: 'left', color: s.c(i === 2 ? 'green' : 'purple') }));
      const vx = bx + bw + 14 * u;
      s.arrow(bx + bw + u, Y(41), vx - 6 * u, Y(41), s.c('--ink-3'), 0.4, 2);
      s.circle(vx, Y(41), 5.5 * u, { fill: s.tint('teal', 0.15), stroke: s.c('teal'), lw: 0.5 });
      s.text('V', vx, Y(41.5), { size: 5.5, italic: true, weight: 650, color: s.c('teal') });
      s.alpha(s.ease('verifier', 0.5, 1.5), () => fitText(s, 'P(right) = 0.91', vx + 7 * u, Y(41.5), w - vx - 9 * u, { font: 'mono', size: 4.2, align: 'left', weight: 650, color: s.c('teal') }));
      s.alpha(s.ease('cobbe', 0.6), () => pill(s, 'trained on solutions labeled right or wrong', w / 2, Y(72), 'teal', { size: 4, maxW: w - 10 * u }));
      s.alpha(s.ease('cobbe', 0.6, 3), () => pill(s, 'Cobbe et al., 2021: 6B + verifier ≥ fine-tuned 175B', w / 2, Y(84), 'slate', { size: 3.8, maxW: w - 10 * u }));
    });
    // the score axis with one draw of candidates
    const stripA = s.ease('bon', 0.6) * (1 - s.ease('kl', 0.5));
    const S = new Frame(s, 8 * u, Y(8), w - 16 * u, 22 * u, [-3.5, 6.5, 0, 1]);
    if (stripA > 0)
      s.alpha(stripA, () => {
        s.line(S.x, S.y + S.h, S.x + S.w, S.y + S.h, s.c('--axis'), 0.3);
        for (const v of [-2, 0, 2, 4, 6]) s.text(String(v), S.X(v), S.y + S.h + 3.4 * u, { font: 'mono', size: 3.4, color: s.c('--ink-3') });
        s.text('verifier score V', S.x + S.w, S.y + S.h + 7.5 * u, { font: 'ui', size: 3.6, align: 'right', color: s.c('teal') });
        const bA = s.ease('noisy', 0.6) * (1 - 0.75 * s.ease('small', 0.5));
        bump(s, S, 2, 0.95, 'green', bA);
        bump(s, S, 0, 0.95, 'red', bA);
        bump(s, S, 3, 0.45, 'red', bA * s.ease('exploit', 0.6), true);
        s.alpha(bA, () => {
          s.text('right', S.X(2), S.y + 2.5 * u, { font: 'ui', size: 3.6, weight: 650, color: s.c('green'), halo: true });
          s.text('wrong', S.X(0), S.y + 2.5 * u, { font: 'ui', size: 3.6, weight: 650, color: s.c('red'), halo: true });
        });
        s.alpha(bA * s.ease('exploit', 0.6), () => s.text('exploits (enlarged)', S.x + S.w, S.y + S.h * 0.3, { font: 'ui', size: 3.6, weight: 650, align: 'right', color: s.c('red'), halo: true }));
        const big = s.since('big') >= 0;
        const draw = big ? DRAW256 : DRAW16;
        const colored = s.ease('small', 0.5);
        const dA = (s.since('big') >= 0 ? s.ease('big', 0.5) : s.ease('bon', 0.5, 0.8)) * (1 - s.win('noisy', 'small'));
        let best = 0;
        draw.forEach((c, i) => {
          if (c.v > draw[best]!.v) best = i;
        });
        s.alpha(dA, () => {
          draw.forEach((c, i) => {
            const x = S.X(Math.max(-3.4, Math.min(6.4, c.v)));
            const y = S.y + S.h * (0.25 + 0.65 * JITTER[i]!);
            const r = (big ? 0.8 : 1.3) * u;
            const k: K = colored > 0 ? (c.ok ? 'green' : 'red') : '--ink-3';
            if (c.hack && colored > 0) {
              const ctx = s.ctx;
              ctx.beginPath();
              ctx.moveTo(x, y - r * 1.6);
              ctx.lineTo(x + r * 1.6, y);
              ctx.lineTo(x, y + r * 1.6);
              ctx.lineTo(x - r * 1.6, y);
              ctx.closePath();
              ctx.fillStyle = s.c('red');
              ctx.fill();
            } else s.circle(x, y, r, { fill: s.tint(k, 0.75) });
          });
          const b = draw[best]!;
          const bx = S.X(Math.min(6.4, b.v));
          s.circle(bx, S.y + S.h * 0.55, 3.2 * u, { stroke: s.c('--ink'), lw: 0.45 });
          const lab = colored > 0 ? (b.ok ? 'picked: right' : b.hack ? 'picked: an exploit' : 'picked: wrong') : 'picked';
          s.text(lab, S.x + S.w, S.y - 1.5 * u, { font: 'ui', size: 3.8, weight: 650, align: 'right', color: s.c(colored > 0 ? (b.ok ? 'green' : 'red') : '--ink-2'), halo: true });
          s.text(`n = ${draw.length}`, S.x, S.y - 1.5 * u, { font: 'mono', size: 3.8, weight: 650, align: 'left', color: s.c('--ink-2') });
        });
      });
    // accuracy of the pick against n
    const cA = s.ease('small', 0.6);
    if (cA > 0)
      s.alpha(cA, () => {
        const F = new Frame(s, 14 * u, Y(44), w - 22 * u, 36 * u, [0, 10, 0, 1]);
        F.axes([0, 2, 4, 6, 8, 10].map((v) => [v, String(2 ** v)]), [[0, '0%'], [0.5, '50%'], [1, '100%']]);
        s.alpha(s.ease('kl', 0.6), () => {
          for (const [lx, kl] of [[2, 0.64], [4, 1.84], [8, 4.55], [10, 5.93]] as const) s.text(`KL ${kl.toFixed(1)}`, F.X(lx), F.y + F.h + 8 * u, { font: 'mono', size: 3.4, color: s.c('purple') });
        });
        F.path(BON_X, PASS_Y, s.tint('slate', 0.8), 0.4, 1, [0.6, 0.8]);
        F.path(BON_X, BON0_Y, s.tint('teal', 0.45), 0.4, 1, [1.4, 1]);
        F.path(BON_X, BON_Y, s.c('teal'), 0.8, s.since('curve') >= 0 ? s.prog('curve') * 1.2 : 0);
        s.alpha(s.ease('goodhart', 0.6), () => {
          F.path(BON_X, BON_PROXY, s.c('purple'), 0.5, s.prog('goodhart') * 2, [1.6, 1]);
          s.text("verifier's score of the pick (rescaled)", F.X(10), F.Y(1) - 2 * u, { font: 'ui', size: 3.6, weight: 600, align: 'right', color: s.c('purple'), halo: true });
        });
        // legend in the empty lower right of the chart
        const rows: [string, string, number, number[] | undefined, number][] = [
          ['pass@n', s.tint('slate', 0.8), 0.4, [0.6, 0.8], 1],
          ['no exploits', s.tint('teal', 0.6), 0.4, [1.4, 1], 1],
          ['2% exploits', s.c('teal'), 0.8, undefined, s.ease('curve', 0.5)],
        ];
        const lw = Math.min(30 * u, F.w * 0.36);
        const lx = F.x + F.w - lw - u;
        const ly = F.y + F.h - 15 * u;
        s.rrect(lx, ly, lw, 14 * u, 1.2, { fill: s.tint('--card', 0.9), stroke: s.c('--rule'), lw: 0.2 });
        rows.forEach(([t, col, lwid, dash, a], i) =>
          s.alpha(a, () => {
            const y = ly + (2.6 + i * 4.4) * u;
            const c = s.ctx;
            c.setLineDash(dash ? dash.map((d) => d * u) : []);
            s.line(lx + 1.5 * u, y, lx + 6 * u, y, col, lwid);
            c.setLineDash([]);
            fitText(s, t, lx + 7.5 * u, y + 0.2 * u, lw - 9 * u, { font: 'ui', size: 3.6, weight: 600, align: 'left', color: s.c('teal') });
          }),
        );
        const i16 = BON_NS.indexOf(16);
        const i256 = BON_NS.indexOf(256);
        s.alpha(s.ease('small', 0.5, 0.8), () => {
          F.dot(4, BON_Y[i16]!, 1.4, s.c('green'));
          s.text(pct(BON_Y[i16]!), F.X(4), F.Y(BON_Y[i16]!) - 3 * u, { font: 'mono', size: 3.6, weight: 650, color: s.c('green'), halo: true });
        });
        s.alpha(s.ease('big', 0.5, 0.8), () => {
          F.dot(8, BON_Y[i256]!, 1.4, s.c('red'));
          s.text(pct(BON_Y[i256]!), F.X(8), F.Y(BON_Y[i256]!) + 5 * u, { font: 'mono', size: 3.6, weight: 650, color: s.c('red'), halo: true });
        });
      });
    s.show('kl', s.ease('kl', 0.6), { y: Y(16) / h });
    s.alpha(s.ease('gentle', 0.6), () => pill(s, '1,024 samples: under 6 nats', w / 2, Y(94), 'purple', { size: 3.8, maxW: w - 10 * u }));
  },
};

// ---------------------------------------------------------------- outcome versus process

const prm: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    const cardA = 1 - s.ease('lightman', 0.6);
    if (cardA > 0)
      s.alpha(cardA, () => {
        const x = 5 * u;
        const cw = w - 10 * u;
        fitText(s, '4 boxes of 12 markers at $2 each,', x, Y(5), cw, { font: 'ui', size: 4, weight: 600, align: 'left', color: s.c('orange') });
        fitText(s, '$18 off, split by 3 classes. Each pays?', x, Y(11), cw, { font: 'ui', size: 4, weight: 600, align: 'left', color: s.c('orange') });
        const state = s.since('cancel') >= 0 ? WORK_CANCEL : s.since('slip') >= 0 ? WORK_SLIP : WORK_CLEAN;
        const showPrm = s.ease('prm', 0.6);
        const rowW = cw - 26 * u;
        const colX = x + rowW + 5 * u;
        s.alpha(showPrm, () => s.text('PRM', colX + 6 * u, Y(18), { font: 'ui', size: 3.6, weight: 700, color: s.c('teal') }));
        state.shown.forEach((e, i) => {
          const y = Y(21 + i * 10.5);
          const bad = !state.ok[i];
          const k: K = bad ? 'red' : 'purple';
          s.rrect(x, y, rowW, 8.5 * u, 1.5, { fill: s.tint(k, bad ? 0.1 : 0.05), stroke: s.tint(k, bad ? 0.8 : 0.35), lw: 0.3 });
          const line = `${i + 1}  ${e.replace('*', '×').replace('/', '÷').replace('-', '−')} = ${state.vals[i]}`;
          fitText(s, line, x + 2.5 * u, y + 4.5 * u, rowW - 16 * u, { font: 'mono', size: 4, align: 'left', weight: 600 });
          s.text(MARKERS[i]!.unit, x + rowW - 2 * u, y + 4.5 * u, { font: 'ui', size: 3.6, align: 'right', color: s.c('--ink-3') });
          s.alpha(showPrm, () => {
            badge(s, colX + 2.5 * u, y + 4.2 * u, 2.4 * u, state.ok[i]!);
            s.text(state.stepP[i]!.toFixed(2), colX + 6 * u, y + 4.5 * u, { font: 'mono', size: 3.6, align: 'left', weight: 650, color: s.c('teal') });
          });
        });
        const ay = Y(21 + 4 * 10.5);
        const right = state.vals[3] === 26;
        s.rrect(x, ay, rowW, 8.5 * u, 1.5, { fill: s.tint('green', 0.08), stroke: s.tint('green', 0.6), lw: 0.3 });
        s.text(`answer a = ${state.vals[3]}`, x + 2.5 * u, ay + 4.5 * u, { font: 'mono', size: 4, align: 'left', weight: 700, color: s.c('green') });
        const ormOn = s.win('orm', 'example') + s.win('slip', 'prm');
        s.alpha(0.6 + 0.4 * clamp01(ormOn), () => {
          badge(s, colX + 2.5 * u, ay + 4.2 * u, 2.4 * u, right);
          s.text('ORM', colX + 6 * u, ay + 4.5 * u, { font: 'ui', size: 3.6, align: 'left', weight: 700, color: s.c('teal') });
        });
        // verdict
        const vy = Y(80);
        if (s.since('slip') >= 0 && s.since('cancel') < 0)
          s.alpha(s.ease('slip', 0.5, 1.5), () => fitText(s, s.since('prm') >= 0 ? 'wrong, and the PRM says where: step 2' : 'wrong, but where?', w / 2, vy, w - 10 * u, { font: 'ui', size: 4.2, weight: 650, color: s.c('red') }));
        if (s.since('cancel') >= 0)
          s.alpha(s.ease('cancel', 0.5, 1.2), () => fitText(s, 'right answer, wrong reasoning', w / 2, vy, w - 10 * u, { font: 'ui', size: 4.2, weight: 650, color: s.c('gold') }));
        s.alpha(s.ease('fooled', 0.5), () => fitText(s, 'ORM: 1.0     PRM: 0.009', w / 2, Y(88), w - 10 * u, { font: 'mono', size: 4, weight: 650, color: s.c('teal') }));
        s.alpha(s.ease('product', 0.5) * (1 - s.ease('lightman', 0.4)), () => fitText(s, '0.95 × 0.10 × 0.10 × 0.95 = 0.009', w / 2, Y(95), w - 10 * u, { font: 'mono', size: 3.8, color: s.c('--ink-2') }));
      });
    // results
    s.alpha(s.win('lightman', 'auto'), () => {
      pill(s, 'PRM800K: ~800,000 human step labels', w / 2, Y(14), 'teal', { size: 4, maxW: w - 10 * u });
      s.alpha(s.ease('result', 0.6), () => {
        const bx = 34 * u;
        const bw = w - bx - 18 * u;
        const bars: [string, number, K][] = [['PRM', 0.78, 'teal'], ['ORM', 0.72, 'slate'], ['majority vote', 0.7, 'gold']];
        bars.forEach(([lab, v, k], i) => {
          const y = Y(30 + i * 14);
          s.text(lab, bx - 2 * u, y + 4 * u, { font: 'ui', size: 4, align: 'right', weight: 650, color: s.c(k) });
          s.rrect(bx, y, bw * v * s.ease('result', 1, 0.3 + 0.4 * i), 8 * u, 1, { fill: s.tint(k, 0.65) });
          s.text(`${Math.round(v * 100)}%`, bx + bw * v + 2 * u, y + 4 * u, { font: 'mono', size: 4, align: 'left', weight: 650, color: s.c(k) });
        });
        fitText(s, 'best of 1,860 samples, a 500-problem MATH subset', w / 2, Y(78), w - 10 * u, { font: 'ui', size: 3.6, color: s.c('--ink-3') });
      });
    });
    // automatic step labels by rollouts
    s.alpha(s.ease('auto', 0.6), () => {
      const sx = 10 * u;
      const sy = Y(50);
      chip(s, sx, sy - 6 * u, 20 * u, 12 * u, 'step t', 'purple', { on: 0.6, font: 'ui', size: 4 });
      const oks = [true, true, false, true];
      oks.forEach((ok, i) => {
        const ty = Y(26 + i * 16);
        const ex = w - 30 * u;
        s.alpha(s.ease('auto', 0.4, 0.6 + 0.4 * i), () => {
          s.line(sx + 20 * u, sy, ex, ty, s.tint('purple', 0.5), 0.35, [1, 0.8]);
          badge(s, ex + 3 * u, ty, 2.6 * u, ok);
        });
      });
      s.alpha(s.ease('auto', 0.5, 2.6), () => s.text('value ≈ 3/4', w - 6 * u, Y(92), { font: 'mono', size: 4.2, weight: 650, align: 'right', color: s.c('teal') }));
      s.text('completions from here', w / 2, Y(14), { font: 'ui', size: 3.8, color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- search

const search: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    const tA = 1 - s.ease('snell', 0.6);
    if (tA > 0)
      s.alpha(tA, () => {
        const LX = (l: number) => 9 * u + (l * (w - 30 * u)) / 3;
        const pos = (l: number, i: number): [number, number] => {
          const n = BEAM[l]!.length;
          return [LX(l), n === 1 ? Y(52) : Y(12 + (i * 80) / (n - 1))];
        };
        const appear = [1, s.ease('beam', 0.6), s.ease('expand', 0.6), s.ease('tree', 0.6)];
        const judged = [1, s.ease('beam', 0.6, 1.4), s.ease('score', 0.6), s.ease('tree', 0.6, 1.6)];
        s.text('PRM score of each partial solution', 4 * u, Y(4), { font: 'ui', size: 3.6, align: 'left', color: s.c('--ink-3') });
        for (let l = 1; l < BEAM.length; l++) {
          BEAM[l]!.forEach((nd, i) => {
            const a = appear[l]!;
            if (a <= 0) return;
            const [x0, y0] = pos(l - 1, nd.parent);
            const [x1, y1] = pos(l, i);
            const dead = !nd.kept && judged[l]! > 0.5;
            s.alpha(a, () => s.line(x0, y0, x1, y1, s.tint(dead ? '--ink-3' : 'teal', dead ? 0.25 : 0.6), 0.3));
          });
        }
        BEAM.forEach((lv, l) =>
          lv.forEach((nd, i) => {
            const a = appear[l]!;
            if (a <= 0) return;
            const [x, y] = pos(l, i);
            const j = judged[l]!;
            const dead = !nd.kept && j > 0.5;
            s.alpha(a, () => {
              s.circle(x, y, 1.8 * u, { fill: dead ? s.tint('--ink-3', 0.35) : s.tint('teal', 0.4 + 0.6 * j * (nd.kept ? 1 : 0.3)) });
              if (nd.kept && l > 0) s.circle(x, y, 2.8 * u, { stroke: s.tint('teal', j), lw: 0.4 });
              if (l > 0) s.text(nd.score.toFixed(2), x + 3.6 * u, y + 0.2 * u, { font: 'mono', size: 3.6, align: 'left', color: dead ? s.c('--ink-3') : s.c('--ink'), halo: true });
            });
          }),
        );
        s.alpha(s.ease('beam', 0.5, 2), () => s.text('keep 3', LX(1), Y(97), { font: 'ui', size: 3.6, weight: 650, color: s.c('teal') }));
        s.text('x', LX(0) - 3.5 * u, Y(52.3), { size: 4.6, italic: true, weight: 650, color: s.c('orange') });
        s.alpha(s.win('guide', 'beam'), () => fitText(s, 'grow partial solutions, scored step by step', w / 2 + 4 * u, Y(52), w - 24 * u, { font: 'ui', size: 4, italic: true, color: s.c('--ink-2') }));
      });
    const cA = s.ease('snell', 0.6);
    if (cA > 0)
      s.alpha(cA, () => {
        const F = new Frame(s, 14 * u, Y(30), w - 22 * u, 46 * u, [0, 6, 0, 1]);
        F.axes([0, 1, 2, 3, 4, 5, 6].map((v) => [v, String(2 ** v)]), [[0, '0%'], [0.5, '50%'], [1, '100%']], 'samples n');
        s.text('chance at least one of n samples is right', F.x, Y(26), { font: 'ui', size: 3.6, align: 'left', color: s.c('--ink-3') });
        F.path(VX, SOMETIMES, s.c('teal'), 0.8, s.prog('snell') * 1.4);
        F.path(VX, NEVER, s.c('red'), 0.8, s.prog('snell') * 1.4);
        s.alpha(s.ease('snell', 0.5, 2), () => {
          s.text('solved sometimes (p = 0.2)', F.X(6), F.Y(0.4), { font: 'ui', size: 3.6, weight: 650, align: 'right', color: s.c('teal'), halo: true });
          s.text('almost never (p = 0.002)', F.X(6), F.Y(NEVER[63]!) - 3 * u, { font: 'ui', size: 3.6, weight: 650, align: 'right', color: s.c('red'), halo: true });
        });
        s.alpha(s.win('depends', 'fourteen'), () => {
          pill(s, 'easy: revise one answer', w / 2, Y(8), 'teal', { size: 3.8, maxW: w - 10 * u });
          pill(s, 'hard: sample more, or search', w / 2, Y(17), 'purple', { size: 3.8, maxW: w - 10 * u });
        });
        s.alpha(s.win('fourteen', 'hard'), () => {
          pill(s, 'per-question choice: ~4× less compute', w / 2, Y(8), 'teal', { size: 3.8, maxW: w - 10 * u });
          pill(s, 'beat a model 14× larger', w / 2, Y(17), 'teal', { size: 3.8, maxW: w - 10 * u });
        });
        s.alpha(s.win('hard', 'multiply'), () => pill(s, 'hardest problems: a bigger model wins', w / 2, Y(12), 'red', { size: 4, maxW: w - 10 * u }));
        s.alpha(s.ease('multiply', 0.6), () => fitText(s, 'compute multiplies what the model can sometimes do', w / 2, Y(12), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('--ink-2') }));
      });
  },
};

// ---------------------------------------------------------------- reasoning models

const CHAIN: [string, K][] = [
  ['try: factor it', 'purple'],
  ['check', 'orange'],
  ['wait, that is wrong', 'red'],
  ['back up', 'slate'],
  ['try: substitute', 'purple'],
  ['check ✓', 'green'],
  ['answer', 'green'],
];

const models: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    s.alpha(s.win('outer', 'inside'), () => {
      const mx = 5 * u;
      chip(s, mx, Y(40), 18 * u, 14 * u, 'model', 'blue', { on: 0.5, font: 'ui', size: 4 });
      const ax = mx + 34 * u;
      const vx = w - 26 * u;
      const ok = [true, false, true, false, true];
      ok.forEach((g, i) => {
        const y = Y(22 + i * 12);
        s.line(mx + 18 * u, Y(47), ax, y + 4 * u, s.tint('purple', 0.5), 0.35);
        chip(s, ax, y, 12 * u, 8 * u, '', g ? 'green' : 'red', { on: 0.5 });
        s.line(ax + 12 * u, y + 4 * u, vx - 5 * u, Y(47), s.tint('--ink-3', 0.4), 0.3);
      });
      s.circle(vx, Y(47), 5 * u, { fill: s.tint('teal', 0.15), stroke: s.c('teal'), lw: 0.5 });
      s.text('V', vx, Y(47.5), { size: 5, italic: true, weight: 650, color: s.c('teal') });
      s.arrow(vx + 5.5 * u, Y(47), w - 9 * u, Y(47), s.c('--ink-3'), 0.4, 1.8);
      badge(s, w - 6 * u, Y(47), 2.6 * u, true);
      fitText(s, 'outside the model: sample, then pick', w / 2, Y(88), w - 10 * u, { font: 'ui', size: 4, italic: true, color: s.c('--ink-2') });
    });
    const iA = s.win('inside', 'o1');
    if (iA > 0)
      s.alpha(iA, () => {
        s.rrect(5 * u, Y(8), w - 10 * u, 12 * u, 2, { fill: s.tint('blue', 0.08), stroke: s.tint('blue', 0.6), lw: 0.3 });
        fitText(s, 'reasoning model', w / 2, Y(14.5), w - 14 * u, { font: 'ui', size: 4.4, weight: 650, color: s.c('blue') });
        s.alpha(s.ease('rl', 0.5), () => pill(s, 'trained with RL', w - 8 * u, Y(24), 'slate', { size: 3.6, align: 'right' }));
        let x = 5 * u;
        let y = Y(32);
        const ch = 9 * u;
        const reveal = s.since('behave') >= 0 ? s.prog('behave') * (CHAIN.length + 0.5) : 1;
        s.alpha(1 - s.ease('behave', 0.5), () => {
          const c = s.ctx;
          c.setLineDash([u, u * 0.8]);
          s.rrect(5 * u, Y(30), w - 10 * u, 28 * u, 2, { stroke: s.tint('purple', 0.6), lw: 0.3 });
          c.setLineDash([]);
          s.text('one long chain of thought', w / 2, Y(50), { font: 'ui', size: 4, italic: true, color: s.c('purple') });
        });
        CHAIN.forEach(([t, k], i) => {
          const tw = s.measure(t, { font: 'ui', size: 4, weight: 600 }) + 5 * u;
          if (x + tw > w - 5 * u) {
            x = 5 * u;
            y += 13 * u;
          }
          const a = clamp01(reveal - i);
          if (a > 0) s.alpha(a, () => chip(s, x, y, tw, ch, t, k, { on: 0.55, font: 'ui', size: 4, ink: s.c(k) }));
          x += tw + 2 * u;
        });
        s.alpha(s.ease('seq', 0.6), () => fitText(s, 'one sequential search, verification built in', w / 2, Y(88), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('--ink-2') }));
      });
    const oA = s.win('o1', 'aime');
    if (oA > 0)
      s.alpha(oA, () => {
        pill(s, 'OpenAI o1, September 2024', w / 2, Y(12), 'blue', { size: 4.4, maxW: w - 10 * u });
        fitText(s, 'raw chain of thought hidden; a summary is shown', w / 2, Y(22), w - 10 * u, { font: 'ui', size: 3.6, color: s.c('--ink-3') });
        s.alpha(s.ease('axes', 0.6), () => {
          const gap = 4 * u;
          const cw = (w - 10 * u - gap) / 2;
          const items: [string, string][] = [['more RL training compute', 'train time'], ['more thinking tokens', 'test time']];
          items.forEach(([a, b], i) => {
            const x = 5 * u + i * (cw + gap);
            s.alpha(s.ease('axes', 0.5, i * 0.8), () => {
              card(s, x, Y(32), cw, 22 * u, 'teal', a, b, { size: 4 });
              s.arrow(x + cw / 2, Y(68), x + cw / 2, Y(58), s.c('teal'), 0.6, 2.2);
              s.text('accuracy rises', x + cw / 2, Y(73), { font: 'ui', size: 3.8, weight: 650, color: s.c('teal') });
            });
          });
          fitText(s, 'two new axes to scale (as reported)', w / 2, Y(86), w - 10 * u, { font: 'ui', size: 3.8, italic: true, color: s.c('--ink-2') });
        });
      });
    const bA = s.ease('aime', 0.6);
    if (bA > 0)
      s.alpha(bA, () => {
        const dim = 1 - 0.55 * s.ease('r1', 0.5);
        s.alpha(dim, () => {
          const bx = 26 * u;
          const bw = w - bx - 18 * u;
          const bars: [string, number, K][] = [['GPT-4o', 0.12, 'slate'], ['o1', 0.74, 'blue']];
          bars.forEach(([lab, v, k], i) => {
            const y = Y(18 + i * 14);
            s.text(lab, bx - 2 * u, y + 4 * u, { font: 'ui', size: 4.2, align: 'right', weight: 650, color: s.c(k) });
            s.rrect(bx, y, bw * v * s.ease('aime', 1, 0.3 + 0.5 * i), 8 * u, 1, { fill: s.tint(k, 0.65) });
            s.text(`~${Math.round(v * 100)}%`, bx + bw * v + 2 * u, y + 4 * u, { font: 'mono', size: 4, align: 'left', weight: 650, color: s.c(k) });
          });
          fitText(s, 'AIME 2024, one sample per problem (OpenAI)', w / 2, Y(50), w - 10 * u, { font: 'ui', size: 3.6, color: s.c('--ink-3') });
        });
        s.alpha(s.ease('r1', 0.6), () => card(s, 6 * u, Y(62), w - 12 * u, 22 * u, 'green', 'DeepSeek-R1, January 2025', 'GRPO with rule-based rewards', { on: 0.5, size: 4.4 }));
      });
  },
};

// ---------------------------------------------------------------- budgets

function strip(s: Scene, x: number, y: number, n: number, cw: number, kOf: (i: number) => K, a = 1): void {
  for (let i = 0; i < n; i++) {
    const k = kOf(i);
    s.alpha(a, () => s.rrect(x + i * cw + 0.25 * s.u, y, cw - 0.5 * s.u, 6 * s.u, 0.6, { fill: s.tint(k, k === '--ink-3' ? 0.3 : 0.6) }));
  }
}

const budget: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    const N = 22;
    const cw = (w - 30 * u) / N;
    const x0 = 6 * u;
    s.alpha(s.win('knob', 's1'), () => {
      const capI = 14;
      s.text('thinking tokens', x0, Y(14), { font: 'ui', size: 3.8, align: 'left', color: s.c('--ink-3') });
      strip(s, x0, Y(18), capI, cw, () => 'purple');
      s.line(x0 + capI * cw, Y(15), x0 + capI * cw, Y(27), s.c('slate'), 0.5, [0.8, 0.6]);
      s.text('cap T', x0 + capI * cw + u, Y(31), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('slate') });
      chip(s, x0 + capI * cw + 2 * u, Y(18), 12 * u, 6 * u, 'a', 'green', { on: 0.7, size: 3.6 });
      s.alpha(s.ease('low', 0.5), () => {
        s.text('too low', x0, Y(46), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('red') });
        strip(s, x0, Y(50), 6, cw, () => 'purple');
        badge(s, x0 + 6 * cw + 4 * u, Y(53), 2.6 * u, false);
        s.text('cut off before an answer', x0 + 6 * cw + 9 * u, Y(53.5), { font: 'ui', size: 3.8, align: 'left', color: s.c('--ink-2') });
        s.alpha(s.ease('low', 0.5, 1.8), () => {
          s.text('too high', x0, Y(68), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('slate') });
          strip(s, x0, Y(72), N, cw, (i) => (i < 9 ? 'purple' : '--ink-3'));
          fitText(s, 'tokens that add nothing', x0 + 15 * cw, Y(84), w - x0 - 15 * cw - 4 * u, { font: 'ui', size: 3.8, color: s.c('--ink-3') });
        });
      });
    });
    s.alpha(s.win('s1', 'toy'), () => {
      pill(s, 's1: 1,000 traces, then budget forcing', w / 2, Y(10), 'gold', { size: 4, maxW: w - 10 * u });
      s.alpha(s.win('s1', 'cut'), () => {
        for (let i = 0; i < 5; i++) s.rrect(w / 2 - 25 * u + i * 2 * u, Y(30 + i * 3), 46 * u, 7 * u, 1, { fill: s.tint('purple', 0.15 + 0.1 * i), stroke: s.tint('purple', 0.5), lw: 0.2 });
        s.text('1,000 questions with reasoning traces', w / 2, Y(58), { font: 'ui', size: 3.8, color: s.c('--ink-2') });
        s.text('fine-tune a 32B model on them', w / 2, Y(66), { font: 'ui', size: 3.8, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('cut', 0.5), () => {
        s.text('cut it short', x0, Y(26), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('slate') });
        strip(s, x0, Y(30), 10, cw, () => 'purple');
        chip(s, x0 + 10 * cw + u, Y(30), 18 * u, 6 * u, '</think>', 'slate', { on: 0.6, size: 3.4 });
        chip(s, x0 + 10 * cw + 20 * u, Y(30), 9 * u, 6 * u, 'a', 'green', { on: 0.7, size: 3.4 });
      });
      s.alpha(s.ease('wait', 0.5), () => {
        s.text('extend it', x0, Y(50), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('gold') });
        strip(s, x0, Y(54), 8, cw, () => 'purple');
        chip(s, x0 + 8 * cw + u, Y(54), 12 * u, 6 * u, 'Wait', 'gold', { on: 0.8, size: 3.6 });
        strip(s, x0 + 8 * cw + 14 * u, Y(54), Math.min(8, Math.floor((w - x0 - 8 * cw - 20 * u) / cw)), cw, () => 'purple', s.ease('wait', 0.6, 1.2));
      });
      s.alpha(s.ease('rose', 0.5), () => fitText(s, 'accuracy rose with the budget, then flattened', w / 2, Y(76), w - 10 * u, { font: 'ui', size: 4.2, italic: true, color: s.c('--ink-2') }));
    });
    const cA = s.win('toy', 'real');
    if (cA > 0)
      s.alpha(cA, () => {
        const F = new Frame(s, 14 * u, Y(14), w - 22 * u, 60 * u, [0, BUDGET_T, 0, 1]);
        F.axes([0, 8, 16, 24, 32, 40, 48].map((v) => [v, String(v)]), [[0, '0%'], [0.5, '50%'], [1, '100%']], 'thinking budget T (tokens)');
        const xs = Array.from({ length: BUDGET_T + 1 }, (_, i) => i);
        const brk = s.ease('drift', 0.8);
        const mix = (a: Float64Array, b: Float64Array) => xs.map((i) => lerp(a[i]!, b[i]!, brk));
        F.path(xs, mix(HARD, HARD_BRK), s.c('purple'), 0.8, s.prog('toy') * 1.3);
        F.path(xs, mix(EASY, EASY_BRK), s.c('green'), 0.8, s.since('easy') >= 0 ? s.prog('easy') * 1.5 : 0);
        s.alpha(s.ease('toy', 0.5, 1.5), () => {
          F.path([12, 12], [0, 1], s.tint('purple', 0.5), 0.3, 1, [0.8, 0.8]);
          s.text('hard: 12 steps', F.X(13), F.Y(0.3), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('purple'), halo: true });
        });
        s.alpha(s.ease('easy', 0.5, 1), () => s.text('easy: 2 steps', F.X(4), F.Y(0.6), { font: 'ui', size: 3.8, weight: 650, align: 'left', color: s.c('green'), halo: true }));
        s.alpha(s.ease('easy', 0.5, 2), () => {
          s.rrect(F.X(3), F.y, F.X(48) - F.X(3), F.h, 0.5, { fill: s.tint('slate', 0.06) });
          s.text('overthinking (easy)', F.X(47), F.Y(0.12), { font: 'ui', size: 3.6, align: 'right', color: s.c('slate'), halo: true });
        });
        s.alpha(brk, () => pill(s, 're-checks break a right answer 8% of the time', w / 2, Y(93), 'red', { size: 3.6, maxW: w - 10 * u }));
      });
    s.alpha(s.ease('real', 0.6), () => {
      s.text('what is 2 + 3?', w / 2, Y(12), { font: 'mono', size: 5, weight: 650, color: s.c('orange') });
      const n = 60;
      const per = 20;
      const cw2 = (w - 12 * u) / per;
      for (let i = 0; i < n; i++)
        s.alpha(clamp01(s.prog('real') * 2.2 - i / n), () => {
          const x = 6 * u + (i % per) * cw2;
          const y = Y(24 + Math.floor(i / per) * 8);
          const ans = i % 17 === 5;
          s.rrect(x + 0.25 * u, y, cw2 - 0.5 * u, 6 * u, 0.6, { fill: s.tint(ans ? 'green' : 'purple', 0.5) });
          if (ans) s.text('5', x + cw2 / 2, y + 3.2 * u, { font: 'mono', size: 3.6, weight: 700 });
        });
      fitText(s, 'hundreds of tokens, the answer 5 found again and again', w / 2, Y(56), w - 10 * u, { font: 'ui', size: 4, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('train', 0.6), () => pill(s, 'reward = right − a small charge per token', w / 2, Y(74), 'gold', { size: 4, maxW: w - 10 * u }));
    });
  },
};

// ---------------------------------------------------------------- distillation

const distill: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    const tx = 5 * u;
    const tw = 26 * u;
    const sw = 22 * u;
    const sx = w - 5 * u - sw;
    const trx = tx + tw + 6 * u;
    const trw = sx - 12 * u - trx;
    s.alpha(s.ease('cheap', 0.5), () => {
      card(s, tx, Y(12), tw, 26 * u, 'blue', 'teacher', 'large, RL-trained', { on: 0.5, size: 4.4 });
      s.alpha(s.ease('cheap', 0.5, 1.5), () => card(s, sx, Y(16), sw, 18 * u, 'green', 'student', 'small', { on: 0.5, size: 4 }));
    });
    const oks = [true, true, false, true];
    s.alpha(s.ease('teacher', 0.5), () => {
      s.arrow(tx + tw + u, Y(25), trx - u, Y(25), s.c('--ink-3'), 0.35, 1.8);
      oks.forEach((ok, i) => {
        const y = Y(10 + i * 8.5);
        s.alpha(s.ease('teacher', 0.4, 0.4 + 0.4 * i), () => {
          s.rrect(trx, y, trw * 0.72, 6 * u, 1, { fill: s.tint('purple', 0.4) });
          s.rrect(trx + trw * 0.74, y, trw * 0.14, 6 * u, 1, { fill: s.tint(ok ? 'green' : 'red', 0.5) });
          s.alpha(s.ease('filter', 0.4, 0.3 * i), () => badge(s, trx + trw * 0.96, y + 3 * u, 2.3 * u, ok));
        });
      });
      s.text('z + a', trx + trw * 0.36, Y(46), { font: 'mono', size: 3.8, color: s.c('purple') });
    });
    s.alpha(s.ease('student', 0.5), () => {
      s.arrow(trx + trw + 2 * u, Y(25), sx - u, Y(25), s.c('--ink-3'), 0.35, 1.8);
      fitText(s, 'next-token prediction on the teacher\'s text', w / 2, Y(55), w - 10 * u, { font: 'ui', size: 4, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('r1d', 'star'), () => {
      pill(s, 'R1 → 1.5B to 70B, ~800k samples', w / 2, Y(68), 'blue', { size: 4, maxW: w - 10 * u });
      s.alpha(s.ease('beat', 0.5), () => pill(s, 'distilled 32B beat the same base trained with RL', w / 2, Y(79), 'green', { size: 3.8, maxW: w - 10 * u }));
      s.alpha(s.ease('few', 0.5), () => pill(s, 's1: 1,000 traces    LIMO: 817', w / 2, Y(90), 'gold', { size: 4, maxW: w - 10 * u }));
    });
    s.alpha(s.win('star', 'limits'), () => {
      const cx = w / 2;
      const dx = Math.min(34 * u, w / 2 - 22 * u);
      const nodes: [string, number, number][] = [
        ['write rationales', cx, Y(64)],
        ['keep right ones', cx + dx, Y(88)],
        ['fine-tune', cx - dx, Y(88)],
      ];
      const hw = (t: string) => (s.measure(t, { font: 'ui', size: 3.8, weight: 600 }) + 3.8 * 0.95 * u) / 2;
      const k = s.tint('teal', 0.75);
      s.arrow(cx + 8 * u, Y(67), cx + dx - 4 * u, Y(84), k, 0.35, 1.6);
      s.arrow(cx + dx - hw(nodes[1]![0]) - u, Y(88), cx - dx + hw(nodes[2]![0]) + u, Y(88), k, 0.35, 1.6);
      s.arrow(cx - dx + 4 * u, Y(84), cx - 8 * u, Y(67), k, 0.35, 1.6);
      nodes.forEach(([t, x, y]) => pill(s, t, x, y, 'teal', { size: 3.8 }));
      s.text('STaR, 2022', cx, Y(78), { font: 'ui', size: 3.6, weight: 650, color: s.c('--ink-3') });
    });
    s.alpha(s.ease('limits', 0.6), () => {
      ['bounded by its teacher', 'copies its verbosity', 'does not learn to explore'].forEach((t, i) => s.alpha(s.ease('limits', 0.4, 0.6 + 0.6 * i), () => pill(s, t, w / 2, Y(68 + i * 11), 'red', { size: 4, maxW: w - 10 * u })));
    });
  },
};

// ---------------------------------------------------------------- outro

const RECAP: [string, string, string, K][] = [
  ['long', 'longer', 'tokens buy serial depth', 'blue'],
  ['vote', 'voting', 'finds the plurality', 'green'],
  ['verify', 'pass@k and verifiers', 'pick it out, gently', 'teal'],
  ['prm', 'process rewards', 'grade every step', 'purple'],
  ['rl', 'reasoning models', 'RL, one long chain', 'gold'],
  ['distill', 'distillation', 'fine-tune on traces', 'slate'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const Y = rows(s);
    const gap = 3 * u;
    const tw = (w - 12 * u - gap) / 2;
    const th = 16 * u;
    RECAP.forEach(([beat, title, sub, k], i) => {
      const a = s.ease(beat, 0.5);
      if (a <= 0) return;
      const x = 6 * u + (i % 2) * (tw + gap);
      const y = Y(5) + Math.floor(i / 2) * (th + gap);
      const on = s.win(beat, i < RECAP.length - 1 ? RECAP[i + 1]![0] : 'close');
      s.alpha(a * (1 - 0.4 * s.ease('close', 0.6)), () => card(s, x, y, tw, th, k, title, sub, { on, size: 4.4 }));
    });
    s.alpha(s.ease('close', 0.6), () => {
      const y = Y(68);
      s.rrect(6 * u, y, w - 12 * u, 26 * u, 2.5, { fill: s.tint('purple', 0.08), stroke: s.c('purple'), lw: 0.4 });
      fitText(s, 'same weights, more thinking', w / 2, y + 8.5 * u, w - 18 * u, { font: 'display', size: 6, weight: 600, color: s.c('purple') });
      fitText(s, 'it pays when something can tell good answers from bad', w / 2, y + 18 * u, w - 18 * u, { font: 'ui', size: 4, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  serial,
  cot,
  vote,
  votemath,
  coverage: coverageScene,
  bon,
  prm,
  search,
  models,
  budget,
  distill,
  outro,
};
