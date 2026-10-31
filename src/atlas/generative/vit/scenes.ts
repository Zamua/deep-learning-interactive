import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { block, caption, picture } from '../draw';

type RGB = [number, number, number];

/** A 32 by 32 picture: sky, sun, a house and hills. */
const RGB32: RGB[][] = Array.from({ length: 32 }, (_, i) =>
  Array.from({ length: 32 }, (_, j): RGB => {
    const hill = 21 + 3 * Math.cos((j - 6) / 5) + (j > 18 ? 1.5 * Math.sin((j - 18) / 3) : 0);
    if (i > hill) return i > 27 ? [70, 135, 60] : [92, 160, 78];
    if (j >= 5 && j <= 11 && i >= 15 && i <= hill + 1) {
      if (i < 17) return [150, 60, 50];
      return j === 8 && i >= 19 ? [90, 60, 40] : [205, 95, 70];
    }
    if (Math.hypot(i - 5.5, j - 19.5) < 3.6) return [250, 205, 70];
    const t = i / 20;
    return [Math.round(105 + 70 * t), Math.round(165 + 45 * t), Math.round(230 + 12 * t)];
  }),
);
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
const IMG = RGB32.map((r) => r.map(css));
/** The 16 patches of 8 by 8 pixels, in reading order. */
const CROPS: string[][][] = Array.from({ length: 16 }, (_, k) => IMG.slice(Math.floor(k / 4) * 8, Math.floor(k / 4) * 8 + 8).map((r) => r.slice((k % 4) * 8, (k % 4) * 8 + 8)));
/** The patch at rows 0..7, columns 16..23: the one with the sun. */
const PATCH = RGB32.slice(0, 8).map((r) => r.slice(16, 24));
const CHANNEL = (k: 0 | 1 | 2) => PATCH.map((r) => r.map((p) => p[k] / 255));
const ROW: number[] = PATCH.flat().flatMap((p) => [p[0] / 255, p[1] / 255, p[2] / 255]);
/** Every patch flattened to its 192 values, in reading order. */
const ROWS: number[][] = Array.from({ length: 16 }, (_, k) =>
  RGB32.slice(Math.floor(k / 4) * 8, Math.floor(k / 4) * 8 + 8).flatMap((r) => r.slice((k % 4) * 8, (k % 4) * 8 + 8).flatMap((p) => [p[0] / 255, p[1] / 255, p[2] / 255])),
);
/** Each patch's mean color, for the token swatches. */
const MEAN: string[] = Array.from({ length: 16 }, (_, k) => {
  const r0 = Math.floor(k / 4) * 8;
  const c0 = (k % 4) * 8;
  const acc = [0, 0, 0];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) RGB32[r0 + i]![c0 + j]!.forEach((v, c) => (acc[c] += v / 64));
  return css(acc.map(Math.round) as RGB);
});

/** Lines that cut the picture at `g` into `n` by `n` patches. */
function cuts(s: Scene, g: { l: number; t: number; p: number }, n: number, a: number, lw = 0.7): void {
  const side = 32 * g.p;
  s.alpha(a, () => {
    for (let k = 1; k < n; k++) {
      s.line(g.l + (k * side) / n, g.t, g.l + (k * side) / n, g.t + side, s.c('--card'), lw);
      s.line(g.l, g.t + (k * side) / n, g.l + side, g.t + (k * side) / n, s.c('--card'), lw);
    }
  });
}

/** A square grid of `n` by `n` cells, `side` stage units wide: attention's scores. */
function scoreGrid(s: Scene, cx: number, cy: number, side: number, n: number, a: number): void {
  const w = side * s.u;
  const l = cx - w / 2;
  const t = cy - w / 2;
  s.alpha(a, () => {
    s.rrect(l, t, w, w, 0.4, { fill: s.tint('green', 0.16), stroke: s.c('green'), lw: 0.35 });
    for (let k = 1; k < n; k++) {
      s.line(l + (k * w) / n, t, l + (k * w) / n, t + w, s.tint('green', 0.45), 0.15);
      s.line(l, t + (k * w) / n, l + w, t + (k * w) / n, s.tint('green', 0.45), 0.15);
    }
  });
}

const WORDS = ['a', 'house', 'on', 'a', 'hill'];

const pixels: SceneDef = {
  draw(s) {
    const u = s.u;
    // A sentence as a row of tokens, with one token attending to all the others.
    s.alpha(s.ease('words', 0.6) * (1 - s.ease('pixel', 0.6)), () => {
      const o = { size: 3.6, font: 'mono', weight: 650 } as const;
      const ws = WORDS.map((w) => s.measure(w, o) + 4 * u);
      const gap = 2.5 * u;
      const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
      const y = s.h * 0.2;
      let x = s.w / 2 - total / 2;
      const xs = ws.map((w) => {
        const c = x + w / 2;
        x += w + gap;
        return c;
      });
      s.alpha(after(s, 'words', 0.5), () => {
        const c = s.ctx;
        c.strokeStyle = s.tint('green', 0.8);
        c.lineWidth = 0.35 * u;
        xs.forEach((x1, j) => {
          if (j === 1) return;
          c.beginPath();
          c.moveTo(xs[1]!, y - 3 * u);
          c.quadraticCurveTo((xs[1]! + x1) / 2, y - 3 * u - (4 + 0.06 * Math.abs(x1 - xs[1]!) / u) * u, x1, y - 3 * u);
          c.stroke();
        });
      });
      xs.forEach((c, j) => {
        s.rrect(c - ws[j]! / 2, y - 3 * u, ws[j]!, 6 * u, 1, { fill: s.tint('gold', 0.18), stroke: s.c('gold'), lw: 0.3 });
        s.text(WORDS[j]!, c, y, { ...o, color: s.c('--ink') });
      });
    });

    const px = 1.4;
    const cx = s.w * 0.28;
    const cy = s.h * 0.58;
    const fly = (k: number) => after(s, 'vit', 0.05 + k * 0.03, 1);
    const g = { l: cx - 16 * px * u, t: cy - 16 * px * u, p: px * u };
    s.alpha(s.ease('grid', 0.8) * (1 - 0.65 * fly(0)), () => {
      picture(s, cx, cy, px, IMG);
      s.rrect(g.l, g.t, 32 * g.p, 32 * g.p, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
    });
    // Every pixel a token, then 8 by 8 patches.
    s.alpha(s.win('pixel', 'patch'), () => {
      for (let k = 1; k < 32; k++) {
        s.line(g.l + k * g.p, g.t, g.l + k * g.p, g.t + 32 * g.p, s.tint('--card', 0.7), 0.12);
        s.line(g.l, g.t + k * g.p, g.l + 32 * g.p, g.t + k * g.p, s.tint('--card', 0.7), 0.12);
      }
    });
    cuts(s, g, 4, s.ease('patch', 0.8) * (1 - fly(0)));
    const below = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    const by = g.t + 32 * g.p + 5 * u;
    s.alpha(s.win('grid', 'pixel'), () => s.text('32 × 32 pixels, 3 colors', cx, by, { ...below, color: s.c('orange') }));
    s.alpha(s.win('pixel', 'patch'), () => s.text('1,024 tokens', cx, by, { ...below, color: s.c('orange') }));
    s.alpha(s.win('patch', 'vit'), () => s.text('8 × 8 patches: 16 tokens', cx, by, { ...below, color: s.c('blue') }));

    // Attention's grid of scores: T by T.
    const gx = s.w * 0.73;
    const side = 38;
    const many = s.win('cost', 'patch');
    const few = s.win('patch', 'vit');
    scoreGrid(s, gx, cy, side, 32, many);
    scoreGrid(s, gx, cy, side, 16, few * after(s, 'patch', 0.5));
    const top = cy - (side / 2 + 4) * u;
    const bot = by;
    s.alpha(many, () => {
      s.text('T × T scores', gx, top, { ...below, color: s.c('green') });
      s.text('1,024² ≈ 1 million', gx, bot, { ...below, color: s.c('green') });
    });
    s.alpha(few * after(s, 'patch', 0.5), () => {
      s.text('T × T scores', gx, top, { ...below, color: s.c('green') });
      s.text('16 × 16 = 256', gx, bot, { ...below, color: s.c('green') });
    });

    // The patches leave the picture and line up like words.
    const tile = 5.2 * u;
    const step = tile + 0.9 * u;
    const x0 = s.w / 2 - (16 * step - 0.9 * u) / 2 + tile / 2;
    const ry = s.h * 0.92;
    if (s.since('vit') >= 0) {
      for (let k = 0; k < 16; k++) {
        const e = fly(k);
        const fx = g.l + ((k % 4) + 0.5) * 8 * g.p;
        const fy = g.t + (Math.floor(k / 4) + 0.5) * 8 * g.p;
        s.alpha(e > 0.003 ? 1 : 0, () => picture(s, lerp(fx, x0 + k * step, e), lerp(fy, ry, e), lerp(px, 5.2 / 8, e), CROPS[k]!));
      }
    }
    const right = { size: 3.4, font: 'mono', halo: true } as const;
    s.alpha(s.ease('vit', 0.6, 0.8), () => {
      s.text('ViT', gx, s.h * 0.4, { size: 8, font: 'serif', weight: 650, color: s.c('blue') });
      s.text('vision transformer', gx, s.h * 0.49, { ...right, color: s.c('--ink-2') });
    });
    s.alpha(after(s, 'paper', 0.6), () => s.text('1 patch = 1 word', gx, s.h * 0.6, { ...right, weight: 650, color: s.c('blue') }));
    s.alpha(after(s, 'scale', 0.3), () => {
      s.text('with millions of images,', gx, s.h * 0.7, { ...right, color: s.c('--ink-2') });
      s.text('it matched conv nets', gx, s.h * 0.76, { ...right, color: s.c('--ink-2') });
    });
    cite(s, 'Dosovitskiy et al., 2020', s.ease('paper', 0.6));
  },
};

const patches: SceneDef = {
  marks: {
    f: { tex: String.raw`N = \left(\frac{H}{P}\right)^{2}`, x: 0.73, y: 0.82, size: 4.6 },
    g: { tex: String.raw`N = \frac{H}{P} \cdot \frac{W}{P}`, x: 0.73, y: 0.82, size: 4.6 },
  },
  draw(s) {
    const rect = s.ease('rect', 0.7);
    s.alpha(1 - rect, () => square(s));
    s.alpha(rect, () => rectangle(s));
    s.show('f', s.ease('N', 0.6, 1.5) * (1 - rect));
    s.show('g', s.ease('rect', 0.6, 2));
  },
};

/** Text lines in the column right of the picture. */
function line(s: Scene, row: number, text: string, k: 'slate' | 'blue' | 'orange' | '--ink-2' | 'green', a: number): void {
  s.alpha(a, () => s.text(text, s.w * 0.73, s.h * (0.2 + row * 0.1), { size: 3.4, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

/** The 32 by 32 picture cut into patches of 8, then of 16, with the counts beside it. */
function square(s: Scene): void {
  const u = s.u;
  const px = 1.4;
  const cx = s.w * 0.28;
  const cy = s.h * 0.5;
  const g = picture(s, cx, cy, px, IMG);
  const side = 32 * g.p;
  const big = s.ease('p16', 0.8);
  cuts(s, g, 4, 1 - big);
  cuts(s, g, 2, big, 0.9);
  s.rrect(g.l, g.t, side, side, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
  // P across the top of the first patch, H down the left side.
  const pw = side / lerp(4, 2, big);
  s.alpha(s.ease('P', 0.6), () => {
    const y = g.t - 2 * u;
    s.line(g.l, y, g.l + pw, y, s.c('slate'), 0.45);
    s.text('P', g.l + pw / 2, y - 2.6 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('slate') });
  });
  s.alpha(s.ease('side', 0.6), () => {
    const x = g.l - 2 * u;
    s.line(x, g.t, x, g.t + side, s.c('orange'), 0.45);
    s.text('H', x - 1.4 * u, g.t + side / 2, { size: 3.6, font: 'mono', weight: 700, align: 'right', color: s.c('orange') });
  });
  // Patch numbers in reading order: 16 of them, then 4.
  for (let k = 0; k < 16; k++) {
    const a = s.ease('N', 0.3, 0.2 + k * 0.12) * (1 - big);
    s.alpha(a, () => s.text(String(k), g.l + ((k % 4) + 0.5) * 8 * g.p, g.t + (Math.floor(k / 4) + 0.5) * 8 * g.p, { size: 3.2, font: 'mono', weight: 700, color: s.c('--ink'), halo: true }));
  }
  for (let k = 0; k < 4; k++) {
    s.alpha(after(s, 'p16', 0.4 + k * 0.08), () => s.text(String(k), g.l + ((k % 2) + 0.5) * 16 * g.p, g.t + (Math.floor(k / 2) + 0.5) * 16 * g.p, { size: 3.6, font: 'mono', weight: 700, color: s.c('--ink'), halo: true }));
  }
  const small = 1 - big;
  line(s, 0, 'P = 8', 'slate', s.ease('P', 0.6) * small);
  line(s, 1, 'H = 32: 32 / 8 = 4', 'orange', after(s, 'side', 0.5) * small);
  line(s, 2, 'N = 4 × 4 = 16', 'blue', after(s, 'N', 0.2) * small);
  line(s, 0, 'P = 16', 'slate', big);
  line(s, 1, '32 / 16 = 2', 'orange', after(s, 'p16', 0.3));
  line(s, 2, 'N = 2 × 2 = 4', 'blue', after(s, 'p16', 0.6) * (1 - s.ease('big', 0.5)));
  line(s, 3, 'P × 2  →  N ÷ 4', '--ink-2', after(s, 'quarter', 0.1) * (1 - s.ease('big', 0.5)));
  line(s, 4, 'P ÷ 2  →  N × 4', '--ink-2', after(s, 'quarter', 0.55) * (1 - s.ease('big', 0.5)));
  line(s, 2, '224 / 16 = 14', 'orange', after(s, 'big', 0.45));
  line(s, 3, '14² = 196', 'blue', after(s, 'big', 0.7));
}

/** A 128 by 192 picture as its grid of 16-pixel patches: 8 down, 12 across. */
function rectangle(s: Scene): void {
  const u = s.u;
  const cell = 3.7 * u;
  const cx = s.w * 0.28;
  const l = cx - 6 * cell;
  const t = s.h * 0.5 - 4 * cell;
  const o = { size: 3.6, font: 'mono', weight: 700 } as const;
  const shown = Math.floor(96 * clamp01(after(s, 'grid', 0.55, 1.6)));
  for (let k = 0; k < 96; k++) {
    const i = Math.floor(k / 12);
    const j = k % 12;
    s.rrect(l + j * cell, t + i * cell, cell, cell, 0.2, { fill: s.tint(k < shown ? 'blue' : 'slate', k < shown ? 0.3 : 0.12), stroke: s.tint('--ink-3', 0.6), lw: 0.2 });
  }
  s.line(l, t - 2 * u, l + 12 * cell, t - 2 * u, s.c('orange'), 0.45);
  s.text('W', cx, t - 4.6 * u, { ...o, color: s.c('orange') });
  s.line(l - 2 * u, t, l - 2 * u, t + 8 * cell, s.c('orange'), 0.45);
  s.text('H', l - 3.4 * u, t + 4 * cell, { ...o, align: 'right', color: s.c('orange') });
  line(s, 0, 'H = 128, W = 192', 'orange', after(s, 'grid', 0.1));
  line(s, 1, 'down: 128 / 16 = 8', 'slate', after(s, 'grid', 0.4));
  line(s, 2, 'across: 192 / 16 = 12', 'slate', after(s, 'grid', 0.55));
  line(s, 3, '8 × 12 = 96 patches', 'blue', after(s, 'grid', 0.8));
}

/** A strip of `vals.length` thin segments, `w` stage units wide, tinted by channel in turn. */
function strip(s: Scene, cx: number, cy: number, w: number, h: number, vals: number[], inks: ('red' | 'green' | 'blue' | 'gold' | 'slate')[], upto = 1): void {
  const n = vals.length;
  const seg = (w * s.u) / n;
  const l = cx - (w * s.u) / 2;
  const shown = Math.floor(n * clamp01(upto));
  for (let i = 0; i < shown; i++) {
    s.ctx.fillStyle = s.tint(inks[i % inks.length]!, 0.15 + 0.8 * vals[i]!);
    s.ctx.fillRect(l + i * seg, cy - (h * s.u) / 2, seg + 0.4, h * s.u);
  }
  s.rrect(l, cy - (h * s.u) / 2, w * s.u, h * s.u, 0.4, { stroke: s.c('--ink-3'), lw: 0.25 });
}

/** A made-up token: 64 values in [0, 1], fixed. */
const TOKEN = Array.from({ length: 64 }, (_, i) => 0.5 + 0.45 * Math.sin(i * 2.1) * Math.cos(i * 0.7));
/** Made-up position vectors, one per place: 64 values in [0, 1] each. */
const POS = Array.from({ length: 17 }, (_, r) => Array.from({ length: 64 }, (_, i) => 0.5 + 0.45 * Math.sin(i * 0.9 + r * 1.7)));

const flatten: SceneDef = {
  draw(s) {
    const u = s.u;
    const W = 92;
    const Y = [0.14, 0.28, 0.38, 0.55, 0.71, 0.88].map((f) => s.h * f);
    const stack = 1 - s.ease('conv', 0.7);
    s.alpha(stack, () => {
      const px = 2;
      const gap = 8 * px + 5;
      const inks = ['red', 'green', 'blue'] as const;
      const names = ['R', 'G', 'B'];
      ([0, 1, 2] as const).forEach((k) => {
        const x = s.w / 2 + ((k - 0.5) * gap + 2) * u;
        const vals = CHANNEL(k);
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
          s.ctx.fillStyle = s.tint(inks[k], 0.12 + 0.85 * vals[i]![j]!);
          s.ctx.fillRect(x - 4 * px * u + j * px * u, Y[0]! - 4 * px * u + i * px * u, px * u + 0.4, px * u + 0.4);
        }
        s.rrect(x - 4 * px * u, Y[0]! - 4 * px * u, 8 * px * u, 8 * px * u, 0.4, { stroke: s.c(inks[k]), lw: 0.3 });
        s.text(names[k]!, x - 4 * px * u - 2.4 * u, Y[0]!, { size: 3.2, font: 'mono', weight: 700, color: s.c(inks[k]) });
      });
      // The patch itself, in color, split into its three channels.
      const cp = picture(s, s.w / 2 - (1.5 * gap + 2) * u, Y[0]!, px, CROPS[2]!);
      s.rrect(cp.l, cp.t, 8 * cp.p, 8 * cp.p, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
      s.text('=', s.w / 2 - (gap + 1.7) * u, Y[0]!, { size: 4, font: 'mono', color: s.c('--ink-3') });
      const o = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
      s.alpha(after(s, 'one', 0.5), () => s.text('8 × 8 × 3 = 192 numbers', s.w / 2, Y[1]!, { ...o, color: s.c('orange') }));
      const fl = s.ease('flat', 1.6, 0.3);
      s.alpha(s.ease('flat', 0.4), () => {
        strip(s, s.w / 2, Y[2]!, W, 3.6, ROW, ['red', 'green', 'blue'], fl);
        s.text('row: P² · C = 192', s.w / 2, Y[2]! + 5 * u, { ...o, size: 3.2, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('embed', 0.6, 1), () => {
        s.arrow(s.w / 2, Y[2]! + 8 * u, s.w / 2, Y[3]! - 5 * u, s.c('--ink-3'), 0.35, 2);
        block(s, s.w / 2, Y[3]!, 44, 9, 'E: 192 × 64, + bias', 'blue', { on: s.win('shared', 'conv'), size: 3.4 });
      });
      s.alpha(s.ease('d', 0.6), () => {
        s.arrow(s.w / 2, Y[3]! + 5 * u, s.w / 2, Y[4]! - 3.2 * u, s.c('--ink-3'), 0.35, 2);
        strip(s, s.w / 2, Y[4]!, W * 0.42, 3.6, TOKEN, ['gold']);
        s.text('token: d = 64', s.w / 2 + (W * 0.21 + 2) * u, Y[4]!, { ...o, size: 3.2, align: 'left', color: s.c('gold') });
      });
    });
    s.alpha(s.win('shared', 'count'), () => caption(s, 'the same E for every patch', Y[5]!, 'blue', 3.4));
    s.alpha(s.win('count', 'total'), () => caption(s, 'each of 64 outputs: 192 + 1 = 193', Y[5]!, 'blue', 3.4));
    s.alpha(s.win('total', 'conv'), () => caption(s, '64 × 193 = 12,352 parameters', Y[5]!, 'blue', 3.4));

    // The same map as a convolution: a P by P filter that jumps a whole patch at a time.
    const conv = s.ease('conv', 0.7, 0.3);
    s.alpha(conv, () => {
      const px = 1.4;
      const cx = s.w / 2;
      const cy = s.h * 0.45;
      const g = picture(s, cx, cy, px, IMG);
      cuts(s, g, 4, 0.6, 0.35);
      s.rrect(g.l, g.t, 32 * g.p, 32 * g.p, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
      const stop = s.since('stride') < 0 ? 0 : Math.min(15, Math.floor(s.prog('stride') * 18));
      const at = (k: number): [number, number] => [g.l + (k % 4) * 8 * g.p, g.t + Math.floor(k / 4) * 8 * g.p];
      for (let k = 0; k < stop; k++) {
        const [x, y] = at(k);
        s.rrect(x, y, 8 * g.p, 8 * g.p, 0.3, { stroke: s.tint('gold', 0.55), lw: 0.3 });
      }
      const [x, y] = at(stop);
      s.rrect(x, y, 8 * g.p, 8 * g.p, 0.3, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.7 });
    });
    s.alpha(s.win('conv', 'stride'), () => caption(s, '64 filters of 8 × 8 × 3, stride 8', Y[5]!, 'slate', 3.4));
    s.alpha(s.ease('stride', 0.6), () => caption(s, 'stride 8: one stop per patch', Y[5]!, 'gold', 3.4));
  },
};

/** The two patches the bag beat swaps: one of sky, one of grass. */
const SWAP: [number, number] = [1, 13];

const sequence: SceneDef = {
  draw(s) {
    const u = s.u;
    const sx = s.w / 2 - 10 * u;
    const top = s.h * 0.13;
    const pitch = 3 * u;
    const emb = after(s, 'stack', 0.55, 1);
    const wide = 60;
    const rw = (wide + (34 - wide) * emb) * u;
    const rh = pitch * 0.7;
    const cls = s.ease('cls', 0.8);
    const shift = cls * pitch;
    const sw = after(s, 'bag', 0.35, 0.9) * (1 - after(s, 'bag', 0.85, 0.9));
    const slot = (k: number) => (k === SWAP[0] ? lerp(SWAP[0], SWAP[1], sw) : k === SWAP[1] ? lerp(SWAP[1], SWAP[0], sw) : k);
    const rowAt = (k: number) => top + shift + slot(k) * pitch;
    const grow = s.ease('stack', 1.2);
    // The 16 flattened patches, then the 16 tokens they embed to, each with its patch's mean color as a swatch.
    for (let k = 0; k < 16; k++) {
      const a = clamp01(grow * 16 - k);
      s.alpha(a, () => {
        const y = rowAt(k);
        s.ctx.fillStyle = MEAN[k]!;
        s.ctx.fillRect(sx - rw / 2 - rh - 1.2 * u, y - rh / 2, rh, rh);
        s.alpha(1 - emb, () => strip(s, sx, y, rw / u, rh / u, ROWS[k]!, ['red', 'green', 'blue']));
        s.alpha(emb, () => s.rrect(sx - rw / 2, y - rh / 2, rw, rh, 0.4, { fill: s.tint('gold', 0.22), stroke: s.tint('gold', 0.6), lw: 0.25 }));
      });
    }
    s.alpha(sw > 0.01 ? 1 : 0, () => {
      for (const k of SWAP) {
        const y = rowAt(k);
        s.rrect(sx - rw / 2 - rh - 2 * u, y - rh / 2 - 0.5 * u, rw + rh + 3 * u, rh + u, 0.6, { stroke: s.c('red'), lw: 0.4 });
      }
    });
    s.alpha(cls, () => {
      s.rrect(sx - rw / 2, top - rh / 2, rw, rh, 0.4, { fill: s.tint('purple', 0.35), stroke: s.c('purple'), lw: 0.35 });
      s.text('cls', sx - rw / 2 - 2.4 * u, top, { size: 3, font: 'mono', weight: 700, align: 'right', color: s.c('purple') });
    });
    // A learned position vector added to each place, the class token's included.
    const pA = s.ease('pos', 0.6, 0.5);
    const pw = 14 * u;
    const pxc = sx + rw / 2 + 6 * u + pw / 2;
    s.alpha(pA, () => {
      s.text('+', sx + rw / 2 + 3 * u, (top + rowAt(15)) / 2, { size: 4.4, font: 'mono', weight: 700, color: s.c('slate') });
      for (let r = 0; r < 17; r++) {
        s.alpha(clamp01(after(s, 'pos', 0.3, 1.2) * 17 - r), () => strip(s, pxc, top + r * pitch, pw / u, rh / u, POS[r]!, ['slate']));
      }
      s.text('pos', pxc, top - pitch * 1.3, { size: 3, font: 'mono', weight: 650, color: s.c('slate') });
    });
    const bottom = top + 16 * pitch + rh / 2;
    const head = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    const hy = top - pitch * 1.3;
    s.alpha(grow * (1 - clamp01(2 * emb)), () => s.text('(16, 192): a row per patch', sx, hy, { ...head, color: s.c('orange') }));
    s.alpha(clamp01(2 * emb - 1) * (1 - cls), () => s.text('(16, 64): a token per patch', sx, hy, { ...head, color: s.c('gold') }));
    s.alpha(cls, () => s.text('(17, 64)', sx, hy, { ...head, color: s.c('purple') }));
    s.alpha(after(s, 'bag', 0.4) * (1 - s.ease('pos', 0.5)), () => {
      const o = { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true } as const;
      s.text('swapped:', sx + rw / 2 + 3 * u, top + 7 * pitch, o);
      s.text('the same to attention', sx + rw / 2 + 3 * u, top + 8.5 * pitch, o);
    });
    // Transformer blocks, then the classifier on the class token.
    const bA = s.ease('blocks', 0.6);
    const by = Math.min(bottom + 11 * u, s.h - 25 * u);
    s.alpha(bA, () => {
      s.arrow(sx, bottom + 1.5 * u, sx, by - 5 * u, s.c('--ink-3'), 0.35, 2);
      block(s, sx, by, 30, 9, 'transformer blocks', 'blue', { size: 3.4, sub: '(17, 64) in, (17, 64) out', on: s.win('blocks', 'read') });
    });
    const ry = by + 15 * u;
    s.alpha(s.ease('read', 0.6), () => {
      s.arrow(sx, by + 5.5 * u, sx, ry - 4.5 * u, s.c('purple'), 0.45, 2.2);
      s.text('class token', sx + 2 * u, (by + ry) / 2, { size: 3, font: 'mono', align: 'left', color: s.c('purple'), halo: true });
      block(s, sx, ry, 34, 8, 'linear classifier → s', 'purple', { size: 3.4, on: 1 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { pixels, patches, flatten, sequence };
