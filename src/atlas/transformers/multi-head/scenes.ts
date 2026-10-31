import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite, columns, verdict } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { heat, sub } from '../draw';

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.3) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

function quote(s: Scene, lines: string[], y: number) {
  const o = { size: 3.4, italic: true, halo: true, color: s.c('--ink-2') };
  lines.forEach((l, i) => s.text(l, s.w / 2, y + (i - (lines.length - 1) / 2) * 5.4 * s.u, o));
}

// ---- one blend is not enough: the word like needs cats and fish, kept apart

const WORDS = ['cats', 'like', 'fish'];
const ONE = [0.45, 0.1, 0.45];
const H0 = [0.9, 0.05, 0.05];
const H1 = [0.05, 0.05, 0.9];
const HK: [Ink, Ink] = ['gold', 'purple'];

function sentence(s: Scene, xs: number[], y: number, k: Ink, on: number[] = []) {
  xs.forEach((x, i) => s.cell(x - 8.5 * s.u, y - 4 * s.u, 17 * s.u, 8 * s.u, WORDS[i]!, k, { on: on[i] ?? 0, size: 3.3 }));
}

/** Lines from one asking word to every answering word, as thick as their weights. */
function fan(s: Scene, x0: number, y0: number, xs: number[], y1: number, w: number[], k: Ink) {
  w.forEach((v, j) => s.line(x0, y0, xs[j]!, y1, s.tint(k, 0.3 + 0.65 * v), 0.25 + 2.4 * v));
}

const blend: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = columns(s, 3, s.tall ? 28 : 32);
    const yTop = s.h * 0.17;
    const yBot = s.h * 0.47;
    const two = s.ease('heads', 0.8);
    const one = 1 - two;
    s.alpha(s.ease('one', 0.8, 0.8) * one, () => {
      fan(s, xs[1]!, yTop + 4 * u, xs, yBot - 4 * u, ONE, 'teal');
      ONE.forEach((v, j) => {
        const f = 0.62;
        const dx = j === 0 ? -2.5 : 2.5;
        s.text(String(v), lerp(xs[1]!, xs[j]!, f) + dx * u, lerp(yTop, yBot, f), { size: 3, font: 'mono', weight: 650, align: j === 0 ? 'right' : 'left', color: s.c('teal'), halo: true });
      });
    });
    // Two heads: one finds cats, the other fish.
    s.alpha(two, () => {
      fan(s, xs[1]! - 3 * u, yTop + 4 * u, xs, yBot - 4 * u, H0, HK[0]);
      s.alpha(s.ease('heads', 0.8, 1.2), () => fan(s, xs[1]! + 3 * u, yTop + 4 * u, xs, yBot - 4 * u, H1, HK[1]));
      const lab = { size: 3, font: 'mono' as const, weight: 650, halo: true };
      s.text('head 0', lerp(xs[1]!, xs[0]!, 0.4) - 6 * u, lerp(yTop, yBot, 0.4), { ...lab, align: 'right', color: s.c(HK[0]) });
      s.alpha(s.ease('heads', 0.8, 1.2), () => s.text('head 1', lerp(xs[1]!, xs[2]!, 0.4) + 6 * u, lerp(yTop, yBot, 0.4), { ...lab, align: 'left', color: s.c(HK[1]) }));
    });
    sentence(s, xs, yTop, 'teal', [0, 1, 0]);
    sentence(s, xs, yBot, 'slate');
    s.text('asking', xs[0]! - 10.5 * u, yTop, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.text('values', xs[0]! - 10.5 * u, yBot, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    s.alpha(s.ease('two', 0.6), () => {
      const q = { size: 3.1, font: 'mono' as const, weight: 600, halo: true };
      s.text('who likes?', xs[0]!, yBot + 7.5 * u, { ...q, color: s.c(HK[0]) });
      s.alpha(s.ease('two', 0.6, 1.4), () => s.text('what is liked?', xs[2]!, yBot + 7.5 * u, { ...q, color: s.c(HK[1]) }));
    });

    // Like's output: one smeared blend, then two clean answers side by side.
    const oy = s.h * 0.72;
    s.alpha(s.ease('blur', 0.7, 0.6) * one, () => {
      const w = 40 * u;
      s.rrect(cx - w / 2, oy - 4.5 * u, w, 9 * u, 1.4, { fill: s.tint(HK[0], 0.3), stroke: s.tint('--ink-3', 0.7), lw: 0.35 });
      s.rrect(cx - w / 2, oy - 4.5 * u, w, 9 * u, 1.4, { fill: s.tint(HK[1], 0.3) });
      s.text('cats and fish, mixed', cx, oy + 0.2 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('--ink') });
      s.text("like's output", cx - w / 2 - 2 * u, oy, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('heads', 0.7, 2.4), () => {
      const w = 24 * u;
      ([['head 0: cats', HK[0]], ['head 1: fish', HK[1]]] as [string, Ink][]).forEach(([t, k], i) => {
        const x = cx + (i ? 1 : -1) * (w / 2 + 1 * u);
        s.rrect(x - w / 2, oy - 4.5 * u, w, 9 * u, 1.4, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.8), lw: 0.35 });
        s.text(t, x, oy + 0.2 * u, { size: 3, font: 'mono', weight: 650, color: s.c(k) });
      });
    });

    const cy = s.h * 0.89;
    s.alpha(s.win('one', 'two') * after(s, 'one', 0.5), () => caption(s, 'one row of weights: one blend', cy));
    s.alpha(s.win('blur', 'heads') * after(s, 'blur', 0.5), () => caption(s, 'neither comes through whole', cy, 'red'));
    s.alpha(s.win('heads', 'name') * after(s, 'heads', 0.6), () => caption(s, 'two attentions, each sharp', cy));
    s.alpha(s.win('name', 'vaswani'), () => caption(s, 'each: a head · together: multi-head', cy));
    s.alpha(s.win('vaswani', 'found'), () => quote(s, ['“With a single attention head,', 'averaging inhibits this.”'], cy - 0.5 * u));
    s.alpha(s.ease('found', 0.6), () => caption(s, 'heads 5 and 6: from “its” to what it refers to', cy, '--ink-2', s.tall ? 2.9 : 3.2));
    cite(s, 'Vaswani et al., 2017 · Attention Is All You Need', s.ease('vaswani', 0.6));
  },
};

// ---- share the width: h heads, each d / h wide

const N = 8;
const PITCH = 12;
const hx = (s: Scene, i: number) => s.w / 2 + (i - (N - 1) / 2) * PITCH * s.u;

/** Each head's 3 by 3 pattern of weights: every head looks somewhere else. */
const PATTERNS: number[][][] = [
  [[1, 0, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [0, 0, 1], [0, 1, 0]],
  [[1, 0, 0], [1, 0, 0], [1, 0, 0]],
  [[0.4, 0.3, 0.3], [0.3, 0.4, 0.3], [0.3, 0.3, 0.4]],
  [[0, 1, 0], [0, 0, 1], [0, 0, 1]],
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]],
  [[0, 1, 0], [0, 1, 0], [0, 1, 0]],
];

/** The token vector x as one long bar of d = 512 numbers. */
function xbar(s: Scene, y: number, w: number): void {
  const u = s.u;
  s.rrect(s.w / 2 - (w / 2) * u, y - 3 * u, w * u, 6 * u, 1.2, { fill: s.tint('orange', 0.18), stroke: s.tint('orange', 0.7), lw: 0.3 });
  s.text('x: d = 512 numbers', s.w / 2, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
}

const split: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const bar = s.h * 0.08;
    xbar(s, bar, 92);
    const y = s.h * 0.34;
    for (let i = 0; i < N; i++) {
      s.alpha(s.ease('h', 0.5, 1 + 0.2 * i), () => {
        s.line(cx, bar + 3 * u, hx(s, i), y - 8 * u, s.tint('--ink-3', 0.6), 0.25);
        s.text(String(i), hx(s, i), y - 6.5 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-3'), halo: true });
        heat(s, hx(s, i) - 3.5 * u, y - 3.5 * u, 3, 3.5, (a, b) => PATTERNS[i]![a]![b]!, 'green');
      });
    }
    s.alpha(s.ease('h', 0.6, 3), () => s.text('h = 8 heads', cx, s.h * 0.19, { size: 3.3, font: 'mono', weight: 600, color: s.c('slate'), halo: true }));

    const w = s.ease('dhead', 0.6);
    s.alpha(w, () => {
      const yc = s.h * 0.48;
      for (let i = 0; i < N; i++) {
        s.rrect(hx(s, i) - 4.5 * u, yc - 2.5 * u, 9 * u, 5 * u, 1, { fill: s.tint('teal', 0.25), stroke: s.tint('teal', 0.7), lw: 0.3 });
        s.text('64', hx(s, i), yc + 0.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('teal') });
      }
      const o = { size: s.tall ? 3.2 : 3.4, weight: 600 };
      s.alpha(s.ease('dhead', 0.6, 2.5) * (1 - s.ease('dk', 0.5)), () => rich(s, [['d_head = d / h = 512 / 8 = ', '--ink-2'], ['64', 'teal']], cx, s.h * 0.57, o));
      s.alpha(s.ease('dk', 0.6, 0.3), () => rich(s, [['d_head = ', '--ink-2'], ['64', 'teal'], [': the dₖ of Vaswani\'s model', '--ink-2']], cx, s.h * 0.57, o));
    });

    // One head's matrices: W_Q wide and short, Q, K and V one row per token, and the T by T weights.
    const ry = s.h * 0.76;
    const ly = s.h * 0.9;
    const lab = { size: 3, font: 'mono' as const, weight: 600 };
    const wq = s.ease('wq', 0.6, 0.6);
    s.alpha(wq * (1 - 0.5 * s.ease('qkv', 0.5)), () => {
      const x0 = cx - (s.tall ? 46 : 52) * u;
      const ww = 36 * u;
      s.rrect(x0, ry - 2.25 * u, ww, 4.5 * u, 0.8, { fill: s.tint('blue', 0.2), stroke: s.tint('blue', 0.8), lw: 0.35 });
      s.text('512', x0 + ww / 2, ry - 5 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
      s.text('64', x0 - 1.5 * u, ry, { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
      const wl = sub(s, 'W', 'Q', x0, ly, { k: 'blue', align: 'left', size: 3 });
      s.text(' (64, 512)', x0 + wl, ly, { ...lab, align: 'left', color: s.c('blue') });
    });
    s.alpha(s.ease('qkv', 0.6, 0.3) * (1 - 0.5 * s.ease('A', 0.5)), () => {
      const x = cx + 2 * u;
      const cols: Ink[] = ['teal', 'purple', 'gold'];
      cols.forEach((k, j) => s.rrect(x - 7.5 * u + j * 5.5 * u, ry - 7 * u, 4.5 * u, 14 * u, 0.8, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.8), lw: 0.35 }));
      s.text('Q, K, V: (T, 64)', x, ly, { ...lab, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('A', 0.6, 0.3), () => {
      const x = cx + (s.tall ? 37 : 40) * u;
      heat(s, x - 5.25 * u, ry - 5.25 * u, 4, 3.5, (a, b) => [0.7, 0.4, 0.2, 0.5][(a + 3 * b) % 4]!, 'green');
      s.text('A: (T, T)', x, ly, { ...lab, color: s.c('green') });
    });
  },
};

// ---- join, then mix; then count the weights

const join: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const top = 1 - s.ease('stack', 0.6);
    s.alpha(top, () => {
      const cat = s.ease('concat', 1.2, 0.8);
      const y = lerp(s.h * 0.1, s.h * 0.16, cat);
      for (let i = 0; i < N; i++) {
        const x = lerp(hx(s, i), cx + (i - (N - 1) / 2) * 9 * u, cat);
        s.rrect(x - 4.5 * u, y - 2.5 * u, 9 * u, 5 * u, cat > 0.95 ? 0.2 : 1, { fill: s.tint('teal', 0.25), stroke: s.tint('teal', 0.7), lw: 0.3 });
        s.text('64', x, y + 0.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('teal') });
      }
      s.alpha(1 - cat, () => s.text('each head: (T, 64)', cx, s.h * 0.2, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      s.alpha(s.ease('concat', 0.6, 2), () => s.text('joined: (T, 512)', cx, s.h * 0.24, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal') }));
      // What adding them up would give instead: one narrow blend.
      s.alpha(s.win('keep', 'wo') * after(s, 'keep', 0.25), () => {
        const y1 = s.h * 0.42;
        s.rrect(cx - 4.5 * u, y1 - 2.5 * u, 9 * u, 5 * u, 1, { fill: s.tint('teal', 0.4), stroke: s.tint('teal', 0.8), lw: 0.3 });
        s.text('64', cx, y1 + 0.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('teal') });
        const msg = 'added up: one blend, (T, 64)';
        const w = s.measure(msg, { size: 3.2 }) + 4.5 * u;
        verdict(s, false, msg, cx - w / 2, s.h * 0.52, 3.2);
      });
      s.alpha(s.ease('wo', 0.6), () => {
        s.arrow(cx, s.h * 0.28, cx, s.h * 0.33, s.c('--ink-3'), 0.35, 2);
        s.rrect(cx - 16 * u, s.h * 0.39 - 4 * u, 32 * u, 8 * u, 1.4, { fill: s.tint('blue', 0.14), stroke: s.tint('blue', 0.7), lw: 0.35 });
        const w = sub(s, 'W', 'O', cx - 13 * u, s.h * 0.39, { k: 'blue', align: 'left', size: 3.4 });
        s.text(' (512, 512)', cx - 13 * u + w, s.h * 0.39, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
        s.arrow(cx, s.h * 0.39 + 4.5 * u, cx, s.h * 0.5 - 3.5 * u, s.c('--ink-3'), 0.35, 2);
        s.rrect(cx - 36 * u, s.h * 0.5 - 2.5 * u, 72 * u, 5 * u, 1, { fill: s.tint('green', 0.2), stroke: s.tint('green', 0.7), lw: 0.3 });
        s.text('out: (T, 512), one row per token', cx, s.h * 0.5 + 0.2 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('green') });
      });
    });

    // Eight W_Q strips, each (64, 512), stack into one d by d square; then the four squares.
    const pack = s.ease('stack', 1.4, 2.2);
    const four = s.ease('four', 1, 0.3);
    const side = lerp(36, 22, four) * u;
    const sx = lerp(cx, columns(s, 4, 26)[0]!, four);
    const sy = lerp(s.h * 0.44, s.h * 0.38, four);
    s.alpha(s.ease('stack', 0.6, 0.4), () => {
      const sh = side / N;
      const gap = lerp(1.6 * u, 0, pack) * (1 - four);
      const tot = side + gap * (N - 1);
      for (let i = 0; i < N; i++) {
        const y0 = sy - tot / 2 + i * (sh + gap);
        s.rrect(sx - side / 2, y0, side, sh, 0.3, { fill: s.tint('blue', 0.18 + 0.04 * (i % 2)), stroke: s.tint('blue', 0.7), lw: 0.25 });
      }
      s.alpha(1 - pack, () => s.text('8 × (64, 512)', sx + side / 2 + 2 * u, sy, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('blue') }));
      s.alpha(pack * (1 - four), () => s.text('(512, 512) = d × d', sx, sy + side / 2 + 4 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('blue') }));
      s.alpha(four, () => sub(s, 'W', 'Q', sx, sy + side / 2 + 4 * u, { k: 'blue', size: 3.2 }));
    });
    s.alpha(four, () => {
      const xs = columns(s, 4, 26);
      const names = ['K', 'V', 'O'];
      names.forEach((n, j) => s.alpha(s.ease('four', 0.6, 1 + 0.6 * j), () => {
        const x = xs[j + 1]!;
        s.rrect(x - side / 2, sy - side / 2, side, side, 0.6, { fill: s.tint('blue', 0.18), stroke: s.tint('blue', 0.7), lw: 0.3 });
        sub(s, 'W', n, x, sy + side / 2 + 4 * u, { k: 'blue', size: 3.2 });
      }));
      s.alpha(after(s, 'four', 0.5), () => rich(s, [['4d² = 4 × 512² = ', '--ink-2'], ['1,048,576', '--ink']], cx, s.h * 0.66, { size: s.tall ? 3.3 : 3.5, weight: 600 }));
    });
    s.alpha(s.ease('same', 0.6), () => caption(s, 'one head of width 512: the same 4d²', s.h * 0.76, 'green'));
    const cy = s.h * 0.89;
    s.alpha(s.win('keep', 'wo') * after(s, 'keep', 0.3), () => caption(s, 'side by side, not added: each keeps its columns', cy, '--ink-2', s.tall ? 2.9 : 3.2));
    s.alpha(s.ease('tried', 0.6), () => caption(s, '1 head: worse · too many: worse', cy));
    cite(s, 'Vaswani et al., 2017 · Table 3', s.ease('tried', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { blend, split, join };
