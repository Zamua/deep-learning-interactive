import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { block, caption, picture } from '../../generative/draw';
import { chips, row, rowWidth } from '../../post-training/draw';

type RGB = [number, number, number];

/** A 24 by 24 picture, one color per patch: sky, sun, hills and a house. */
const IMG24: string[][] = Array.from({ length: 24 }, (_, i) =>
  Array.from({ length: 24 }, (_, j) => {
    const hill = 15.5 + 2.2 * Math.cos((j - 4) / 3.8) + (j > 13 ? 1.1 * Math.sin((j - 13) / 2.3) : 0);
    let c: RGB;
    if (i > hill) c = i > 20 ? [70, 135, 60] : [92, 160, 78];
    else if (j >= 4 && j <= 8 && i >= 11 && i <= hill + 1) c = i < 13 ? [150, 60, 50] : j === 6 && i >= 14 ? [90, 60, 40] : [205, 95, 70];
    else if (Math.hypot(i - 4.5, j - 15) < 2.8) c = [250, 205, 70];
    else c = [Math.round(105 + 4.5 * i), Math.round(165 + 3 * i), Math.round(230 + 1 * i)];
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }),
);

/** A fixed pseudo-random strip pattern, `n` values in [0, 1]. */
const pattern = (n: number, seed: number) => Array.from({ length: n }, (_, i) => 0.5 + 0.45 * Math.sin(i * 2.1 + seed) * Math.cos(i * 0.7 + seed * 1.3));
const SHORT = pattern(24, 1);
const LONG = pattern(64, 2);

/** A vector drawn as a thin striped bar, `w` stage units long, centered on (cx, cy). */
function strip(s: Scene, cx: number, cy: number, w: number, vals: number[], k: Ink, o: { h?: number; upto?: number } = {}): void {
  const h = (o.h ?? 3.4) * s.u;
  const seg = (w * s.u) / vals.length;
  const l = cx - (w * s.u) / 2;
  const shown = Math.floor(vals.length * clamp01(o.upto ?? 1));
  for (let i = 0; i < shown; i++) {
    s.ctx.fillStyle = s.tint(k, 0.15 + 0.75 * vals[i]!);
    s.ctx.fillRect(l + i * seg, cy - h / 2, seg + 0.4, h);
  }
  s.rrect(l, cy - h / 2, w * s.u, h, 0.4, { stroke: s.tint(k, 0.8), lw: 0.25 });
}

const mono = (size: number, k: string, o: { align?: CanvasTextAlign; weight?: number } = {}) => ({ size, font: 'mono' as const, weight: o.weight ?? 600, align: o.align, color: k, halo: true });

// ---- two trained models, and two ways to join them

const PROMPT = ['img', 'img', '⋯', 'img', 'What', 'is', 'it', '?'];

const join: SceneDef = {
  draw(s) {
    const u = s.u;
    const fl = s.win('flamingo', 'llava');
    const ll = s.ease('llava', 0.8);
    const vx = s.w * 0.27;
    const lx = s.w * 0.72;
    const by = s.h * 0.45;
    // The picture and the vision transformer.
    const px = s.tall ? 1 : 1.05;
    const py = s.h * 0.17;
    picture(s, vx, py, px, IMG24);
    s.rrect(vx - 12 * px * u, py - 12 * px * u, 24 * px * u, 24 * px * u, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
    s.arrow(vx, py + (12 * px + 1.5) * u, vx, by - 8.5 * u, s.c('--ink-3'), 0.35, 2);
    const vw = 34;
    block(s, vx, by, vw, 14, 'vision', 'blue', { sub: 'transformer', size: 3.4, on: s.win('two', 'flamingo') });
    // Its output: one vector per patch.
    s.alpha(s.win('two', 'llava') * (1 - fl), () => {
      for (let k = 0; k < 3; k++) strip(s, vx, by + (11 + 4.6 * k) * u, 18, SHORT.map((v, i) => (v + 0.13 * k * i) % 1), 'orange', { h: 2.8 });
      s.text('vectors', vx, by + 26 * u, mono(3, s.c('orange')));
    });

    // The language model: a stack of layers, with the reply above it.
    const lw = 32;
    const lh = 38;
    const top = by - (lh / 2) * u;
    s.rrect(lx - (lw / 2) * u, top, lw * u, lh * u, 1.6, { fill: s.tint('purple', 0.08), stroke: s.tint('purple', 0.6), lw: 0.35 });
    s.text('language model', lx, top + 4.5 * u, mono(3.2, s.c('purple'), { weight: 650 }));
    const ly = (i: number) => top + (11 + i * 7.6) * u;
    for (let i = 0; i < 4; i++) s.rrect(lx - 12 * u, ly(i) - 1.8 * u, 24 * u, 3.6 * u, 0.8, { fill: s.tint('purple', 0.22), stroke: s.tint('purple', 0.5), lw: 0.2 });
    s.alpha(s.ease('two', 0.6, 2), () => s.text('a house on a hill', lx, top - 5 * u, mono(3.1, s.c('purple'), { weight: 500 })));
    s.arrow(lx, top - 0.6 * u, lx, top - 2.6 * u, s.c('--ink-3'), 0.3, 1.4);
    s.alpha(s.win('two', 'flamingo') * s.ease('two', 0.6, 9), () => s.text('?', (vx + (vw / 2) * u + lx - (lw / 2) * u) / 2, by, { size: 9, font: 'display', weight: 600, color: s.c('red') }));

    // Flamingo: both frozen, with new attention layers between the language model's own.
    s.alpha(fl, () => {
      for (let i = 0; i < 3; i++) {
        const y = (ly(i) + ly(i + 1)) / 2;
        const g = s.ease('flamingo', 0.6, 4 + 0.4 * i);
        s.alpha(g, () => {
          s.rrect(lx - 9 * u, y - 1.1 * u, 18 * u, 2.2 * u, 0.6, { fill: s.tint('green', 0.55), stroke: s.c('green'), lw: 0.25 });
          s.line(vx + (vw / 2) * u, by + (i - 1) * 2 * u, lx - 9 * u, y, s.tint('green', 0.7), 0.25, [1, 0.8]);
        });
      }
      s.alpha(s.ease('flamingo', 0.6, 2), () => {
        s.text('frozen', vx, by + 11 * u, mono(3, s.c('slate')));
        s.text('frozen + new layers', lx, top + (lh + 4) * u, mono(3, s.c('green')));
      });
    });

    // LLaVA: one learned map, and the picture's tokens in the prompt.
    const mx = (vx + (vw / 2) * u + lx - (lw / 2) * u) / 2;
    s.alpha(ll, () => {
      block(s, mx, by, 9, 9, 'W', 'blue', { size: 3.8, on: s.win('llava', 'prompt') });
      s.arrow(vx + (vw / 2 + 0.6) * u, by, mx - 5.5 * u, by, s.c('--ink-3'), 0.35, 1.6);
    });
    const pa = s.ease('prompt', 0.6);
    const size = s.tall ? 2.7 : 3;
    const width = rowWidth(s, PROMPT, size, 1);
    const r = row(s, PROMPT, s.w / 2 - width / 2, size, 1);
    const ry = s.h * 0.86;
    s.alpha(pa, () => {
      s.arrow(mx, by + 5.5 * u, (r.xs[0]! + r.xs[3]!) / 2, ry - 4.5 * u, s.c('--ink-3'), 0.35, 1.6);
      s.arrow((r.xs[4]! + r.xs[7]!) / 2, ry - 4.5 * u, lx, top + (lh + 1) * u, s.c('--ink-3'), 0.35, 1.6);
      chips(s, PROMPT, r, ry, (i) => (i < 4 ? 'gold' : 'purple'), { size, h: 6, a: (i) => clamp01(pa * 6 - i * 0.5) });
      s.text('the prompt: read before the reply', s.w / 2, ry + 6.5 * u, mono(2.9, s.c('--ink-2'), { weight: 500 }));
    });
    cite(s, 'Flamingo · Alayrac et al., 2022', fl);
    cite(s, 'LLaVA · Liu, Li, Wu & Lee, 2023', ll);
  },
};

// ---- the picture as patch vectors

const patches: SceneDef = {
  draw(s) {
    const u = s.u;
    const px = s.tall ? 1.55 : 1.7;
    const side = 24 * px * u;
    const cx = s.w / 2 - (s.tall ? 27 : 32) * u;
    const cy = s.h * 0.4;
    const g = picture(s, cx, cy, px, IMG24);
    const cut = s.ease('cut', 0.8, 1);
    s.alpha(cut * 0.85, () => {
      for (let k = 1; k < 24; k++) {
        s.line(g.l + k * g.p, g.t, g.l + k * g.p, g.t + side, s.tint('--card', 0.7), 0.12);
        s.line(g.l, g.t + k * g.p, g.l + side, g.t + k * g.p, s.tint('--card', 0.7), 0.12);
      }
    });
    s.rrect(g.l, g.t, side, side, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
    const ly = g.t + side + 5 * u;
    s.text('336 × 336 pixels', cx, ly, mono(3.5, s.c('orange')));
    s.alpha(s.ease('cut', 0.6, 1), () => s.text('patches of 14 × 14', cx, ly + 6.5 * u, mono(3.3, s.c('slate'))));
    s.alpha(s.ease('cut', 0.6, 3.5), () => s.text('336 / 14 = 24 per side', cx, ly + 13 * u, mono(3.3, s.c('--ink-2'))));
    s.alpha(s.ease('N', 0.6, 1), () => s.text('N = 24 × 24 = 576', cx, ly + 19.5 * u, mono(3.5, s.c('blue'), { weight: 700 })));
    s.alpha(s.ease('img', 0.6, 2), () => s.text('LLaVA-1.5 · Liu, Li, Li & Lee, 2023', s.w - 5 * u, 5 * u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));

    // The vision transformer and its output: one vector per patch, plus the class token.
    const rx = s.w / 2 + (s.tall ? 25 : 30) * u;
    const by = s.h * 0.16;
    const va = s.ease('vit', 0.6);
    s.alpha(va, () => {
      const half = (s.measure('vision transformer', { size: 3.4, font: 'mono', weight: 650 }) / u + 5) / 2;
      s.arrow(g.l + side + 1.5 * u, g.t + 4 * u, rx - (half + 1.5) * u, by, s.c('--ink-3'), 0.35, 2);
      block(s, rx, by, 28, 11, 'vision transformer', 'blue', { sub: 'already trained', size: 3.4, on: s.win('vit', 'drop') });
    });
    const rows = ['cls', '0', '1', '2', '⋮', '575'];
    const top = s.h * 0.34;
    const pitch = 7.4 * u;
    const drop = s.ease('drop', 0.8);
    const sw = 26;
    s.alpha(s.ease('vit', 0.6, 0.8), () => {
      s.arrow(rx, by + 6.5 * u, rx, top - 7.5 * u, s.c('--ink-3'), 0.35, 2);
      s.text('1,024 numbers each', rx, top - 4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      rows.forEach((r, i) => {
        const y = top + 1.5 * u + i * pitch;
        const cls = i === 0;
        if (r === '⋮') {
          s.text('⋮', rx, y, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
          return;
        }
        s.alpha(cls ? 1 - 0.75 * drop : 1, () => {
          strip(s, rx, y, sw, pattern(24, i + 3), cls ? 'purple' : 'orange');
          s.text(r, rx - (sw / 2 + 2) * u, y, mono(2.8, s.c(cls ? 'purple' : '--ink-3'), { align: 'right' }));
        });
        if (cls) s.alpha(drop, () => s.line(rx - (sw / 2 + 1) * u, y, rx + (sw / 2 + 1) * u, y, s.c('red'), 0.5));
      });
      const sy = top + 1.5 * u + rows.length * pitch + 1 * u;
      s.alpha(1 - drop, () => s.text('(577, 1,024)', rx, sy, mono(3.3, s.c('orange'))));
      s.alpha(drop, () => s.text('(576, 1,024)', rx, sy, mono(3.3, s.c('orange'), { weight: 700 })));
    });
  },
};

// ---- the projection, the prompt, and the room the image takes

const IMG_TOK = ['img 0', 'img 1', '⋯', 'img 575'];
const TEXT_TOK = ['What', 'is', 'this', '?'];

const project: SceneDef = {
  draw(s) {
    const u = s.u;
    const y0 = s.h * 0.14;
    const lx = s.w / 2 - (s.tall ? 36 : 40) * u;
    const mx = s.w / 2 - (s.tall ? 4 : 6) * u;
    const rx = s.w / 2 + (s.tall ? 31 : 34) * u;
    const lw = 10;
    const rw = s.tall ? 34 : 40;
    // A patch vector and a word vector: different lengths.
    strip(s, lx, y0, lw, SHORT, 'orange');
    s.text('patch: 1,024', lx, y0 + 5.5 * u, mono(2.9, s.c('orange')));
    const wa = s.ease('W', 0.6);
    strip(s, rx, y0, rw, LONG, 'gold');
    s.alpha(1 - wa, () => {
      s.text('token: d = 4,096', rx, y0 + 5.5 * u, mono(2.9, s.c('gold')));
      s.alpha(s.ease('width', 0.6, 3), () => s.text('does not fit', (lx + (lw / 2) * u + rx - (rw / 2) * u) / 2, y0, mono(2.9, s.c('red'))));
    });
    s.alpha(wa, () => {
      s.arrow(lx + (lw / 2 + 1.5) * u, y0, mx - 13 * u, y0, s.c('--ink-3'), 0.35, 2);
      block(s, mx, y0, 22, 9, 'W, b', 'blue', { sub: '1,024 → 4,096', size: 3.4, on: Math.max(s.win('W', 'name'), s.win('count', 'mlp')) });
      s.arrow(mx + 13 * u, y0, rx - (rw / 2 + 1.5) * u, y0, s.c('--ink-3'), 0.35, 2);
      s.text('image token: 4,096', rx, y0 + 5.5 * u, mono(2.9, s.c('gold')));
    });
    const cy = s.h * 0.34;
    const off = 1 - s.ease('prompt', 0.6);
    s.alpha(s.win('name', 'count'), () => caption(s, 'a projection: a learned linear map,', cy, 'blue', 3.2));
    s.alpha(s.win('name', 'count') * s.ease('name', 0.6, 1), () => caption(s, 'from one width to another', cy + 6 * u, 'blue', 3.2));
    s.alpha(s.ease('count', 0.6) * off, () => caption(s, '1,024 × 4,096 = 4,194,304 weights', cy, 'blue', 3.3, { weight: 650 }));
    s.alpha(s.ease('count', 0.6, 2) * off * (1 - s.ease('bias', 0.5)), () => caption(s, 'one W for all 576 patches', cy + 6.5 * u, '--ink-3', 3.1));
    s.alpha(s.ease('bias', 0.6, 0.5) * off, () => caption(s, '+ 4,096 biases = 4,198,400', cy + 6.5 * u, 'green', 3.3, { weight: 650 }));
    s.alpha(s.ease('mlp', 0.6) * off, () => {
      caption(s, 'or an MLP: map, activation, map', cy + 14 * u, '--ink-2', 3.1);
      caption(s, '1,024 → 4,096 → 4,096', cy + 20 * u, '--ink-2', 3.1);
    });

    // The prompt: image tokens first, then the text.
    const toks = [...IMG_TOK, ...TEXT_TOK];
    const size = s.tall ? 2.9 : 3.2;
    const gap = 1.2;
    const width = rowWidth(s, toks, size, gap);
    const r = row(s, toks, s.w / 2 - width / 2, size, gap);
    const py = s.h * 0.64;
    const pa = s.ease('prompt', 0.6);
    s.alpha(pa, () => {
      chips(s, toks, r, py, (i) => (i < IMG_TOK.length ? 'gold' : 'purple'), { size, h: 6.4, a: (i) => clamp01(pa * 8 - i * 0.6) });
      s.text('image tokens', (r.xs[0]! + r.xs[IMG_TOK.length - 1]!) / 2, py + 6.5 * u, { size: 2.7, font: 'mono', color: s.c('gold') });
      s.text('text', (r.xs[IMG_TOK.length]! + r.xs[toks.length - 1]!) / 2, py + 6.5 * u, { size: 2.7, font: 'mono', color: s.c('purple') });
    });
    // A text token attends back to the image tokens.
    const ra = s.ease('prompt', 0.8, 3.5);
    s.alpha(ra, () => {
      const from = r.xs[IMG_TOK.length + 2]!;
      for (const k of [0, 1, 3]) {
        const to = r.xs[k]!;
        const mid = (from + to) / 2;
        const lift = (3 + Math.abs(from - to) / u / 10) * u;
        const c = s.ctx;
        c.beginPath();
        c.moveTo(from, py - 3.6 * u);
        c.quadraticCurveTo(mid, py - 3.6 * u - lift * 2, to, py - 3.6 * u);
        c.strokeStyle = s.tint('purple', 0.75);
        c.lineWidth = 0.3 * u;
        c.stroke();
      }
      s.text('attends to every image token', s.w / 2, s.h * 0.43, { size: 3.2, font: 'mono', color: s.c('purple'), halo: true });
    });

    // The window: image tokens first, and what is left for text.
    const bw = (s.tall ? 88 : 100) * u;
    const L = s.w / 2 - bw / 2;
    const yb = s.h * 0.84;
    s.alpha(s.ease('left', 0.6), () => {
      const hb = 6 * u;
      const split = L + (bw * 576) / 2048;
      s.text('Tₘₐₓ = 2,048 tokens', s.w / 2, yb - 6.5 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      s.rrect(L, yb - hb / 2, bw, hb, 1, { fill: s.tint('purple', 0.22), stroke: s.c('purple'), lw: 0.3 });
      s.rrect(L, yb - hb / 2, split - L, hb, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.3 });
      s.text('image: 576', L, yb + 6.5 * u, mono(2.9, s.c('gold'), { align: 'left' }));
      s.alpha(s.ease('left', 0.6, 3), () => s.text('text: 2,048 − 576 = 1,472', L + bw, yb + 6.5 * u, mono(2.9, s.c('purple'), { align: 'right' })));
    });
  },
};

// ---- two stages of training

/** The three parts in a row, each frozen or training; `trains` lights the ones that learn. */
function parts(s: Scene, y: number, trains: [number, number, number]): void {
  const u = s.u;
  const xs = [s.w / 2 - (s.tall ? 34 : 40) * u, s.w / 2, s.w / 2 + (s.tall ? 34 : 40) * u];
  const names: [string, string][] = [['vision', 'transformer'], ['projection', 'W, b'], ['language', 'model']];
  const w = s.tall ? 29 : 32;
  xs.forEach((x, i) => {
    const t = trains[i]!;
    const k: Ink = t > 0.5 ? 'green' : 'slate';
    s.rrect(x - (w / 2) * u, y - 7 * u, w * u, 14 * u, 1.6, { fill: s.tint(k, 0.1 + 0.18 * t), stroke: s.tint(k, 0.5 + 0.5 * t), lw: 0.35 + 0.2 * t });
    s.text(names[i]![0], x, y - 2.4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
    s.text(names[i]![1], x, y + 2.6 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
    s.text(t > 0.5 ? 'learns' : 'frozen', x, y + 11 * u, { size: 3, font: 'mono', weight: 600, color: s.c(t > 0.5 ? 'green' : '--ink-3') });
  });
  s.arrow(xs[0]! + (w / 2 + 0.6) * u, y, xs[1]! - (w / 2 + 0.6) * u, y, s.c('--ink-3'), 0.35, 1.6);
  s.arrow(xs[1]! + (w / 2 + 0.6) * u, y, xs[2]! - (w / 2 + 0.6) * u, y, s.c('--ink-3'), 0.35, 1.6);
}

const CAPTION = ['[576 image tokens]', 'a', 'dog', 'on', 'a', 'beach'];
const QA = ['[576 image tokens]', 'What', 'is', 'he', 'holding', '?', 'A', 'frisbee'];

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const two = s.ease('s2', 0.8);
    s.alpha(1 - two, () => caption(s, 'stage 1: images with captions', s.h * 0.1, '--ink-2', 3.4, { weight: 650 }));
    s.alpha(two, () => caption(s, 'stage 2: images, questions, answers', s.h * 0.1, '--ink-2', 3.4, { weight: 650 }));
    parts(s, s.h * 0.32, [0, 1, two]);
    const size = s.tall ? 2.6 : 2.9;
    const ty = s.h * 0.66;
    const draw = (toks: string[], from: number, a: number) =>
      s.alpha(a, () => {
        const width = rowWidth(s, toks, size, 1.2);
        const r = row(s, toks, s.w / 2 - width / 2, size, 1.2);
        chips(s, toks, r, ty, (i) => (i === 0 ? 'gold' : i >= from ? 'green' : 'purple'), { size, h: 6.2, on: (i) => (i >= from ? s.ease('loss', 0.6) : 0) });
        s.alpha(s.ease('loss', 0.6, 0.6), () => {
          const x0 = r.xs[from]! - r.ws[from]! / 2;
          const x1 = r.xs[toks.length - 1]! + r.ws[toks.length - 1]! / 2;
          s.line(x0, ty + 5 * u, x1, ty + 5 * u, s.c('green'), 0.35);
          s.text('predicted: next-token loss', Math.min((x0 + x1) / 2, s.w - 4 * u - s.measure('predicted: next-token loss', { size: 2.9, font: 'mono' }) / 2), ty + 9 * u, { size: 2.9, font: 'mono', color: s.c('green'), halo: true });
        });
      });
    draw(CAPTION, 1, s.ease('s1', 0.6, 0.8) * (1 - two));
    draw(QA, 6, two);
    s.alpha(s.ease('loss', 0.6, 2.5) * (1 - two), () => caption(s, 'only W, b move: they learn its language', s.h * 0.88, 'blue', 3));
    s.alpha(s.ease('tuning', 0.6), () => caption(s, 'instruction tuning', s.h * 0.85, 'green', 3.4, { weight: 650 }));
    s.alpha(s.ease('tuning', 0.6, 2.5), () => caption(s, 'Visual Instruction Tuning · Liu et al., 2023', s.h * 0.92, '--ink-2', 2.9, { italic: true }));
  },
};

export const scenes: Record<string, SceneDef> = { join, patches, project, train };
