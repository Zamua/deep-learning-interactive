import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel, verdict } from '../../draw';
import { after } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, block, brace, curve, fmt, frame, rich, type Ink } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** One line of plain text across the stage, centered. */
function caption(s: Scene, text: string, y: number, k: Ink, a: number, size = 3.2, italic = false) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, italic, color: s.c(k), halo: true }));
}

// ---- scene 1: the reward route, two trainings and a sampling loop, and the shortcut around them

const STEPS: [string, Ink][] = [
  ['preference pairs', 'gold'],
  ['reward model', 'slate'],
  ['sample · score · step', 'slate'],
  ['trained model', 'purple'],
];

/** A small circular arrow: a loop that keeps going round. */
function cycle(s: Scene, x: number, y: number, r: number, k: Ink) {
  const c = s.ctx;
  c.beginPath();
  c.arc(x, y, r, -0.3 * Math.PI, 1.35 * Math.PI);
  c.strokeStyle = s.c(k);
  c.lineWidth = 0.45 * s.u;
  c.stroke();
  const a = -0.3 * Math.PI;
  const [hx, hy] = [x + r * Math.cos(a), y + r * Math.sin(a)];
  s.arrow(hx - 0.8 * s.u, hy - 1.2 * s.u, hx + 0.2 * s.u, hy + 0.3 * s.u, s.c(k), 0.45, 1.6);
}

const route: SceneDef = {
  draw(s) {
    const ys = [0.16, 0.32, 0.48, 0.64].map((f) => s.h * f);
    const x = s.w / 2 - 6 * s.u;
    const bw = 48 * s.u;
    const skip = s.ease('dpo', 0.8, 0.6);
    const on = [s.win('rm', 'loop'), s.win('rm', 'loop') + s.win('cost', 'dpo'), s.win('loop', 'dpo'), 0];
    STEPS.forEach(([t, k], i) => {
      const mid = i === 1 || i === 2;
      const a = s.ease('rm', 0.5, i === 0 ? 0 : i === 1 ? 0.8 : 1.6) * (mid ? 1 - 0.6 * skip : 1);
      s.alpha(i === 3 ? s.ease('rm', 0.5, 2.4) : a, () => {
        block(s, x, ys[i]!, bw, 8 * s.u, '', k, { on: Math.min(1, on[i]!) });
        s.text(t, x, ys[i]!, { size: 3.1, font: 'mono', weight: 600, color: s.c(mid ? '--ink-2' : '--ink') });
        if (i < 3) s.arrow(x, ys[i]! + 4.3 * s.u, x, ys[i + 1]! - 4.3 * s.u, s.c('--ink-3'), 0.35, 1.8);
      });
      if (mid) s.alpha(skip, () => s.line(x - 25 * s.u, ys[i]!, x + 25 * s.u, ys[i]!, s.c('red'), 0.5));
    });
    // The loop goes round and round: sample, score, step, sample again.
    s.alpha(s.ease('loop', 0.6, 0.4) * (1 - 0.6 * skip), () => cycle(s, x - bw / 2 - 5 * s.u, ys[2]!, 2.6 * s.u, 'slate'));
    // The shortcut, around the right of the stack.
    s.alpha(skip, () => {
      const xr = x + bw / 2 + 6 * s.u;
      s.line(x + bw / 2, ys[0]!, xr, ys[0]!, s.c('green'), 0.5);
      s.line(xr, ys[0]!, xr, ys[3]!, s.c('green'), 0.5);
      s.arrow(xr, ys[3]!, x + bw / 2 + 0.5 * s.u, ys[3]!, s.c('green'), 0.5, 2);
      s.text('DPO', xr + 2 * s.u, (ys[0]! + ys[3]!) / 2, { size: 3.6, font: 'mono', weight: 700, align: 'left', color: s.c('green') });
    });
    const cy = s.h * 0.8;
    caption(s, 'fit a reward model, then a sampling loop', cy, '--ink-2', s.win('loop', 'cost'));
    caption(s, 'two models to train, and a loop', cy, 'red', s.win('cost', 'dpo'));
    caption(s, 'direct preference optimization', cy, 'green', s.win('dpo', 'title'), 3.6);
    s.alpha(s.ease('title', 0.6), () => {
      s.text('Direct Preference Optimization:', s.w / 2, cy, { size: 3.2, italic: true, color: s.c('--ink-2') });
      s.text('Your Language Model is Secretly a Reward Model', s.w / 2, cy + 5 * s.u, { size: 3.2, italic: true, color: s.c('--ink') });
    });
    cite(s, 'Rafailov, Sharma, Mitchell et al., 2023', s.ease('dpo', 0.6, 1));
  },
};

// ---- scene 2: train on reward minus charge, and the charges come out as the rewards plus one shared number

const RW = [2, 1];
const PSTAR = Math.exp(RW[0]!) / (Math.exp(RW[0]!) + Math.exp(RW[1]!));

/** The model's probabilities at time t: even, then shifting toward the first answer until reward minus charge is level. */
const probs = (s: Scene): number[] => {
  const p = lerp(0.5, PSTAR, s.ease('shift', 3.2, 0.6));
  return [p, 1 - p];
};
const charge = (p: number) => Math.log(p / 0.5);
const code2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2).replace(/^(-?)0\./, '$1.'));

const settle: SceneDef = {
  marks: {
    f: { tex: String.raw`\hat r(y) = \sym{beta}{\beta} \ln\frac{\sym{pi}{\pi}(y)}{\sym{piref}{\pi_{\text{ref}}}(y)}`, x: 0.5, y: 0.88, size: 4.4 },
  },
  draw(s) {
    const xs = columns(s, 2, 36);
    const p = probs(s);
    const ch = p.map(charge);
    const net = RW.map((r, i) => r - ch[i]!);
    s.slot('p', p.map(code2).join(', '));
    s.slot('ch', ch.map(code2).join(', '));
    s.slot('net', net.map(code2).join(', '));
    // The charge itself, before the two answers arrive.
    s.alpha(s.ease('charge', 0.6, 0.4) * (1 - s.ease('two', 0.5)), () => {
      rich(s, [['charge = ', 'red'], ['β', 'slate'], [' · (ln ', '--ink-2'], ['π', 'teal'], [' − ln ', '--ink-2'], ['π_ref', 'slate'], [')', '--ink-2']], s.w / 2, s.h * 0.36, { size: 4.2, weight: 600 });
      s.text('added up over the answer\'s tokens', s.w / 2, s.h * 0.45, { size: 3, color: s.c('--ink-3') });
      s.alpha(after(s, 'charge', 0.6), () => s.text('favor an answer more: pay more', s.w / 2, s.h * 0.58, { size: 3.2, color: s.c('red') }));
    });
    const show = s.ease('two', 0.6);
    // Each answer's probability: the reference's (dashed) beside the model's.
    const base = s.h * 0.4;
    const H = 28;
    s.alpha(show, () => {
      xs.forEach((x, i) => {
        s.text(`answer ${i + 1}`, x, s.h * 0.07, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
        s.line(x - 11 * s.u, base, x + 11 * s.u, base, s.c('--axis'), 0.35);
        const bar = (dx: number, v: number, k: Ink, dash: boolean, lit: number) => {
          const h = v * H * s.u;
          const bx = x + dx * s.u - 3.5 * s.u;
          if (dash) block(s, bx + 3.5 * s.u, base - h / 2, 7 * s.u, h, '', k, { dash: true });
          else s.rrect(bx, base - h, 7 * s.u, h, 0.8, { fill: s.tint(k, 0.35 + 0.25 * lit), stroke: s.tint(k, 0.7 + 0.3 * lit), lw: 0.3 });
          s.text(v.toFixed(2), bx + 3.5 * s.u, base - h - 2.8 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
        };
        bar(-4.5, 0.5, 'slate', true, 0);
        bar(4.5, p[i]!, 'teal', false, s.win('nums', 'net'));
        s.text('π_ref', x - 4.5 * s.u, base + 3 * s.u, { size: 2.6, font: 'mono', color: s.c('slate') });
        s.text('π', x + 4.5 * s.u, base + 3 * s.u, { size: 2.8, font: 'mono', color: s.c('teal') });
      });
    });
    // Reward, charge and what is left, one column per answer.
    const lx = xs[0]! - 9 * s.u;
    const rows: [string, Ink, number, string[], number[]][] = [
      ['r', 'gold', s.h * 0.53, RW.map(String), [0, 0]],
      ['charge', 'red', s.h * 0.63, ch.map((v) => fmt(v)), [s.win('nums', 'net'), s.win('nums', 'net')].map((v) => v + s.win('gap', 'secret'))],
      ['r − charge', 'green', s.h * 0.73, net.map((v) => fmt(v)), [s.win('level', 'nums') + s.win('net', 'net2'), s.win('level', 'nums') + s.win('net2', 'flip')]],
    ];
    rows.forEach(([name, k, y, labels, lit], j) => {
      s.alpha(j === 0 ? show : s.ease('two', 0.6, 0.8 + 0.5 * j), () => {
        rowLabel(s, name, lx, y, k, 3);
        cells(s, xs, y, labels, k, { w: 16, h: 7, size: 3.2, on: lit.map((v) => Math.min(1, v)) });
      });
    });
    const cy = s.h * 0.85;
    caption(s, 'charge = β · log-ratio, here with β = 1', cy, 'red', after(s, 'two', 0.5) * (1 - s.ease('shift', 0.5)), 3);
    caption(s, 'more probability: a bigger charge', cy, '--ink-2', s.win('shift', 'level'), 3);
    caption(s, 'stops when r − charge is level', cy, 'green', s.win('level', 'flip'), 3);
    caption(s, 'r = charge + one shared number', cy, '--ink-2', s.win('flip', 'gap'), 3);
    caption(s, 'charges 1 apart, as the rewards are', cy, 'red', s.win('gap', 'secret'), 3);
    caption(s, 'β · log-ratio: the reward, as far as picks can tell', cy, '--ink-2', s.win('secret', 'rhat'), 3);
    s.show('f', s.ease('rhat', 0.6));
  },
};

// ---- scenes 3 and 4: one pair, on two number lines of log-probability, and the loss on its margin

const BETA = 0.1;
/** Log-probabilities: the reference's, fixed, and the model's before and after training lowers the loss. */
const W = { ref: -15, from: -12, to: -10.5 };
const Lr = { ref: -14, from: -15, to: -16.5 };

/** A number line from −20 to −5 for one answer: the reference's dot, the model's dot, and the gap between them. */
function track(s: Scene, y: number, name: string, k: Ink, ref: number, lp: number, o: { a: number; lit?: number; frozen?: number }) {
  const F = frame(s.w / 2 - 33 * s.u, y, s.w / 2 + 33 * s.u, y, [-20, -5], [0, 1]);
  s.alpha(o.a, () => {
    s.line(F.l, y, F.r, y, s.c('--axis'), 0.35);
    s.text(name, F.l - 3 * s.u, y, { size: 3.6, font: 'mono', weight: 700, align: 'right', color: s.c(k) });
    s.text('−20', F.l, y + 3.2 * s.u, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
    s.text('−5', F.r, y + 3.2 * s.u, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
    const right = lp > ref;
    ball(s, F.X(ref), y, 'slate', 1.5);
    ball(s, F.X(lp), y, 'teal', 1.5);
    const lab = { size: 2.8, font: 'mono', weight: 600, halo: true } as const;
    s.text(`π_ref ${fmt(ref, 0)}`, F.X(ref) + (right ? -1 : 1) * s.u, y - 3.6 * s.u, { ...lab, align: right ? 'right' : 'left', color: s.c('slate') });
    s.text(`π ${fmt(lp, lp % 1 ? 1 : 0)}`, F.X(lp) + (right ? 1 : -1) * s.u, y - 3.6 * s.u, { ...lab, align: right ? 'left' : 'right', color: s.c('teal') });
    s.alpha(o.frozen ?? 0, () => s.circle(F.X(ref), y, 2.3 * s.u, { stroke: s.c('slate'), lw: 0.35 }));
    const [a, b] = right ? [F.X(ref), F.X(lp)] : [F.X(lp), F.X(ref)];
    const g = lp - ref;
    brace(s, 'bottom', a, b, y + 5.5 * s.u, `log-ratio ${fmt(g, g % 1 ? 1 : 0)}`, 'orange', 2.8);
  });
}

/** The loss against the margin, with balls at the given margins, each with its own opacity. */
function lossPlot(s: Scene, a: number, at: [number, Ink, string, number][]) {
  const F = frame(s.w / 2 - 30 * s.u, s.h * 0.62, s.w / 2 + 30 * s.u, s.h * 0.9, [-3, 3], [0, 3.2]);
  s.alpha(a, () => {
    axes(s, F, 'margin', 'loss', { x: 'orange', y: 'red' });
    curve(s, F, nls, -3, 3, 'red');
    for (const [m, k, label, b] of at) {
      s.alpha(b, () => {
        ball(s, F.X(m), F.Y(nls(m)), k, 1.5);
        if (label) s.text(label, F.X(m) + 2.5 * s.u, F.Y(nls(m)) - 4 * s.u, { size: 2.9, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
      });
    }
  });
}

const margin = (w: number, l: number) => BETA * (w - W.ref - (l - Lr.ref));

const pairs: SceneDef = {
  marks: {
    rh: { tex: String.raw`\hat r(y) = \sym{beta}{\beta} \ln\frac{\sym{pi}{\pi}(y)}{\sym{piref}{\pi_{\text{ref}}}(y)}`, x: 0.5, y: 0.3, size: 5 },
    L: { tex: String.raw`\symL = -\ln\sigma\big(\hat r(\sym{yw}{y_w}) - \hat r(\sym{yl}{y_l})\big)`, x: 0.5, y: 0.47, size: 4 },
  },
  draw(s) {
    const y1 = s.h * 0.12;
    const y2 = s.h * 0.3;
    s.show('rh', s.win('back', 'lp'));
    caption(s, 'train π until r̂ predicts the labelers\' picks', s.h * 0.45, '--ink-2', after(s, 'back', 0.4) * (1 - s.ease('lp', 0.5)), 3.2);
    track(s, y1, 'y_w', 'green', W.ref, W.from, { a: s.ease('lp', 0.6, 2) });
    track(s, y2, 'y_l', 'red', Lr.ref, Lr.from, { a: s.ease('pair', 0.6, 2) });
    s.alpha(after(s, 'imp', 0.25) * (1 - s.ease('pair', 0.5)), () => rich(s, [['r̂ = 0.1 × (−12 − (−15)) = 0.1 × 3 = ', '--ink-2'], ['0.3', 'orange']], s.w / 2, s.h * 0.29, { size: 3.1, weight: 600 }));
    s.show('L', s.ease('loss', 0.6));
    s.alpha(s.ease('m', 0.6, 0.6), () => rich(s, [['margin = 0.1 × (3 − (−1)) = ', '--ink-2'], ['0.4', 'orange']], s.w / 2, s.h * 0.55, { size: 3.2, weight: 600 }));
    const M = margin(W.from, Lr.from);
    lossPlot(s, s.ease('loss', 0.6, 1), [[M, 'red', '', after(s, 'm', 0.6)], [M, 'red', `σ ≈ ${sig(M).toFixed(2)}, loss ≈ ${nls(M).toFixed(2)}`, after(s, 'val', 0.3)]]);
  },
};

const moves: SceneDef = {
  draw(s) {
    const y1 = s.h * 0.12;
    const y2 = s.h * 0.3;
    const go = s.ease('step', 3, 0.8);
    const w = lerp(W.from, W.to, go);
    const l = lerp(Lr.from, Lr.to, go);
    const out = 1 - s.ease('needs', 0.6);
    const frozen = s.win('ref', 'wrong');
    track(s, y1, 'y_w', 'green', W.ref, w, { a: out, frozen });
    track(s, y2, 'y_l', 'red', Lr.ref, l, { a: out, frozen });
    const M = margin(w, l);
    s.alpha(out, () => rich(s, [[`margin = 0.1 × (${fmt(w - W.ref, 1)} − (${fmt(l - Lr.ref, 1)})) = `, '--ink-2'], [fmt(M, 2), 'orange']], s.w / 2, s.h * 0.47, { size: 3.2, weight: 600 }));
    const wrong = s.win('wrong', 'needs');
    lossPlot(s, out, [[M, 'red', `loss ≈ ${nls(M).toFixed(2)}`, 1], [-1.5, 'purple', 'ranked wrong: steep', wrong]]);
    caption(s, 'chosen: more likely · rejected: less', s.h * 0.555, 'teal', after(s, 'step', 0.3) * (1 - s.ease('ref', 0.5)), 3);
    caption(s, 'the reference is frozen: it never moves', s.h * 0.555, 'slate', frozen, 3);
    caption(s, 'steeper slope: a bigger push', s.h * 0.555, 'purple', wrong, 3);
    // What DPO needs, and what it does not.
    s.alpha(s.ease('needs', 0.6, 0.3), () => {
      const x = s.w / 2 - 24 * s.u;
      const items: [boolean, string][] = [
        [true, 'preference pairs'],
        [true, 'the model being trained'],
        [true, 'a frozen reference'],
        [false, 'a reward model'],
        [false, 'sampling'],
      ];
      items.forEach(([ok, t], i) => verdict(s, ok, t, x, s.h * (0.24 + i * 0.12), 3.6));
    });
  },
};

export const scenes: Record<string, SceneDef> = { route, settle, pairs, moves };
