import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../linear-algebra/draw';
import { fmt } from '../../sequences/draw';
import { chain, sub } from '../linear-recurrence/chain';

// The running example: inputs 4, 2, 6 with step sizes 1, 0.1, 3, and b = 1.
const XS = [4, 2, 6];
const DT = [1, 0.1, 3];
const AS = DT.map((d) => Math.round(Math.exp(-d) * 100) / 100);
const run = (as: number[], xs: number[]) => xs.reduce<number[]>((hs, x, t) => [...hs, Math.round((as[t]! * hs[t]! + x) * 1e6) / 1e6], [0]);
const HS = run(AS, XS);
// The worked problem.
const XS1 = [3, 5, 2];
const AS1 = [0.5, 0.9, 0.1];
const HS1 = run(AS1, XS1);

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) => s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const Y = (s: Scene, f: number) => f * s.h;
const a2 = (v: number) => v.toFixed(2).replace(/0$/, '');

// ---- scene 1: a_t = e^(-Δ_t)

const select: SceneDef = {
  marks: {
    fixed: { tex: String.raw`\symx_{t-k} \text{ weighs } c\,a^k b`, x: 0.5, y: 0.09, size: 4.6 },
    sel: { tex: String.raw`a_t = e^{-\Delta_t}`, x: 0.5, y: 0.09, size: 5 },
  },
  draw(s) {
    s.show('fixed', s.ease('fixed', 0.6) * (1 - s.ease('select', 0.5)));
    s.show('sel', s.ease('select', 0.6, 0.4));
    const gap = (s.tall ? 22 : 24) * s.u;
    const xs = [-1, 0, 1].map((j) => s.w / 2 + 6 * s.u + j * gap);
    const lx = xs[0]! - gap / 2 - 3 * s.u;
    const rows = { x: Y(s, 0.24), dt: Y(s, 0.34), a: Y(s, 0.44) };
    const perToken = s.ease('delta', 0.6, 1);
    // Tokens, then their step sizes, then their decays.
    mono(s, 'x', lx, rows.x, 'orange', 3.6, 'right');
    xs.forEach((x, j) => {
      s.cell(x - 5 * s.u, rows.x - 3.5 * s.u, 10 * s.u, 7 * s.u, String(XS[j]), 'orange', { size: 3.2 });
      mono(s, `x${sub(j + 1)}`, x + 6.4 * s.u, rows.x - 3.6 * s.u, 'orange', 2.6, 'left');
    });
    s.alpha(s.ease('delta', 0.6, 0.4), () => {
      mono(s, 'Δ', lx, rows.dt, 'slate', 3.6, 'right');
      xs.forEach((x, j) => s.cell(x - 5 * s.u, rows.dt - 3.5 * s.u, 10 * s.u, 7 * s.u, String(DT[j]), 'slate', { size: 3.2, on: j === 2 ? s.win('big', 'small') : j === 1 ? s.ease('small', 0.5) : 0 }));
    });
    s.alpha(s.ease('fixed', 0.6, 0.6), () => {
      mono(s, 'a', lx, rows.a, 'teal', 3.6, 'right');
      xs.forEach((x, j) => {
        const fixed = 1 - perToken;
        const hot = j === 2 ? s.win('big', 'small') : j === 1 ? s.ease('small', 0.5) : 0;
        s.alpha(fixed, () => s.cell(x - 5 * s.u, rows.a - 3.5 * s.u, 10 * s.u, 7 * s.u, '0.5', 'teal', { size: 3.2 }));
        s.alpha(perToken, () => s.cell(x - 5 * s.u, rows.a - 3.5 * s.u, 10 * s.u, 7 * s.u, a2(AS[j]!), 'teal', { size: 3.2, on: hot }));
      });
      s.alpha(1 - perToken, () => mono(s, 'the same for every token', s.w / 2 + 6 * s.u, rows.a + 7 * s.u, '--ink-3', 3, 'center', 500));
    });
    // The curve a = e^(-Δ) for Δ from 0 to 4.
    s.alpha(s.ease('select', 0.6, 1.2), () => {
      const x0 = s.w / 2 - 30 * s.u;
      const x1 = s.w / 2 + 34 * s.u;
      const top = Y(s, 0.62);
      const bot = Y(s, 0.86);
      const px = (d: number) => x0 + (d / 4) * (x1 - x0);
      const py = (a: number) => bot - a * (bot - top);
      s.line(x0, bot, x1, bot, s.c('--axis'), 0.3);
      s.line(x0, bot, x0, top - 2 * s.u, s.c('--axis'), 0.3);
      for (let i = 0; i < 60; i++) s.line(px((i / 60) * 4), py(Math.exp(-(i / 60) * 4)), px(((i + 1) / 60) * 4), py(Math.exp(-((i + 1) / 60) * 4)), s.c('teal'), 0.45);
      [0, 1, 2, 3, 4].forEach((d) => mono(s, String(d), px(d), bot + 3 * s.u, '--ink-3', 2.6));
      mono(s, 'Δ', x1 + 2 * s.u, bot, 'slate', 3.2, 'left');
      mono(s, 'a', x0, top - 4.6 * s.u, 'teal', 3.2);
      mono(s, '1', x0 - 2 * s.u, py(1), '--ink-3', 2.6, 'right');
      const dot = (d: number, a: number, on: number, label: string, side: CanvasTextAlign) =>
        s.alpha(0.35 + 0.65 * on, () => {
          s.circle(px(d), py(a), (1 + 0.5 * on) * s.u, { fill: s.c('teal') });
          mono(s, label, px(d) + (side === 'left' ? 2.4 : -2.4) * s.u, py(a) - 3 * s.u, on > 0.5 ? '--ink' : '--ink-3', 3, side);
        });
      s.alpha(s.ease('big', 0.5), () => dot(3, AS[2]!, s.win('big', 'small'), 'forget: 0.05', 'center'));
      s.alpha(s.ease('small', 0.5), () => dot(0.1, AS[1]!, s.ease('small', 0.5), 'keep: 0.9', 'left'));
      s.alpha(s.ease('small', 0.5, 1.5), () => dot(1, AS[0]!, 0, '0.37', 'left'));
    });
  },
};

// ---- scene 2: the state through three steps

const runScene: SceneDef = {
  marks: {
    rec: { tex: String.raw`\symh_t = a_t\,\symh_{t-1} + b\,\symx_t`, x: 0.5, y: 0.09, size: 4.8 },
    mamba: { tex: String.raw`\text{Mamba: }\ \symh_t = e^{-\Delta_t}\,\symh_{t-1} + \Delta_t\, b_t\,\symx_t,\ \ y_t = c_t\,\symh_t`, x: 0.5, y: 0.87, size: 4 },
  },
  draw(s) {
    s.show('rec', s.ease('h1', 0.5));
    s.show('mamba', s.ease('more', 0.6, 0.3));
    mono(s, 'b = 1', s.w / 2, Y(s, 0.19), '--ink-2', 3.4);
    const p3 = s.prog('h3');
    const filled = (i: number) => (i === 0 ? 1 : i === 1 ? s.ease('h1', 0.4, 0.6 * (s.end('h1') - s.at('h1'))) : i === 2 ? s.ease('h2', 0.4, 0.6 * (s.end('h2') - s.at('h2'))) : p3 > 0.6 ? 1 : 0);
    const now = (i: number) => (i === 1 ? s.win('h1', 'h2') : i === 2 ? s.win('h2', 'h3') : i === 3 ? s.win('h3', 'more') : 0);
    const g = chain(s, {
      y: Y(s, 0.47),
      n: 3,
      states: (i) => (filled(i) > 0.5 ? fmt(HS[i]!) : ''),
      inputs: XS.map(String),
      decay: (t) => `×${a2(AS[t - 1]!)}`,
      gain: '',
      show: (i) => (i === 0 ? 1 : s.ease('h1', 0.5, 0.3 * i)),
      hot: now,
      thick: (t) => 0.4 + 2 * AS[t - 1]!,
      decayInk: (t) => (AS[t - 1]! > 0.5 ? 'teal' : 'red'),
    });
    for (let t = 1; t <= 3; t++) s.alpha(s.ease('h1', 0.5, 0.3 * t), () => mono(s, `Δ = ${DT[t - 1]}`, (g.x(t - 1) + g.x(t)) / 2, g.y + 4 * s.u, 'slate', 2.6));
    const yl = Y(s, 0.87);
    const lines = [`h₁ = ${a2(AS[0]!)}·0 + 4 = 4`, `h₂ = ${a2(AS[1]!)}·4 + 2 = ${fmt(HS[2]!)}`, `h₃ = ${a2(AS[2]!)}·${fmt(HS[2]!)} + 6 ≈ ${fmt(HS[3]!)}`];
    s.alpha(s.win('h1', 'h2', 0.4) * s.ease('h1', 0.4, 0.5 * (s.end('h1') - s.at('h1'))), () => mono(s, lines[0]!, s.w / 2, yl, '--ink', 3.6));
    s.alpha(s.win('h2', 'h3', 0.4) * s.ease('h2', 0.4, 0.4 * (s.end('h2') - s.at('h2'))), () => mono(s, lines[1]!, s.w / 2, yl, 'teal', 3.6));
    s.alpha(s.win('h3', 'more', 0.4) * (p3 > 0.5 ? 1 : 0), () => mono(s, lines[2]!, s.w / 2, yl, 'red', 3.6));
  },
};

// ---- scene 3: memory while generating

const LAYERS = 32;
const D = 4000;
const STATE = 128_000;
const cacheGB = (tokens: number) => (2 * LAYERS * tokens * D * 2) / 1e9;
const STATE_MB = (LAYERS * STATE * 2) / 1e6;

const memory: SceneDef = {
  marks: {
    kv: { tex: String.raw`\text{cache} = 2 \times \text{layers} \times \text{tokens} \times d \times \text{bytes}`, x: 0.5, y: 0.09, size: 4 },
    st: { tex: String.raw`\text{state} = \text{layers} \times \text{state size} \times \text{bytes}`, x: 0.5, y: 0.18, size: 4 },
  },
  draw(s) {
    s.show('kv', s.ease('cache', 0.6));
    s.show('st', s.ease('state', 0.6));
    const x0 = s.w / 2 - (s.tall ? 40 : 46) * s.u;
    const full = (s.tall ? 62 : 72) * s.u;
    const tokens = Math.round(4000 * Math.min(1, s.span('cache', 'size') * 1.4 + s.ease('size', 0.1)) / 10) * 10;
    const yc = Y(s, 0.45);
    const ys = Y(s, 0.65);
    const bh = 6 * s.u;
    s.alpha(s.ease('cache', 0.6, 0.6), () => {
      mono(s, 'KV cache', x0, yc - bh / 2 - 3 * s.u, 'purple', 3.2, 'left');
      const w = Math.max(0.8 * s.u, (full * tokens) / 4000);
      s.rrect(x0, yc - bh / 2, w, bh, 1, { fill: s.tint('purple', 0.45), stroke: s.c('purple'), lw: 0.3 });
      mono(s, `${tokens.toLocaleString('en-US')} tokens`, x0 + full, yc - bh / 2 - 3 * s.u, '--ink-2', 3, 'right', 500);
      s.alpha(s.ease('size', 0.5, 0.6 * (s.end('size') - s.at('size'))), () => mono(s, `≈ ${cacheGB(4000).toFixed(1)} GB`, x0 + full, yc + bh / 2 + 3.4 * s.u, 'purple', 3.2, 'right'));
    });
    s.alpha(s.ease('state', 0.6, 0.4), () => {
      mono(s, 'state', x0, ys - bh / 2 - 3 * s.u, 'gold', 3.2, 'left');
      s.rrect(x0, ys - bh / 2, 0.8 * s.u, bh, 0.3, { fill: s.c('gold') });
      mono(s, 'the same at any length', x0 + 3 * s.u, ys, '--ink-3', 3, 'left', 500);
      s.alpha(s.ease('ratio', 0.5, 0.35 * (s.end('ratio') - s.at('ratio'))), () => mono(s, `≈ ${STATE_MB.toFixed(1)} MB`, x0 + full, ys + bh / 2 + 3.4 * s.u, 'gold', 3.2, 'right'));
    });
    s.alpha(s.ease('size', 0.6, 0.3), () => mono(s, `${LAYERS} layers   d = 4,000   2 bytes`, s.w / 2, Y(s, 0.27), '--ink-2', 3.2, 'center', 500));
    s.alpha(s.ease('ratio', 0.6, 0.65 * (s.end('ratio') - s.at('ratio'))), () => mono(s, `${(cacheGB(4000) * 1000 / STATE_MB).toFixed(0)}× as much`, s.w / 2, Y(s, 0.85), 'purple', 4, 'center', 650));
  },
};

// ---- scene 4: two worked problems

const tryIt: SceneDef = {
  marks: {
    p1: { tex: String.raw`b = 1,\ \ \symh_0 = 0`, x: 0.5, y: 0.08, size: 4.6 },
    q1: { tex: String.raw`a_1, a_2, a_3 = 0.5, 0.9, 0.1\!:\quad \symh_3\,?`, x: 0.5, y: 0.17, size: 4.4 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    const two = s.ease('p2', 0.6, 0.3);
    s.show('p1', one);
    s.show('q1', one * s.ease('p1', 0.5, 0.45 * (s.end('p1') - s.at('p1'))));
    const q = s.prog('a1');
    s.alpha(one, () => {
      const at = [0, 0.12, 0.45, 0.8];
      chain(s, {
        y: Y(s, 0.45),
        n: 3,
        states: (i) => (i === 0 || q > at[i]! ? fmt(HS1[i]!) : i === 3 ? '?' : ''),
        inputs: XS1.map(String),
        decay: (t) => `×${AS1[t - 1]}`,
        gain: '',
        show: () => 1,
        hot: (i) => (i === 3 ? s.ease('a1', 0.5, 0.8 * (s.end('a1') - s.at('a1'))) : 0),
        thick: (t) => 0.4 + 2 * AS1[t - 1]!,
        decayInk: (t) => (AS1[t - 1]! > 0.5 ? 'teal' : 'red'),
      });
      const lines = [`h₁ = 0.5·0 + 3 = 3`, `h₂ = 0.9·3 + 5 = ${fmt(HS1[2]!)}`, `h₃ = 0.1·${fmt(HS1[2]!)} + 2 = ${fmt(HS1[3]!)}`];
      lines.forEach((l, i) => s.alpha(q > at[i + 1]! ? 1 : 0, () => mono(s, l, s.w / 2, Y(s, 0.78 + 0.065 * i), i === 2 ? 'gold' : '--ink-2', 3.4)));
    });
    s.alpha(two, () => {
      const lx = s.w / 2 - (s.tall ? 44 : 50) * s.u;
      const o = (t: string, y: number, k: Ink, size = 3.4) => mono(s, t, lx, Y(s, y), k, size, 'left', 500);
      o('32 layers, d = 4,000, 2 bytes per number', 0.1, '--ink-2');
      o('state: 128,000 numbers per layer', 0.17, 'gold');
      o('8,000 tokens: cache ÷ state = ?', 0.24, 'purple');
      const w = s.ease('a2', 0.5, 0.15 * (s.end('a2') - s.at('a2')));
      const v = s.ease('a2', 0.5, 0.6 * (s.end('a2') - s.at('a2')));
      s.alpha(s.ease('p2', 0.5, 0.5 * (s.end('p2') - s.at('p2'))), () => {
        o('per layer:', 0.39, '--ink-3', 3.2);
        o('cache  2 × 8,000 × 4,000', 0.46, 'purple');
        o('state  128,000', 0.6, 'gold');
      });
      s.alpha(w, () => o('       = 64,000,000', 0.53, 'purple'));
      s.alpha(v, () => {
        o('64,000,000 ÷ 128,000 = 500', 0.74, 'purple', 3.8);
        o('layers and bytes cancel', 0.82, '--ink-3', 3);
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { select, run: runScene, memory, try: tryIt };
