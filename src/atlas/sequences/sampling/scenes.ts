import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after, caption } from '../../networks/draw';
import { box, chip, fmt } from '../draw';

const TOK = ['cat', 'dog', 'fish'];
const S = [2, 1, 0];
const soft = (z: readonly number[]) => {
  const e = z.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const P = soft(S);
const f2 = (v: number) => v.toFixed(2);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Bars over cat, dog and fish, with the tokens named under them and, optionally, their ids. */
function tokenBars(s: Scene, xs: number[], base: number, p: number[], o: { height: number; w?: number; hi?: number[]; size?: number; ids?: number; grow?: number }): void {
  bars(s, xs, base, p, 'teal', { max: 1, height: o.height, w: o.w ?? 9, fmt: f2, hi: o.hi, grow: o.grow });
  TOK.forEach((t, j) => {
    s.text(t, xs[j]!, base + 3.6 * s.u, { size: o.size ?? 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
    if (o.ids) s.alpha(o.ids, () => s.text(`id ${j}`, xs[j]!, base + 7.6 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') }));
  });
}

/** A point along the quadratic curve from p0 through control c to p1. */
const quad = (p0: [number, number], c: [number, number], p1: [number, number], f: number): [number, number] => [
  (1 - f) ** 2 * p0[0] + 2 * (1 - f) * f * c[0] + f ** 2 * p1[0],
  (1 - f) ** 2 * p0[1] + 2 * (1 - f) * f * c[1] + f ** 2 * p1[1],
];

// ---- write: predict, pick, append, feed back in

const TEXT = ['I', 'fed', 'my', 'cat', 'fish'];
/** The second round's probabilities, after "I fed my cat": fish comes next. */
const P2 = soft([1, 0, 2.5]);

const write: SceneDef = {
  draw(s) {
    const u = s.u;
    const slots = columns(s, 5, s.tall ? 15 : 16);
    const y0 = s.h * 0.13;
    const xs = columns(s, 3, 16).map((x) => x - 4 * u);
    const base = s.h * 0.74;
    const by = s.h * 0.36;
    const f1 = after(s, 'loop', 0.18, 1.1);
    const f2_ = after(s, 'loop', 0.62, 1.1);
    const morph = after(s, 'loop', 0.4, 0.8);
    const p = P.map((v, j) => lerp(v, P2[j]!, morph));

    // The text so far, with empty slots for what comes next.
    TEXT.forEach((t, i) => {
      if (i < 3) chip(s, slots[i]!, y0, t, 'orange', { w: 12, h: 7, size: 3.2 });
      else {
        const done = i === 3 ? f1 >= 1 : f2_ >= 1;
        if (!done) s.rrect(slots[i]! - 6 * u, y0 - 3.5 * u, 12 * u, 7 * u, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
        else chip(s, slots[i]!, y0, t, 'orange', { w: 12, h: 7, size: 3.2 });
      }
    });
    s.arrow(s.w / 2 - 4 * u, y0 + 5 * u, s.w / 2 - 4 * u, by - 6 * u, s.c('--ink-3'), 0.35, 1.8);
    box(s, s.w / 2 - 4 * u, by, 'language model', 'slate', { w: 34, h: 9, size: 3.2 });
    s.arrow(s.w / 2 - 4 * u, by + 5.5 * u, s.w / 2 - 4 * u, base - 24 * u, s.c('--ink-3'), 0.35, 1.8);
    s.alpha(s.ease('predict', 0.8, 0.8), () => {
      const which = f2_ > 0 ? 2 : f1 > 0 && f1 < 1 ? 0 : -1;
      tokenBars(s, xs, base, p, { height: 18, hi: [which === 0 ? 1 : 0, 0, which === 2 ? 1 : 0], grow: s.ease('predict', 0.9, 0.8) });
    });

    // The loop back: from the bars, round the right side, to the end of the text.
    const p0: [number, number] = [xs[2]! + 7 * u, base - 10 * u];
    const c: [number, number] = [s.w - 3 * u, (base + y0) / 2 + 4 * u];
    const p1: [number, number] = [slots[4]! + 7.5 * u, y0 + 2 * u];
    s.alpha(s.ease('loop', 0.6, 0.6) * 0.8, () => {
      const g = s.ctx;
      g.beginPath();
      g.moveTo(...p0);
      g.quadraticCurveTo(c[0], c[1], p1[0], p1[1]);
      g.strokeStyle = s.c('--ink-3');
      g.lineWidth = 0.35 * u;
      g.setLineDash([1.2 * u, 1.2 * u]);
      g.stroke();
      g.setLineDash([]);
      const q = quad(p0, c, p1, 0.94);
      s.arrow(q[0], q[1], p1[0], p1[1], s.c('--ink-3'), 0.35, 1.8);
    });
    // The chosen token flies from its bar to the next free slot.
    const fly = (f: number, j: number, slot: number) => {
      if (f <= 0 || f >= 1) return;
      const from: [number, number] = [xs[j]!, base + 3.6 * u];
      const to: [number, number] = [slots[slot]!, y0];
      const [x, y] = quad(from, [s.w - 6 * u, (base + y0) / 2], to, smooth(f));
      chip(s, x, y, TOK[j]!, 'orange', { w: 12, h: 7, size: 3.2, on: 1 });
    };
    fly(f1, 0, 3);
    fly(f2_, 2, 4);

    // Decoding: the step on the loop that turns bars into one token.
    const q = quad(p0, c, p1, 0.5);
    s.alpha(s.ease('decode', 0.6), () => {
      s.circle(q[0], q[1], 3.4 * u, { fill: s.c('--card'), stroke: s.c('purple'), lw: 0.45 });
      s.text('?', q[0], q[1] + 0.3 * u, { size: 4, font: 'mono', weight: 700, color: s.c('purple') });
    });
    const cy = s.h * 0.92;
    s.alpha(s.win('predict', 'loop'), () => caption(s, 'a probability for every next token', cy, '--ink-2', 3.3));
    s.alpha(s.win('loop', 'decode') * after(s, 'loop', 0.85), () => caption(s, 'generating: pick, append, repeat', cy, 'orange', 3.4));
    s.alpha(s.ease('decode', 0.6), () => caption(s, 'decoding: probabilities → one token', cy, 'purple', 3.4));
  },
};

// ---- pick: greedy takes the top bar; sampling throws a dart at the bars laid end to end

/** Where the darts land along [0, 1): cat below 0.67, dog below 0.91, fish above. */
const DARTS = [0.42, 0.78, 0.15, 0.6, 0.95, 0.33, 0.7, 0.08];
const CDF = [P[0]!, P[0]! + P[1]!, 1];
const hit = (d: number) => CDF.findIndex((c) => d < c);
const SHANNON = ['THE HEAD AND IN FRONTAL ATTACK ON AN', 'ENGLISH WRITER THAT THE CHARACTER OF', 'THIS POINT IS THEREFORE ANOTHER', 'METHOD FOR THE LETTERS THAT THE ...'];

function strip(s: Scene, y: number, toks: string[], k: Color, label: string, a: number, shown: (i: number) => number): void {
  s.alpha(a, () => {
    const xs = columns(s, toks.length, 10.5);
    s.text(label, s.w / 2, y - 6.5 * s.u, { size: 3, color: s.c('--ink-3') });
    toks.forEach((t, i) => s.alpha(shown(i), () => chip(s, xs[i]!, y, t, k, { w: 9.6, h: 6, size: 2.8 })));
  });
}

const pick: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 18);
    const ys = s.h * 0.17;
    rowLabel(s, 's', xs[0]! - 11 * u, ys, 'purple');
    cells(s, xs, ys, S.map(String), 'purple', { w: 12, h: 8 });
    TOK.forEach((t, j) => s.text(t, xs[j]!, ys - 7.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    const base = s.h * 0.47;
    s.alpha(s.ease('scores', 0.6, 2.5), () => {
      s.arrow(s.w / 2, ys + 6 * u, s.w / 2, ys + 12 * u, s.c('--ink-3'), 0.35, 1.8);
      s.text('softmax', s.w / 2 + 3 * u, ys + 9 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      tokenBars(s, xs, base, P, { height: 16, w: 10, ids: 1, grow: s.ease('scores', 0.9, 2.8), hi: [s.win('greedy', 'sample'), 0, 0] });
    });
    const low = s.h * 0.85;
    const greedyA = s.ease('greedy', 0.8, 1.5) * (1 - s.ease('sample', 0.5));
    strip(s, low, Array(8).fill('cat'), 'gold', 'greedy: the same on every run', greedyA, (i) => after(s, 'greedy', 0.3 + i * 0.05, 0.3));
    s.alpha(s.win('dull', 'sample'), () => caption(s, '“bland and strangely repetitive”', s.h * 0.69, 'red', 3.3, { italic: true }));
    cite(s, 'Holtzman, Buys, Du, Forbes & Choi, 2019', s.win('dull', 'sample'));

    // The dart line: the three bars laid end to end, one unit long in all.
    const lineA = s.ease('sample', 0.7, 1.5) * (1 - s.ease('shannon', 0.6));
    const L = s.w / 2 - 33 * u;
    const R = s.w / 2 + 33 * u;
    const ly = s.h * 0.67;
    s.alpha(lineA, () => {
      let x = L;
      P.forEach((v, j) => {
        const w = v * (R - L) * after(s, 'sample', 0.2 + 0.08 * j, 0.6);
        s.rrect(x, ly - 2.5 * u, w, 5 * u, 0.4, { fill: s.tint('teal', 0.2 + 0.15 * (2 - j)), stroke: s.tint('teal', 0.8), lw: 0.25 });
        if (j < 2) s.text(TOK[j]!, x + w / 2, ly + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink'), halo: true });
        else s.text(TOK[j]!, x + w / 2, ly + 5.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
        x += w;
      });
      s.text('0', L, ly + 5.2 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
      s.text('1', R, ly - 5.2 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
      DARTS.forEach((d, i) => {
        const a = after(s, 'sample', 0.5 + i * 0.06, 0.25);
        if (a <= 0) return;
        const dx = L + d * (R - L);
        s.alpha(a * (i === DARTS.length - 1 || after(s, 'sample', 0.56 + i * 0.06, 0.25) < 1 ? 1 : 0.35), () => {
          s.arrow(dx, ly - 7.5 * u, dx, ly - 2.8 * u, s.c('purple'), 0.4, 1.4);
        });
      });
    });
    strip(s, low, DARTS.map((d) => TOK[hit(d)]!), 'teal', 'sampled: one possible run', lineA, (i) => after(s, 'sample', 0.52 + i * 0.06, 0.3));

    // Shannon's sample, drawn one word at a time from a book.
    const sh = s.ease('shannon', 0.7, 0.4);
    cite(s, 'Shannon, 1948', sh);
    s.alpha(sh, () => {
      const top = s.h * 0.66;
      const pitch = 4.6 * u;
      const wd = Math.min(s.w - 10 * u, 74 * u);
      s.rrect(s.w / 2 - wd / 2, top - 4 * u, wd, pitch * SHANNON.length + 4 * u, 1.2, { fill: s.tint('slate', 0.06), stroke: s.tint('slate', 0.4), lw: 0.25 });
      const shown = clamp(s.prog('shannon') * 1.4 + s.prog('book') * 0.4, 0, 1);
      const words = SHANNON.join(' ').split(' ');
      let n = Math.ceil(shown * words.length);
      SHANNON.forEach((line, i) => {
        const ws = line.split(' ');
        const take = Math.max(0, Math.min(ws.length, n));
        n -= ws.length;
        if (take) s.text(ws.slice(0, take).join(' '), s.w / 2 - wd / 2 + 3 * u, top + i * pitch, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-2') });
      });
    });
    const cy = s.h * 0.93;
    s.alpha(s.ease('book', 0.6), () => caption(s, 'open anywhere, find the last word, copy the next', cy, '--ink-2', 3));
  },
};

// ---- temp: one dial, from cold to hot

const LN2 = Math.log(2);
/** The temperature at this moment, as a log so that halving and doubling move it equal steps. */
function logT(s: Scene): number {
  if (s.since('order') >= 0) return LN2 * Math.cos(2 * Math.PI * s.prog('order'));
  // Heated, then cooled, as the voice says each word; then back to 1.
  const f = (s.t - s.at('name')) / (s.end('name') - s.at('name'));
  const hc = Math.log(3) * (smooth((f - 0.64) / 0.1) - 2 * smooth((f - 0.86) / 0.08)) * (1 - s.ease('gaps', 1));
  return hc - LN2 * s.ease('cold', 1.2, 0.3) + 2 * LN2 * s.ease('hot', 1.2, 0.3);
}

const tFmt = (T: number) => String(Number(T.toFixed(2)));

/** The dial: a track from cold to hot on a log scale, with a knob at T. */
function dial(s: Scene, y: number, T: number): void {
  const u = s.u;
  const half = s.tall ? 30 : 36;
  const a = s.w / 2 - half * u;
  const b = s.w / 2 + half * u;
  const X = (t: number) => a + ((Math.log2(t) + 2) / 4) * (b - a);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    s.line(a + f * (b - a), y, a + (f + 1 / n) * (b - a), y, s.tint(f < 0.5 ? 'blue' : 'red', 0.25 + 0.6 * Math.abs(f - 0.5) * 2), 1.1);
  }
  for (const t of [0.5, 1, 2]) {
    s.line(X(t), y - 1.6 * u, X(t), y + 1.6 * u, s.c('--ink-3'), 0.3);
    s.text(String(t), X(t), y + 4.2 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
  }
  s.text('cold', a - 2.5 * u, y, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
  s.text('hot', b + 2.5 * u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
  const k = X(clamp(T, 0.25, 4));
  s.circle(k, y, 2 * u, { fill: s.c('--card'), stroke: s.c('slate'), lw: 0.5 });
  s.text(`T = ${tFmt(T)}`, k, y - 4.6 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('slate'), halo: true });
}

const temp: SceneDef = {
  marks: {
    f: { tex: String.raw`\symp = \mathrm{softmax}(\syms / \symT)`, x: 0.5, y: 0.07, size: 5 },
  },
  draw(s) {
    const u = s.u;
    s.show('f', s.ease('dial', 0.6));
    const T = Math.exp(logT(s));
    const z = S.map((v) => v / T);
    dial(s, s.h * 0.24, T);
    const xs = columns(s, 3, 18).map((x) => x + 5 * u);
    const cy0 = s.h * 0.4;
    rowLabel(s, 's / T', xs[0]! - 9 * u, cy0, 'purple', 3.4);
    cells(s, xs, cy0, z.map((v) => fmt(+v.toFixed(2))), 'purple', { w: 12, h: 7, size: 3.1, on: [s.win('cold', 'cold-p'), s.win('cold', 'cold-p'), s.win('cold', 'cold-p')] });
    s.alpha(s.ease('gaps', 0.6), () => {
      for (let j = 0; j < 2; j++) s.text(`gap ${tFmt(z[j]! - z[j + 1]!)}`, (xs[j]! + xs[j + 1]!) / 2, cy0 + 6.5 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
    });
    tokenBars(s, xs, s.h * 0.82, soft(z), { height: 26, w: 10, hi: [Math.max(s.win('cold-p', 'hot'), s.ease('order', 0.6)), 0, 0] });
    const cy = s.h * 0.93 + 2 * u;
    s.alpha(s.win('name', 'gaps') * (1 - after(s, 'name', 0.55)), () => caption(s, 'physics: chance goes as e^(−energy / T)', cy, '--ink-2', 3.2));
    s.alpha(s.win('name', 'gaps') * after(s, 'name', 0.55), () => caption(s, 'hot: spread out · cold: settle', cy, '--ink-2', 3.2));
    s.alpha(s.win('gaps', 'cold'), () => caption(s, 'softmax sees only the gaps', cy, '--ink-2', 3.2));
    s.alpha(s.win('cold', 'cold-p'), () => caption(s, 's / 0.5 = 2s: every gap doubles', cy, 'blue', 3.2));
    s.alpha(s.win('cold-p', 'hot'), () => caption(s, 'e⁴ ≈ 54.6 of 63.0: cat 0.87', cy, 'blue', 3.2));
    s.alpha(s.win('hot', 'order'), () => caption(s, 's / 2: every gap halves', cy, 'red', 3.2));
    s.alpha(s.ease('order', 0.6), () => caption(s, 'any T: cat on top, greedy picks id 0', cy, '--ink-2', 3.2));
  },
};

// ---- limits: freeze to greedy, boil to uniform

const LOOP = 'is that they were all the same thing that was a startup ';

/** Lines of text cut at spaces to fit `n` characters. */
function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > n) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
const LOOP_LINES = wrap(LOOP.repeat(3).trim() + ' ...', 34);

function row(s: Scene, base: number, label: string, T: number, note: string, a: number): void {
  s.alpha(a, () => {
    const u = s.u;
    const xs = columns(s, 3, 16).map((x) => x + 10 * u);
    const lx = xs[0]! - 11 * u;
    rowLabel(s, label, lx, base - 9 * u, 'slate', 3.4);
    s.text(`T = ${T < 0.1 ? T.toFixed(2) : T < 10 ? tFmt(T) : Math.round(T)}`, lx, base - 4 * u, { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text(note, lx, base + 0.5 * u, { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
    tokenBars(s, xs, base, soft(S.map((v) => v / T)), { height: 16, size: 2.9 });
  });
}

const limits: SceneDef = {
  draw(s) {
    const u = s.u;
    const Tlo = Math.exp(Math.log(0.02) * s.ease('freeze', 2.4, 0.4));
    const Thi = Math.exp(Math.log(1000) * s.ease('boil', 2.4, 0.6));
    row(s, s.h * 0.36, 'T → 0', Tlo, after(s, 'freeze', 0.7) > 0.5 ? 'greedy' : '', 1);
    row(s, s.h * 0.74, 'T → ∞', Thi, after(s, 'boil', 0.6) > 0.5 ? 'uniform' : '', s.ease('boil', 0.6));
    cite(s, 'Karpathy, 2015', s.win('karpathy', 'boil'));
    s.alpha(s.win('karpathy', 'boil'), () => {
      const top = s.h * 0.52;
      const pitch = 4.4 * u;
      const wd = Math.min(s.w - 10 * u, 70 * u);
      s.rrect(s.w / 2 - wd / 2, top - 4.5 * u, wd, pitch * LOOP_LINES.length + 4.5 * u, 1.2, { fill: s.tint('red', 0.05), stroke: s.tint('red', 0.4), lw: 0.25 });
      const shown = Math.ceil(clamp((s.prog('karpathy') - 0.35) / 0.55, 0, 1) * LOOP_LINES.length);
      LOOP_LINES.slice(0, shown).forEach((line, i) => s.text(line, s.w / 2 - wd / 2 + 3 * u, top + i * pitch, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-2') }));
    });
    const cy = s.h * 0.91;
    s.alpha(s.win('freeze', 'karpathy'), () => caption(s, 'gaps stretch: the top token takes all', cy, '--ink-2', 3.2));
    s.alpha(s.win('boil', 'between'), () => caption(s, 'gaps shrink: 1/3 each', cy, '--ink-2', 3.2));
    s.alpha(s.ease('between', 0.6), () => {
      caption(s, 'lower T: cautious, repeats', cy - 2.6 * u, 'blue', 3.1);
      caption(s, 'higher T: varied, more mistakes', cy + 2.6 * u, 'red', 3.1);
    });
  },
};

export const scenes: Record<string, SceneDef> = { write, pick, temp, limits };
