import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
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

const patches: SceneDef = {
  marks: {
    f: { tex: String.raw`N = \left(\frac{H}{P}\right)^{2}`, x: 0.5, y: 0.88, size: 5 },
    g: { tex: String.raw`N = \frac{H}{P} \cdot \frac{W}{P}`, x: 0.5, y: 0.86, size: 5 },
  },
  draw(s) {
    const rect = s.ease('rect', 0.7);
    s.alpha(1 - rect, () => square(s, 1 - rect));
    s.alpha(rect, () => rectangle(s));
    s.show('g', s.ease('rect', 0.6, 6));
  },
};

/** The 32 by 32 picture cut into 16 patches, numbered, with the count and the formula. */
function square(s: Scene, vis: number): void {
  const u = s.u;
  const px = 1.75;
  const cx = s.w / 2;
  const cy = s.h * 0.33;
  const g = picture(s, cx, cy, px, IMG);
  const side = 32 * g.p;
  const cut = s.ease('cut', 0.8);
  s.alpha(cut, () => {
    for (let k = 1; k < 4; k++) {
      s.line(g.l + k * 8 * g.p, g.t, g.l + k * 8 * g.p, g.t + side, s.c('--card'), 0.7);
      s.line(g.l, g.t + k * 8 * g.p, g.l + side, g.t + k * 8 * g.p, s.c('--card'), 0.7);
    }
  });
  s.rrect(g.l, g.t, side, side, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
  // Patch numbers appear in reading order.
  for (let k = 0; k < 16; k++) {
    const a = s.ease('count', 0.3, 0.6 + k * 0.18);
    s.alpha(a, () => s.text(String(k), g.l + ((k % 4) + 0.5) * 8 * g.p, g.t + (Math.floor(k / 4) + 0.5) * 8 * g.p, { size: 3.4, font: 'mono', weight: 700, color: s.c('--ink'), halo: true }));
  }
  const tx = s.w / 2;
  const ty = [g.t + side + 6 * u, g.t + side + 13 * u, g.t + side + 20 * u];
  const o = { size: 3.8, font: 'mono', weight: 600, halo: true } as const;
  s.text('32 × 32 pixels, 3 colors', tx, ty[0]!, { ...o, color: s.c('orange') });
  s.alpha(cut, () => s.text('patch: P × P, P = 8', tx, ty[1]!, { ...o, color: s.c('slate') }));
  s.alpha(s.ease('count', 0.6, 0.3), () => s.text('32 / 8 = 4 per side: 16', tx, ty[2]!, { ...o, color: s.c('blue') }));
  const fa = s.ease('formula', 0.6);
  s.show('f', fa * vis, { x: 0.5 - 22 / (s.w / u), y: 0.9 });
  s.alpha(fa, () => s.text('(224 / 16)² = 196', s.w / 2 + 18 * u, s.h * 0.9, { ...o, color: s.c('blue') }));
}

/** A 128 by 192 image as its grid of 16-pixel patches: 8 down, 12 across. */
function rectangle(s: Scene): void {
  const u = s.u;
  const cell = 4.4 * u;
  const l = s.w / 2 - 6 * cell;
  const t = s.h * 0.1;
  const o = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
  const shown = Math.floor(96 * s.ease('rect', 2.2, 2.4));
  for (let k = 0; k < 96; k++) {
    const i = Math.floor(k / 12);
    const j = k % 12;
    s.rrect(l + j * cell, t + i * cell, cell, cell, 0.2, { fill: s.tint(k < shown ? 'blue' : 'slate', k < shown ? 0.3 : 0.12), stroke: s.tint('--ink-3', 0.6), lw: 0.2 });
  }
  s.text('192 px', s.w / 2, t - 3 * u, { ...o, color: s.c('orange') });
  s.text('128 px', l - 2 * u, t + 4 * cell, { ...o, align: 'right', color: s.c('orange') });
  const y = t + 8 * cell;
  s.alpha(s.ease('rect', 0.6, 2.4), () => s.text('down: 128 / 16 = 8', s.w / 2, y + 6 * u, { ...o, color: s.c('slate') }));
  s.alpha(s.ease('rect', 0.6, 3.6), () => s.text('across: 192 / 16 = 12', s.w / 2, y + 13 * u, { ...o, color: s.c('slate') }));
  s.alpha(s.ease('rect', 0.6, 4.8), () => s.text('8 × 12 = 96 patches', s.w / 2, y + 20 * u, { ...o, color: s.c('blue') }));
}

/** A strip of `vals.length` thin segments, `w` stage units wide, tinted by channel in turn. */
function strip(s: Scene, cx: number, cy: number, w: number, h: number, vals: number[], inks: ('red' | 'green' | 'blue' | 'gold')[], upto = 1): void {
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

const flatten: SceneDef = {
  draw(s) {
    const u = s.u;
    const W = 92;
    const Y = [0.13, 0.27, 0.37, 0.56, 0.72, 0.88].map((f) => s.h * f);
    const px = 2;
    const gap = 8 * px + 5;
    const inks = ['red', 'green', 'blue'] as const;
    const names = ['R', 'G', 'B'];
    ([0, 1, 2] as const).forEach((k) => {
      const x = s.w / 2 + (k - 1) * gap * u;
      const vals = CHANNEL(k);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        s.ctx.fillStyle = s.tint(inks[k], 0.12 + 0.85 * vals[i]![j]!);
        s.ctx.fillRect(x - 4 * px * u + j * px * u, Y[0]! - 4 * px * u + i * px * u, px * u + 0.4, px * u + 0.4);
      }
      s.rrect(x - 4 * px * u, Y[0]! - 4 * px * u, 8 * px * u, 8 * px * u, 0.4, { stroke: s.c(inks[k]), lw: 0.3 });
      s.text(names[k]!, x - 4 * px * u - 2.4 * u, Y[0]!, { size: 3.2, font: 'mono', weight: 700, color: s.c(inks[k]) });
    });
    const o = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    s.text('8 × 8 × 3 = 192 numbers', s.w / 2, Y[1]!, { ...o, color: s.c('orange') });
    const fl = s.ease('flat', 1.6, 0.3);
    s.alpha(s.ease('flat', 0.4), () => {
      strip(s, s.w / 2, Y[2]!, W, 3.6, ROW, ['red', 'green', 'blue'], fl);
      s.text('row: P² · C = 192', s.w / 2, Y[2]! + 5 * u, { ...o, size: 3.2, color: s.c('--ink-2') });
    });
    const em = s.ease('embed', 0.6);
    s.alpha(em, () => {
      s.arrow(s.w / 2, Y[2]! + 8 * u, s.w / 2, Y[3]! - 5 * u, s.c('--ink-3'), 0.35, 2);
      block(s, s.w / 2, Y[3]!, 44, 9, 'E: 192 × 64, + bias', 'blue', { on: s.win('shared', 'conv'), size: 3.4 });
      s.arrow(s.w / 2, Y[3]! + 5 * u, s.w / 2, Y[4]! - 3.2 * u, s.c('--ink-3'), 0.35, 2);
    });
    s.alpha(s.ease('embed', 0.6, 1.2), () => {
      strip(s, s.w / 2, Y[4]!, W * 0.42, 3.6, TOKEN, ['gold']);
      s.text('token: d = 64', s.w / 2 + (W * 0.21 + 2) * u, Y[4]!, { ...o, size: 3.2, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.win('shared', 'conv'), () => caption(s, '192 × 64 + 64 = 12,352, for every patch', Y[5]!, 'blue', 3.4));
    s.alpha(s.ease('conv', 0.6), () => caption(s, '= 64 filters of 8 × 8 × 3, stride 8', Y[5]!, 'slate', 3.4));
  },
};

const sequence: SceneDef = {
  draw(s) {
    const u = s.u;
    const sx = s.w / 2 - 8 * u;
    const top = s.h * 0.12;
    const pitch = 3 * u;
    const emb = s.ease('tokens', 1);
    const wide = 60;
    const rw = (wide + (34 - wide) * emb) * u;
    const rh = pitch * 0.7;
    const cls = s.ease('cls', 0.8);
    const shift = cls * pitch;
    const rowAt = (k: number) => top + shift + k * pitch;
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
    s.alpha(cls, () => {
      const y = top;
      s.rrect(sx - rw / 2, y - rh / 2, rw, rh, 0.4, { fill: s.tint('purple', 0.35), stroke: s.c('purple'), lw: 0.35 });
      s.text('cls', sx - rw / 2 - 2.4 * u, y, { size: 3, font: 'mono', weight: 700, align: 'right', color: s.c('purple') });
    });
    const bottom = rowAt(15) + rh / 2;
    const o = { size: 3.6, font: 'mono', weight: 650, halo: true } as const;
    const lx = sx + rw / 2 + 3 * u;
    s.alpha(grow * (1 - emb), () => s.text('(16, 192)', lx, (top + bottom) / 2, { ...o, align: 'left', color: s.c('orange') }));
    s.alpha(emb * (1 - cls), () => s.text('(16, 64)', lx, (top + bottom) / 2, { ...o, align: 'left', color: s.c('gold') }));
    s.alpha(cls, () => s.text('(17, 64)', lx, (top + bottom) / 2, { ...o, align: 'left', color: s.c('purple') }));
    s.alpha(grow * (1 - emb), () => s.text('192 numbers per patch', sx, top - pitch * 1.1, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(emb, () => s.text('64 numbers per token', sx, top - pitch * 1.1, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    // Transformer blocks, then the classifier on the class token.
    const bA = s.ease('blocks', 0.6);
    const by = bottom + 11 * u;
    const bx = sx;
    s.alpha(bA, () => {
      s.arrow(sx, bottom + 1.5 * u, sx, by - 5 * u, s.c('--ink-3'), 0.35, 2);
      block(s, bx, by, 30, 9, 'transformer blocks', 'blue', { size: 3.4, sub: '(17, 64) in, (17, 64) out', on: s.win('blocks', 'read') });
    });
    const rA = s.ease('read', 0.6);
    const ry = by + 15 * u;
    s.alpha(rA, () => {
      s.arrow(bx, by + 5.5 * u, bx, ry - 4.5 * u, s.c('purple'), 0.45, 2.2);
      s.text('class token', bx + 2 * u, (by + ry) / 2, { size: 3, font: 'mono', align: 'left', color: s.c('purple'), halo: true });
      block(s, bx, ry, 34, 8, 'linear classifier → s', 'purple', { size: 3.4, on: 1 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { patches, flatten, sequence };
