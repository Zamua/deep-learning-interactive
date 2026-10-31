import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { fmt } from '../../sequences/draw';
import { chain } from '../linear-recurrence/chain';

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) => s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const Y = (s: Scene, f: number) => f * s.h;
const a2 = (v: number) => v.toFixed(2).replace(/0$/, '');

/** x centers for `n` items `pitch` stage units apart, centered on the stage. */
const spread = (s: Scene, n: number, pitch: number) => Array.from({ length: n }, (_, i) => s.w / 2 + (i - (n - 1) / 2) * pitch * s.u);

// ---- the sentence: two sentences, a full stop between them

const TOKS = ['Ada', 'sang', '.', 'Bo', 'ran'];
const A_FIX = 0.6;
/** Each token's own decay: words keep, the full stop clears. */
const A_SEL = [0.9, 0.9, 0.05, 0.9, 0.9];
/** A token's weight in the last state: the product of the decays of every token after it. */
const weights = (as: number[]) => as.map((_, i) => as.slice(i + 1).reduce((p, a) => p * a, 1));
const W_FIX = weights(TOKS.map(() => A_FIX));
const W_SEL = weights(A_SEL);

/** The tokens as chips, a decay cell under each, and a bar of each token's weight above. */
function sentence(s: Scene, o: { base: number; ws: number[]; as: string[]; asOn?: number; asA?: number; ink: (i: number) => Ink; barA?: number }) {
  const pitch = s.tall ? 17 : 19;
  const xs = spread(s, TOKS.length, pitch);
  const unit = 26 * s.u;
  const bw = 9 * s.u;
  s.alpha(o.barA ?? 1, () => {
    s.line(xs[0]! - bw, o.base, xs[xs.length - 1]! + bw, o.base, s.c('--axis'), 0.35);
    xs.forEach((x, i) => {
      const hh = Math.max(0.5 * s.u, o.ws[i]! * unit);
      const k = o.ink(i);
      s.rrect(x - bw / 2, o.base - hh, bw, hh, 0.8, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
      mono(s, a2(o.ws[i]!), x, o.base - hh - 2.8 * s.u, k, 3);
    });
  });
  xs.forEach((x, i) => s.cell(x - 5 * s.u, o.base + 3 * s.u, 10 * s.u, 6.5 * s.u, TOKS[i]!, 'orange', { size: 3.1 }));
  s.alpha(o.asA ?? 1, () => {
    mono(s, 'a', xs[0]! - 7.5 * s.u, o.base + 15.5 * s.u, 'teal', 3.4, 'right');
    xs.forEach((x, i) => s.cell(x - 5 * s.u, o.base + 12.25 * s.u, 10 * s.u, 6.5 * s.u, o.as[i]!, 'teal', { size: 3.1, on: o.asOn ?? 0 }));
  });
  return xs;
}

// ---- scene 1: one fixed decay fades every token alike

const same: SceneDef = {
  marks: {
    rec: { tex: String.raw`\symh_t = \syma\,\symh_{t-1} + \symb\,\symx_t`, x: 0.5, y: 0.08, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    s.show('rec', s.ease('recall', 0.6));
    // Input, state, output: what makes it a state space model.
    const diag = s.ease('recall', 0.6, 0.6) * (1 - s.ease('fixed', 0.5));
    s.alpha(diag, () => {
      const y = Y(s, 0.27);
      const gap = (s.tall ? 24 : 28) * u;
      const [xx, xh, xy] = [s.w / 2 - gap, s.w / 2, s.w / 2 + gap];
      s.cell(xx - 5 * u, y - 3.5 * u, 10 * u, 7 * u, 'x', 'orange', { size: 3.4 });
      s.arrow(xx + 5.6 * u, y, xh - 6.2 * u, y, s.c('--ink-3'), 0.35, 1.8);
      s.circle(xh, y, 5.6 * u, { fill: s.tint('gold', 0.2), stroke: s.c('gold'), lw: 0.4 });
      mono(s, 'h', xh, y + 0.2 * u, 'gold', 3.6);
      // The state feeds itself, faded by a.
      const c = s.ctx;
      c.save();
      c.strokeStyle = s.c('teal');
      c.lineWidth = 0.4 * u;
      c.beginPath();
      c.arc(xh, y - 7.6 * u, 3.2 * u, Math.PI * 0.85, Math.PI * 2.15);
      c.stroke();
      c.restore();
      mono(s, '×a', xh + 5 * u, y - 10 * u, 'teal', 3, 'left');
      const named = s.ease('name', 0.6);
      s.alpha(named, () => {
        s.arrow(xh + 6.2 * u, y, xy - 5.6 * u, y, s.c('--ink-3'), 0.35, 1.8);
        s.cell(xy - 5 * u, y - 3.5 * u, 10 * u, 7 * u, 'y', 'purple', { size: 3.4 });
        mono(s, 'input', xx, y + 7.5 * u, '--ink-3', 2.9, 'center', 500);
        mono(s, 'state', xh, y + 9 * u, '--ink-3', 2.9, 'center', 500);
        mono(s, 'output', xy, y + 7.5 * u, '--ink-3', 2.9, 'center', 500);
      });
      s.alpha(after(s, 'name', 0.45), () => mono(s, 'a state space model', s.w / 2, y + 16 * u, 'gold', 3.6, 'center', 650));
    });

    // The sentence: weights by age with one a, then weights set by each token's own a.
    const base = Y(s, 0.66);
    const morph = after(s, 'want', 0.45, 1.2);
    const ws = W_FIX.map((w, i) => lerp(w, W_SEL[i]!, morph));
    const asText = TOKS.map((_, i) => (morph > 0.5 ? a2(A_SEL[i]!) : String(A_FIX)));
    s.alpha(s.ease('fixed', 0.6, 0.3), () => {
      sentence(s, {
        base,
        ws,
        as: asText,
        asOn: s.win('fixed', 'want') * 0.4 + (morph > 0.5 ? 0.5 : 0),
        ink: (i) => (morph > 0.5 ? (i < 2 ? 'red' : 'gold') : 'gold'),
        barA: s.ease('fixed', 0.8, 0.8),
      });
    });
    const cy = Y(s, 0.25);
    s.alpha(s.win('fixed', 'want') * after(s, 'fixed', 0.35), () => mono(s, 'one a for all: weight = 0.6^age', s.w / 2, cy, 'teal', 3.4));
    s.alpha(s.ease('want', 0.5) * (1 - morph), () => mono(s, 'the full stop could clear what came before', s.w / 2, cy, 'red', 3.2, 'center', 500));
    s.alpha(morph, () => {
      mono(s, 'each token sets its own a', s.w / 2, cy, 'teal', 3.4);
      mono(s, 'old sentence cleared, new one held', s.w / 2, cy + 6 * u, '--ink-2', 3, 'center', 500);
    });
  },
};

// ---- scene 2: Δ, the time a token takes, and a = e^(-Δ)

const step: SceneDef = {
  marks: {
    sel: { tex: String.raw`a_t = e^{-\Delta_t}`, x: 0.5, y: 0.08, size: 5 },
  },
  draw(s) {
    const u = s.u;
    s.show('sel', s.ease('a', 0.6, 0.6));
    const x0 = 18 * u;
    const x1 = s.w - 10 * u;
    const top = Y(s, 0.2);
    const bot = Y(s, 0.58);
    const px = (t: number) => x0 + (t / 4) * (x1 - x0);
    const py = (a: number) => bot - a * (bot - top);
    const rows = s.ease('select', 0.6);
    // The plot steps back to make room for the tokens.
    s.alpha(1 - 0.5 * rows, () => {
      s.line(x0, bot, x1, bot, s.c('--axis'), 0.35);
      s.line(x0, bot, x0, top - 2 * u, s.c('--axis'), 0.35);
      s.alpha(1 - rows, () => {
        [0, 1, 2, 3, 4].forEach((t) => mono(s, String(t), px(t), bot + 3.2 * u, '--ink-3', 2.7, 'center', 500));
        mono(s, 'time →', x1, bot + 7.4 * u, '--ink-3', 2.9, 'right', 500);
      });
      mono(s, '1', x0 - 2 * u, py(1), '--ink-3', 2.7, 'right', 500);
      mono(s, '0', x0 - 2 * u, bot, '--ink-3', 2.7, 'right', 500);
      mono(s, 'state left', x0 + 2 * u, top - 1.5 * u, 'gold', 3, 'left');
      const grow = s.ease('drain', 2.2, 0.4);
      const n = 80;
      const k = Math.floor(n * grow);
      for (let i = 0; i < k; i++) s.line(px((i / n) * 4), py(Math.exp(-(i / n) * 4)), px(((i + 1) / n) * 4), py(Math.exp(-((i + 1) / n) * 4)), s.c('gold'), 0.5);
    });

    /** A step from 0 to `d` along the time axis, and where it lands on the curve. */
    const stepTo = (d: number, a: number, k: Ink, label: string, side: CanvasTextAlign, dy = -3.6) =>
      s.alpha(a * (1 - 0.5 * rows), () => {
        const yb = bot - 2.2 * u;
        s.rrect(px(0), yb - 1 * u, Math.max(0.6 * u, px(d) - px(0)), 2 * u, 0.6, { fill: s.tint('slate', 0.35), stroke: s.c('slate'), lw: 0.25 });
        s.line(px(d), yb, px(d), py(Math.exp(-d)), s.tint(k, 0.6), 0.3, [1, 1]);
        s.circle(px(d), py(Math.exp(-d)), 1.3 * u, { fill: s.c(k) });
        const dx = side === 'left' ? 2.6 : side === 'right' ? -2.6 : 0;
        mono(s, label, px(d) + dx * u, py(Math.exp(-d)) + dy * u, k, 3.1, side);
      });
    stepTo(1, s.win('drain', 'big') * after(s, 'drain', 0.55), 'gold', 'e⁻¹ ≈ 0.37', 'left');
    s.alpha(s.win('delta', 'big'), () => mono(s, 'Δ: the time this token takes', px(0), bot + 7.4 * u, 'slate', 2.9, 'left', 500));
    stepTo(3, s.win('big', 'small'), 'red', 'Δ = 3: 0.05, forget', 'center', -6);
    stepTo(0.1, s.win('small', 'range'), 'teal', 'Δ = 0.1: 0.9, keep', 'left', 1);
    s.alpha(s.win('range', 'select'), () => {
      s.rrect(px(0), py(1), px(4) - px(0), py(0) - py(1), 0, { fill: s.tint('teal', 0.07) });
      mono(s, 'Δ > 0, so 0 < a < 1: shrinks, never grows', s.w / 2, Y(s, 0.73), 'teal', 3.2);
      mono(s, 'and never exactly 0', s.w / 2, Y(s, 0.79), '--ink-3', 3, 'center', 500);
    });

    // Each token computes its own step, and so its own decay.
    s.alpha(rows, () => {
      const xs = spread(s, TOKS.length, s.tall ? 17 : 19);
      const ys = [Y(s, 0.7), Y(s, 0.8), Y(s, 0.9)];
      const lx = xs[0]! - 7.5 * u;
      mono(s, 'Δ', lx, ys[1]!, 'slate', 3.4, 'right');
      mono(s, 'a', lx, ys[2]!, 'teal', 3.4, 'right');
      xs.forEach((x, i) => {
        const d = i === 2 ? 3 : 0.1;
        const hot = i === 2 ? 1 : 0;
        s.cell(x - 5 * u, ys[0]! - 3.25 * u, 10 * u, 6.5 * u, TOKS[i]!, 'orange', { size: 3.1 });
        s.alpha(after(s, 'select', 0.15 + 0.06 * i), () => s.cell(x - 5 * u, ys[1]! - 3.25 * u, 10 * u, 6.5 * u, String(d), 'slate', { size: 3.1, on: hot * 0.6 }));
        s.alpha(after(s, 'select', 0.45 + 0.06 * i), () => s.cell(x - 5 * u, ys[2]! - 3.25 * u, 10 * u, 6.5 * u, a2(A_SEL[i]!), 'teal', { size: 3.1, on: hot * 0.6 }));
      });
      mono(s, 'each token picks its own step', s.w / 2, Y(s, 0.625), '--ink-2', 3.2, 'center', 500);
    });
    cite(s, 'Mamba · Gu & Dao, 2023', s.ease('mamba', 0.6));
  },
};

// ---- scene 3: the state through three steps

const XS = [4, 2, 6];
const DT = [1, 0.1, 3];
const AS = DT.map((d) => Math.round(Math.exp(-d) * 100) / 100);
const run = (as: number[], xs: number[]) => xs.reduce<number[]>((hs, x, t) => [...hs, Math.round((as[t]! * hs[t]! + x) * 1e6) / 1e6], [0]);
const HS = run(AS, XS);

const runScene: SceneDef = {
  marks: {
    rec: { tex: String.raw`\symh_t = a_t\,\symh_{t-1} + \symb\,\symx_t`, x: 0.5, y: 0.08, size: 4.8 },
  },
  draw(s) {
    s.show('rec', s.ease('set', 0.5));
    s.alpha(s.ease('h1', 0.5), () => mono(s, 'b = 1,  h₀ = 0', s.w / 2, Y(s, 0.19), '--ink-2', 3.4));
    const p3 = s.prog('h3');
    const filled = (i: number) => (i === 0 ? s.ease('h1', 0.4) : i === 1 ? after(s, 'h1', 0.7, 0.4) : i === 2 ? after(s, 'h2', 0.75, 0.4) : p3 > 0.75 ? 1 : 0);
    const now = (i: number) => (i === 1 ? s.win('h1', 'h2') : i === 2 ? s.win('h2', 'h3') : i === 3 ? s.ease('h3', 0.6) : 0);
    const g = chain(s, {
      y: Y(s, 0.45),
      n: 3,
      states: (i) => (filled(i) > 0.5 ? fmt(HS[i]!) : ''),
      inputs: XS.map(String),
      decay: (t) => `×${a2(AS[t - 1]!)}`,
      gain: '',
      show: (i) => (i === 0 ? 1 : after(s, 'set', 0.1 + 0.08 * i)),
      hot: now,
      thick: (t) => 0.4 + 2 * AS[t - 1]!,
      decayInk: (t) => (AS[t - 1]! > 0.5 ? 'teal' : 'red'),
    });
    for (let t = 1; t <= 3; t++) s.alpha(after(s, 'set', 0.3 + 0.1 * t), () => mono(s, `Δ = ${DT[t - 1]}`, (g.x(t - 1) + g.x(t)) / 2, g.y + 4 * s.u, 'slate', 2.7));
    const yl = Y(s, 0.88);
    const lines = [`h₁ = ${a2(AS[0]!)}·0 + 4 = 4`, `h₂ = ${a2(AS[1]!)}·4 + 2 = ${fmt(HS[2]!)}`, `h₃ = ${a2(AS[2]!)}·${fmt(HS[2]!)} + 6 ≈ ${fmt(HS[3]!)}`];
    s.alpha(s.win('set', 'h1'), () => mono(s, 'decays: e^(−Δ) = 0.37, 0.9, 0.05', s.w / 2, yl, 'teal', 3.4));
    s.alpha(s.win('h1', 'h2', 0.4) * after(s, 'h1', 0.6, 0.4), () => mono(s, lines[0]!, s.w / 2, yl, '--ink', 3.6));
    s.alpha(s.win('h2', 'h3', 0.4) * after(s, 'h2', 0.45, 0.4), () => mono(s, lines[1]!, s.w / 2, yl, 'teal', 3.6));
    s.alpha(p3 > 0.5 ? 1 : 0, () => {
      mono(s, lines[2]!, s.w / 2, yl, 'red', 3.6);
      s.alpha(after(s, 'h3', 0.85), () => mono(s, 'almost all new input', s.w / 2, yl + 6 * s.u, '--ink-3', 3, 'center', 500));
    });
  },
};

// ---- scene 4: memory while generating

const LAYERS = 32;
const D = 4000;
const STATE = 2 * D * 16;
const cacheGB = (tokens: number) => (2 * LAYERS * tokens * D * 2) / 1e9;
const STATE_MB = (LAYERS * STATE * 2) / 1e6;

const memory: SceneDef = {
  marks: {
    kv: { tex: String.raw`\text{cache} = 2 \times \text{layers} \times \text{tokens} \times d \times \text{bytes}`, x: 0.5, y: 0.08, size: 3.8 },
    st: { tex: String.raw`\text{state} = \text{layers} \times \text{state size} \times \text{bytes}`, x: 0.5, y: 0.16, size: 3.8 },
  },
  draw(s) {
    const u = s.u;
    const marks = 1 - s.ease('fast', 0.5);
    s.show('kv', s.ease('cache', 0.6) * marks);
    s.show('st', s.ease('state', 0.6) * marks);
    const x0 = s.w / 2 - (s.tall ? 40 : 46) * u;
    const full = (s.tall ? 80 : 92) * u;
    // The bar's full width is 8,000 tokens: 4,000 fill half of it, and doubling fills the rest.
    const doubled = after(s, 'times', 0.45, 1.2);
    const tokens = Math.round((4000 * Math.min(1, s.prog('cache') * 1.3) + 4000 * doubled) / 10) * 10;
    const yc = Y(s, 0.38);
    const ys = Y(s, 0.53);
    const bh = 6 * u;
    s.alpha(s.ease('cache', 0.6, 0.4), () => {
      mono(s, 'KV cache', x0, yc - bh / 2 - 3 * u, 'purple', 3.2, 'left');
      const w = Math.max(0.8 * u, (full * tokens) / 8000);
      s.rrect(x0, yc - bh / 2, w, bh, 1, { fill: s.tint('purple', 0.45), stroke: s.c('purple'), lw: 0.3 });
      mono(s, `${tokens.toLocaleString('en-US')} tokens`, x0 + full, yc - bh / 2 - 3 * u, '--ink-2', 3, 'right', 500);
      s.alpha(after(s, 'cache', 0.7), () => mono(s, `≈ ${cacheGB(tokens).toFixed(1)} GB`, x0 + full, yc + bh / 2 + 3.4 * u, 'purple', 3.2, 'right'));
    });
    s.alpha(s.ease('cache', 0.6, 0.8), () => mono(s, `${LAYERS} layers   d = 4,000   2 bytes`, s.w / 2, Y(s, 0.25), '--ink-2', 3.1, 'center', 500));
    s.alpha(s.ease('state', 0.6, 0.4), () => {
      mono(s, 'state', x0, ys - bh / 2 - 3 * u, 'gold', 3.2, 'left');
      s.rrect(x0, ys - bh / 2, 0.8 * u, bh, 0.3, { fill: s.c('gold') });
      mono(s, 'updated in place: the same at any length', x0 + 3 * u, ys, '--ink-3', 2.9, 'left', 500);
      s.alpha(s.ease('mb', 0.5, 1.2), () => mono(s, `≈ ${STATE_MB.toFixed(1)} MB`, x0 + full, ys + bh / 2 + 3.4 * u, 'gold', 3.2, 'right'));
    });
    // The arithmetic, one line per beat.
    const L = (t: string, f: number, k: Ink, a: number, size = 3.2) => s.alpha(a, () => mono(s, t, s.w / 2, Y(s, f), k, size));
    const per = 1 - s.ease('ratio', 0.5);
    L('per layer: 2d × 16 = 8,000 × 16', 0.68, 'gold', s.ease('shape', 0.6) * per);
    L('= 128,000 numbers', 0.75, 'gold', after(s, 'shape', 0.6) * per);
    L(`× ${LAYERS} layers × 2 bytes ≈ ${STATE_MB.toFixed(1)} MB`, 0.82, 'gold', s.ease('mb', 0.6) * per);
    const fast = 1 - s.ease('fast', 0.5);
    L('per layer, cache: 2 × 4,000 × 4,000', 0.68, 'purple', s.ease('ratio', 0.6) * fast);
    L('= 32,000,000 numbers', 0.75, 'purple', after(s, 'ratio', 0.55) * fast);
    L('÷ 128,000 = 250× the state', 0.82, 'purple', s.ease('times', 0.6) * fast, 3.4);
    L('8,000 tokens: 500×, the state unchanged', 0.89, 'purple', doubled * fast);
    s.alpha(s.ease('fast', 0.6), () => {
      mono(s, 'no cache: more sequences per GPU', s.w / 2, Y(s, 0.72), '--ink-2', 3.3);
      mono(s, '4 to 5× the tokens per second', s.w / 2, Y(s, 0.8), 'gold', 3.5, 'center', 650);
    });
    cite(s, 'Gu & Dao, 2023', s.ease('fast', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { same, step, run: runScene, memory };
